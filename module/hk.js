// HK-RPG MVP core
export const HK = {
  distancePenalty(extraSquares) {
    return Math.floor(Math.max(0, extraSquares) / 2);
  },
  countSuccesses(roll) {
    const term = roll.terms?.find(t => t.results);
    const results = term?.results?.map(r => r.result) ?? [];
    return results.filter(v => v >= 5).length;
  },
  hasSix(roll) {
    const term = roll.terms?.find(t => t.results);
    const results = term?.results?.map(r => r.result) ?? [];
    return results.some(v => v === 6);
  },
  async rollPool({dice, speaker, flavor}) {
    const d = Math.max(0, Number(dice) || 0);
    const roll = await (new Roll(`${d}d6`)).evaluate();
    const succ = HK.countSuccesses(roll);
    await roll.toMessage({ speaker, flavor: `${flavor} | успехов: ${succ}` });
    return { roll, succ };
  },
  getSquaresBetween(tokenA, tokenB) {
    if (!canvas?.grid) return null;
    const ray = new Ray(tokenA.center, tokenB.center);
    const d = canvas.grid.measureDistances([{ray}], {gridSpaces: true})?.[0];
    return Number(d);
  },
  getEquippedArmor(actor) {
    // MVP: armor = first armor item on actor with durability > 0
    const armors = actor.items.filter(i => i.type === "armor");
    const armor = armors.find(a => (a.system?.defense?.durability?.value ?? 0) > 0) ?? armors[0];
    return armor ?? null;
  }
};

// Derived calculations on actor prepareData are in Actor class.

import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import { HKWeaponSheet, HKArmorSheet } from "./sheets/item-sheets.js";

Hooks.once("init", () => {
  console.log("HK-RPG | init");

  CONFIG.Actor.documentClass = HKActor;
  CONFIG.Item.documentClass = HKItem;

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hk-rpg", HKBugSheet, { types: ["bug"], makeDefault: true });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hk-rpg", HKWeaponSheet, { types: ["weapon"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKArmorSheet, { types: ["armor"], makeDefault: true });
});