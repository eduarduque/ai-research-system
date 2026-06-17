import Parser from "rss-parser";
import { v4 as uuidv4 } from "uuid";
import { getSources, insertSource, updateSourceEmbedding } from "./db";
import { embedText } from "./embeddings";

const DEFAULT_FEEDS = [
  { name: "Hacker News", url: "https://news.ycombinator.com/rss" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },
];

const ITEMS_PER_FEED = 2;

export async function seedDefaultSources() {
  const existing = getSources() as { id: string }[];
  if (existing.length > 0) return;

  const parser = new Parser({ timeout: 10000 });

  for (const feed of DEFAULT_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items.slice(0, ITEMS_PER_FEED);

      for (const item of items) {
        if (!item.link) continue;

        const id = uuidv4();
        const rawContent = item.contentSnippet || item.content || item.title || "";
        const source = {
          id,
          title: (item.title || item.link).trim(),
          url: item.link,
          content: rawContent.slice(0, 20000),
          date_ingested: new Date().toISOString(),
        };

        try {
          insertSource(source);

          const embedding = await embedText(
            `${source.title}\n\n${source.content.slice(0, 8000)}`
          );
          updateSourceEmbedding(id, embedding);
        } catch {
          // skip if insert fails (e.g. duplicate)
        }
      }
    } catch {
      // skip unreachable feeds silently
    }
  }
}
