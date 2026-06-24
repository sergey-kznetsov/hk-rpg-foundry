// module/sheets/item-sheets.js

class HKBaseItemSheet extends ItemSheet {
  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    data.type = this.item.type;
    data.isCondition = this.item.type === "condition";
    data.isTrait = this.item.type === "trait";
    data.isPath = this.item.type === "path";
    data.isArt = this.item.type === "art";
    data.isSpell = this.item.type === "spell";
    data.isCharm = this.item.type === "charm";
    data.isConsumable = this.item.type === "consumable";
    data.isGear = this.item.type === "gear";
    data.isShield = this.item.type === "shield";
    data.isFocus = this.item.type === "focus";
    data.effectsJson = JSON.stringify(this.item.system?.effects ?? [], null, 2);
    return data;
  }

  async _updateObject(event, formData) {
    const effectsJson = formData["system.effectsJson"];
    if (effectsJson !== undefined) {
      delete formData["system.effectsJson"];
      try {
        formData["system.effects"] = effectsJson?.trim() ? JSON.parse(effectsJson) : [];
      } catch (err) {
        ui.notifications.error("JSON эффектов предмета не распознан. Изменения эффектов не сохранены.");
        console.error("HKRPG | item effects parse error", err);
      }
    }
    return super._updateObject(event, formData);
  }
}

export class HKWeaponSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-weapon-sheet.hbs",
      width: 540,
      height: 680
    });
  }
}

export class HKArmorSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-armor-sheet.hbs",
      width: 500,
      height: 560
    });
  }
}

export class HKGenericItemSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-generic-sheet.hbs",
      width: 620,
      height: 660
    });
  }
}
