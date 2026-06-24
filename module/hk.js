// module/hk.js
import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import {
  HKWeaponSheet,
  HKArmorSheet,
  HKGenericItemSheet
} from "./sheets/item-sheets.js";

export const HK = {
  itemTypes: [
    "weapon",
    "armor",
    "condition",
    "trait",
    "path",
    "art",
    "spell",
    "charm",
    "consumable",
    "gear"
  ],

  itemTypeLabels: {
    weapon: "HKRPG.Weapon",
    armor: "HKRPG.Armor",
    condition: "HKRPG.Condition",
    trait: "HKRPG.Trait",
    path: "HKRPG.Path",
    art: "HKRPG.Art",
    spell: "HKRPG.Spell",
    charm: "HKRPG.Charm",
    consumable: "HKRPG.Consumable",
    gear: "HKRPG.Gear"
  },

  distancePenalty(extraSquares) {
    return Math.max(0, Math.floor(Number(extraSquares) || 0));
  },

  clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
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
    const d = Math.max(0, Math.floor(Number(dice) || 0));
    const formula = d > 0 ? `${d}d6` : "0";
    const roll = await (new Roll(formula)).evaluate();
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

    await rr.toMessage({
      speaker,
      flavor: `Переброс (.5 ${label}): ${old} → ${rr.total}. Итог успехов: ${succ}`
    });

    return succ;
  },

  getSquaresBetween(tokenA, tokenB) {
    if (!canvas?.grid || !tokenA?.center || !tokenB?.center) return null;
    const ray = new Ray(tokenA.center, tokenB.center);

    const d = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })?.[0];
    const n = Number(d);
    return Number.isFinite(n) ? n : null;
  },

  getEquippedArmor(actor) {
    const armors = actor.items.filter(i => i.type === "armor");
    const equipped = armors.filter(a => a.system?.equipped !== false);
    const usable = equipped.find(a => (a.system?.defense?.durability?.value ?? 0) > 0);
    return usable ?? equipped[0] ?? armors[0] ?? null;
  },

  sumConditionModifier(actor, key) {
    return actor.items
      .filter(i => i.type === "condition")
      .reduce((total, condition) => total + Number(condition.system?.modifiers?.[key] ?? 0), 0);
  }
};

Hooks.once("init", () => {
  console.log("HK-RPG | init");

  game.hk = { HK };

  CONFIG.Actor.documentClass = HKActor;
  CONFIG.Item.documentClass = HKItem;

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hk-rpg", HKBugSheet, { types: ["bug"], makeDefault: true });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hk-rpg", HKWeaponSheet, { types: ["weapon"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("hk-rpg", HKGenericItemSheet, {
    types: ["condition", "trait", "path", "art", "spell", "charm", "consumable", "gear"],
    makeDefault: true
  });
});
