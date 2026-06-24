// module/content/importer.js
const CONTENT_BASE = "systems/hk-rpg/data";

async function loadJson(path) {
  const response = await fetch(`${CONTENT_BASE}/${path}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
  return response.json();
}

function sourceKey(doc) {
  const src = doc.system?.source ?? doc.system?.meta?.source ?? doc.system?.kind ?? "content";
  return `${doc.type}:${src}:${doc.name}`;
}

function defaultItemSystem(type, source, extra = {}) {
  const base = { description: extra.description ?? "", source, notes: extra.notes ?? "" };
  if (type === "weapon") return foundry.utils.mergeObject(base, { quality: 1, weight: 1, hands: 1, attack: { stat: "pow", skill: "soldier", range: 1, damageBase: 2, damageType: "physical", kind: "melee", weaponTypes: [] }, cost: { stamTax: 1, stamInvestMax: 3 }, flags: { ignoreDR: 0, ignoreArmorAbsorb: false, pairable: false, provokesAdjacent: false }, price: 0 }, { inplace: false });
  if (type === "shield") return foundry.utils.mergeObject(base, { quality: 1, weight: 1, hands: 1, equipped: false, defense: { parryBonus: 0, dr: 0, durability: { value: 0, max: 0 }, absorption: 0, absorbDice: 0 }, price: 0 }, { inplace: false });
  if (type === "armor") return foundry.utils.mergeObject(base, { kind: "light", weight: 1, equipped: false, defense: { dr: 0, durability: { value: 5, max: 5 }, absorbBonus: 1, absorbRerolls: 0 }, price: 0 }, { inplace: false });
  if (type === "focus") return foundry.utils.mergeObject(base, { quality: 1, focusType: "", damageBase: 0, range: "", hands: 1, weight: 0, attuned: false, price: 0 }, { inplace: false });
  if (type === "charm") return foundry.utils.mergeObject(base, { rarity: extra.rarity ?? "common", marks: extra.marks ?? 1, equipped: false, fragile: false, cursed: false }, { inplace: false });
  if (type === "consumable") return foundry.utils.mergeObject(base, { kind: extra.kind ?? "misc", quantity: 1, satiety: 0, effect: extra.effect ?? "", rarity: extra.rarity ?? "common", strength: 0, reusable: false, weight: 0, price: 0 }, { inplace: false });
  if (type === "gear") return foundry.utils.mergeObject(base, { kind: extra.kind ?? "gear", quality: 0, weight: 1, quantity: 1, price: 0 }, { inplace: false });
  return base;
}

function defaultActorSystem(source, kind) {
  return {
    stats: {
      pow: { value: 3, half: 0 }, grace: { value: 3, half: 0 }, shell: { value: 3, half: 0 }, insight: { value: 3, half: 0 }
    },
    pools: {
      heart: { value: 7, max: 7 }, soul: { value: 3, max: 3 }, stam: { value: 3, max: 3 },
      satiety: { value: 0, max: 20 }, supplies: { value: 0, max: 0 }, essence: { value: 0, max: 0 }
    },
    meta: { speed: 6, size: "medium", hunger: 4, fright: 1, appeal: 1, marks: { value: 3, max: 3 }, absorption: 0, notes: `Импортировано из ${source}. Статблок требуется сверить и доавтоматизировать.` },
    source,
    kind
  };
}

function normalizeItems(raw) {
  if (Array.isArray(raw)) return raw;
  const source = raw.source ?? "HKRPG content";
  const result = [];
  for (const [type, names] of Object.entries(raw.items ?? {})) {
    for (const entry of names) {
      if (typeof entry === "string") result.push({ name: entry, type, system: defaultItemSystem(type, source) });
      else result.push({ name: entry.name, type: entry.type ?? type, system: defaultItemSystem(entry.type ?? type, source, entry) });
    }
  }
  return result;
}

function normalizeActors(raw, kind) {
  if (Array.isArray(raw) && raw[0]?.type) return raw;
  const source = raw.source ?? "HKRPG content";
  const names = Array.isArray(raw) ? raw : (raw.actors ?? []);
  return names.map(entry => {
    const name = typeof entry === "string" ? entry : entry.name;
    return { name, type: "bug", system: defaultActorSystem(source, kind), items: [] };
  });
}

async function createMissingDocuments(documentName, docs, { folderName } = {}) {
  const cls = documentName === "Actor" ? Actor : Item;
  const collection = documentName === "Actor" ? game.actors : game.items;
  const existing = new Set(collection.map(d => d.getFlag("hk-rpg", "sourceKey") ?? sourceKey(d)));
  const pending = [];

  for (const doc of docs) {
    const key = sourceKey(doc);
    if (existing.has(key)) continue;
    pending.push(foundry.utils.mergeObject(foundry.utils.deepClone(doc), {
      flags: { "hk-rpg": { sourceKey: key, importedAt: new Date().toISOString() } }
    }, { inplace: false }));
  }

  if (!pending.length) return { created: 0, skipped: docs.length };

  let folder = null;
  if (folderName) {
    folder = game.folders.find(f => f.type === documentName && f.name === folderName)
      ?? await Folder.create({ name: folderName, type: documentName, sorting: "a" });
    for (const doc of pending) doc.folder = folder.id;
  }

  await cls.createDocuments(pending, { keepId: false });
  return { created: pending.length, skipped: docs.length - pending.length };
}

export const HKContentImporter = {
  async importItems() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const items = normalizeItems(await loadJson("items-core.json"));
    const result = await createMissingDocuments("Item", items, { folderName: "HKRPG — Предметы" });
    ui.notifications.info(`HKRPG: предметы импортированы. Создано ${result.created}, пропущено ${result.skipped}.`);
    return result;
  },

  async importCreatures() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = normalizeActors(await loadJson("actors-creatures.json"), "creature");
    const result = await createMissingDocuments("Actor", actors, { folderName: "HKRPG — Монстры и существа" });
    ui.notifications.info(`HKRPG: существа импортированы. Создано ${result.created}, пропущено ${result.skipped}.`);
    return result;
  },

  async importNpcs() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = normalizeActors(await loadJson("actors-npcs.json"), "npc");
    const result = await createMissingDocuments("Actor", actors, { folderName: "HKRPG — НИПы" });
    ui.notifications.info(`HKRPG: НИПы импортированы. Создано ${result.created}, пропущено ${result.skipped}.`);
    return result;
  },

  async importAll() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const items = await this.importItems();
    const creatures = await this.importCreatures();
    const npcs = await this.importNpcs();
    const summary = { items, creatures, npcs };
    console.log("HKRPG | content import", summary);
    ChatMessage.create({
      content: `<h2>HKRPG: импорт контента</h2>
        <p><b>Предметы:</b> создано ${items.created}, пропущено ${items.skipped}</p>
        <p><b>Монстры и существа:</b> создано ${creatures.created}, пропущено ${creatures.skipped}</p>
        <p><b>НИПы:</b> создано ${npcs.created}, пропущено ${npcs.skipped}</p>`
    });
    return summary;
  }
};
