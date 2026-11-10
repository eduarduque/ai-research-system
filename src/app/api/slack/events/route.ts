import { NextRequest, NextResponse, after } from "next/server";
import { verifySlackSignature, slackPost, extractUrls } from "@/lib/slack";
import { ingestUrl } from "@/lib/ingest";
import { generateBrief } from "@/lib/briefs";

type SlackEvent = { type: string; text?: string; channel?: string; ts?: string; bot_id?: string; subtype?: string };
type SlackPayload = { type: string; challenge?: string; event?: SlackEvent };

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/** Ingest a URL shared in Slack, generate its brief and reply in-thread. Calls the engine directly. */
async function processUrl(url: string, channel: string, ts: string): Promise<void> {
  try {
    const { source, alreadyResearched } = await ingestUrl(url);
    if (!alreadyResearched) await slackPost(channel, `📥 *${source.title}* saved — generating brief…`, ts);

    const brief = await generateBrief(source.id);
    const keyIdeas = (JSON.parse(brief.key_ideas ?? "[]") as string[]).slice(0, 3).map((k) => `• ${k}`).join("\n");

    await slackPost(
      channel,
      [
        `*Research Brief: ${source.title}*${alreadyResearched ? " _(already in your library)_" : ""}`,
        source.url,
        "",
        "*Summary*",
        brief.summary ?? "—",
        "",
        "*Key Ideas*",
        keyIdeas || "—",
        "",
        "*Why it matters*",
        brief.why_it_matters ?? "—",
        "",
        `*Opportunity Score:* ${brief.product_opportunity_score ?? "—"}/10`,
        `*Next Action:* ${brief.recommended_next_action ?? "—"}`,
        "",
        `_Full brief: ${baseUrl()}/briefs/${brief.id}_`,
      ].join("\n"),
      ts
    );
  } catch (err) {
    console.error("Slack processUrl error:", err);
    await slackPost(channel, `❌ Couldn't research ${url}: ${err instanceof Error ? err.message : "unknown error"}`, ts);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Fail closed: without a signing secret anyone could make the server fetch URLs and spend API quota.
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "Slack integration is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Slack retries when we take >3s to ack. The original delivery is already being
  // processed in after(), so acknowledge retries without doing the work twice.
  if (req.headers.get("x-slack-retry-num")) return NextResponse.json({ ok: true });

  let payload: SlackPayload;
  try {
    payload = JSON.parse(rawBody) as SlackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification") return NextResponse.json({ challenge: payload.challenge });

  const event = payload.event;
  if (payload.type === "event_callback" && event?.type === "message" && !event.bot_id && !event.subtype) {
    const urls = extractUrls(event.text ?? "").slice(0, 3);
    if (urls.length > 0 && event.channel && event.ts) {
      const { channel, ts } = event;
      // Ack immediately; after() keeps the work alive past the response.
      after(async () => {
        for (const url of urls) await processUrl(url, channel, ts);
      });
    }
  }

  return NextResponse.json({ ok: true });
}
