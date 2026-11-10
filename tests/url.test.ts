import { describe, it, expect } from "vitest";
import { normalizeUrl, isPrivateIp, assertPublicUrl, UnsafeUrlError } from "@/lib/url";

describe("normalizeUrl", () => {
  it("adds a missing scheme (share-sheet links)", () => {
    expect(normalizeUrl("example.com/post")).toBe("https://example.com/post");
  });

  it("strips tracking params, fragment and trailing slash so re-shares dedupe", () => {
    const a = normalizeUrl("https://Example.com/a/b/?utm_source=x&utm_medium=y#section");
    const b = normalizeUrl("https://example.com/a/b");
    expect(a).toBe(b);
  });

  it("keeps meaningful query params, in a stable order", () => {
    expect(normalizeUrl("https://x.com/watch?v=2&a=1&fbclid=zzz")).toBe("https://x.com/watch?a=1&v=2");
  });

  it("canonicalizes the bare origin", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("throws on garbage", () => {
    expect(() => normalizeUrl("http://")).toThrow();
  });
});

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateIp(ip)).toBe(true)
  );

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("%s is public", (ip) =>
    expect(isPrivateIp(ip)).toBe(false)
  );
});

describe("assertPublicUrl (SSRF guard)", () => {
  it("rejects the cloud metadata endpoint", async () => {
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects localhost by name", async () => {
    await expect(assertPublicUrl("http://localhost:3000/api/sources")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects non-http schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/http/);
  });

  it("accepts a public IP literal", async () => {
    await expect(assertPublicUrl("https://1.1.1.1/")).resolves.toBeUndefined();
  });
});
