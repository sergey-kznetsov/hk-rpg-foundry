// module/documents/actor.js
import { HK } from "../hk.js";
import { calculateEffectiveSystem } from "../mechanics/effects.js";

const TECH_TYPES = new Set(["art", "spell"]);
const WEIGHT_TYPES = new Set(["weapon", "shield", "armor", "focus", "consumable", "gear"]);

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function itemQuantity(item) {
  if (["consumable", "gear"].includes(item.type)) return Math.max(0, n(item.system?.quantity, 1));
  return 1;
}

function itemWeight(item) {
  if (!WEIGHT_TYPES.has(item.type)) return 0;
  if (item.system?.weight === "light" || item.system?.weight === "Л" || item.system?.weight === "л") return 0;
  return Math.max(0, n(item.system?.weight, 0)) * itemQuantity(item);
}

function sizeKey(system) {
  const raw = String(system?.meta?.size ?? system?.builder?.sizeTemplate ?? "medium").trim().toLowerCase();
  if (["small", "мелкий", "маленький", "s"].includes(raw)) return "small";
  if (["large", "большой", "l"].includes(raw)) return "large";
  return "medium";
}

function buildWarnings({ system, traitCount, hunger, hungerMax, usedMarks, marksMax, usedTechSlots, techSlots, carriedWeight, carry, hardLoad, encumbrance }) {
  const warnings = [];
  if (traitCount > 7) warnings.push(`Черты: ${traitCount}/7. Основных черт больше допустимого лимита.`);
  if (hunger > hungerMax) warnings.push(`Голод: ${hunger}/${hungerMax}. Превышен максимум шаблона размера.`);
  if (usedMarks > marksMax) warnings.push(`Метки: занято ${usedMarks}/${marksMax}. Надето слишком много амулетов.`);
  if (usedTechSlots > techSlots) warnings.push(`Ячейки техник: подготовлено ${usedTechSlots}/${techSlots}. Слишком много Искусств/Тайн.`);
  if (carriedWeight > hardLoad) warnings.push(`Вес: ${carriedWeight}/${hardLoad}. Жук не может нести больше удвоенной Нагрузки.`);
  else if (carriedWeight > carry) warnings.push(`Вес: ${carriedWeight}/${carry}. Перегруз: -1 куб к проверкам Мощи/Грации и +1 Выносливость к действиям.`);
  if (encumbrance === "blocked") warnings.push("Вес выше предельной нагрузки: перед боевым тестом разгрузите персонажа или исправьте снаряжение.");
  const satiety = n(system?.pools?.satiety?.value, 0);
  if (satiety < -100) warnings.push("Сытость ниже -100: жук мёртв от голода и истощения.");
  else if (satiety < -50) warnings.push("Сытость от -50 до -100: -1 ко всем Главным Характеристикам и ослабленное восстановление.");
  else if (satiety < 0) warnings.push("Сытость ниже 0: во время отдыха восстанавливается только половина Души.");
  return warnings;
}

export class HKActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    const s = this.system ?? {};
    s.effective = calculateEffectiveSystem(this);

    const rawPow = n(s.effective?.stats?.pow?.value ?? s.stats?.pow?.value);
    const rawGrace = n(s.effective?.stats?.grace?.value ?? s.stats?.grace?.value);
    const shell = n(s.effective?.stats?.shell?.value ?? s.stats?.shell?.value);
    const insight = n(s.effective?.stats?.insight?.value ?? s.stats?.insight?.value);

    const carry = Math.floor(rawPow);
    const carriedWeight = this.items.reduce((total, item) => total + itemWeight(item), 0);
    const hardLoad = Math.max(0, carry * 2);
    const encumbrance = carriedWeight > hardLoad ? "blocked" : (carriedWeight > carry ? "overloaded" : "ok");
    const encumbrancePenalty = encumbrance === "ok" ? 0 : -1;
    const staminaSurcharge = encumbrance === "ok" ? 0 : 1;

    if (encumbrancePenalty) {
      s.effective.stats.pow.value = Math.max(0, rawPow + encumbrancePenalty);
      s.effective.stats.grace.value = Math.max(0, rawGrace + encumbrancePenalty);
    }

    const pow = n(s.effective?.stats?.pow?.value ?? rawPow);
    const grace = n(s.effective?.stats?.grace?.value ?? rawGrace);

    s.derived ??= {};
    s.derived.carry = carry;
    s.derived.maneuver = Math.ceil(grace / 2);
    s.derived.beltSlots = Math.floor(shell);
    s.derived.techSlots = Math.floor(insight);

    const armor = HK.getEquippedArmor(this);
    const durability = n(armor?.system?.defense?.durability?.value, 0);
    const dr = n(armor?.system?.defense?.dr, 0);
    s.derived.dr = (armor && durability > 0) ? dr : 0;

    const baseSpeed = n(s.effective?.meta?.speed ?? s.meta?.speed);
    const speedDelta = HK.sumConditionModifier(this, "speedDelta");
    s.derived.speed = Math.max(0, baseSpeed + speedDelta);

    const traits = this.items.filter(i => i.type === "trait");
    const mainTraits = traits.filter(i => !bool(i.system?.isSubtrait));
    const pathRanks = this.items.filter(i => i.type === "path").reduce((total, path) => total + Math.max(0, n(path.system?.rank, 0)), 0);
    const martialRanks = this.items.filter(i => i.type === "path" && i.system?.category === "martial").reduce((total, path) => total + Math.max(0, n(path.system?.rank, 0)), 0);
    const mysticRanks = this.items.filter(i => i.type === "path" && i.system?.category === "mystic").reduce((total, path) => total + Math.max(0, n(path.system?.rank, 0)), 0);

    const equippedMarks = this.items.filter(i => i.type === "charm" && i.system?.equipped === true).reduce((total, charm) => total + n(charm.system?.marks, 0), 0);
    const marksMax = n(s.effective?.meta?.marks?.max ?? s.meta?.marks?.max, 0);
    s.derived.equippedMarks = equippedMarks;
    s.derived.freeMarks = Math.max(0, marksMax - equippedMarks);
    s.derived.activeEffects = Array.isArray(s.effective?.effects) ? s.effective.effects.length : 0;

    const preparedTech = this.items.filter(i => TECH_TYPES.has(i.type) && i.system?.prepared === true);
    const preparedArts = preparedTech.filter(i => i.type === "art").length;
    const preparedSpells = preparedTech.filter(i => i.type === "spell").length;
    const usedTechSlots = preparedTech.length;

    const key = sizeKey(s);
    const template = HK.sizeTemplates?.[key] ?? HK.sizeTemplates?.medium;
    const hunger = n(s.effective?.meta?.hunger ?? s.meta?.hunger, 0);
    const hungerMax = n(template?.meta?.hungerMax, 20);
    const hungerStart = n(template?.meta?.hungerStart, 4);
    const satietyMax = Math.max(10, hunger);
    const satietyLoss = Math.max(10, hunger);

    s.builder ??= {};
    s.derived.character = {
      sizeKey: key,
      sizeLabel: template?.label ?? "Средний",
      traitCount: mainTraits.length,
      subtraitCount: traits.length - mainTraits.length,
      traitLimit: 7,
      traitSlotsFree: Math.max(0, 7 - mainTraits.length),
      pathRanks,
      martialRanks,
      mysticRanks,
      preparedArts,
      preparedSpells,
      usedTechSlots,
      techSlots: s.derived.techSlots,
      carriedWeight,
      carry,
      hardLoad,
      encumbrance,
      encumbrancePenalty,
      staminaSurcharge,
      hunger,
      hungerMax,
      hungerStart,
      satietyMax,
      satietyLoss,
      marksUsed: equippedMarks,
      marksMax,
      marksFree: Math.max(0, marksMax - equippedMarks),
      warnings: buildWarnings({ system: s, traitCount: mainTraits.length, hunger, hungerMax, usedMarks: equippedMarks, marksMax, usedTechSlots, techSlots: s.derived.techSlots, carriedWeight, carry, hardLoad, encumbrance })
    };

    s.derived.encumbrancePenalty = encumbrancePenalty;
    s.derived.staminaSurcharge = staminaSurcharge;
  }
}
