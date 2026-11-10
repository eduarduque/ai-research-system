import { createHmac, timingSafeEqual } from "crypto";

/** Verify a Slack request signature (v0 HMAC-SHA256) and reject replays older than 5 minutes. */
export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const computed = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function slackPost(channel: string, text: string, threadTs?: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel, text, unfurl_links: false, ...(threadTs && { thread_ts: threadTs }) }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!body.ok) console.warn("Slack chat.postMessage failed:", body.error ?? res.status);
}

/** Extract URLs from a Slack message. Slack wraps links as <https://x|label> or <https://x>. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>|]+/g) ?? [];
  return [...new Set(matches)];
}
