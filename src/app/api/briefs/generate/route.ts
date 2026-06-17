import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { getSourceById, insertBrief, getBriefBySourceId } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const truncatedContent = source.content.slice(0, 4000);
    let briefData;
    let usedAI = false;

    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `You are a research analyst. Analyze this article and return ONLY a valid JSON object (no markdown, no explanation).

JSON fields required:
- summary: string (2-3 sentences)
- key_ideas: string[] (3-5 items)
- entities_topics: string[] (3-5 named entities or topics)
- why_hunter_should_care: string (relevance to XPM, XPM Labs, AI systems, or product strategy)
- opportunity_ideas: string[] (2-3 product or strategy opportunities)
- product_opportunity_score: number (1-10)
- recommended_next_action: string (one clear action)

Title: ${source.title}
URL: ${source.url}
Content: ${truncatedContent}`;

        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0].message.content || "{}";
        briefData = JSON.parse(raw);
        usedAI = true;
      } catch (aiErr: unknown) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.warn("OpenAI brief generation failed, using fallback:", msg);
        briefData = deterministicBrief(source.title, source.url, source.content);
      }
    } else {
      briefData = deterministicBrief(source.title, source.url, source.content);
    }

    void usedAI;

    const id = uuidv4();
    const now = new Date().toISOString();
    const markdown = buildMarkdown(source.title, source.url, briefData);

    const brief = {
      id,
      source_id,
      markdown,
      summary: briefData.summary || "",
      key_ideas: JSON.stringify(briefData.key_ideas || []),
      entities_topics: JSON.stringify(briefData.entities_topics || []),
      opportunity_ideas: JSON.stringify(briefData.opportunity_ideas || []),
      product_opportunity_score: briefData.product_opportunity_score || 5,
      recommended_next_action: briefData.recommended_next_action || "",
      why_hunter_should_care: briefData.why_hunter_should_care || "",
      created_at: now,
    };

    insertBrief(brief);
    return NextResponse.json(getBriefBySourceId(source_id), { status: 201 });
  } catch (err) {
    console.error("briefs/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
