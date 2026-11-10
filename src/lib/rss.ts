import Parser from "rss-parser";

const parser = new Parser({
  customFields: { item: ["content:encoded", "description"] },
});

export type RssItem = {
  title: string;
  link: string;
  content: string;
  pubDate: string;
};

export async function fetchFeedItems(feedUrl: string): Promise<{ feedTitle: string; items: RssItem[] }> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feedText = await res.text();

  const feed = await parser.parseString(feedText);

  const items = (feed.items || []).slice(0, 20).map((item) => ({
    title: item.title || "Untitled",
    link: item.link || "",
    content:
      ((item as unknown as Record<string, unknown>)["content:encoded"] as string) ||
      item.contentSnippet ||
      item.content ||
      "",
    pubDate: item.pubDate || item.isoDate || "",
  }));

  return { feedTitle: feed.title || feedUrl, items };
}
