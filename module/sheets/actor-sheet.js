// module/sheets/actor-sheet.js
import { HK } from "../hk.js";

export class HKBugSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "actor"],
      template: "systems/hk-rpg/templates/actor-bug-sheet.hbs",
      width: 880,
      height: 860
    });
  }

  getData(options) {
    const data = super.getData(options);
    const byType = (type) => this.actor.items.filter(i => i.type === type);

    data.system = this.actor.system;
    data.weapons = byType("weapon");
    data.armors = byType("armor");
    data.conditions = byType("condition");
    data.traits = byType("trait");
    data.paths = byType("path");
    data.arts = byType("art");
    data.spells = byType("spell");
    data.charms = byType("charm");
    data.consumables = byType("consumable");
    data.gear = [...byType("gear"), ...byType("shield"), ...byType("focus")];
    data.itemTypes = HK.itemTypes.map(type => ({
      type,
      label: game.i18n.localize(HK.itemTypeLabels[type] ?? type)
    }));
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".hk-roll").on("click", async (ev) => {
      const statKey = ev.currentTarget.dataset.stat;
      await this._rollStat(statKey);
    });

    html.find(".hk-roll-skill").on("click", async (ev) => {
      const statKey = ev.currentTarget.dataset.stat;
      const skillKey = ev.currentTarget.dataset.skill;
      await this._rollSkill(statKey, skillKey);
    });

    html.find(".hk-attack").on("click", async (ev) => {
      const itemId = ev.currentTarget.dataset.itemId;
      const weapon = this.actor.items.get(itemId);
      if (!weapon) return ui.notifications.warn("Оружие не найдено.");
      await this._attackWithWeapon(weapon);
    });

    html.find(".hk-use-consumable").on("click", async (ev) => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      await HK.useConsumable(item, this.actor);
    });

    html.find(".hk-use-tech").on("click", async (ev) => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      await HK.useTechnique(item, this.actor);
    });

    html.find(".hk-toggle-equip").on("click", async (ev) => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      await HK.toggleEquip(item);
    });

    html.find(".hk-create-item").on("click", async (ev) => {
      const type = ev.currentTarget.dataset.type;
      const label = ev.currentTarget.dataset.label || type;
      if (!HK.itemTypes.includes(type)) return ui.notifications.warn(`Неизвестный тип предмета: ${type}`);
      await this.actor.createEmbeddedDocuments("Item", [{ name: label, type }]);
    });

    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest(".item");
      const item = this.actor.items.get(li?.dataset?.itemId);
      item?.sheet?.render(true);
    });

    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset?.itemId;
      if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });
  }

  async _rollStat(statKey) {
    const dice = HK.effectiveStat(this.actor, statKey);
    const rerollFromHalf = HK.effectiveStatHalf(this.actor, statKey) ? 1 : 0;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    const { roll } = await HK.rollPool({
      dice,
      speaker,
      flavor: `Проверка: ${statKey} (${dice}d6)`
    });

    if (rerollFromHalf > 0) {
      await HK.rerollOneFailureFromHalf({ roll, speaker, label: statKey });
    }
  }

  async _rollSkill(statKey, skillKey) {
    const statDice = HK.effectiveStat(this.actor, statKey);
    const skillDice = HK.effectiveSkill(this.actor, skillKey);
    const dice = statDice + skillDice;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    const { roll } = await HK.rollPool({
      dice,
      speaker,
      flavor: `Проверка навыка: ${statKey}+${skillKey} (${statDice}+${skillDice} = ${dice}d6)`
    });

    if (HK.effectiveStatHalf(this.actor, statKey)) {
      await HK.rerollOneFailureFromHalf({ roll, speaker, label: statKey });
    }
  }

  async _attackWithWeapon(weapon) {
    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) return ui.notifications.warn("Нужно выбрать ровно 1 цель (Target).");

    const targetToken = targets[0];
    const attackerToken = this.actor.getActiveTokens(true, true)?.[0];
    if (!attackerToken) return ui.notifications.warn("Нужен активный токен атакующего на сцене.");

    const targetActor = targetToken.actor;
    if (!targetActor) return ui.notifications.warn("У цели нет Actor.");

    const w = weapon.system.attack ?? {};
    const statKey = w.stat ?? "pow";
    const skillKey = w.skill ?? null;

    const baseDamage = Math.max(0, Number(w.damageBase ?? 1));
    const damageType = String(w.damageType ?? "physical");

    const range = Math.max(0, Number(w.range ?? 1));
    const distSq = HK.getSquaresBetween(attackerToken, targetToken);
    if (distSq == null) return ui.notifications.warn("Не удалось измерить дистанцию.");

    const extra = Math.max(0, distSq - range);
    const rangePenalty = HK.distancePenalty(extra);

    const stamTax = Math.max(0, Number(weapon.system.cost?.stamTax ?? 0));
    const investMax = Math.max(0, Number(weapon.system.cost?.stamInvestMax ?? 0));
    const currentStam = Math.max(0, Number(this.actor.system.pools?.stam?.value ?? 0));
    const maxInvest = Math.min(investMax, Math.max(0, currentStam - stamTax));

    let invested = 0;

    const content = `
      <p>Дистанция: <b>${distSq}</b> клеток. Дальность: <b>${range}</b>. Штраф дальности: <b>-${rangePenalty}</b> куб(а).</p>
      <p>Выносливость: сейчас <b>${currentStam}</b>. Налог: <b>${stamTax}</b>.</p>
      <div class="form-group">
        <label>Вложенная выносливость (0..${maxInvest})</label>
        <input id="hkInvest" type="number" value="0" min="0" max="${maxInvest}"/>
      </div>
    `;

    await Dialog.prompt({
      title: `Атака: ${weapon.name}`,
      content,
      label: "Бросить",
      callback: (html) => {
        invested = Number(html.find("#hkInvest")?.val?.() ?? 0);
        invested = Math.max(0, Math.min(invested, maxInvest));
      }
    });

    const spend = stamTax + invested;
    if (spend > currentStam) return ui.notifications.warn("Недостаточно выносливости.");
    await this.actor.update({ "system.pools.stam.value": currentStam - spend });

    const statDice = Math.max(0, HK.effectiveStat(this.actor, statKey));
    const skillDice = skillKey ? Math.max(0, HK.effectiveSkill(this.actor, skillKey)) : 0;
    const conditionDice = HK.sumConditionModifier(this.actor, "attackDiceDelta");

    const dice = Math.max(0, statDice + skillDice + invested + conditionDice - rangePenalty);

    const { roll, succ } = await HK.rollPool({
      dice,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Атака ${weapon.name}: ${statKey}${skillKey ? "+" + skillKey : ""} + влож(${invested}) + сост(${conditionDice}) - дальн(${rangePenalty}) = ${dice}d6`
    });

    if (succ <= 0) return;

    const extraSucc = Math.max(0, succ - 1);
    const addCap = Math.max(baseDamage, invested);
    const addDamage = Math.min(extraSucc, addCap);
    let probable = baseDamage + addDamage;

    const ignoreDR = Math.max(0, Number(weapon.system.flags?.ignoreDR ?? 0));
    const targetDRRaw = Math.max(0, Number(targetActor.system.derived?.dr ?? 0));
    const targetDR = Math.max(0, targetDRRaw - ignoreDR);

    probable = Math.max(1, probable - targetDR);

    let absorbSucc = 0;
    if (damageType === "physical") {
      const shellDice = Math.max(0, HK.effectiveStat(targetActor, "shell"));
      const defenseDelta = HK.sumConditionModifier(targetActor, "defenseDiceDelta");
      const res = await HK.rollPool({
        dice: Math.max(0, shellDice + defenseDelta),
        speaker: ChatMessage.getSpeaker({ actor: targetActor }),
        flavor: `Впитывание (Панцирь): ${targetActor.name} (${shellDice} + сост(${defenseDelta}) d6)`
      });
      absorbSucc = res.succ;
    }

    let finalDmg = Math.max(0, probable - absorbSucc);

    const absorption = Math.max(0, HK.effectiveMeta(targetActor, "absorption"));
    finalDmg = Math.max(0, finalDmg - absorption);

    const hp = Math.max(0, Number(targetActor.system.pools?.heart?.value ?? 0));
    await targetActor.update({ "system.pools.heart.value": Math.max(0, hp - finalDmg) });

    if (HK.hasSix(roll)) {
      const armor = HK.getEquippedArmor(targetActor);
      if (armor) {
        const dv = Math.max(0, Number(armor.system.defense?.durability?.value ?? 0));
        if (dv > 0) await armor.update({ "system.defense.durability.value": dv - 1 });
      }
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<b>${this.actor.name}</b> наносит <b>${finalDmg}</b> урона цели <b>${targetActor.name}</b>.
      (вероятн: ${probable}, ПУ: ${targetDR}, впитано: ${absorbSucc}, поглощ.: ${absorption})`
    });
  }
}
