import { getRssFeeds, getSourceByUrl } from "./db";
import { fetchFeedItems } from "./rss";
import { saveSource, htmlToText } from "./ingest";
import { normalizeUrl } from "./url";
import type { Source } from "./types";

// Bounds so a single tap stays fast — a few fresh items per feed, capped overall.
const ITEMS_PER_FEED = 5;
const MAX_NEW_SOURCES = 8;

export async function discoverLatest(opts: { itemsPerFeed?: number; maxNew?: number } = {}): Promise<{
  newSources: Source[];
  skippedDuplicates: number;
  feedsChecked: number;
  feedErrors: string[];
}> {
  const itemsPerFeed = opts.itemsPerFeed ?? ITEMS_PER_FEED;
  const maxNew = opts.maxNew ?? MAX_NEW_SOURCES;
  const feeds = getRssFeeds() as { name: string; url: string }[];
  const newSources: Source[] = [];
  let skippedDuplicates = 0;
  const feedErrors: string[] = [];

  // Fetch feeds concurrently; ingest sequentially (embedding is the slow, CPU-bound part).
  const results = await Promise.allSettled(feeds.map((f) => fetchFeedItems(f.url)));

  for (const [i, result] of results.entries()) {
    if (newSources.length >= maxNew) break;
    if (result.status === "rejected") {
      feedErrors.push(feeds[i].name);
      continue;
    }
    for (const item of result.value.items.slice(0, itemsPerFeed)) {
      if (newSources.length >= maxNew) break;
      if (!item.link) continue;
      let url: string;
      try {
        url = normalizeUrl(item.link);
      } catch {
        continue;
      }
      if (getSourceByUrl(url)) {
        skippedDuplicates++;
        continue;
      }
      const saved = await saveSource({ title: item.title, url, content: htmlToText(item.content || item.title) });
      if (saved.alreadyResearched) skippedDuplicates++;
      else newSources.push(saved.source);
    }
  }

  return { newSources, skippedDuplicates, feedsChecked: feeds.length, feedErrors };
}
