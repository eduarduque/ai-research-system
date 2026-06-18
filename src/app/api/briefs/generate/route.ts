import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSourceById, insertBrief, getBriefBySourceId } from "@/lib/db";
import { getAIClient } from "@/lib/ai";

function buildMarkdown(
  title: string,
  url: string,
  data: {
    summary: string;
    key_ideas: string[];
    entities_topics: string[];
    why_hunter_should_care: string;
    opportunity_ideas: string[];
    product_opportunity_score: number;
    recommended_next_action: string;
  }
): string {
  return `# Research Brief

## Source
**${title}**
${url}

## Summary
${data.summary}

## Key Ideas
${data.key_ideas.map((i) => `- ${i}`).join("\n")}

## Entities / Topics
${data.entities_topics.map((i) => `- ${i}`).join("\n")}

## Why Hunter Should Care
${data.why_hunter_should_care}

## Opportunity Ideas
${data.opportunity_ideas.map((i) => `- ${i}`).join("\n")}

## Product Opportunity Score
Score: ${data.product_opportunity_score}/10

## Recommended Next Action
${data.recommended_next_action}
`;
}

function extractJSON(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* try extraction below */ }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* continue */ } }
  const braces = raw.match(/(\{[\s\S]*\})/);
  if (braces) { try { return JSON.parse(braces[1]); } catch { /* continue */ } }
  throw new Error("No valid JSON found in model response");
}

function deterministicBrief(title: string, url: string, content: string) {
  const words = content.split(/\s+/).slice(0, 30).join(" ");
  return {
    summary: `Article about: ${title}. ${words}...`,
    key_ideas: ["Key concept extracted from source", "Secondary insight", "Notable detail"],
    entities_topics: ["AI", "Technology", title.split(" ")[0]],
    why_hunter_should_care: "This source covers topics relevant to AI strategy and product development.",
    opportunity_ideas: ["Explore this topic further", "Apply insights to current projects"],
    product_opportunity_score: 5,
    recommended_next_action: "Read the full article and identify actionable items.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { source_id } = await req.json();
    if (!source_id) {
      return NextResponse.json({ error: "source_id is required" }, { status: 400 });
    }

    const source = getSourceById(source_id) as { id: string; title: string; url: string; content: string } | undefined;
    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Return existing brief if already generated
    const existing = getBriefBySourceId(source_id);
    if (existing) return NextResponse.json(existing);

    type BriefData = {
      summary: string;
      key_ideas: string[];
      entities_topics: string[];
      why_hunter_should_care: string;
      opportunity_ideas: string[];
      product_opportunity_score: number;
      recommended_next_action: string;
    };

    function normalizeBriefData(raw: Record<string, unknown>, articleContent: string): BriefData {
      const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
      const src = articleContent.toLowerCase();

      // The model extracts its own grounding names in _grounding.names before analyzing.
      // We use those as the authoritative set of what belongs in entities_topics.
      const grounding = (raw._grounding ?? {}) as Record<string, unknown>;
      const groundedNames = new Set(arr(grounding.names).map(n => n.toLowerCase()));

      // Validate entities: must appear in the article text OR in model's own extracted names.
      // This removes GPT-3/DALL-E style hallucinations where the model drew from training knowledge.
      const rawEntities = arr(raw.entities_topics);
      const validEntities = rawEntities.filter(e =>
        src.includes(e.toLowerCase()) || groundedNames.has(e.toLowerCase())
      );

      return {
        summary: String(raw.summary || ""),
        key_ideas: arr(raw.key_ideas),
        entities_topics: validEntities.length >= 2 ? validEntities : rawEntities,
        why_hunter_should_care: String(raw.why_hunter_should_care || ""),
        opportunity_ideas: arr(raw.opportunity_ideas),
        product_opportunity_score: Number(raw.product_opportunity_score) || 5,
        recommended_next_action: String(raw.recommended_next_action || ""),
      };
    }

    // 6000 chars fits within most local model context windows while giving much more article content
    const truncatedContent = source.content.slice(0, 6000);
    let briefData: BriefData;
    const ai = getAIClient();

    if (ai) {
      try {
        const prompt = `You are a senior research analyst at XPM Labs, a product strategy firm building AI-native tools and agentic systems. Your reader is Hunter, a product strategist who tracks AI capability frontiers, agentic systems, competitive dynamics between tech companies, and patterns in what products win or lose at market entry.

YOUR TASK HAS TWO STEPS. Fill the JSON in this exact order:

STEP 1 — Fill "_grounding" first by reading the article and copying verbatim:
  - "numbers": every specific figure, statistic, date, or financial amount that appears in the article
  - "names": every product name, company name, person name, and technology that appears in the article

STEP 2 — Fill all remaining fields using ONLY what you listed in _grounding. Do not introduce any name, number, or product that is not in _grounding.

JSON FIELDS (fill in this order):
"_grounding": { "numbers": string[], "names": string[] }
"summary": 2-3 sentences using specific figures from _grounding.numbers and names from _grounding.names
"key_ideas": 3-5 complete insights from the article — not rephrased title words, actual findings with specifics
"entities_topics": 3-5 items chosen from _grounding.names only
"why_hunter_should_care": ONE specific strategic implication for Hunter. Not "important to track companies." Name the actual insight: what would a smart product strategist do differently after reading this?
"opportunity_ideas": 2-3 moves FOR Hunter and XPM Labs — not advice for the company in the article. Concrete enough to act on.
"product_opportunity_score": 1-10 — how directly actionable is this for an AI product company right now?
"recommended_next_action": one specific thing Hunter should do in the next 48 hours

EXAMPLE — bad vs good for why_hunter_should_care:
BAD: "It is important to track the performance of tech companies and their product launches."
GOOD: "Snap's failure confirms the AR market is bifurcating: Meta wins consumer with cheap+social, Apple owns premium+enterprise. Any product strategy that tries to price between them will fail the same way Specs is failing."

EXAMPLE — bad vs good for opportunity_ideas:
BAD: "Explore alternative pricing models for AR glasses"
GOOD: "Target Meta Ray-Bans developers now — build AI overlay apps for $300 hardware before the platform matures and competition locks in"

Return ONLY a valid JSON object. No markdown, no code fences, no explanation.

Article:
Title: ${source.title}
URL: ${source.url}
Content: ${truncatedContent}`;

        // Ollama doesn't guarantee response_format support across all models
        const createOpts = {
          model: ai.model,
          messages: [{ role: "user" as const, content: prompt }],
          temperature: 0.3,
          ...(ai.provider !== "ollama" && { response_format: { type: "json_object" as const } }),
        };
        const completion = await ai.client.chat.completions.create(createOpts);

        const raw = completion.choices[0].message.content || "{}";
        briefData = normalizeBriefData(extractJSON(raw), truncatedContent);
      } catch (aiErr: unknown) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.warn(`AI brief generation failed (${ai.provider}), using fallback:`, msg);
        briefData = deterministicBrief(source.title, source.url, source.content);
      }
    } else {
      briefData = deterministicBrief(source.title, source.url, source.content);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const markdown = buildMarkdown(source.title, source.url, briefData);

    const brief = {
      id,
      source_id,
      markdown,
      summary: briefData.summary,
      key_ideas: JSON.stringify(briefData.key_ideas),
      entities_topics: JSON.stringify(briefData.entities_topics),
      opportunity_ideas: JSON.stringify(briefData.opportunity_ideas),
      product_opportunity_score: briefData.product_opportunity_score,
      recommended_next_action: briefData.recommended_next_action,
      why_hunter_should_care: briefData.why_hunter_should_care,
      created_at: now,
    };

    insertBrief(brief);
    return NextResponse.json(getBriefBySourceId(source_id), { status: 201 });
  } catch (err) {
    console.error("briefs/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
