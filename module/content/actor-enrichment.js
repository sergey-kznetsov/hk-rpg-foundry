// module/content/actor-enrichment.js

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function kindOf(actor) {
  return String(actor.system?.kind ?? "").toLowerCase();
}

function isImportedHKActor(actor) {
  return actor?.type === "bug" && (actor.getFlag("hk-rpg", "sourceKey") || ["npc", "creature"].includes(kindOf(actor)));
}

function sourceLabel(actor) {
  return actor.system?.source ?? (kindOf(actor) === "npc" ? "Записки Дуэлянта" : "Журнал Скальда");
}

function roleByName(name, kind) {
  const lower = name.toLowerCase();
  if (/целител|знахарь|шаман|жрец|цвет|пыльц/.test(lower)) return "поддержка / магия";
  if (/страж|рыцарь|паладин|смотритель|воин|солдат|гладиатор|защитник/.test(lower)) return "боевой противник ближней линии";
  if (/развед|шпион|ассасин|охотник|подлец|засад/.test(lower)) return "скрытность / точечные атаки";
  if (/алхим|склян|яд|химик|плевак|снаряд|стрел|пращ/.test(lower)) return "дальний бой / эффекты";
  if (/оболоч|забытые|тень|расео|дух|грез|кошмар/.test(lower)) return "мистическая угроза";
  if (/гигант|колосс|кракен|драколич|владык|черв|огром/.test(lower)) return "крупная угроза";
  return kind === "npc" ? "разумный НИП" : "дикое существо";
}

function descriptionFor(actor) {
  const name = actor.name;
  const kind = kindOf(actor);
  const role = roleByName(name, kind);
  if (actor.system?.profile?.description && !/требуется/i.test(actor.system.profile.description)) return actor.system.profile.description;
  if (kind === "npc") return `${name} — готовый НИП HKRPG из источника «${sourceLabel(actor)}». Роль: ${role}. Используй его как разумного жука с мотивами, снаряжением и тактическими решениями, а не как безымянного монстра.`;
  return `${name} — существо HKRPG из источника «${sourceLabel(actor)}». Роль: ${role}. До точной ручной сверки статблока это игровая заготовка: проверь Сердца, защиты, атаки и особенности перед важной сценой.`;
}

function tacticsFor(actor) {
  const lower = actor.name.toLowerCase();
  if (/целител|знахарь|шаман|цвет|пыльц/.test(lower)) return "Держится за союзниками, тратит действия на поддержку, контроль поля и лечение. В ближний бой вступает только при угрозе.";
  if (/страж|рыцарь|паладин|смотритель|защитник/.test(lower)) return "Держит линию, прикрывает союзников, вынуждает противников тратить Выносливость на защиту и отступление.";
  if (/шпион|ассасин|охотник|засад|камне|кукит/.test(lower)) return "Начинает из укрытия или выгодной позиции. Предпочитает слабые цели, изоляцию и отход после удара.";
  if (/плевак|аспид|снаряд|стрел|пращ|комар|москит/.test(lower)) return "Сохраняет дистанцию, давит дальними атаками и эффектами. Отступает, если противник навязывает ближний бой.";
  if (/оболоч|тень|расео|дух|грез|кошмар/.test(lower)) return "Играет от мистических особенностей, страха, Души или особых иммунитетов. Перед боем проверь текст особенностей.";
  if (/гигант|колосс|кракен|драколич|черв|владык/.test(lower)) return "Использует размер и давление позиции. Его атаки должны менять сцену: отбрасывать, перекрывать путь или вынуждать группу рассредоточиться.";
  return "Использует самую сильную доступную атаку, защищается Панцирем и старается действовать согласно роли в сцене. Перед важным боем уточни особенности вручную.";
}

function weaponFor(actor) {
  const lower = actor.name.toLowerCase();
  if (/пращ|стрел|плевак|аспид|снаряд|комар|москит/.test(lower)) {
    return {
      name: "Дальняя природная атака",
      type: "weapon",
      system: {
        description: "Автозаготовка: дальняя атака по описанию существа. Сверь урон, дальность и особые эффекты с источником перед важной сценой.",
        quality: 1, weight: 0, hands: 0, equipped: true, source: sourceLabel(actor),
        attack: { stat: "grace", skill: "scout", range: 4, damageBase: 2, damageType: "physical", kind: "ranged", weaponTypes: ["natural"] },
        cost: { stamTax: 1, stamInvestMax: 3 }, flags: { ignoreDR: 0, ignoreArmorAbsorb: false, pairable: false, provokesAdjacent: true }, effects: []
      }
    };
  }
  if (/шаман|маг|жрец|грез|кошмар|расео|дух|волхв/.test(lower)) {
    return {
      name: "Мистический удар",
      type: "weapon",
      system: {
        description: "Автозаготовка: магическая или духовная атака. Сверь точные свойства, Душу и сопротивления с источником.",
        quality: 1, weight: 0, hands: 0, equipped: true, source: sourceLabel(actor),
        attack: { stat: "insight", skill: "lore", range: 3, damageBase: 2, damageType: "magic", kind: "spell", weaponTypes: ["mystic"] },
        cost: { stamTax: 0, stamInvestMax: 2 }, flags: { ignoreDR: 1, ignoreArmorAbsorb: false, pairable: false, provokesAdjacent: false }, effects: []
      }
    };
  }
  const damage = /гигант|колосс|кракен|драколич|владык|черв|больш|огром/.test(lower) ? 4 : 2;
  return {
    name: "Ближняя атака",
    type: "weapon",
    system: {
      description: "Автозаготовка: когти, жвалы, удар телом, оружие или другая основная ближняя атака. Сверь точное название и свойства с источником.",
      quality: 1, weight: damage >= 4 ? 2 : 1, hands: 1, equipped: true, source: sourceLabel(actor),
      attack: { stat: "pow", skill: "soldier", range: 1, damageBase: damage, damageType: "physical", kind: "melee", weaponTypes: ["natural"] },
      cost: { stamTax: 1, stamInvestMax: 3 }, flags: { ignoreDR: 0, ignoreArmorAbsorb: false, pairable: false, provokesAdjacent: false }, effects: []
    }
  };
}

function armorFor(actor) {
  const shell = n(actor.system?.stats?.shell?.value, 3);
  if (shell < 4 && !/страж|рыцарь|паладин|смотритель|броне|панцир/.test(actor.name.toLowerCase())) return null;
  const heavy = shell >= 5 || /тяж|броне|панцир|паладин|гигант|колосс/.test(actor.name.toLowerCase());
  return {
    name: heavy ? "Тяжёлая защита" : "Лёгкая защита",
    type: "armor",
    system: {
      description: "Автозаготовка защиты: панцирь, броня или природная оболочка. Сверь ПУ и Прочность с источником.",
      source: sourceLabel(actor), kind: heavy ? "heavy" : "light", weight: heavy ? 3 : 1, equipped: true,
      defense: { dr: heavy ? 2 : 1, durability: { value: heavy ? 9 : 5, max: heavy ? 9 : 5 }, absorbBonus: 1, absorbRerolls: heavy ? 0 : 1 },
      effects: [], price: 0
    }
  };
}

async function ensureEmbedded(actor, itemData) {
  if (!itemData) return false;
  const exists = actor.items.find(i => i.name === itemData.name && i.type === itemData.type);
  if (exists) return false;
  await actor.createEmbeddedDocuments("Item", [itemData]);
  return true;
}

export async function enrichActors({ actors = game.actors.contents, onlyImported = true } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Обогащение HKRPG доступно только Мастеру.");
  let updated = 0;
  let itemsCreated = 0;

  for (const actor of actors) {
    if (actor.type !== "bug") continue;
    if (onlyImported && !isImportedHKActor(actor)) continue;
    const kind = kindOf(actor) || "character";
    const role = roleByName(actor.name, kind);
    const updates = {
      "system.profile.description": descriptionFor(actor),
      "system.profile.role": role,
      "system.profile.tactics": tacticsFor(actor),
      "system.profile.attacks": actor.system?.profile?.attacks || "Основные атаки представлены предметами на листе. Автозаготовки нужно сверить с источником перед ключевым боем.",
      "system.token.width": n(actor.system?.token?.width, 1),
      "system.token.height": n(actor.system?.token?.height, n(actor.system?.token?.width, 1))
    };
    await actor.update(updates);
    updated += 1;
    if (kind === "npc" || kind === "creature") {
      if (await ensureEmbedded(actor, weaponFor(actor))) itemsCreated += 1;
      if (await ensureEmbedded(actor, armorFor(actor))) itemsCreated += 1;
    }
  }

  const result = { updated, itemsCreated };
  console.log("HKRPG | actors enriched", result);
  ui.notifications.info(`HKRPG: описания и базовые атаки обновлены. Актёров: ${updated}, предметов: ${itemsCreated}.`);
  return result;
}

Hooks.once("ready", () => {
  game.hk = game.hk ?? {};
  game.hk.enrichActors = enrichActors;
});
