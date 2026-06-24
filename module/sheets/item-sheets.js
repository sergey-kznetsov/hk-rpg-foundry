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
    return data;
  }
}

export class HKWeaponSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-weapon-sheet.hbs",
      width: 540,
      height: 600
    });
  }
}

export class HKArmorSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-armor-sheet.hbs",
      width: 460,
      height: 440
    });
  }
}

export class HKGenericItemSheet extends HKBaseItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-generic-sheet.hbs",
      width: 560,
      height: 560
    });
  }
}
