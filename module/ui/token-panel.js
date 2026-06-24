// module/ui/token-panel.js
import { HK } from "../hk.js";

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ownedControlledActor() {
  const tokens = canvas?.tokens?.controlled ?? [];
  const token = tokens.find(t => t.actor?.isOwner) ?? null;
  return token?.actor ? { token, actor: token.actor } : null;
}

function button(label, cls, item = null, title = "") {
  const itemAttr = item ? ` data-item-id="${item.id}"` : "";
  return `<button type="button" class="${cls}"${itemAttr} title="${title || label}">${label}</button>`;
}

function renderPanel() {
  $("#hk-token-panel").remove();
  const selected = ownedControlledActor();
  if (!selected) return;

  const { actor } = selected;
  const weapons = actor.items.filter(i => i.type === "weapon").slice(0, 8);
  const arts = actor.items.filter(i => i.type === "art" && i.system?.prepared === true).slice(0, 6);
  const spells = actor.items.filter(i => i.type === "spell" && i.system?.prepared === true).slice(0, 6);
  const consumables = actor.items.filter(i => i.type === "consumable" && n(i.system?.quantity, 1) > 0).slice(0, 6);
  const equipped = actor.items.filter(i => ["armor", "shield", "focus", "charm", "gear"].includes(i.type) && (i.system?.equipped === true || i.system?.attuned === true)).slice(0, 8);

  const heart = actor.system?.pools?.heart ?? {};
  const soul = actor.system?.pools?.soul ?? {};
  const stam = actor.system?.pools?.stam ?? {};

  const html = $(`
    <aside id="hk-token-panel" class="hk-token-panel">
      <header>
        <img src="${actor.img}"/>
        <div>
          <b>${actor.name}</b>
          <div class="hk-muted">Сердца ${heart.value}/${heart.max} · Душа ${soul.value}/${soul.max} · Вын. ${stam.value}/${stam.max}</div>
        </div>
      </header>
      <section>
        <h4>Оружие</h4>
        <div class="hk-panel-actions">${weapons.map(w => button(w.name, "hk-panel-attack", w, "Атака оружием")).join("") || `<span class="hk-muted">Нет оружия</span>`}</div>
      </section>
      <section>
        <h4>Искусства и Тайны</h4>
        <div class="hk-panel-actions">${[...arts, ...spells].map(t => button(t.name, "hk-panel-use-tech", t, "Использовать подготовленную технику")).join("") || `<span class="hk-muted">Нет подготовленных техник</span>`}</div>
      </section>
      <section>
        <h4>Расходники</h4>
        <div class="hk-panel-actions">${consumables.map(c => button(`${c.name} ×${n(c.system?.quantity, 1)}`, "hk-panel-use-consumable", c, "Использовать расходник")).join("") || `<span class="hk-muted">Нет расходников</span>`}</div>
      </section>
      <section>
        <h4>Снаряжение</h4>
        <div class="hk-panel-tags">${equipped.map(i => `<span>${i.name}</span>`).join("") || `<span class="hk-muted">Ничего не надето</span>`}</div>
      </section>
      <footer>
        ${button("Вын.", "hk-panel-recover", null, "Восстановить Выносливость")}
        ${button("Фокус", "hk-panel-focus", null, "Фокусировка Души")}
        ${button("Лист", "hk-panel-open", null, "Открыть лист")}
      </footer>
    </aside>
  `);

  html.find(".hk-panel-attack").on("click", async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await HK.rollWeaponAttack(actor, item, { sourceToken: selected.token });
  });
  html.find(".hk-panel-use-tech").on("click", async ev => HK.useTechnique(actor.items.get(ev.currentTarget.dataset.itemId), actor));
  html.find(".hk-panel-use-consumable").on("click", async ev => HK.useConsumable(actor.items.get(ev.currentTarget.dataset.itemId), actor));
  html.find(".hk-panel-recover").on("click", async () => { await HK.recoverStamina(actor); renderPanel(); });
  html.find(".hk-panel-focus").on("click", async () => { await HK.focusSoul(actor); renderPanel(); });
  html.find(".hk-panel-open").on("click", () => actor.sheet?.render(true));

  $(document.body).append(html);
}

async function setActorTokenSize(actor, { width = 1, height = width, updateActiveTokens = true } = {}) {
  if (!actor?.isOwner) return ui.notifications.warn("Нет прав менять размер токена.");
  width = Math.max(0.25, n(width, 1));
  height = Math.max(0.25, n(height, width));
  await actor.update({
    "system.token.width": width,
    "system.token.height": height,
    "prototypeToken.width": width,
    "prototypeToken.height": height
  });
  if (updateActiveTokens) {
    const updates = actor.getActiveTokens(true, true).map(t => ({ _id: t.id, width, height }));
    if (updates.length) await canvas.scene.updateEmbeddedDocuments("Token", updates);
  }
  ui.notifications.info(`HKRPG: размер токена ${width}×${height}.`);
  renderPanel();
}

Hooks.once("ready", () => {
  game.hk = game.hk ?? {};
  game.hk.setActorTokenSize = setActorTokenSize;
  HK.setActorTokenSize = setActorTokenSize;
  renderPanel();
});

Hooks.on("controlToken", renderPanel);
Hooks.on("updateActor", renderPanel);
Hooks.on("createItem", renderPanel);
Hooks.on("updateItem", renderPanel);
Hooks.on("deleteItem", renderPanel);
Hooks.on("canvasReady", renderPanel);
