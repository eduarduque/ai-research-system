import { NextRequest, NextResponse } from "next/server";
import { ingestUrl, normalizeUrl } from "@/lib/ingest";
import { getSourceByUrl } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const existing = getSourceByUrl(normalizeUrl(url));
    if (existing) {
      return NextResponse.json({ ...existing, already_researched: true }, { status: 200 });
    }

    const source = await ingestUrl(url);
    return NextResponse.json({ ...source, already_researched: false }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const status = msg.startsWith("Failed to fetch") || msg.startsWith("Could not extract") ? 422 : 500;
    if (status === 500) console.error("ingest/url error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
