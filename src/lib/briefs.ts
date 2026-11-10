import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getSourceById, insertBrief, getBriefBySourceId, deleteBriefBySourceId } from "./db";
import { getAIClient, reasoningOptions } from "./ai";
import type { Brief } from "./types";

export type BriefData = {
  summary: string;
  key_ideas: string[];
  entities_topics: string[];
  why_it_matters: string;
  opportunity_ideas: string[];
  product_opportunity_score: number;
  recommended_next_action: string;
};

// Lenient schema: small models return numbers as strings, single strings instead
// of arrays, etc. Coerce what's recoverable; reject what isn't.
// Items sometimes come back as objects ({"idea": "...", "detail": "..."}); flatten
// them to their string values instead of rejecting the whole brief.
const itemToString = (v: unknown): string =>
  typeof v === "string" || typeof v === "number"
    ? String(v)
    : v && typeof v === "object"
      ? Object.values(v).filter((x) => typeof x === "string" || typeof x === "number").join(" — ")
      : "";
const stringList = z
  .union([z.array(z.unknown()), z.string()])
  .transform((v) => (Array.isArray(v) ? v.map(itemToString) : v ? [v] : []))
  .transform((v) => v.map((s) => s.trim()).filter(Boolean));

export const BriefSchema = z.object({
  _grounding: z.object({ numbers: stringList.optional(), names: stringList.optional() }).partial().optional(),
  summary: z.string().trim().min(1),
  key_ideas: stringList.pipe(z.array(z.string()).min(1)),
  entities_topics: stringList,
  why_it_matters: z.string().trim().default(""),
  opportunity_ideas: stringList.default([]),
  product_opportunity_score: z.coerce.number().transform((n) => Math.min(10, Math.max(1, Math.round(n || 5)))),
  recommended_next_action: z.string().trim().default(""),
});

function buildMarkdown(title: string, url: string, data: BriefData, isFallback: boolean): string {
  return `# Research Brief
${isFallback ? "\n> Generated without an AI model (extractive fallback). Regenerate once a provider is available.\n" : ""}
## Source
**${title}**
${url}

## Summary
${data.summary}

## Key Ideas
${data.key_ideas.map((i) => `- ${i}`).join("\n")}

## Entities / Topics
${data.entities_topics.map((i) => `- ${i}`).join("\n")}

## Why It Matters
${data.why_it_matters}

## Opportunity Ideas
${data.opportunity_ideas.map((i) => `- ${i}`).join("\n")}

## Product Opportunity Score
Score: ${data.product_opportunity_score}/10

## Recommended Next Action
${data.recommended_next_action}
`;
}

export function extractJSON(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* try extraction below */ }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* continue */ } }
  const braces = raw.match(/(\{[\s\S]*\})/);
  if (braces) { try { return JSON.parse(braces[1]); } catch { /* continue */ } }
  throw new Error("No valid JSON found in model response");
}

function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? [text]).map((s) => s.trim()).filter((s) => s.length > 30);
}

/**
 * Non-AI brief built only from the article's own sentences. Everything in it is
 * verbatim from the source — less insightful than an LLM brief, but never wrong.
 */
export function extractiveBrief(title: string, content: string): BriefData {
  const sentences = splitSentences(content);
  const withNumbers = sentences.filter((s) => /\d/.test(s));
  const keyIdeas = [...new Set([...withNumbers, ...sentences.slice(1)])].slice(0, 4);

  const counts = new Map<string, number>();
  for (const m of content.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g)) {
    const name = m[1];
    if (/^(The|A|An|In|On|It|This|That|But|And|For|We|He|She|They|I)$/.test(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const entities = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);

  return {
    summary: sentences.slice(0, 2).join(" ") || title,
    key_ideas: keyIdeas.length ? keyIdeas : [title],
    entities_topics: entities,
    why_it_matters: "Not assessed — no AI model was available when this brief was generated.",
    opportunity_ideas: [],
    product_opportunity_score: 5,
    recommended_next_action: "Regenerate this brief with an AI provider configured for analysis.",
  };
}

/**
 * Validate model output and drop hallucinated entities: an entity is kept only if
 * it appears in the article text or in the model's own verbatim _grounding.names.
 */
export function normalizeBriefData(raw: unknown, articleContent: string): BriefData {
  const parsed = BriefSchema.parse(raw);
  const src = articleContent.toLowerCase();
  const groundedNames = new Set((parsed._grounding?.names ?? []).map((n) => n.toLowerCase()));
  const validEntities = parsed.entities_topics.filter(
    (e) => src.includes(e.toLowerCase()) || (groundedNames.has(e.toLowerCase()) && src.includes(e.toLowerCase().split(" ")[0]))
  );

  return {
    summary: parsed.summary,
    key_ideas: parsed.key_ideas,
    entities_topics: validEntities,
    why_it_matters: parsed.why_it_matters,
    opportunity_ideas: parsed.opportunity_ideas,
    product_opportunity_score: parsed.product_opportunity_score,
    recommended_next_action: parsed.recommended_next_action,
  };
}

export function buildBriefPrompt(title: string, url: string, content: string): string {
  return `You are a research analyst summarizing an article for a technology professional who wants to stay current on AI, tech, and the broader industry.

YOUR TASK HAS TWO STEPS:

STEP 1 — Fill "_grounding" by reading the article and listing verbatim:
  - "numbers": every specific figure, statistic, date, or financial amount mentioned
  - "names": every product, company, person, and technology named in the article

STEP 2 — Fill all remaining fields using ONLY what is in _grounding. Do not add any name, number, or product not found in the article.

JSON FIELDS:
"_grounding": { "numbers": string[], "names": string[] }
"summary": 2-3 sentences — what happened, who is involved, and the single most important finding or number
"key_ideas": 4-5 specific insights that include actual numbers and names from the article. Not generic observations — concrete findings a reader would want to know.
"entities_topics": 3-5 names copied exactly from _grounding.names
"why_it_matters": what does this development mean for the tech and AI industry? What trend does it confirm or challenge? One clear, specific insight.
"opportunity_ideas": 2-3 concrete areas, questions, or shifts worth watching based on what this article reveals
"product_opportunity_score": integer 1-10 — how significant is this story for someone following AI and tech right now? Reserve 9-10 for genuinely industry-shifting news.
"recommended_next_action": one specific follow-up a reader should take to learn more or act on this story

Return ONLY valid JSON. No markdown, no code fences, no explanation.

Article:
Title: ${title}
URL: ${url}
Content: ${content}`;
}

/** Call the configured LLM and return validated brief data. Throws on any failure. */
export async function generateBriefData(title: string, url: string, content: string): Promise<BriefData> {
  const ai = getAIClient();
  if (!ai) throw new Error("No AI provider configured");
  // 6000 chars fits most local-model context windows while giving plenty of article.
  const truncated = content.slice(0, 6000);
  const completion = await ai.client.chat.completions.create({
    model: ai.model,
    messages: [{ role: "user", content: buildBriefPrompt(title, url, truncated) }],
    temperature: 0.3,
    ...reasoningOptions(ai.model),
    // Ollama doesn't guarantee response_format support across all models.
    ...(ai.provider !== "ollama" && { response_format: { type: "json_object" as const } }),
  });
  return normalizeBriefData(extractJSON(completion.choices[0].message.content || "{}"), truncated);
}

/**
 * Get or create the brief for a source. AI briefs are cached; extractive
 * fallbacks are regenerated on the next request (or when `force` is set).
 */
export async function generateBrief(sourceId: string, opts: { force?: boolean } = {}): Promise<Brief> {
  const source = getSourceById(sourceId) as { id: string; title: string; url: string; content: string } | undefined;
  if (!source) throw new Error("Source not found");

  const existing = getBriefBySourceId(sourceId) as Brief | undefined;
  if (existing && !opts.force && !existing.is_fallback) return existing;

  let briefData: BriefData;
  let isFallback = false;
  try {
    briefData = await generateBriefData(source.title, source.url, source.content);
  } catch (err) {
    console.warn("AI brief generation failed, using extractive fallback:", err instanceof Error ? err.message : err);
    // Keep an existing fallback rather than churning it on every failed retry.
    if (existing) return existing;
    briefData = extractiveBrief(source.title, source.content);
    isFallback = true;
  }

  deleteBriefBySourceId(sourceId);
  insertBrief({
    id: uuidv4(),
    source_id: sourceId,
    markdown: buildMarkdown(source.title, source.url, briefData, isFallback),
    summary: briefData.summary,
    key_ideas: JSON.stringify(briefData.key_ideas),
    entities_topics: JSON.stringify(briefData.entities_topics),
    opportunity_ideas: JSON.stringify(briefData.opportunity_ideas),
    product_opportunity_score: briefData.product_opportunity_score,
    recommended_next_action: briefData.recommended_next_action,
    why_it_matters: briefData.why_it_matters,
    is_fallback: isFallback ? 1 : 0,
    created_at: new Date().toISOString(),
  });
  return getBriefBySourceId(sourceId) as Brief;
}
