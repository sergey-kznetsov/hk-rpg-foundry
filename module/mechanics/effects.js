// module/mechanics/effects.js

const ALWAYS_ON_TYPES = new Set(["trait", "path", "condition"]);
const EQUIPPED_FIELD_BY_TYPE = {
  weapon: "equipped",
  shield: "equipped",
  armor: "equipped",
  focus: "attuned",
  charm: "equipped",
  gear: "equipped"
};

const STAT_KEYS = ["pow", "grace", "shell", "insight"];
const SKILL_KEYS = ["soldier", "scout", "lore", "craft", "survival", "social"];
const POOL_KEYS = ["heart", "soul", "stam", "satiety", "supplies", "essence"];
const META_KEYS = ["speed", "hunger", "fright", "appeal", "absorption"];

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function effectLabel(item, effect) {
  return effect?.label || item?.name || "HKRPG effect";
}

function isItemEnabled(item) {
  if (!item) return false;
  if (ALWAYS_ON_TYPES.has(item.type)) return true;

  const field = EQUIPPED_FIELD_BY_TYPE[item.type];
  if (!field) return false;
  return item.system?.[field] === true;
}

function normalizeEffect(item, effect) {
  if (!effect || effect.enabled === false) return null;
  const key = effect.key || effect.path;
  if (!key) return null;

  return {
    key,
    mode: effect.mode || "add",
    value: n(effect.value, 0),
    label: effectLabel(item, effect),
    sourceId: item?.id ?? null,
    sourceName: item?.name ?? "",
    sourceType: item?.type ?? ""
  };
}

function legacyEffects(item) {
  const effects = [];
  const system = item.system ?? {};

  if (item.type === "trait") {
    if (n(system.hunger) !== 0) effects.push({ key: "meta.hunger", mode: "add", value: n(system.hunger), label: `${item.name}: Голод` });
    if (n(system.fright) !== 0) effects.push({ key: "meta.fright", mode: "add", value: n(system.fright), label: `${item.name}: Жуть` });
    if (n(system.appeal) !== 0) effects.push({ key: "meta.appeal", mode: "add", value: n(system.appeal), label: `${item.name}: Привлекательность` });
  }

  if (item.type === "path") {
    const rank = Math.max(0, n(system.rank, 0));
    if (system.category === "martial") effects.push({ key: "pools.stam.max", mode: "add", value: rank, label: `${item.name}: воинский Ранг` });
    if (system.category === "mystic") effects.push({ key: "pools.soul.max", mode: "add", value: rank, label: `${item.name}: мистический Ранг` });
  }

  if (item.type === "condition") {
    const speedDelta = n(system.modifiers?.speedDelta, 0);
    if (speedDelta !== 0) effects.push({ key: "meta.speed", mode: "add", value: speedDelta, label: `${item.name}: скорость` });
  }

  return effects;
}

export function collectItemEffects(actor) {
  const collected = [];

  for (const item of actor?.items ?? []) {
    if (!isItemEnabled(item)) continue;

    for (const effect of legacyEffects(item)) collected.push(effect);

    const explicit = Array.isArray(item.system?.effects) ? item.system.effects : [];
    for (const raw of explicit) {
      const effect = normalizeEffect(item, raw);
      if (effect) collected.push(effect);
    }
  }

  return collected;
}

export function applyNumberEffects(base, effects, key) {
  let value = n(base, 0);
  const relevant = effects.filter(e => e.key === key);

  for (const effect of relevant.filter(e => e.mode === "override")) value = n(effect.value, value);
  for (const effect of relevant.filter(e => e.mode === "add")) value += n(effect.value, 0);
  for (const effect of relevant.filter(e => e.mode === "multiply" || e.mode === "mul")) value *= n(effect.value, 1);
  for (const effect of relevant.filter(e => e.mode === "min")) value = Math.min(value, n(effect.value, value));
  for (const effect of relevant.filter(e => e.mode === "max")) value = Math.max(value, n(effect.value, value));

  return value;
}

export function calculateEffectiveSystem(actor) {
  const system = actor.system ?? {};
  const effects = collectItemEffects(actor);
  const effective = {
    stats: {},
    skills: {},
    pools: {},
    meta: {},
    effects
  };

  for (const key of STAT_KEYS) {
    const base = system.stats?.[key] ?? {};
    effective.stats[key] = {
      value: applyNumberEffects(n(base.value), effects, `stats.${key}.value`),
      half: applyNumberEffects(n(base.half), effects, `stats.${key}.half`)
    };
  }

  for (const key of SKILL_KEYS) {
    const base = system.skills?.[key] ?? {};
    effective.skills[key] = {
      rank: applyNumberEffects(n(base.rank), effects, `skills.${key}.rank`)
    };
  }

  for (const key of POOL_KEYS) {
    const base = system.pools?.[key] ?? {};
    const max = applyNumberEffects(n(base.max), effects, `pools.${key}.max`);
    effective.pools[key] = {
      value: Math.min(n(base.value), max),
      max
    };
  }

  for (const key of META_KEYS) {
    effective.meta[key] = applyNumberEffects(n(system.meta?.[key]), effects, `meta.${key}`);
  }

  const marks = system.meta?.marks ?? {};
  effective.meta.marks = {
    value: Math.min(n(marks.value), applyNumberEffects(n(marks.max), effects, "meta.marks.max")),
    max: applyNumberEffects(n(marks.max), effects, "meta.marks.max")
  };

  return effective;
}

export function effectiveStat(actor, key) {
  return n(actor.system?.effective?.stats?.[key]?.value ?? actor.system?.stats?.[key]?.value, 0);
}

export function effectiveStatHalf(actor, key) {
  return n(actor.system?.effective?.stats?.[key]?.half ?? actor.system?.stats?.[key]?.half, 0);
}

export function effectiveSkill(actor, key) {
  return n(actor.system?.effective?.skills?.[key]?.rank ?? actor.system?.skills?.[key]?.rank, 0);
}

export function effectivePoolMax(actor, key) {
  return n(actor.system?.effective?.pools?.[key]?.max ?? actor.system?.pools?.[key]?.max, 0);
}

export function effectiveMeta(actor, key) {
  return n(actor.system?.effective?.meta?.[key] ?? actor.system?.meta?.[key], 0);
}
