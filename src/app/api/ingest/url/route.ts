import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { v4 as uuidv4 } from "uuid";
import { insertSource, getSourceById } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      html = await res.text();
    } catch {
      return NextResponse.json({ error: "Failed to fetch URL. Check the URL and try again." }, { status: 422 });
    }

    // Extract title from <title> tag as fallback
    const $ = cheerio.load(html);
    const fallbackTitle = $("title").first().text().trim() || url;

    // Use Readability for clean article text
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title?.trim() || fallbackTitle;
    const content = article?.textContent?.trim() || $("body").text().trim();

    if (!content || content.length < 50) {
      return NextResponse.json({ error: "Could not extract meaningful content from this URL." }, { status: 422 });
    }

    const id = uuidv4();
    const source = {
      id,
      title,
      url,
      content: content.slice(0, 20000),
      date_ingested: new Date().toISOString(),
    };

    insertSource(source);
    return NextResponse.json(getSourceById(id), { status: 201 });
  } catch (err) {
    console.error("ingest/url error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
