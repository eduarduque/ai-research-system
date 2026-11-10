import { countSources } from "./db";
import { discoverLatest } from "./discover";
import { reindexStale } from "./indexing";

/**
 * First-boot experience: pull a couple of items from each default feed so the
 * library, search and graph aren't empty. Also backfills chunks/embeddings for
 * sources created by older versions (or after switching embedding models).
 * Runs in the background — never blocks server startup.
 */
export async function seedAndBackfill() {
  try {
    if (countSources() === 0 && process.env.SEED_ON_BOOT !== "false") {
      const { newSources } = await discoverLatest({ itemsPerFeed: 2, maxNew: 10 });
      console.log(`Seeded ${newSources.length} sources from default feeds.`);
    }
    const reindexed = await reindexStale();
    if (reindexed > 0) console.log(`Indexed ${reindexed} source(s) for retrieval.`);
  } catch (err) {
    console.warn("Seed/backfill failed:", err instanceof Error ? err.message : err);
  }
}
