import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSources, getBriefs } from "@/lib/db";
import type { Source, Brief } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function scoreDoc(query: string, text: string): number {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const lower = text.toLowerCase();
  return words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const sources = getSources() as Source[];
    const briefs = getBriefs() as (Brief & { source_title: string; source_url: string })[];

    // Score each source by keyword overlap
    const scored = sources.map((s) => {
      const brief = briefs.find((b) => b.source_id === s.id);
      const text = [s.title, s.content, brief?.summary || "", brief?.markdown || ""].join(" ");
      return { source: s, brief, score: scoreDoc(question, text) };
    });

    const top = scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (top.length === 0) {
      return NextResponse.json({
        answer: "## Answer\nNo relevant research found in your library for this question. Try ingesting more sources first.\n\n## Sources Used\nNone",
        sources: [],
      });
    }

    const context = top
      .map((r, i) => {
        const snippet = r.brief?.summary
          ? `Summary: ${r.brief.summary}`
          : r.source.content.slice(0, 500);
        return `[${i + 1}] ${r.source.title} (${r.source.url})\n${snippet}`;
      })
      .join("\n\n---\n\n");

    let answerText: string;

    if (process.env.OPENAI_API_KEY) {
      const prompt = `You are a research assistant. Answer the question using only the provided research sources. Be concise and cite source numbers.

QUESTION: ${question}

SOURCES:
${context}

Return your answer in this exact format:
## Answer
[Your answer here, referencing sources by number like [1], [2]]

## Sources Used
[List each source title and URL that you referenced]`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      answerText = completion.choices[0].message.content || "No answer generated.";
    } else {
      const sourceList = top.map((r) => `- ${r.source.title}: ${r.source.url}`).join("\n");
      answerText = `## Answer\nBased on your saved research, here are the most relevant sources for "${question}". (AI answer generation requires OPENAI_API_KEY.)\n\n## Sources Used\n${sourceList}`;
    }

    return NextResponse.json({
      answer: answerText,
      sources: top.map((r) => ({ id: r.source.id, title: r.source.title, url: r.source.url })),
    });
  } catch (err) {
    console.error("ask error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
