"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RssFeed, RssItem } from "@/lib/types";

export default function RssPage() {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<RssFeed | null>(null);
  const [items, setItems] = useState<RssItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [feedError, setFeedError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/rss/feeds")
      .then((r) => r.json())
      .then(setFeeds);
  }, []);

  async function fetchFeed(feed: RssFeed) {
    setSelectedFeed(feed);
    setItems([]);
    setFeedError("");
    setLoadingFeed(true);
    const res = await fetch("/api/rss/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedUrl: feed.url }),
    });
    const data = await res.json();
    setLoadingFeed(false);
    if (!res.ok) {
      setFeedError(data.error || "Could not fetch feed.");
      return;
    }
    setItems(data.items || []);
  }

  async function ingestItem(item: RssItem, index: number) {
    setIngestingId(String(index));
    const ingestRes = await fetch("/api/rss/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item.title, link: item.link, content: item.content }),
    });
    const source = await ingestRes.json();
    if (!ingestRes.ok) {
      setIngestingId(null);
      return;
    }

    const briefRes = await fetch("/api/briefs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: source.id }),
    });
    const brief = await briefRes.json();
    setIngestingId(null);

    if (briefRes.ok) {
      router.push(`/briefs/${brief.id}`);
    } else {
      router.push("/library");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">RSS Feeds</h1>
      <p className="text-slate-400 text-sm mb-8">
        Select a feed to browse recent AI research items and ingest one.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {feeds.map((feed) => (
          <button
            key={feed.id}
            onClick={() => fetchFeed(feed)}
            className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
              selectedFeed?.id === feed.id
                ? "bg-sky-600 border-sky-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <div className="font-medium">{feed.name}</div>
            <div className="text-xs opacity-70 truncate mt-0.5">{feed.url}</div>
          </button>
        ))}
      </div>

      {loadingFeed && (
        <div className="text-slate-400 text-sm py-4">Fetching feed…</div>
      )}

      {feedError && (
        <div className="bg-red-900/40 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
          {feedError}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-300 hover:underline line-clamp-2">
                    {item.title}
                  </a>
                  {item.pubDate && (
                    <div className="text-xs text-slate-500 mt-1">{new Date(item.pubDate).toLocaleDateString()}</div>
                  )}
                </div>
                <button
                  onClick={() => ingestItem(item, i)}
                  disabled={ingestingId !== null}
                  className="shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                >
                  {ingestingId === String(i) ? "Ingesting…" : "Ingest + Brief"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
