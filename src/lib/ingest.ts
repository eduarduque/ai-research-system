import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { v4 as uuidv4 } from "uuid";
import { insertSource, getSourceById, getSourceByUrl } from "./db";
import { indexSource } from "./indexing";
import { scrapeWithBrowser } from "./browser-scrape";
import { normalizeUrl, safeFetch, UnsafeUrlError } from "./url";
import type { Source } from "./types";

export { normalizeUrl } from "./url";

// Pages with less than this many characters are probably JS-rendered and get a browser fallback.
const THIN_CONTENT_THRESHOLD = 500;
const MAX_CONTENT_CHARS = 20000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; AIResearchSystem/1.0; +https://github.com/eduarduque/ai-research-system)";

/** User-facing ingestion failure (bad URL, unreachable, no extractable text) — maps to HTTP 422. */
export class IngestError extends Error {}

export type SaveResult = { source: Source; alreadyResearched: boolean };

/**
 * Single write path for every ingestion route (URL, RSS, discovery, seed, MCP):
 * canonicalize the URL, skip duplicates, store, then chunk + embed.
 */
export async function saveSource(input: { title: string; url: string; content: string }): Promise<SaveResult> {
  const url = normalizeUrl(input.url);
  const existing = getSourceByUrl(url) as Source | undefined;
  if (existing) return { source: existing, alreadyResearched: true };

  const source = {
    id: uuidv4(),
    title: input.title.trim().slice(0, 500) || url,
    url,
    content: stripReferenceMarkers(input.content || input.title).slice(0, MAX_CONTENT_CHARS),
    date_ingested: new Date().toISOString(),
  };
  try {
    insertSource(source);
  } catch (err) {
    // Lost a race with a concurrent ingest of the same URL (unique index on url).
    const winner = getSourceByUrl(url) as Source | undefined;
    if (winner) return { source: winner, alreadyResearched: true };
    throw err;
  }
  await indexSource(source);
  return { source: getSourceById(source.id) as Source, alreadyResearched: false };
}

/** Strip HTML from RSS item bodies (content:encoded is usually full HTML). */
export function htmlToText(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  $("br").replaceWith("\n");
  $("p,div,li,h1,h2,h3,h4,h5,h6,blockquote").each((_, el) => { $(el).append("\n\n"); });
  return $.root().text().replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Remove reference markers like "[12]", "[a]" or "[citation needed]" copied from
 * Wikipedia-style pages. Left in, they collide with the RAG prompt's own [n]
 * excerpt citations and the model "cites" excerpts that don't exist.
 */
export function stripReferenceMarkers(text: string): string {
  return text
    .replace(/\[(?:\d{1,3}|[a-z]|note \d+|citation needed|clarification needed|when\?|who\?|according to whom\?)\]/gi, "")
    .replace(/[ \t]+([.,;:])/g, "$1");
}

// Reference lists, footnotes and navigation boxes: not article content, and they
// dominate long pages (a Wikipedia article can be 40% citations).
const BACK_MATTER_SELECTORS = [
  ".reflist", ".references", ".mw-references-wrap", "ol.references", ".refbegin",
  ".navbox", ".vertical-navbox", ".catlinks", ".sistersitebox", ".mw-editsection",
  "sup.reference", ".footnotes", "[role='doc-endnotes']", "[role='doc-bibliography']",
].join(",");

const CITATION_LINE = /^(\s*[↑^]|.*\bRetrieved (on )?(\d{1,2} )?[A-Z]?[a-z]* ?\d{1,2},? \d{4}|.*\bRetrieved \d{4}-\d{2}-\d{2}|.*\b(arXiv:|doi:|ISBN|ISSN)\s*\S+)/;

/** Drop a trailing block of citation-like lines that survived DOM cleanup. */
export function trimTrailingCitations(text: string): string {
  const lines = text.split("\n");
  let cut = lines.length;
  let citations = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line.length < 40 || CITATION_LINE.test(line)) {
      if (line && CITATION_LINE.test(line)) citations++;
      cut = i;
    } else {
      break;
    }
  }
  return citations >= 3 ? lines.slice(0, cut).join("\n").trim() : text;
}

export function extractArticle(html: string, url: string): { title: string; content: string } {
  const $ = cheerio.load(html);
  let title = $("meta[property='og:title']").attr("content")?.trim() || $("title").first().text().trim() || url;
  $("script,style,noscript").remove();
  let content = $("body").text().replace(/\s+/g, " ").trim();
  try {
    // Readability can throw on unusual markup — fall back to raw body text.
    const doc = new JSDOM(html, { url }).window.document;
    doc.querySelectorAll(BACK_MATTER_SELECTORS).forEach((el) => el.remove());
    const article = new Readability(doc).parse();
    if (article?.title) title = article.title.trim();
    if (article?.textContent && article.textContent.trim().length > 200) {
      content = article.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
    }
  } catch {
    /* keep cheerio text */
  }
  return { title, content: trimTrailingCitations(content) };
}

export async function ingestUrl(rawUrl: string): Promise<SaveResult> {
  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    throw new IngestError("That doesn't look like a valid URL.");
  }

  const existing = getSourceByUrl(url) as Source | undefined;
  if (existing) return { source: existing, alreadyResearched: true };

  let html = "";
  try {
    const res = await safeFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new IngestError(`The site responded with HTTP ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) {
      throw new IngestError(`Unsupported content type (${type.split(";")[0]}). Only web pages can be ingested.`);
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_HTML_BYTES) {
      throw new IngestError("Page is too large to ingest.");
    }
    html = (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch (err) {
    if (err instanceof IngestError) throw err;
    if (err instanceof UnsafeUrlError) throw new IngestError(err.message);
    throw new IngestError("Failed to fetch URL. Check the URL and try again.");
  }

  let { title, content } = extractArticle(html, url);

  if (content.length < THIN_CONTENT_THRESHOLD) {
    console.log(`Thin content (${content.length} chars) from ${url} — trying headless browser`);
    const browserResult = await scrapeWithBrowser(url);
    if (browserResult) {
      if (browserResult.title) title = browserResult.title;
      content = browserResult.content;
    }
  }

  if (!content || content.length < 50) {
    throw new IngestError("Could not extract meaningful content from this URL. The page may be paywalled or require JavaScript.");
  }

  return saveSource({ title, url, content });
}
