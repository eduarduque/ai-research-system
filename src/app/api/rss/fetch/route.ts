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

    let feed;
    try {
      feed = await parser.parseURL(feedUrl);
    } catch {
      return NextResponse.json({ error: "Could not parse RSS feed. The feed URL may be invalid or unreachable." }, { status: 422 });
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
