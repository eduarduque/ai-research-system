import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { v4 as uuidv4 } from "uuid";
import { insertSource, getSourceById, updateSourceEmbedding } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { scrapeWithBrowser } from "@/lib/browser-scrape";

// Pages with less than this many characters are considered JS-rendered and get a browser fallback
const THIN_CONTENT_THRESHOLD = 500;

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

    // Use Readability for clean article text — wrap in try/catch since some
    // pages (paywalls, SPAs, unusual HTML) can cause JSDOM to throw
    let title = fallbackTitle;
    let content = $("body").text().trim();
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      if (article?.title) title = article.title.trim();
      if (article?.textContent) content = article.textContent.trim();
    } catch {
      // fall through to cheerio-extracted content
    }

    // If content is thin, the page is probably JavaScript-rendered — try a real browser
    if (content.length < THIN_CONTENT_THRESHOLD) {
      console.log(`Thin content (${content.length} chars) from ${url} — trying browser fallback`);
      const browserResult = await scrapeWithBrowser(url);
      if (browserResult) {
        if (browserResult.title) title = browserResult.title;
        content = browserResult.content;
        console.log(`Browser scrape got ${content.length} chars`);
      }
    }

    if (!content || content.length < 50) {
      return NextResponse.json({ error: "Could not extract meaningful content from this URL. The page may be paywalled or require JavaScript." }, { status: 422 });
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

    try {
      const embedding = await embedText(`${title}\n\n${content.slice(0, 8000)}`);
      updateSourceEmbedding(id, embedding);
    } catch {
      // non-fatal — search falls back to keyword matching
    }

    return NextResponse.json(getSourceById(id), { status: 201 });
  } catch (err) {
    console.error("ingest/url error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
