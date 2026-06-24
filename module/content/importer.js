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
    const items = await loadJson("items-core.json");
    const result = await createMissingDocuments("Item", items, { folderName: "HKRPG — Предметы" });
    ui.notifications.info(`HKRPG: предметы импортированы. Создано ${result.created}, пропущено ${result.skipped}.`);
    return result;
  },

  async importCreatures() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = await loadJson("actors-creatures.json");
    const result = await createMissingDocuments("Actor", actors, { folderName: "HKRPG — Монстры и существа" });
    ui.notifications.info(`HKRPG: существа импортированы. Создано ${result.created}, пропущено ${result.skipped}.`);
    return result;
  },

  async importNpcs() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = await loadJson("actors-npcs.json");
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
