import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifySlackSignature, extractUrls } from "@/lib/slack";
import { RateLimiter } from "@/lib/rate-limit";
import { safeEqual, sessionValue } from "@/lib/auth";

describe("verifySlackSignature", () => {
  const secret = "test-secret";
  const body = '{"type":"event_callback"}';
  const now = 1_700_000_000;
  const sign = (ts: number, b = body) => `v0=${createHmac("sha256", secret).update(`v0:${ts}:${b}`).digest("hex")}`;

  it("accepts a valid signature", () => {
    expect(verifySlackSignature(secret, body, String(now), sign(now), now)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySlackSignature(secret, body + " ", String(now), sign(now), now)).toBe(false);
  });

  it("rejects replays older than five minutes", () => {
    expect(verifySlackSignature(secret, body, String(now - 301), sign(now - 301), now)).toBe(false);
  });

  it("rejects a missing or malformed timestamp", () => {
    expect(verifySlackSignature(secret, body, "", sign(now), now)).toBe(false);
    expect(verifySlackSignature(secret, body, "abc", sign(now), now)).toBe(false);
  });
});

describe("extractUrls", () => {
  it("pulls URLs out of Slack's <url|label> markup and dedupes", () => {
    expect(extractUrls("see <https://a.com/x|a.com> and https://a.com/x and <https://b.org>")).toEqual([
      "https://a.com/x",
      "https://b.org",
    ]);
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit then rejects", () => {
    const rl = new RateLimiter(3, 60_000);
    const t = 1_000_000_020_000;
    expect([rl.hit("ip", t), rl.hit("ip", t), rl.hit("ip", t), rl.hit("ip", t)]).toEqual([2, 1, 0, -1]);
  });

  it("tracks clients independently", () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.hit("a", 0)).toBe(0);
    expect(rl.hit("b", 0)).toBe(0);
    expect(rl.hit("a", 0)).toBe(-1);
  });

  it("recovers as the window slides", () => {
    const rl = new RateLimiter(2, 60_000);
    rl.hit("ip", 0);
    rl.hit("ip", 0);
    expect(rl.hit("ip", 1000)).toBe(-1);
    expect(rl.hit("ip", 120_000)).toBeGreaterThanOrEqual(0);
  });
});

describe("auth helpers", () => {
  it("safeEqual compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("session cookie value is derived from, but not equal to, the token", async () => {
    const v = await sessionValue("hunter2");
    expect(v).toMatch(/^[0-9a-f]{64}$/);
    expect(v).not.toContain("hunter2");
    expect(await sessionValue("hunter2")).toBe(v);
  });
});
