// module/hk.js
import { effectiveMeta, effectivePoolMax, effectiveSkill, effectiveStat, effectiveStatHalf } from "./mechanics/effects.js";
import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import { HKWeaponSheet, HKArmorSheet, HKGenericItemSheet } from "./sheets/item-sheets.js";
import { HKContentImporter } from "./content/importer.js";

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function asBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function actorFromUuid(uuid) {
  if (!uuid) return null;
  const doc = await fromUuid(uuid);
  if (doc instanceof Actor) return doc;
  if (doc?.actor instanceof Actor) return doc.actor;
  return null;
}

function uniqueActors(actors) {
  const map = new Map();
  for (const actor of actors.filter(Boolean)) map.set(actor.id, actor);
  return Array.from(map.values());
}

function controlledTokenForActor(actor) {
  const controlled = canvas?.tokens?.controlled ?? [];
  return controlled.find(t => t.actor?.id === actor?.id) ?? actor?.getActiveTokens(true, true)?.[0] ?? null;
}

function selectedTargetActors() {
  const targeted = Array.from(game.user.targets ?? []).map(t => t.actor).filter(Boolean);
  const controlled = Array.from(canvas?.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
  return { targeted: uniqueActors(targeted), controlled: uniqueActors(controlled) };
}

export const HK = {
  sizeTemplates: {
    small: { key: "small", label: "Мелкий", size: "small", stats: { pow: 2, insight: 3, shell: 3, grace: 4 }, pools: { heart: 6, stam: 3, soul: 3 }, meta: { speed: 7, hunger: -1, hungerStart: -1, hungerMax: 15, fright: 1, appeal: 1.5, marks: 3 } },
    medium: { key: "medium", label: "Средний", size: "medium", stats: { pow: 3, insight: 3, shell: 3, grace: 3 }, pools: { heart: 7, stam: 3, soul: 3 }, meta: { speed: 6, hunger: 4, hungerStart: 4, hungerMax: 20, fright: 1, appeal: 1, marks: 3 } },
    large: { key: "large", label: "Большой", size: "large", stats: { pow: 4, insight: 3, shell: 4, grace: 2 }, pools: { heart: 8, stam: 3, soul: 3 }, meta: { speed: 5, hunger: 9, hungerStart: 9, hungerMax: 25, fright: 1.5, appeal: 1, marks: 3 } }
  },

  itemTypes: ["weapon", "shield", "armor", "focus", "condition", "trait", "path", "art", "spell", "charm", "consumable", "gear"],
  itemTypeLabels: { weapon: "HKRPG.Weapon", shield: "HKRPG.Shield", armor: "HKRPG.Armor", focus: "HKRPG.Focus", condition: "HKRPG.Condition", trait: "HKRPG.Trait", path: "HKRPG.Path", art: "HKRPG.Art", spell: "HKRPG.Spell", charm: "HKRPG.Charm", consumable: "HKRPG.Consumable", gear: "HKRPG.Gear" },
  statLabels: { pow: "Мощь", grace: "Грация", shell: "Панцирь", insight: "Проницательность" },
  skillLabels: { soldier: "Солдат", scout: "Разведчик", lore: "Лор", craft: "Ремесло", survival: "Выживание", social: "Общение" },

  content: HKContentImporter,
  effectiveStat,
  effectiveStatHalf,
  effectiveSkill,
  effectivePoolMax,
  effectiveMeta,

  distancePenalty(extraSquares) { return Math.max(0, Math.floor(Number(extraSquares) || 0)); },
  clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min; },
  sizeTemplateOptions() { return Object.values(HK.sizeTemplates).map(template => ({ key: template.key, label: template.label })); },

  async applySizeTemplate(actor, key = "medium") {
    const template = HK.sizeTemplates[key] ?? HK.sizeTemplates.medium;
    const updates = {
      "system.builder.sizeTemplate": template.key,
      "system.meta.size": template.size,
      "system.meta.speed": template.meta.speed,
      "system.meta.hunger": template.meta.hunger,
      "system.meta.fright": template.meta.fright,
      "system.meta.appeal": template.meta.appeal,
      "system.meta.marks.value": template.meta.marks,
      "system.meta.marks.max": template.meta.marks,
      "system.pools.heart.value": template.pools.heart,
      "system.pools.heart.max": template.pools.heart,
      "system.pools.soul.value": template.pools.soul,
      "system.pools.soul.max": template.pools.soul,
      "system.pools.stam.value": template.pools.stam,
      "system.pools.stam.max": template.pools.stam,
      "system.pools.satiety.max": Math.max(10, template.meta.hunger),
      "system.stats.pow.value": template.stats.pow,
      "system.stats.pow.half": 0,
      "system.stats.grace.value": template.stats.grace,
      "system.stats.grace.half": 0,
      "system.stats.shell.value": template.stats.shell,
      "system.stats.shell.half": 0,
      "system.stats.insight.value": template.stats.insight,
      "system.stats.insight.half": 0
    };
    await actor.update(updates);
    ui.notifications.info(`HKRPG: применён шаблон размера «${template.label}».`);
    return updates;
  },

  async syncActorMaximums(actor) {
    const heartMax = HK.effectivePoolMax(actor, "heart");
    const soulMax = HK.effectivePoolMax(actor, "soul");
    const stamMax = HK.effectivePoolMax(actor, "stam");
    const suppliesMax = HK.effectivePoolMax(actor, "supplies");
    const essenceMax = HK.effectivePoolMax(actor, "essence");
    const satietyMax = actor.system?.derived?.character?.satietyMax ?? Math.max(10, HK.effectiveMeta(actor, "hunger"));
    const updates = {
      "system.pools.satiety.max": satietyMax,
      "system.pools.heart.value": Math.min(n(actor.system?.pools?.heart?.value), heartMax),
      "system.pools.soul.value": Math.min(n(actor.system?.pools?.soul?.value), soulMax),
      "system.pools.stam.value": Math.min(n(actor.system?.pools?.stam?.value), stamMax),
      "system.pools.supplies.value": Math.min(n(actor.system?.pools?.supplies?.value), suppliesMax),
      "system.pools.essence.value": Math.min(n(actor.system?.pools?.essence?.value), essenceMax),
      "system.pools.satiety.value": Math.min(n(actor.system?.pools?.satiety?.value), satietyMax)
    };
    await actor.update(updates);
    ui.notifications.info("HKRPG: текущие значения запасов обрезаны по эффективным максимумам.");
    return updates;
  },

  _resultsFromRoll(roll) { const term = roll.terms?.find(t => Array.isArray(t?.results)); return term?.results?.map(r => r.result) ?? []; },
  countSuccesses(roll) { return HK._resultsFromRoll(roll).filter(v => v >= 5).length; },
  hasSix(roll) { return HK._resultsFromRoll(roll).some(v => v === 6); },

  async rollPool({ dice, speaker, flavor }) {
    const d = Math.max(0, Math.floor(Number(dice) || 0));
    const roll = await (new Roll(d > 0 ? `${d}d6` : "0")).evaluate();
    const succ = HK.countSuccesses(roll);
    await roll.toMessage({ speaker, flavor: `${flavor} | успехов: ${succ}` });
    return { roll, succ };
  },

  async rerollOneFailureFromHalf({ roll, speaker, label }) {
    const term = roll.terms?.find(t => Array.isArray(t?.results));
    const idx = term?.results?.findIndex(r => r.result < 5) ?? -1;
    if (idx < 0) return HK.countSuccesses(roll);
    const rr = await (new Roll("1d6")).evaluate();
    const old = term.results[idx].result;
    term.results[idx].result = Math.max(old, rr.total);
    const succ = HK.countSuccesses(roll);
    await rr.toMessage({ speaker, flavor: `Переброс (.5 ${label}): ${old} → ${rr.total}. Итог успехов: ${succ}` });
    return succ;
  },

  getSquaresBetween(tokenA, tokenB) {
    if (!canvas?.grid || !tokenA?.center || !tokenB?.center) return null;
    const d = canvas.grid.measureDistances([{ ray: new Ray(tokenA.center, tokenB.center) }], { gridSpaces: true })?.[0];
    const parsed = Number(d);
    return Number.isFinite(parsed) ? parsed : null;
  },

  getEquippedArmor(actor) {
    const armors = actor.items.filter(i => i.type === "armor");
    const equipped = armors.filter(a => a.system?.equipped !== false);
    const usable = equipped.find(a => (a.system?.defense?.durability?.value ?? 0) > 0);
    return usable ?? equipped[0] ?? armors[0] ?? null;
  },

  sumConditionModifier(actor, key) {
    return actor.items.filter(i => i.type === "condition").reduce((total, condition) => total + n(condition.system?.modifiers?.[key]), 0);
  },

  async applyAttackDamageToActor(targetActor, payload = {}) {
    if (!targetActor) return ui.notifications.warn("Не выбран получатель урона.");
    if (!targetActor.isOwner && !game.user.isGM) return ui.notifications.warn("Нет прав изменять Сердца этой цели.");

    const rawDamage = Math.max(0, n(payload.amount));
    const damageType = String(payload.damageType ?? "physical");
    const ignoreDR = Math.max(0, n(payload.ignoreDR));
    const sourceName = String(payload.sourceName ?? "атака");
    const degradeArmor = asBool(payload.degradeArmor);

    const targetDRRaw = Math.max(0, n(targetActor.system?.derived?.dr));
    const targetDR = Math.max(0, targetDRRaw - ignoreDR);
    let afterDR = rawDamage;
    if (rawDamage > 0) afterDR = Math.max(1, rawDamage - targetDR);

    let absorbSucc = 0;
    if (damageType === "physical" && afterDR > 0) {
      const shellDice = Math.max(0, HK.effectiveStat(targetActor, "shell"));
      const defenseDelta = HK.sumConditionModifier(targetActor, "defenseDiceDelta");
      const res = await HK.rollPool({
        dice: Math.max(0, shellDice + defenseDelta),
        speaker: ChatMessage.getSpeaker({ actor: targetActor }),
        flavor: `Впитывание (Панцирь): ${targetActor.name} (${shellDice} + сост(${defenseDelta}) d6)`
      });
      absorbSucc = res.succ;
    }

    const absorption = Math.max(0, HK.effectiveMeta(targetActor, "absorption"));
    const finalDamage = Math.max(0, afterDR - absorbSucc - absorption);
    const hp = Math.max(0, n(targetActor.system?.pools?.heart?.value));
    await targetActor.update({ "system.pools.heart.value": Math.max(0, hp - finalDamage) });

    if (degradeArmor) {
      const armor = HK.getEquippedArmor(targetActor);
      if (armor) {
        const dv = Math.max(0, n(armor.system?.defense?.durability?.value));
        if (dv > 0) await armor.update({ "system.defense.durability.value": dv - 1 });
      }
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      content: `<div class="hk-chat-card"><h3>HKRPG: урон применён</h3><p><b>${esc(targetActor.name)}</b> получает <b>${finalDamage}</b> урона от <b>${esc(sourceName)}</b>.</p><p class="hk-muted">Сырой урон: ${rawDamage}; после ПУ: ${afterDR}; ПУ: ${targetDR}; впитано: ${absorbSucc}; поглощение: ${absorption}; Сердца: ${hp} → ${Math.max(0, hp - finalDamage)}.</p></div>`
    });

    return { target: targetActor, rawDamage, afterDR, targetDR, absorbSucc, absorption, finalDamage };
  },

  async applyAttackDamageToActors(targetActors, payload = {}) {
    const actors = uniqueActors(Array.isArray(targetActors) ? targetActors : [targetActors]);
    if (!actors.length) return ui.notifications.warn("Нет целей для применения урона.");
    const results = [];
    for (const actor of actors) results.push(await HK.applyAttackDamageToActor(actor, payload));
    return results;
  },

  async handleChatDamageButton(button) {
    const payload = {
      amount: n(button.dataset.amount),
      damageType: button.dataset.damageType ?? "physical",
      ignoreDR: n(button.dataset.ignoreDr),
      degradeArmor: asBool(button.dataset.degradeArmor),
      sourceName: button.dataset.sourceName ?? "атака"
    };

    const mode = button.dataset.mode ?? "stored";
    let actors = [];
    if (mode === "stored") actors = [await actorFromUuid(button.dataset.targetUuid)];
    if (mode === "targeted") actors = selectedTargetActors().targeted;
    if (mode === "controlled") actors = selectedTargetActors().controlled;

    actors = uniqueActors(actors.filter(Boolean));
    if (!actors.length) return ui.notifications.warn("Нет цели. Выбери токен или назначь Target, затем нажми кнопку в чате снова.");
    return HK.applyAttackDamageToActors(actors, payload);
  },

  async rollWeaponAttack(actor, weapon, { sourceToken = null } = {}) {
    if (!actor || !weapon) return ui.notifications.warn("Нужны жук и оружие.");
    const targets = Array.from(game.user.targets ?? []);
    const targetToken = targets.length === 1 ? targets[0] : null;
    const attackerToken = sourceToken ?? controlledTokenForActor(actor);
    const targetActor = targetToken?.actor ?? null;

    const w = weapon.system?.attack ?? {};
    const statKey = w.stat ?? "pow";
    const skillKey = w.skill ?? null;
    const baseDamage = Math.max(0, n(w.damageBase, 1));
    const damageType = String(w.damageType ?? "physical");
    const range = Math.max(0, n(w.range, 1));
    const ignoreDR = Math.max(0, n(weapon.system?.flags?.ignoreDR));

    let distSq = null;
    if (attackerToken && targetToken) distSq = HK.getSquaresBetween(attackerToken, targetToken);
    const autoExtra = distSq == null ? 0 : Math.max(0, distSq - range);
    const autoRangePenalty = HK.distancePenalty(autoExtra);

    const surcharge = Math.max(0, n(actor.system?.derived?.staminaSurcharge));
    const stamTax = Math.max(0, n(weapon.system?.cost?.stamTax) + surcharge);
    const investMax = Math.max(0, n(weapon.system?.cost?.stamInvestMax));
    const currentStam = Math.max(0, n(actor.system?.pools?.stam?.value));
    const maxInvest = Math.min(investMax, Math.max(0, currentStam - stamTax));

    let invested = 0;
    let rangePenalty = autoRangePenalty;

    const content = `
      <div class="hk-dialog-help">
        <p><b>${esc(actor.name)}</b> атакует: <b>${esc(weapon.name)}</b>.</p>
        <p>Цель: <b>${targetActor ? esc(targetActor.name) : "не выбрана"}</b>. ${targetActor ? "Кнопка применения урона будет привязана к этой цели." : "Урон можно будет применить из чата к выбранному или Target-токену."}</p>
        <p>Дальность оружия: <b>${range}</b>. ${distSq == null ? "Дистанция не измерена автоматически." : `Дистанция: <b>${distSq}</b>; штраф дальности: <b>-${autoRangePenalty}</b> куб.`}</p>
        <p>Выносливость: сейчас <b>${currentStam}</b>; налог атаки <b>${stamTax}</b>${surcharge ? `, включая +${surcharge} за перегруз` : ""}.</p>
      </div>
      <div class="form-group"><label>Вложенная выносливость (0..${maxInvest})</label><input id="hkInvest" type="number" value="0" min="0" max="${maxInvest}"/></div>
      <div class="form-group"><label>Штраф дальности</label><input id="hkRangePenalty" type="number" value="${autoRangePenalty}" min="0"/></div>
    `;

    await Dialog.prompt({
      title: `Атака: ${weapon.name}`,
      content,
      label: "Бросить",
      callback: html => {
        invested = HK.clampNumber(html.find("#hkInvest")?.val?.() ?? 0, 0, maxInvest);
        rangePenalty = HK.clampNumber(html.find("#hkRangePenalty")?.val?.() ?? autoRangePenalty, 0, 99);
      }
    });

    const spend = stamTax + invested;
    if (spend > currentStam) return ui.notifications.warn("Недостаточно Выносливости.");
    if (spend > 0) await actor.update({ "system.pools.stam.value": currentStam - spend });

    const statDice = Math.max(0, HK.effectiveStat(actor, statKey));
    const skillDice = skillKey ? Math.max(0, HK.effectiveSkill(actor, skillKey)) : 0;
    const conditionDice = HK.sumConditionModifier(actor, "attackDiceDelta");
    const dice = Math.max(0, statDice + skillDice + invested + conditionDice - rangePenalty);

    const { roll, succ } = await HK.rollPool({
      dice,
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Атака ${weapon.name}: ${HK.statLabels[statKey] ?? statKey}${skillKey ? "+" + (HK.skillLabels[skillKey] ?? skillKey) : ""} + влож(${invested}) + сост(${conditionDice}) - дальн(${rangePenalty}) = ${dice}d6`
    });

    if (succ <= 0) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="hk-chat-card"><h3>Промах: ${esc(weapon.name)}</h3><p><b>${esc(actor.name)}</b> не набирает успехов. Урон не создаётся.</p></div>`
      });
      return { roll, succ, damage: 0 };
    }

    const extraSucc = Math.max(0, succ - 1);
    const addCap = Math.max(baseDamage, invested);
    const addDamage = Math.min(extraSucc, addCap);
    const rawDamage = baseDamage + addDamage;
    const degradeArmor = HK.hasSix(roll);
    const targetUuid = targetActor?.uuid ?? "";
    const targetButton = targetActor ? `<button type="button" class="hk-chat-apply-damage" data-mode="stored" data-target-uuid="${esc(targetUuid)}" data-amount="${rawDamage}" data-damage-type="${esc(damageType)}" data-ignore-dr="${ignoreDR}" data-degrade-armor="${degradeArmor}" data-source-name="${esc(weapon.name)}">Нанести сохранённой цели: ${esc(targetActor.name)}</button>` : "";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="hk-chat-card hk-attack-card">
        <h3>${esc(actor.name)} — атака: ${esc(weapon.name)}</h3>
        <p><b>Попадание:</b> ${succ} успех(ов). <b>Сырой урон до защиты цели:</b> ${rawDamage}.</p>
        <p class="hk-muted">База ${baseDamage}; доп. урон от успехов ${addDamage}/${addCap}; тип ${esc(damageType)}; игнор ПУ ${ignoreDR}; ${degradeArmor ? "есть 6 — броня цели потеряет 1 Прочность при применении" : "6 нет — броня не портится"}.</p>
        <div class="hk-chat-actions">
          ${targetButton}
          <button type="button" class="hk-chat-apply-damage" data-mode="targeted" data-amount="${rawDamage}" data-damage-type="${esc(damageType)}" data-ignore-dr="${ignoreDR}" data-degrade-armor="${degradeArmor}" data-source-name="${esc(weapon.name)}">Нанести текущим Target-целям</button>
          <button type="button" class="hk-chat-apply-damage" data-mode="controlled" data-amount="${rawDamage}" data-damage-type="${esc(damageType)}" data-ignore-dr="${ignoreDR}" data-degrade-armor="${degradeArmor}" data-source-name="${esc(weapon.name)}">Нанести выбранному токену</button>
        </div>
      </div>`
    });

    return { roll, succ, damage: rawDamage, targetActor };
  },

  async recoverStamina(actor) {
    const max = HK.effectivePoolMax(actor, "stam");
    await actor.update({ "system.pools.stam.value": max, "system.combat.reactionAvailable": true });
    return max;
  },

  async spendSoul(actor, amount = 1) {
    const current = n(actor.system?.pools?.soul?.value);
    const cost = Math.max(0, n(amount));
    if (current < cost) return false;
    await actor.update({ "system.pools.soul.value": current - cost });
    return true;
  },

  async spendStamina(actor, amount = 1) {
    const current = n(actor.system?.pools?.stam?.value);
    const cost = Math.max(0, n(amount));
    if (current < cost) return false;
    await actor.update({ "system.pools.stam.value": current - cost });
    return true;
  },

  async focusSoul(actor, { soulCost = 1, heal = 1 } = {}) {
    const ok = await HK.spendSoul(actor, soulCost);
    if (!ok) return ui.notifications.warn("Недостаточно Души для Фокусировки.");
    const hp = n(actor.system?.pools?.heart?.value);
    const max = HK.effectivePoolMax(actor, "heart");
    await actor.update({ "system.pools.heart.value": Math.min(max, hp + heal) });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${esc(actor.name)}</b> фокусирует Душу и восстанавливает ${heal} Сердце.` });
    return true;
  },

  async rest(actor, { long = false } = {}) {
    const heart = actor.system?.pools?.heart ?? {};
    const satiety = actor.system?.pools?.satiety ?? {};
    const hunger = Math.max(10, HK.effectiveMeta(actor, "hunger"));
    const heartGain = long ? HK.effectivePoolMax(actor, "heart") : 1;
    const updates = {
      "system.pools.heart.value": Math.min(HK.effectivePoolMax(actor, "heart"), n(heart.value) + heartGain),
      "system.pools.soul.value": HK.effectivePoolMax(actor, "soul"),
      "system.pools.stam.value": HK.effectivePoolMax(actor, "stam"),
      "system.pools.satiety.value": n(satiety.value) - hunger,
      "system.combat.reactionAvailable": true
    };
    await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${esc(actor.name)}</b> отдыхает. Душа и Выносливость восстановлены, Сытость уменьшена на ${hunger}.` });
    return updates;
  },

  async useConsumable(item, actor = item?.actor) {
    if (!item || item.type !== "consumable" || !actor) return ui.notifications.warn("Нужен расходник на листе жука.");
    const qty = n(item.system?.quantity, 1);
    if (qty <= 0) return ui.notifications.warn("Расходник закончился.");
    const satiety = n(item.system?.satiety);
    const satietyMax = HK.effectivePoolMax(actor, "satiety") || n(actor.system?.pools?.satiety?.max);
    const satietyNow = n(actor.system?.pools?.satiety?.value);
    const updates = {};
    if (satiety !== 0) updates["system.pools.satiety.value"] = Math.min(satietyMax, satietyNow + satiety);
    if (!item.system?.reusable) await item.update({ "system.quantity": Math.max(0, qty - 1) });
    if (Object.keys(updates).length) await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${esc(actor.name)}</b> использует <b>${esc(item.name)}</b>${satiety ? ` и получает ${satiety} Сытости` : ""}.${item.system?.effect ? `<p>${esc(item.system.effect)}</p>` : ""}` });
    return true;
  },

  async useTechnique(item, actor = item?.actor) {
    if (!item || !["art", "spell"].includes(item.type) || !actor) return ui.notifications.warn("Нужно Искусство или Тайна на листе жука.");
    const soulCost = n(item.system?.cost?.soul);
    const stamCost = n(item.system?.cost?.stam);
    if (n(actor.system?.pools?.soul?.value) < soulCost) return ui.notifications.warn("Недостаточно Души.");
    if (n(actor.system?.pools?.stam?.value) < stamCost) return ui.notifications.warn("Недостаточно Выносливости.");
    if (soulCost) await HK.spendSoul(actor, soulCost);
    if (stamCost) await HK.spendStamina(actor, stamCost);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${esc(actor.name)}</b> применяет <b>${esc(item.name)}</b>.<p>Стоимость: ${stamCost} Выносливости, ${soulCost} Души.</p>${item.system?.description ? `<p>${esc(item.system.description)}</p>` : ""}` });
    return true;
  },

  async toggleEquip(item) {
    if (!item) return;
    const field = item.type === "focus" ? "attuned" : "equipped";
    if (!Object.hasOwn(item.system ?? {}, field)) return ui.notifications.warn("У этого предмета нет переключателя экипировки.");
    await item.update({ [`system.${field}`]: !item.system[field] });
  }
};

Hooks.on("renderChatMessage", (_message, html) => {
  html.find?.(".hk-chat-apply-damage")?.on("click", async ev => {
    ev.preventDefault();
    await HK.handleChatDamageButton(ev.currentTarget);
  });
});

function exposeHKApi() {
  const api = {
    HK,
    content: HKContentImporter,
    importContent: () => HKContentImporter.importAll(),
    organizeContent: () => HKContentImporter.organizeContent(),
    importItems: () => HKContentImporter.importItems(),
    importCreatures: () => HKContentImporter.importCreatures(),
    importNpcs: () => HKContentImporter.importNpcs(),
    recoverStamina: actor => HK.recoverStamina(actor),
    focusSoul: (actor, options) => HK.focusSoul(actor, options),
    rest: (actor, options) => HK.rest(actor, options),
    useConsumable: (item, actor) => HK.useConsumable(item, actor),
    useTechnique: (item, actor) => HK.useTechnique(item, actor),
    toggleEquip: item => HK.toggleEquip(item),
    rollWeaponAttack: (actor, weapon, options) => HK.rollWeaponAttack(actor, weapon, options),
    applyAttackDamageToActor: (actor, payload) => HK.applyAttackDamageToActor(actor, payload),
    applySizeTemplate: (actor, key) => HK.applySizeTemplate(actor, key),
    syncActorMaximums: actor => HK.syncActorMaximums(actor)
  };
  game.hk = Object.assign(game.hk ?? {}, api);
  return game.hk;
}

Hooks.once("init", () => {
  console.log("HK-RPG | init");
  exposeHKApi();
  CONFIG.Actor.documentClass = HKActor;
  CONFIG.Item.documentClass = HKItem;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hk-rpg", HKBugSheet, { types: ["bug"], makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hk-rpg", HKWeaponSheet, { types: ["weapon"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKGenericItemSheet, { types: ["shield", "focus", "condition", "trait", "path", "art", "spell", "charm", "consumable", "gear"], makeDefault: true });
});

Hooks.once("ready", () => {
  exposeHKApi();
});
