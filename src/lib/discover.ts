import { v4 as uuidv4 } from "uuid";
import { getRssFeeds, getSourceByUrl, insertSource, getSourceById, updateSourceEmbedding } from "./db";
import { fetchFeedItems } from "./rss";
import { embedText } from "./embeddings";
import type { Source } from "./types";

// Bounds so a single tap stays fast — a few fresh items per feed, capped overall.
const ITEMS_PER_FEED = 5;
const MAX_NEW_SOURCES = 8;

export async function discoverLatest(): Promise<{
  newSources: Source[];
  skippedDuplicates: number;
  feedsChecked: number;
  feedErrors: string[];
}> {
  const feeds = getRssFeeds() as { name: string; url: string }[];
  const newSources: Source[] = [];
  let skippedDuplicates = 0;
  const feedErrors: string[] = [];

  for (const feed of feeds) {
    if (newSources.length >= MAX_NEW_SOURCES) break;

    let items;
    try {
      items = (await fetchFeedItems(feed.url)).items.slice(0, ITEMS_PER_FEED);
    } catch {
      feedErrors.push(feed.name);
      continue;
    }

    for (const item of items) {
      if (newSources.length >= MAX_NEW_SOURCES) break;
      if (!item.link) continue;

      // Already researched — this is exactly the "has this been covered before" check.
      if (getSourceByUrl(item.link)) {
        skippedDuplicates++;
        continue;
      }

      const id = uuidv4();
      const source = {
        id,
        title: item.title,
        url: item.link,
        content: (item.content || item.title).slice(0, 20000),
        date_ingested: new Date().toISOString(),
      };
      insertSource(source);

      try {
        const embedding = await embedText(`${source.title}\n\n${source.content.slice(0, 8000)}`);
        updateSourceEmbedding(id, embedding);
      } catch {
        // non-fatal — search falls back to keyword matching
      }

      newSources.push(getSourceById(id) as Source);
    }
  }

  return { newSources, skippedDuplicates, feedsChecked: feeds.length, feedErrors };
}
