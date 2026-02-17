export class HKWeaponSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-weapon-sheet.hbs",
      width: 520,
      height: 520
    });
  }
  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    return data;
  }
}

export class HKArmorSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hk", "sheet", "item"],
      template: "systems/hk-rpg/templates/item-armor-sheet.hbs",
      width: 420,
      height: 360
    });
  }
  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    return data;
  }
}