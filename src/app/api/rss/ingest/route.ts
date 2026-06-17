import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { insertSource, getSourceById } from "@/lib/db";

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
    return NextResponse.json(getSourceById(id), { status: 201 });
  } catch (err) {
    console.error("rss/ingest error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
