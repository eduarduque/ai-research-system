import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser({
  customFields: { item: ["content:encoded", "description"] },
});

export async function POST(req: NextRequest) {
  try {
    const { feedUrl } = await req.json();
    if (!feedUrl) {
      return NextResponse.json({ error: "feedUrl is required" }, { status: 400 });
    }

    // Fetch manually so we control headers — many sites block requests without a User-Agent
    let feedText: string;
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      feedText = await res.text();
    } catch {
      return NextResponse.json({ error: "Could not reach the feed URL. It may be down or blocking requests." }, { status: 422 });
    }

    let feed;
    try {
      feed = await parser.parseString(feedText);
    } catch {
      return NextResponse.json({ error: "Could not parse RSS feed. The URL may not be a valid RSS/Atom feed." }, { status: 422 });
    }

    const items = (feed.items || []).slice(0, 20).map((item) => ({
      title: item.title || "Untitled",
      link: item.link || "",
      content:
        (item as unknown as Record<string, unknown>)["content:encoded"] as string ||
        item.contentSnippet ||
        item.content ||
        "",
      pubDate: item.pubDate || item.isoDate || "",
    }));

    return NextResponse.json({ feedTitle: feed.title, items });
  } catch (err) {
    console.error("rss/fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
