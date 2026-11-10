import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveSource, htmlToText } from "@/lib/ingest";
import { parseBody } from "@/lib/http";

const Body = z.object({
  title: z.string().trim().min(1, "title is required").max(1000),
  link: z.string().trim().url("link must be a URL"),
  content: z.string().max(200_000).optional(),
});

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, Body);
  if (error) return error;
  try {
    const { source, alreadyResearched } = await saveSource({
      title: data.title,
      url: data.link,
      content: htmlToText(data.content || data.title),
    });
    return NextResponse.json(
      { ...source, already_researched: alreadyResearched },
      { status: alreadyResearched ? 200 : 201 }
    );
  } catch (err) {
    console.error("rss/ingest error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
