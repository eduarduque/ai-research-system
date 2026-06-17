import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { insertSource, getSourceById, updateSourceEmbedding } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  try {
    const { title, link, content } = await req.json();
    if (!title || !link) {
      return NextResponse.json({ error: "title and link are required" }, { status: 400 });
    }

    const id = uuidv4();
    const source = {
      id,
      title: title.trim(),
      url: link,
      content: (content || title).slice(0, 20000),
      date_ingested: new Date().toISOString(),
    };

    insertSource(source);

    if (process.env.OPENAI_API_KEY) {
      try {
        const embedding = await embedText(`${source.title}\n\n${source.content.slice(0, 8000)}`);
        updateSourceEmbedding(id, embedding);
      } catch {
        // non-fatal — search falls back to keyword matching
      }
    }

    return NextResponse.json(getSourceById(id), { status: 201 });
  } catch (err) {
    console.error("rss/ingest error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
