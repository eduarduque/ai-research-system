import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFeedItems } from "@/lib/rss";
import { parseBody } from "@/lib/http";

const Body = z.object({ feedUrl: z.string().trim().url("feedUrl must be a URL") });

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, Body);
  if (error) return error;
  try {
    return NextResponse.json(await fetchFeedItems(data.feedUrl));
  } catch {
    return NextResponse.json(
      { error: "Could not reach or parse the feed. It may be down, blocking requests, or not a valid RSS/Atom feed." },
      { status: 422 }
    );
  }
}
