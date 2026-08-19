import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature, slackPost, extractUrls } from "@/lib/slack";

type SlackEvent = {
  type: string;
  text?: string;
  channel?: string;
  ts?: string;
  bot_id?: string;
  subtype?: string;
};

type SlackPayload = {
  type: string;
  challenge?: string;
  event?: SlackEvent;
};

async function processUrl(url: string, channel: string, ts: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const ingestRes = await fetch(`${base}/api/ingest/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!ingestRes.ok) {
      const err = await ingestRes.json() as { error?: string };
      await slackPost(channel, `❌ Couldn't read that URL: ${err.error ?? "unknown error"}`, ts);
      return;
    }

    const source = await ingestRes.json() as { id: string; title: string };
    await slackPost(channel, `📥 *${source.title}* saved — generating brief...`, ts);

    const briefRes = await fetch(`${base}/api/briefs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: source.id }),
    });

    if (!briefRes.ok) {
      await slackPost(channel, `⚠️ Brief generation failed. Source saved: *${source.title}*`, ts);
      return;
    }

    const brief = await briefRes.json() as {
      id: string;
      summary?: string;
      key_ideas?: string;
      why_it_matters?: string;
      product_opportunity_score?: number;
      recommended_next_action?: string;
    };

    const keyIdeas = JSON.parse(brief.key_ideas ?? "[]") as string[];
    const keyIdeasText = keyIdeas.slice(0, 3).map((k) => `• ${k}`).join("\n");
    const score = brief.product_opportunity_score ?? "—";

    const message = [
      `*Research Brief: ${source.title}*`,
      url,
      "",
      `*Summary*`,
      brief.summary ?? "—",
      "",
      `*Key Ideas*`,
      keyIdeasText,
      "",
      `*Why it matters*`,
      brief.why_it_matters ?? "—",
      "",
      `*Opportunity Score:* ${score}/10`,
      `*Next Action:* ${brief.recommended_next_action ?? "—"}`,
      "",
      `_View full brief: ${base}/briefs/${brief.id}_`,
    ].join("\n");

    await slackPost(channel, message, ts);
  } catch (err) {
    console.error("Slack processUrl error:", err);
    await slackPost(channel, `❌ Error processing ${url}`, ts);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const rawBody = await req.text();

  if (signingSecret) {
    const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
    const signature = req.headers.get("x-slack-signature") ?? "";
    if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: SlackPayload;
  try {
    payload = JSON.parse(rawBody) as SlackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack URL verification handshake
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event?.type === "message") {
    const event = payload.event;
    // Skip bot messages and edits/deletions
    if (!event.bot_id && !event.subtype) {
      const urls = extractUrls(event.text ?? "");
      if (urls.length > 0 && event.channel && event.ts) {
        // Respond to Slack immediately — processing happens in background
        for (const url of urls.slice(0, 3)) {
          void processUrl(url, event.channel, event.ts);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
