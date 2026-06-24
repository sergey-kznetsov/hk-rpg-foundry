// module/content/actor-enrichment.js
import { HKContentImporter } from "./importer.js";

export async function enrichActors() {
  return HKContentImporter.syncManualActors?.() ?? ui.notifications.warn("Синхронизация документных актёров недоступна: обнови систему до версии с importer.syncManualActors.");
}

Hooks.once("ready", () => {
  game.hk = game.hk ?? {};
  game.hk.enrichActors = enrichActors;
  game.hk.syncManualActors = enrichActors;
});
