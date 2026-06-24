// module/content/actor-enrichment.js
// Документная синхронизация актёров HKRPG.
// Здесь нет эвристических описаний: данные читаются из data/manual-actors-core.json,
// который извлечён из «Записок Дуэлянта» и «Журнала Скальда».

const MANUAL_ACTORS_FILE = "manual-actors-core.json";
const CONTENT_BASE = "systems/hk-rpg/data";

async function loadManualActors() {
  const response = await fetch(`${CONTENT_BASE}/${MANUAL_ACTORS_FILE}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Не удалось загрузить ${MANUAL_ACTORS_FILE}: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : (data.actors ?? []);
}

function sourceKey(doc) {
  const src = doc.system?.source ?? doc.system?.meta?.source ?? doc.system?.kind ?? "content";
  return `${doc.type}:${src}:${doc.name}`;
}

function embeddedKey(item, actorSource = "") {
  const src = item.system?.source ?? actorSource ?? "actor content";
  return `${item.type}:${src}:${item.name}`;
}

function withSyncFlag(data, key) {
  return foundry.utils.mergeObject(foundry.utils.deepClone(data), {
    flags: { "hk-rpg": { sourceKey: key, syncedAt: new Date().toISOString(), sourceSynced: true } }
  }, { inplace: false });
}

function findExistingActor(seed) {
  const key = sourceKey({ name: seed.name, type: seed.type ?? "bug", system: seed.system ?? {} });
  return game.actors.find(a => (a.getFlag("hk-rpg", "sourceKey") ?? sourceKey(a)) === key)
    ?? game.actors.find(a => a.type === (seed.type ?? "bug") && a.name === seed.name && String(a.system?.kind ?? "") === String(seed.system?.kind ?? ""))
    ?? game.actors.find(a => a.type === (seed.type ?? "bug") && a.name === seed.name);
}

async function syncEmbeddedItems(actor, seedItems = [], source = "") {
  let created = 0;
  let updated = 0;

  for (const item of seedItems) {
    const key = embeddedKey(item, source);
    const data = withSyncFlag(item, key);
    const existing = actor.items.find(i => (i.getFlag("hk-rpg", "sourceKey") ?? embeddedKey(i, source)) === key)
      ?? actor.items.find(i => i.name === item.name && i.type === item.type);

    if (existing) {
      await existing.update({ name: data.name, img: data.img, system: data.system, flags: data.flags });
      updated += 1;
    } else {
      await actor.createEmbeddedDocuments("Item", [data]);
      created += 1;
    }
  }

  return { created, updated };
}

async function syncActor(seed) {
  const actorSeed = {
    name: seed.name,
    type: seed.type ?? "bug",
    img: seed.img,
    system: seed.system ?? {},
    items: seed.items ?? []
  };
  const key = sourceKey(actorSeed);
  const actorData = withSyncFlag(actorSeed, key);
  let actor = findExistingActor(actorSeed);
  let createdActor = false;

  if (!actor) {
    actor = (await Actor.createDocuments([actorData], { keepId: false }))[0];
    createdActor = true;
  } else {
    const mergedSystem = foundry.utils.mergeObject(
      foundry.utils.deepClone(actor.system ?? {}),
      foundry.utils.deepClone(actorSeed.system ?? {}),
      { inplace: false }
    );
    await actor.update({ img: actorSeed.img ?? actor.img, system: mergedSystem, flags: actorData.flags });
  }

  const embedded = await syncEmbeddedItems(actor, actorSeed.items, actorSeed.system?.source);
  return { actor, createdActor, embedded };
}

export async function syncManualActors() {
  if (!game.user.isGM) return ui.notifications.warn("Синхронизация HKRPG доступна только Мастеру.");

  const actors = await loadManualActors();
  let createdActors = 0;
  let updatedActors = 0;
  let embeddedCreated = 0;
  let embeddedUpdated = 0;

  for (const seed of actors) {
    const result = await syncActor(seed);
    if (result.createdActor) createdActors += 1;
    else updatedActors += 1;
    embeddedCreated += result.embedded.created;
    embeddedUpdated += result.embedded.updated;
  }

  const summary = { sourceActors: actors.length, createdActors, updatedActors, embeddedCreated, embeddedUpdated };
  console.log("HKRPG | manual actors sync", summary);
  ui.notifications.info(`HKRPG: документные НИПы/монстры синхронизированы. Актёров: ${actors.length}, предметов создано ${embeddedCreated}, обновлено ${embeddedUpdated}.`);
  return summary;
}

export async function enrichActors() {
  return syncManualActors();
}

Hooks.once("ready", () => {
  game.hk = game.hk ?? {};
  game.hk.enrichActors = enrichActors;
  game.hk.syncManualActors = syncManualActors;
});
