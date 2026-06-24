// module/hk.js
import { HKActor } from "./documents/actor.js";
import { HKItem } from "./documents/item.js";
import { HKBugSheet } from "./sheets/actor-sheet.js";
import {
  HKWeaponSheet,
  HKArmorSheet,
  HKGenericItemSheet
} from "./sheets/item-sheets.js";
import { HKContentImporter } from "./content/importer.js";

export const HK = {
  itemTypes: [
    "weapon",
    "shield",
    "armor",
    "focus",
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
    shield: "HKRPG.Shield",
    armor: "HKRPG.Armor",
    focus: "HKRPG.Focus",
    condition: "HKRPG.Condition",
    trait: "HKRPG.Trait",
    path: "HKRPG.Path",
    art: "HKRPG.Art",
    spell: "HKRPG.Spell",
    charm: "HKRPG.Charm",
    consumable: "HKRPG.Consumable",
    gear: "HKRPG.Gear"
  },

  content: HKContentImporter,

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
  },

  async recoverStamina(actor) {
    const max = Number(actor.system?.pools?.stam?.max ?? 0);
    await actor.update({ "system.pools.stam.value": max, "system.combat.reactionAvailable": true });
    return max;
  },

  async spendSoul(actor, amount = 1) {
    const current = Number(actor.system?.pools?.soul?.value ?? 0);
    const cost = Math.max(0, Number(amount) || 0);
    if (current < cost) return false;
    await actor.update({ "system.pools.soul.value": current - cost });
    return true;
  },

  async focusSoul(actor, { soulCost = 1, heal = 1 } = {}) {
    const ok = await HK.spendSoul(actor, soulCost);
    if (!ok) return ui.notifications.warn("Недостаточно Души для Фокусировки.");
    const hp = Number(actor.system?.pools?.heart?.value ?? 0);
    const max = Number(actor.system?.pools?.heart?.max ?? 0);
    await actor.update({ "system.pools.heart.value": Math.min(max, hp + heal) });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> фокусирует Душу и восстанавливает ${heal} Сердце.` });
    return true;
  },

  async rest(actor, { long = false } = {}) {
    const heart = actor.system?.pools?.heart ?? {};
    const soul = actor.system?.pools?.soul ?? {};
    const satiety = actor.system?.pools?.satiety ?? {};
    const hunger = Math.max(10, Number(actor.system?.meta?.hunger ?? 10));
    const heartGain = long ? Number(heart.max ?? 0) : 1;
    const updates = {
      "system.pools.heart.value": Math.min(Number(heart.max ?? 0), Number(heart.value ?? 0) + heartGain),
      "system.pools.soul.value": Number(soul.max ?? 0),
      "system.pools.satiety.value": Number(satiety.value ?? 0) - hunger,
      "system.combat.reactionAvailable": true
    };
    await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${actor.name}</b> отдыхает. Душа восстановлена, Сытость уменьшена на ${hunger}.` });
    return updates;
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
    types: ["shield", "focus", "condition", "trait", "path", "art", "spell", "charm", "consumable", "gear"],
    makeDefault: true
  });
});

Hooks.once("ready", () => {
  game.hk.importContent = () => HKContentImporter.importAll();
  game.hk.importItems = () => HKContentImporter.importItems();
  game.hk.importCreatures = () => HKContentImporter.importCreatures();
  game.hk.importNpcs = () => HKContentImporter.importNpcs();
  game.hk.recoverStamina = actor => HK.recoverStamina(actor);
  game.hk.focusSoul = (actor, options) => HK.focusSoul(actor, options);
  game.hk.rest = (actor, options) => HK.rest(actor, options);
});
