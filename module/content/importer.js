// module/content/importer.js
const CONTENT_BASE = "systems/hk-rpg/data";
const ITEM_SEED_FILES = ["items-core.json", "rules-core.json"];

const ITEM_ROOT = "HKRPG — Предметы и правила";
const CREATURE_ROOT = "HKRPG — Монстры и существа";
const NPC_ROOT = "HKRPG — НИПы";

const ITEM_TYPE_FOLDERS = {
  weapon: ["Снаряжение", "Оружие"],
  shield: ["Снаряжение", "Щиты"],
  armor: ["Снаряжение", "Броня"],
  focus: ["Снаряжение", "Фокусировки"],
  charm: ["Амулеты"],
  condition: ["Правила", "Состояния"],
  trait: ["Правила", "Черты"],
  path: ["Правила", "Пути"],
  art: ["Правила", "Искусства"],
  spell: ["Правила", "Тайны"],
  consumable: ["Расходники"],
  gear: ["Снаряжение", "Прочее"]
};

const CONSUMABLE_KIND_FOLDERS = {
  food: "Еда",
  potion: "Зелья",
  alcohol: "Алкоголь",
  flask: "Склянки",
  poison: "Яды",
  trap: "Ловушки",
  misc: "Прочее",
  "еда": "Еда",
  "зелье": "Зелья",
  "зелья": "Зелья",
  "алкоголь": "Алкоголь",
  "склянка": "Склянки",
  "склянки": "Склянки",
  "яд": "Яды",
  "яды": "Яды",
  "ловушка": "Ловушки",
  "ловушки": "Ловушки"
};

const GEAR_KIND_FOLDERS = {
  tool: "Инструменты",
  tools: "Инструменты",
  treasure: "Сокровища",
  find: "Находки",
  finding: "Находки",
  belt: "Предметы пояса",
  gear: "Прочее",
  misc: "Прочее",
  "инструмент": "Инструменты",
  "инструменты": "Инструменты",
  "сокровище": "Сокровища",
  "сокровища": "Сокровища",
  "находка": "Находки",
  "находки": "Находки",
  "пояс": "Предметы пояса"
};

const CREATURE_CATEGORY_RULES = [
  { folder: "Адаптация Hallownest", names: ["Ползуны", "Топтуны", "Мстекрылы", "Жужжалка", "Аспиды", "Молодняк аспидов", "Опарыши", "Древние бальдры", "Младший бальдр", "Мшистики", "Лишайники", "Мшистые громилы", "Живень"] },
  { folder: "Великое Древо", names: ["Обил", "Ворокрыл", "Носложуки", "Трамаходы", "Корахват", "Громожуки", "Статики", "Панцирекруги", "Друлитки", "Таптики", "Моховички", "Моховики шаманы", "Мшистые колоссы"] },
  { folder: "Зона Оукшейда", names: ["Мерзкие Плеваки", "Камнескоки", "Пружехвосты", "Бронежуки", "Роющие кристалопанцири", "Эстиды", "Сниффиды"] },
  { folder: "Пыль и пустоши", names: ["Владыки пустоши", "Клятвошипы", "Смертобросы", "Пылевые дьяволы", "Жутестрах", "Игла жутестраха", "Тератера", "Существо из старых времен", "Странник Пустоши", "Пусточерви", "Пустоторождённые"] },
  { folder: "Летающие и роевые", names: ["Флафферы", "Булавочники", "Булавочники — крупная вариация", "Стаджеры", "Сприверы", "Бисерокрыл", "Узлокрыл", "Стрекозы", "Стрекозы — крупная вариация", "Личинка стрекозы", "Комары", "Даорокрыл"] },
  { folder: "Болота, грибы и гниль", names: ["Шерстяная тля", "Флурф", "Флурф-родитель", "Холможук", "Зеленые садовые слизни", "Тактики", "Трюфели", "Грузилы", "Гнилурны", "Гнильщики", "Кляксы", "Хлюпки"] },
  { folder: "Грёзы и тени", names: ["Чурлы", "Валдунид", "Неразлучники", "Неразлучники — крупная вариация", "Вриг", "Мрачлуны", "Архилуны", "Тени", "Меридиены", "Гробоносцы", "Накопитель", "Накопитель — крупная вариация", "Забытые"] },
  { folder: "Особые и крупные угрозы", names: ["Кракен", "Светопийцы", "Кукиты", "Струйщик", "Конькоспины", "Мосус Колосус", "Глулбы", "Пугличи"] }
];

const NPC_CATEGORY_RULES = [
  { folder: "Хранители порядка", names: ["Пчела-часовой", "Пчела-целитель", "Оса-страж", "Оса-рыцарь", "Жесткокрылый Смотритель", "Бабочка-разведчик", "Богомол-шпион", "Богомол-убийца", "Муравей-солдат"] },
  { folder: "Дивные видения", names: ["Богомол-охотник", "Улитка-шаман", "Термит-хранитель", "Таракан-алхимик", "Ткач-охотник", "Мотылёк-лампоносец"] },
  { folder: "Неприятные типы", names: ["Цикада-саботёр", "Ткач-колдун", "Блоха-разбойник", "Скорпион-воитель", "Скорпион-поработитель", "Скорпион-заклинатель пыли", "Цикада-барабанщик", "Саранча-прорицатель"] },
  { folder: "Пыль и оболочки", names: ["Малая Оболочка", "Рогатая Оболочка", "Летающая Оболочка", "Земляная Оболочка", "Оболочка Голода", "Оболочка-гигант", "Оболочка-волхв", "Драколич", "Скорпион-пылевой лич"] },
  { folder: "Серебряные муравьи и паладины", names: ["Серебряный муравей-привратник", "Серебряный муравей-щитоносец", "Серебряный муравей-лихач", "Скорпион-рыцарь шипа", "Мокрица-гладиатор", "Воин клана Жуков", "Хранитель Искусств клана Жуков", "Галловый паладин-новобранец (оса)", "Галловый паладин-защитник"] },
  { folder: "Осквернители", names: ["Ученик Осквернителя (оса)", "Избранный Осквернитель (оса)", "Паладин-Осквернитель (оса)"] },
  { folder: "Болото и кровь", names: ["Пиявка вызыватель духов", "Пиявка знахарь", "Пиявка маг крови", "Пиявка ведьмак", "Москит-болотник (Женский)", "Москит-подлец (Женский)", "Москит-ловец (Мужской)", "Клещ-засадник", "Клещ берсерк", "Клещ рейнджер", "Болотный слизняк-здоровяк", "Болотный слизняк маг крови", "Старейша болотных слизняков (Патриарх/Матриарх)", "Москит жрец гниения (Мужской)"] },
  { folder: "Жуки-ассасины", names: ["Жук-ассасин охотник", "Жук-ассасин призыватель грёз", "Жук-ассасин призыватель кошмаров", "Жук-ассасин лидер клана"] },
  { folder: "Расео и духи", names: ["Эн’Расео Скорби", "Эн’Расео Страха", "Эн’Расео Гнева", "Эн’Расео Одержимости", "Со’Расео Радости", "Со’Расео Любви", "Со’Расео Амбиций", "Со’Расео Усталости", "Призрак старицы"] }
];

function namesToCategoryMap(rules) {
  const map = new Map();
  for (const rule of rules) for (const name of rule.names) map.set(name, rule.folder);
  return map;
}

const CREATURE_CATEGORY_BY_NAME = namesToCategoryMap(CREATURE_CATEGORY_RULES);
const NPC_CATEGORY_BY_NAME = namesToCategoryMap(NPC_CATEGORY_RULES);

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
  const base = { description: extra.description ?? "", source, notes: extra.notes ?? "", effects: extra.effects ?? [] };
  if (type === "weapon") return foundry.utils.mergeObject(base, { quality: 1, weight: 1, hands: 1, equipped: false, attack: { stat: "pow", skill: "soldier", range: 1, damageBase: 2, damageType: "physical", kind: "melee", weaponTypes: [] }, cost: { stamTax: 1, stamInvestMax: 3 }, flags: { ignoreDR: 0, ignoreArmorAbsorb: false, pairable: false, provokesAdjacent: false }, price: 0 }, { inplace: false });
  if (type === "shield") return foundry.utils.mergeObject(base, { quality: 1, weight: 1, hands: 1, equipped: false, defense: { parryBonus: 0, dr: 0, durability: { value: 0, max: 0 }, absorption: 0, absorbDice: 0 }, price: 0 }, { inplace: false });
  if (type === "armor") return foundry.utils.mergeObject(base, { kind: "light", weight: 1, equipped: false, defense: { dr: 0, durability: { value: 5, max: 5 }, absorbBonus: 1, absorbRerolls: 0 }, price: 0 }, { inplace: false });
  if (type === "focus") return foundry.utils.mergeObject(base, { quality: 1, focusType: "", damageBase: 0, range: "", hands: 1, weight: 0, attuned: false, price: 0 }, { inplace: false });
  if (type === "condition") return foundry.utils.mergeObject(base, { stackable: true, stacks: { value: 0, max: 3 }, duration: { type: "rounds", value: 0 }, modifiers: { attackDiceDelta: 0, defenseDiceDelta: 0, speedDelta: 0 } }, { inplace: false });
  if (type === "trait") return foundry.utils.mergeObject(base, { hunger: 0, fright: 0, appeal: 0, isSubtrait: false }, { inplace: false });
  if (type === "path") return foundry.utils.mergeObject(base, { category: extra.category ?? "martial", rank: 1, prepared: false }, { inplace: false });
  if (type === "art") return foundry.utils.mergeObject(base, { path: extra.path ?? "", rank: 1, prepared: false, cost: { stam: 0, soul: 0 } }, { inplace: false });
  if (type === "spell") return foundry.utils.mergeObject(base, { mystery: extra.mystery ?? "", rank: 1, prepared: false, cost: { soul: 1 }, range: extra.range ?? "touch" }, { inplace: false });
  if (type === "charm") return foundry.utils.mergeObject(base, { rarity: extra.rarity ?? "common", marks: extra.marks ?? 1, equipped: false, fragile: false, cursed: false }, { inplace: false });
  if (type === "consumable") return foundry.utils.mergeObject(base, { kind: extra.kind ?? "misc", quantity: 1, satiety: 0, effect: extra.effect ?? "", rarity: extra.rarity ?? "common", strength: 0, reusable: false, weight: 0, price: 0 }, { inplace: false });
  if (type === "gear") return foundry.utils.mergeObject(base, { kind: extra.kind ?? "gear", quality: 0, weight: 1, quantity: 1, equipped: false, price: 0 }, { inplace: false });
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
      if (typeof entry === "string") {
        result.push({ name: entry, type, system: defaultItemSystem(type, source) });
      } else {
        const itemType = entry.type ?? type;
        const base = defaultItemSystem(itemType, entry.source ?? source, entry);
        const system = foundry.utils.mergeObject(base, entry.system ?? {}, { inplace: false });
        result.push({ name: entry.name, type: itemType, img: entry.img, system });
      }
    }
  }
  return result;
}

function normalizeActors(raw, kind) {
  if (Array.isArray(raw) && raw[0]?.type) return raw;
  const source = raw.source ?? "HKRPG content";
  const names = Array.isArray(raw) ? raw : (raw.actors ?? []);
  return names.map(entry => {
    if (typeof entry !== "string" && entry.type) return entry;
    const name = typeof entry === "string" ? entry : entry.name;
    const baseSystem = defaultActorSystem(source, kind);
    const system = typeof entry === "string" ? baseSystem : foundry.utils.mergeObject(baseSystem, entry.system ?? {}, { inplace: false });
    return { name, type: "bug", system, items: entry.items ?? [] };
  });
}

function normalizedKind(value) {
  return String(value ?? "").trim().toLowerCase();
}

function inferConsumableFolder(item) {
  const kind = normalizedKind(item.system?.kind);
  if (CONSUMABLE_KIND_FOLDERS[kind]) return CONSUMABLE_KIND_FOLDERS[kind];

  const name = item.name.toLowerCase();
  if (/(мясо|растен|гриб|па[её]к|нектар|мед|амброз)/i.test(name)) return "Еда";
  if (/(брага|вино|пиво|эль|виски|медовуха|бренди|сидр)/i.test(name)) return "Алкоголь";
  if (/(склян|снаряд|мина|шип|силки|паутина|бомбардир|муравлев|саранчи|заводной|тотем)/i.test(name)) return "Склянки и ловушки";
  return "Прочее";
}

function inferGearFolder(item) {
  const kind = normalizedKind(item.system?.kind);
  if (GEAR_KIND_FOLDERS[kind]) return GEAR_KIND_FOLDERS[kind];

  const name = item.name.toLowerCase();
  if (/(кирка|лом|плащ|удочка|книга|набор|молот|пила|прибор)/i.test(name)) return "Инструменты";
  if (/(бальзам|бинты|заплатка|воск|брус|руда|лепесток|осколок|ячейка)/i.test(name)) return "Находки";
  if (/(подсумок|седло|светокамень|лампочка|фонарь|ловец|сальник|янтарь|сердце|клешня|накидка|крылья)/i.test(name)) return "Предметы пояса";
  return "Прочее";
}

function itemFolderPath(item) {
  const path = [ITEM_ROOT, ...(ITEM_TYPE_FOLDERS[item.type] ?? ["Прочее"] )];
  if (item.type === "consumable") path.push(inferConsumableFolder(item));
  if (item.type === "gear") path.push(inferGearFolder(item));
  return path;
}

function inferActorCategory(actor) {
  const explicit = actor.system?.category ?? actor.system?.folderCategory ?? actor.system?.role;
  if (explicit) return String(explicit);

  const kind = actor.system?.kind;
  if (kind === "creature") return CREATURE_CATEGORY_BY_NAME.get(actor.name) ?? "Прочие существа";
  if (kind === "npc") return NPC_CATEGORY_BY_NAME.get(actor.name) ?? "Прочие НИПы";
  return "Без категории";
}

function actorFolderPath(root, actor) {
  const source = String(actor.system?.source ?? "").trim() || "Без источника";
  return [root, source, inferActorCategory(actor)];
}

function folderParentId(folder) {
  return folder.folder?.id ?? folder.parent?.id ?? folder._source?.folder ?? null;
}

function findFolder(documentName, name, parentId) {
  return game.folders.find(f =>
    f.type === documentName &&
    f.name === name &&
    (folderParentId(f) ?? null) === (parentId ?? null)
  );
}

async function ensureFolderPath(documentName, names, cache = new Map()) {
  const cleanNames = names.filter(Boolean);
  let parent = null;

  for (const name of cleanNames) {
    const parentId = parent?.id ?? null;
    const key = `${documentName}:${parentId ?? "root"}:${name}`;
    let folder = cache.get(key) ?? findFolder(documentName, name, parentId);

    if (!folder) {
      folder = await Folder.create({
        name,
        type: documentName,
        folder: parentId,
        sorting: "a"
      });
    }

    cache.set(key, folder);
    parent = folder;
  }

  return parent;
}

async function moveExistingDocuments(documentName, docs, folderForDoc, existingByKey, folderCache) {
  if (!folderForDoc) return 0;

  const updates = [];
  for (const doc of docs) {
    const existing = existingByKey.get(sourceKey(doc));
    if (!existing) continue;

    const path = folderForDoc(doc);
    if (!path?.length) continue;

    const folder = await ensureFolderPath(documentName, path, folderCache);
    if (existing.folder?.id === folder.id) continue;

    updates.push({ _id: existing.id, folder: folder.id });
  }

  if (!updates.length) return 0;

  const cls = documentName === "Actor" ? Actor : Item;
  await cls.updateDocuments(updates);
  return updates.length;
}

async function createMissingDocuments(documentName, docs, { folderName, folderForDoc, organizeExisting = true } = {}) {
  const cls = documentName === "Actor" ? Actor : Item;
  const collection = documentName === "Actor" ? game.actors : game.items;
  const existingByKey = new Map(collection.map(d => [d.getFlag("hk-rpg", "sourceKey") ?? sourceKey(d), d]));
  const pending = [];
  const folderCache = new Map();

  const makePath = doc => {
    if (folderForDoc) return folderForDoc(doc);
    if (folderName) return [folderName];
    return null;
  };

  for (const doc of docs) {
    const key = sourceKey(doc);
    if (existingByKey.has(key)) continue;

    const copy = foundry.utils.mergeObject(foundry.utils.deepClone(doc), {
      flags: { "hk-rpg": { sourceKey: key, importedAt: new Date().toISOString() } }
    }, { inplace: false });

    const path = makePath(doc);
    if (path?.length) {
      const folder = await ensureFolderPath(documentName, path, folderCache);
      copy.folder = folder.id;
    }

    pending.push(copy);
  }

  let moved = 0;
  if (organizeExisting) moved = await moveExistingDocuments(documentName, docs, makePath, existingByKey, folderCache);

  if (pending.length) await cls.createDocuments(pending, { keepId: false });

  return { created: pending.length, skipped: docs.length - pending.length, moved };
}

async function loadAllItems() {
  const raws = await Promise.all(ITEM_SEED_FILES.map(loadJson));
  return raws.flatMap(normalizeItems);
}

export const HKContentImporter = {
  async importItems() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const items = await loadAllItems();
    const result = await createMissingDocuments("Item", items, { folderForDoc: itemFolderPath });
    ui.notifications.info(`HKRPG: предметы и правила импортированы. Создано ${result.created}, пропущено ${result.skipped}, перемещено ${result.moved}.`);
    return result;
  },

  async importCreatures() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = normalizeActors(await loadJson("actors-creatures.json"), "creature");
    const result = await createMissingDocuments("Actor", actors, { folderForDoc: actor => actorFolderPath(CREATURE_ROOT, actor) });
    ui.notifications.info(`HKRPG: существа импортированы. Создано ${result.created}, пропущено ${result.skipped}, перемещено ${result.moved}.`);
    return result;
  },

  async importNpcs() {
    if (!game.user.isGM) return ui.notifications.warn("Импорт HKRPG доступен только Мастеру.");
    const actors = normalizeActors(await loadJson("actors-npcs.json"), "npc");
    const result = await createMissingDocuments("Actor", actors, { folderForDoc: actor => actorFolderPath(NPC_ROOT, actor) });
    ui.notifications.info(`HKRPG: НИПы импортированы. Создано ${result.created}, пропущено ${result.skipped}, перемещено ${result.moved}.`);
    return result;
  },

  async organizeContent() {
    if (!game.user.isGM) return ui.notifications.warn("Организация HKRPG доступна только Мастеру.");
    const items = await this.importItems();
    const creatures = await this.importCreatures();
    const npcs = await this.importNpcs();
    const summary = { items, creatures, npcs };
    ui.notifications.info("HKRPG: папки контента обновлены.");
    console.log("HKRPG | content organize", summary);
    return summary;
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
        <p><b>Предметы и правила:</b> создано ${items.created}, пропущено ${items.skipped}, перемещено ${items.moved}</p>
        <p><b>Монстры и существа:</b> создано ${creatures.created}, пропущено ${creatures.skipped}, перемещено ${creatures.moved}</p>
        <p><b>НИПы:</b> создано ${npcs.created}, пропущено ${npcs.skipped}, перемещено ${npcs.moved}</p>`
    });
    return summary;
  }
};
