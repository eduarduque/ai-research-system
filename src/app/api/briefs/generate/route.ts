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

    function normalizeBriefData(raw: Record<string, unknown>): BriefData {
      const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
      return {
        summary: String(raw.summary || ""),
        key_ideas: arr(raw.key_ideas),
        entities_topics: arr(raw.entities_topics),
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
        const prompt = `You are a senior research analyst at XPM Labs, a product strategy firm building AI-native tools and agentic systems. Your reader is Hunter, a product strategist who tracks:

- AI capability frontiers: what models can do now that they couldn't 6 months ago
- Agentic AI: autonomous workflows, LLM-powered loops, operator frameworks
- Competitive dynamics between AI companies: OpenAI, Anthropic, Google, Meta, Mistral, Snap, Apple
- Consumer vs enterprise pricing dynamics and what causes new hardware/software categories to succeed or fail
- Patterns in what tech products win or lose at market entry

Return ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.

JSON FIELDS:
- summary: string — 2-3 sentences. Be specific. Include the key number, name, or finding if one exists in the article.
- key_ideas: string[] — 3-5 items. Must be actual insights or findings, NOT rephrased title words. Each item should be a complete thought that adds information.
- entities_topics: string[] — 3-5 specific product names, company names, people, or technical concepts from the article.
- why_hunter_should_care: string — ONE specific strategic implication. Do NOT write generic statements like "it is important to track tech companies." Ask: what would a smart product strategist do differently after reading this? What pattern does this confirm or break? Name the actual insight.
- opportunity_ideas: string[] — 2-3 concrete moves specific enough that someone could act on them. NOT "explore pricing models." YES: "Build for Meta Ray-Bans' price point — the AR market is bifurcating and cheap+social is winning."
- product_opportunity_score: number — 1-10, where 10 = directly actionable for an AI product company right now, 1 = interesting but no clear angle.
- recommended_next_action: string — one specific action Hunter should take in the next 48 hours based on this article.

EXAMPLE — bad vs good for why_hunter_should_care:
BAD: "As a research analyst it is important to track the performance of tech companies and their product launches."
GOOD: "Snap's failure confirms the AR market is bifurcating: Meta wins consumer with cheap+social, Apple owns premium+enterprise. There is no viable middle. Any product strategy that tries to price between them will fail the same way Specs is failing."

EXAMPLE — bad vs good for opportunity_ideas:
BAD: "Explore alternative pricing models for AR glasses"
GOOD: "Target Meta Ray-Bans developers now — build AI overlay apps for $300 hardware before the platform matures and competition locks in"

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
        briefData = normalizeBriefData(extractJSON(raw));
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
