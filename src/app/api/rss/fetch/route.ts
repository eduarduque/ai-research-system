import { NextRequest, NextResponse } from "next/server";
import { fetchFeedItems } from "@/lib/rss";

export async function POST(req: NextRequest) {
  try {
    const { feedUrl } = await req.json();
    if (!feedUrl) {
      return NextResponse.json({ error: "feedUrl is required" }, { status: 400 });
    }

    let result;
    try {
      result = await fetchFeedItems(feedUrl);
    } catch {
      return NextResponse.json({ error: "Could not reach or parse the feed. It may be down, blocking requests, or not a valid RSS/Atom feed." }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("rss/fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
