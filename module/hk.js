// module/hk.js
import { effectiveMeta, effectivePoolMax, effectiveSkill, effectiveStat, effectiveStatHalf } from "./mechanics/effects.js";
import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import { HKWeaponSheet, HKArmorSheet, HKGenericItemSheet } from "./sheets/item-sheets.js";
import { HKContentImporter } from "./content/importer.js";

export const HK = {
  sizeTemplates: {
    small: { key: "small", label: "Мелкий", size: "small", stats: { pow: 2, insight: 3, shell: 3, grace: 4 }, pools: { heart: 6, stam: 3, soul: 3 }, meta: { speed: 7, hunger: -1, hungerStart: -1, hungerMax: 15, fright: 1, appeal: 1.5, marks: 3 } },
    medium: { key: "medium", label: "Средний", size: "medium", stats: { pow: 3, insight: 3, shell: 3, grace: 3 }, pools: { heart: 7, stam: 3, soul: 3 }, meta: { speed: 6, hunger: 4, hungerStart: 4, hungerMax: 20, fright: 1, appeal: 1, marks: 3 } },
    large: { key: "large", label: "Большой", size: "large", stats: { pow: 4, insight: 3, shell: 4, grace: 2 }, pools: { heart: 8, stam: 3, soul: 3 }, meta: { speed: 5, hunger: 9, hungerStart: 9, hungerMax: 25, fright: 1.5, appeal: 1, marks: 3 } }
  },

  itemTypes: ["weapon", "shield", "armor", "focus", "condition", "trait", "path", "art", "spell", "charm", "consumable", "gear"],
  itemTypeLabels: { weapon: "HKRPG.Weapon", shield: "HKRPG.Shield", armor: "HKRPG.Armor", focus: "HKRPG.Focus", condition: "HKRPG.Condition", trait: "HKRPG.Trait", path: "HKRPG.Path", art: "HKRPG.Art", spell: "HKRPG.Spell", charm: "HKRPG.Charm", consumable: "HKRPG.Consumable", gear: "HKRPG.Gear" },

  content: HKContentImporter,
  effectiveStat,
  effectiveStatHalf,
  effectiveSkill,
  effectivePoolMax,
  effectiveMeta,

  distancePenalty(extraSquares) { return Math.max(0, Math.floor(Number(extraSquares) || 0)); },
  clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min; },
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
      "system.pools.heart.value": Math.min(Number(actor.system?.pools?.heart?.value ?? 0), heartMax),
      "system.pools.soul.value": Math.min(Number(actor.system?.pools?.soul?.value ?? 0), soulMax),
      "system.pools.stam.value": Math.min(Number(actor.system?.pools?.stam?.value ?? 0), stamMax),
      "system.pools.supplies.value": Math.min(Number(actor.system?.pools?.supplies?.value ?? 0), suppliesMax),
      "system.pools.essence.value": Math.min(Number(actor.system?.pools?.essence?.value ?? 0), essenceMax),
      "system.pools.satiety.value": Math.min(Number(actor.system?.pools?.satiety?.value ?? 0), satietyMax)
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
    const n = Number(d);
    return Number.isFinite(n) ? n : null;
  },

  getEquippedArmor(actor) {
    const armors = actor.items.filter(i => i.type === "armor");
    const equipped = armors.filter(a => a.system?.equipped !== false);
    const usable = equipped.find(a => (a.system?.defense?.durability?.value ?? 0) > 0);
    return usable ?? equipped[0] ?? armors[0] ?? null;
  },
  sumConditionModifier(actor, key) { return actor.items.filter(i => i.type === "condition").reduce((total, condition) => total + Number(condition.system?.modifiers?.[key] ?? 0), 0); },
  async recoverStamina(actor) { const max = HK.effectivePoolMax(actor, "stam"); await actor.update({ "system.pools.stam.value": max, "system.combat.reactionAvailable": true }); return max; },
  async spendSoul(actor, amount = 1) { const current = Number(actor.system?.pools?.soul?.value ?? 0); const cost = Math.max(0, Number(amount) || 0); if (current < cost) return false; await actor.update({ "system.pools.soul.value": current - cost }); return true; },
  async spendStamina(actor, amount = 1) { const current = Number(actor.system?.pools?.stam?.value ?? 0); const cost = Math.max(0, Number(amount) || 0); if (current < cost) return false; await actor.update({ "system.pools.stam.value": current - cost }); return true; },

  async focusSoul(actor, { soulCost = 1, heal = 1 } = {}) {
    const ok = await HK.spendSoul(actor, soulCost);
    if (!ok) return ui.notifications.warn("Недостаточно Души для Фокусировки.");
    const hp = Number(actor.system?.pools?.heart?.value ?? 0);
    const max = HK.effectivePoolMax(actor, "heart");
    await actor.update({ "system.pools.heart.value": Math.min(max, hp + heal) });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> фокусирует Душу и восстанавливает ${heal} Сердце.` });
    return true;
  },

  async rest(actor, { long = false } = {}) {
    const heart = actor.system?.pools?.heart ?? {};
    const satiety = actor.system?.pools?.satiety ?? {};
    const hunger = Math.max(10, HK.effectiveMeta(actor, "hunger"));
    const heartGain = long ? HK.effectivePoolMax(actor, "heart") : 1;
    const updates = {
      "system.pools.heart.value": Math.min(HK.effectivePoolMax(actor, "heart"), Number(heart.value ?? 0) + heartGain),
      "system.pools.soul.value": HK.effectivePoolMax(actor, "soul"),
      "system.pools.stam.value": HK.effectivePoolMax(actor, "stam"),
      "system.pools.satiety.value": Number(satiety.value ?? 0) - hunger,
      "system.combat.reactionAvailable": true
    };
    await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> отдыхает. Душа и Выносливость восстановлены, Сытость уменьшена на ${hunger}.` });
    return updates;
  },

  async useConsumable(item, actor = item?.actor) {
    if (!item || item.type !== "consumable" || !actor) return ui.notifications.warn("Нужен расходник на листе жука.");
    const qty = Number(item.system?.quantity ?? 1);
    if (qty <= 0) return ui.notifications.warn("Расходник закончился.");
    const satiety = Number(item.system?.satiety ?? 0);
    const satietyMax = HK.effectivePoolMax(actor, "satiety") || Number(actor.system?.pools?.satiety?.max ?? 0);
    const satietyNow = Number(actor.system?.pools?.satiety?.value ?? 0);
    const updates = {};
    if (satiety !== 0) updates["system.pools.satiety.value"] = Math.min(satietyMax, satietyNow + satiety);
    if (!item.system?.reusable) await item.update({ "system.quantity": Math.max(0, qty - 1) });
    if (Object.keys(updates).length) await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> использует <b>${item.name}</b>${satiety ? ` и получает ${satiety} Сытости` : ""}.${item.system?.effect ? `<p>${item.system.effect}</p>` : ""}` });
    return true;
  },

  async useTechnique(item, actor = item?.actor) {
    if (!item || !["art", "spell"].includes(item.type) || !actor) return ui.notifications.warn("Нужно Искусство или Тайна на листе жука.");
    const soulCost = Number(item.system?.cost?.soul ?? 0);
    const stamCost = Number(item.system?.cost?.stam ?? 0);
    if (Number(actor.system?.pools?.soul?.value ?? 0) < soulCost) return ui.notifications.warn("Недостаточно Души.");
    if (Number(actor.system?.pools?.stam?.value ?? 0) < stamCost) return ui.notifications.warn("Недостаточно Выносливости.");
    if (soulCost) await HK.spendSoul(actor, soulCost);
    if (stamCost) await HK.spendStamina(actor, stamCost);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> применяет <b>${item.name}</b>.<p>Стоимость: ${stamCost} Выносливости, ${soulCost} Души.</p>${item.system?.description ? `<p>${item.system.description}</p>` : ""}` });
    return true;
  },

  async toggleEquip(item) {
    if (!item) return;
    const field = item.type === "focus" ? "attuned" : "equipped";
    if (!Object.hasOwn(item.system ?? {}, field)) return ui.notifications.warn("У этого предмета нет переключателя экипировки.");
    await item.update({ [`system.${field}`]: !item.system[field] });
  }
};

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
