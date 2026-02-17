// module/hk.js
import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import { HKWeaponSheet, HKArmorSheet } from "./sheets/item-sheets.js";

export const HK = {
  distancePenalty(extraSquares) {
    return Math.floor(Math.max(0, Number(extraSquares) || 0) / 2);
  },

  _resultsFromRoll(roll) {
    const term = roll.terms?.find(t => Array.isArray(t?.results));
    return term?.results?.map(r => r.result) ?? [];
  },

  countSuccesses(roll) {
    const results = HK._resultsFromRoll(roll);
    return results.filter(v => v >= 5).length;
  },

  hasSix(roll) {
    const results = HK._resultsFromRoll(roll);
    return results.some(v => v === 6);
  },

  async rollPool({ dice, speaker, flavor }) {
    const d = Math.max(0, Number(dice) || 0);
    const roll = await (new Roll(`${d}d6`)).evaluate();
    const succ = HK.countSuccesses(roll);
    await roll.toMessage({ speaker, flavor: `${flavor} | успехов: ${succ}` });
    return { roll, succ };
  },

  getSquaresBetween(tokenA, tokenB) {
    if (!canvas?.grid || !tokenA?.center || !tokenB?.center) return null;
    const ray = new Ray(tokenA.center, tokenB.center);

    // gridSpaces: true => вернёт расстояние в клетках
    const d = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })?.[0];
    const n = Number(d);
    return Number.isFinite(n) ? n : null;
  },

  getEquippedArmor(actor) {
    // MVP: "надета" = первый armor с прочностью > 0; если таких нет — первый armor
    const armors = actor.items.filter(i => i.type === "armor");
    const usable = armors.find(a => (a.system?.defense?.durability?.value ?? 0) > 0);
    return usable ?? armors[0] ?? null;
  }
};

Hooks.once("init", () => {
  console.log("HK-RPG | init");

  CONFIG.Actor.documentClass = HKActor;
  CONFIG.Item.documentClass = HKItem;

  // Actor sheets
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hk-rpg", HKBugSheet, { types: ["bug"], makeDefault: true });

  // Item sheets
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hk-rpg", HKWeaponSheet, { types: ["weapon"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKArmorSheet, { types: ["armor"], makeDefault: true });
});
