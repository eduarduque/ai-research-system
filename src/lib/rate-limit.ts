/**
 * Fixed-window-with-carryover limiter (a "sliding window counter"): cheap, no
 * dependencies, good enough to stop one client from draining the LLM quota.
 * In-process only — use Redis/Upstash if you run more than one instance.
 */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number; prev: number }>();

  constructor(private limit: number, private windowMs = 60_000) {}

  /** Returns remaining requests, or -1 when the request should be rejected. */
  hit(key: string, now = Date.now()): number {
    const bucketStart = now - (now % this.windowMs);
    let w = this.windows.get(key);
    if (!w || w.start !== bucketStart) {
      const prev = w && w.start === bucketStart - this.windowMs ? w.count : 0;
      w = { start: bucketStart, count: 0, prev };
      this.windows.set(key, w);
    }
    // Weight the previous window by how much of it still overlaps the sliding window.
    const overlap = 1 - (now - bucketStart) / this.windowMs;
    const estimated = w.prev * overlap + w.count;
    if (estimated >= this.limit) return -1;
    w.count++;
    if (this.windows.size > 10_000) this.sweep(bucketStart);
    return Math.max(0, Math.floor(this.limit - estimated - 1));
  }

  private sweep(bucketStart: number) {
    for (const [k, w] of this.windows) if (w.start < bucketStart - this.windowMs) this.windows.delete(k);
  }
}
