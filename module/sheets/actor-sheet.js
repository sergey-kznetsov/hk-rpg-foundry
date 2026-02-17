import { HK } from "../hk.js";

export class HKBugSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "actor"],
      template: "systems/hk-rpg/templates/actor-bug-sheet.hbs",
      width: 720,
      height: 720
    });
  }

  getData(options) {
    const data = super.getData(options);
    data.system = this.actor.system;
    data.weapons = this.actor.items.filter(i => i.type === "weapon");
    data.armors = this.actor.items.filter(i => i.type === "armor");
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".hk-roll").on("click", async (ev) => {
      const statKey = ev.currentTarget.dataset.stat;
      await this._rollStat(statKey);
    });

    html.find(".hk-attack").on("click", async (ev) => {
      const itemId = ev.currentTarget.dataset.itemId;
      const weapon = this.actor.items.get(itemId);
      if (!weapon) return ui.notifications.warn("Оружие не найдено.");
      await this._attackWithWeapon(weapon);
    });

    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      item?.sheet?.render(true);
    });

    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest(".item");
      await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
    });
  }

  async _rollStat(statKey) {
    const s = this.actor.system.stats?.[statKey];
    const dice = Number(s?.value ?? 0);
    const reroll = Number(s?.half ?? 0) ? 1 : 0;

    const { roll, succ } = await HK.rollPool({
      dice,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Проверка: ${statKey} (${dice}d6)`
    });

    if (reroll > 0) {
      const term = roll.terms?.find(t => t.results);
      const idx = term?.results?.findIndex(r => r.result < 5) ?? -1;
      if (idx >= 0) {
        const rr = await (new Roll("1d6")).evaluate();
        const old = term.results[idx].result;
        term.results[idx].result = Math.max(old, rr.total);
        const succ2 = HK.countSuccesses(roll);
        await rr.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: `Переброс (.5 ${statKey}): ${old} → ${rr.total}. Итог успехов: ${succ2}`
        });
      }
    }
  }

  async _attackWithWeapon(weapon) {
    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) return ui.notifications.warn("Нужно выбрать ровно 1 цель (Target).");
    const targetToken = targets[0];
    const attackerToken = this.actor.getActiveTokens(true, true)?.[0];
    if (!attackerToken) return ui.notifications.warn("Нужен активный токен атакующего на сцене.");

    const w = weapon.system.attack;
    const statKey = w.stat ?? "pow";
    const skillKey = w.skill ?? null;
    const baseDamage = Number(w.damageBase ?? 1);
    const damageType = (w.damageType ?? "physical");

    const range = Number(w.range ?? 1);
    const distSq = HK.getSquaresBetween(attackerToken, targetToken);
    if (distSq == null) return ui.notifications.warn("Не удалось измерить дистанцию.");
    const extra = Math.max(0, distSq - range);
    const rangePenalty = HK.distancePenalty(extra);

    // stamina dialog
    const stamTax = Number(weapon.system.cost?.stamTax ?? 0);
    const investMax = Number(weapon.system.cost?.stamInvestMax ?? 0);
    const currentStam = Number(this.actor.system.pools?.stam?.value ?? 0);

    const content = `
      <p>Дистанция: <b>${distSq}</b> клеток. Дальность оружия: <b>${range}</b>. Штраф дальности: <b>-${rangePenalty}</b> куб(а).</p>
      <p>Выносливость: сейчас <b>${currentStam}</b>. Налог: <b>${stamTax}</b>.</p>
      <div class="form-group">
        <label>Вложенная выносливость (0..${Math.min(investMax, Math.max(0, currentStam - stamTax))})</label>
        <input id="hkInvest" type="number" value="0" min="0" max="${Math.min(investMax, Math.max(0, currentStam - stamTax))}"/>
      </div>
    `;

    let invested = 0;
    await Dialog.prompt({
      title: `Атака: ${weapon.name}`,
      content,
      label: "Бросить",
      callback: (html) => {
        invested = Number(html.find("#hkInvest").val() ?? 0);
        invested = Math.max(0, Math.min(invested, investMax, Math.max(0, currentStam - stamTax)));
      }
    });

    // spend stamina
    const spend = stamTax + invested;
    if (spend > currentStam) return ui.notifications.warn("Недостаточно выносливости.");
    await this.actor.update({ "system.pools.stam.value": currentStam - spend });

    // build dice pool
    const statDice = Number(this.actor.system.stats?.[statKey]?.value ?? 0);
    const skillDice = skillKey ? Number(this.actor.system.skills?.[skillKey]?.rank ?? 0) : 0;
    const dice = Math.max(0, statDice + skillDice + invested - rangePenalty);

    const { roll, succ } = await HK.rollPool({
      dice,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Атака ${weapon.name}: ${statKey}${skillKey ? "+"+skillKey : ""} + влож.вынос(${invested}) - дальн(${rangePenalty}) = ${dice}d6`
    });

    if (succ <= 0) return;

    const extraSucc = Math.max(0, succ - 1);
    const addCap = Math.max(baseDamage, invested);
    const addDamage = Math.min(extraSucc, addCap);
    let probable = baseDamage + addDamage;

    // target DR
    const targetActor = targetToken.actor;
    const ignoreDR = Number(weapon.system.flags?.ignoreDR ?? 0);
    const targetDR = Math.max(0, Number(targetActor?.system?.derived?.dr ?? 0) - ignoreDR);
    probable = Math.max(1, probable - targetDR);

    // absorb (shell) only if physical and not ignored by weapon flag
    let absorbSucc = 0;
    if (damageType === "physical") {
      const { succ: sAbs } = await HK.rollPool({
        dice: Number(targetActor.system.stats?.shell?.value ?? 0),
        speaker: ChatMessage.getSpeaker({ actor: targetActor }),
        flavor: `Впитывание (Панцирь): ${targetActor.name}`
      });
      absorbSucc = sAbs;
    }

    let finalDmg = Math.max(0, probable - absorbSucc);

    // absorption (flat)
    const absorp = Number(targetActor.system.meta?.absorption ?? 0);
    finalDmg = Math.max(0, finalDmg - absorp);

    // apply damage
    const hp = Number(targetActor.system.pools?.heart?.value ?? 0);
    await targetActor.update({ "system.pools.heart.value": Math.max(0, hp - finalDmg) });

    // armor durability loss rule (MVP): if hit and at least one 6 on attack roll, reduce durability by 1
    if (HK.hasSix(roll)) {
      const armor = HK.getEquippedArmor(targetActor);
      if (armor) {
        const dv = Number(armor.system.defense?.durability?.value ?? 0);
        if (dv > 0) await armor.update({ "system.defense.durability.value": dv - 1 });
      }
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>${this.actor.name}</b> наносит <b>${finalDmg}</b> урона цели <b>${targetActor.name}</b>. (вероятн: ${probable}, впитано: ${absorbSucc}, поглощ.: ${absorp}, ПУ: ${targetDR})`
    });
  }
}