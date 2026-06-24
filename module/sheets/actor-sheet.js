// module/sheets/actor-sheet.js
import { HK } from "../hk.js";

export class HKBugSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "actor"],
      template: "systems/hk-rpg/templates/actor-bug-sheet.hbs",
      width: 960,
      height: 940
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
    data.itemTypes = HK.itemTypes.map(type => ({ type, label: game.i18n.localize(HK.itemTypeLabels[type] ?? type) }));
    const activeSize = data.system?.derived?.character?.sizeKey ?? data.system?.builder?.sizeTemplate ?? "medium";
    data.sizeOptions = HK.sizeTemplateOptions().map(option => ({ ...option, selected: option.key === activeSize }));
    data.characterWarnings = data.system?.derived?.character?.warnings ?? [];
    data.hasCharacterWarnings = data.characterWarnings.length > 0;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".hk-roll").on("click", async ev => this._rollStat(ev.currentTarget.dataset.stat));
    html.find(".hk-roll-skill").on("click", async ev => this._rollSkill(ev.currentTarget.dataset.stat, ev.currentTarget.dataset.skill));

    html.find(".hk-apply-size-template").on("click", async () => {
      const key = html.find("[name='system.builder.sizeTemplate']")?.val?.() ?? "medium";
      await HK.applySizeTemplate(this.actor, key);
    });

    html.find(".hk-sync-maximums").on("click", async () => HK.syncActorMaximums(this.actor));
    html.find(".hk-recover-stamina").on("click", async () => HK.recoverStamina(this.actor));
    html.find(".hk-focus-soul").on("click", async () => HK.focusSoul(this.actor));
    html.find(".hk-rest-short").on("click", async () => HK.rest(this.actor, { long: false }));
    html.find(".hk-rest-long").on("click", async () => HK.rest(this.actor, { long: true }));

    html.find(".hk-attack").on("click", async ev => {
      const weapon = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!weapon) return ui.notifications.warn("Оружие не найдено.");
      await HK.rollWeaponAttack(this.actor, weapon);
    });

    html.find(".hk-use-consumable").on("click", async ev => HK.useConsumable(this.actor.items.get(ev.currentTarget.dataset.itemId), this.actor));
    html.find(".hk-use-tech").on("click", async ev => HK.useTechnique(this.actor.items.get(ev.currentTarget.dataset.itemId), this.actor));
    html.find(".hk-toggle-equip").on("click", async ev => HK.toggleEquip(this.actor.items.get(ev.currentTarget.dataset.itemId)));

    html.find(".hk-toggle-prepared").on("click", async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (item) await item.update({ "system.prepared": !item.system?.prepared });
    });

    html.find(".hk-sync-token-size").on("click", async () => {
      const width = Math.max(0.25, Number(html.find("[name='system.token.width']")?.val?.() ?? this.actor.system?.token?.width ?? 1));
      const height = Math.max(0.25, Number(html.find("[name='system.token.height']")?.val?.() ?? this.actor.system?.token?.height ?? width));
      if (HK.setActorTokenSize) await HK.setActorTokenSize(this.actor, { width, height, updateActiveTokens: true });
      else ui.notifications.warn("HKRPG: модуль изменения размера токена ещё не загружен.");
    });

    html.find(".hk-create-item").on("click", async ev => {
      const type = ev.currentTarget.dataset.type;
      const label = ev.currentTarget.dataset.label || type;
      if (!HK.itemTypes.includes(type)) return ui.notifications.warn(`Неизвестный тип предмета: ${type}`);
      await this.actor.createEmbeddedDocuments("Item", [{ name: label, type }]);
    });

    html.find(".item-edit").on("click", ev => {
      const li = ev.currentTarget.closest(".item");
      this.actor.items.get(li?.dataset?.itemId)?.sheet?.render(true);
    });

    html.find(".item-delete").on("click", async ev => {
      const li = ev.currentTarget.closest(".item");
      const id = li?.dataset?.itemId;
      if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });
  }

  async _rollStat(statKey) {
    const dice = HK.effectiveStat(this.actor, statKey);
    const rerollFromHalf = HK.effectiveStatHalf(this.actor, statKey) ? 1 : 0;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const { roll } = await HK.rollPool({ dice, speaker, flavor: `Проверка: ${HK.statLabels[statKey] ?? statKey} (${dice}d6)` });
    if (rerollFromHalf > 0) await HK.rerollOneFailureFromHalf({ roll, speaker, label: HK.statLabels[statKey] ?? statKey });
  }

  async _rollSkill(statKey, skillKey) {
    const statDice = HK.effectiveStat(this.actor, statKey);
    const skillDice = HK.effectiveSkill(this.actor, skillKey);
    const dice = statDice + skillDice;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const { roll } = await HK.rollPool({
      dice,
      speaker,
      flavor: `Проверка навыка: ${HK.statLabels[statKey] ?? statKey}+${HK.skillLabels[skillKey] ?? skillKey} (${statDice}+${skillDice} = ${dice}d6)`
    });
    if (HK.effectiveStatHalf(this.actor, statKey)) await HK.rerollOneFailureFromHalf({ roll, speaker, label: HK.statLabels[statKey] ?? statKey });
  }
}
