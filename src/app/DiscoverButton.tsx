"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = { newSources: { id: string; title: string }[]; skippedDuplicates: number; feedErrors: string[] };

export default function DiscoverButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function run() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/discover", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || "Discovery failed.");
      return;
    }
    const parts = [`${data.newSources.length} new source${data.newSources.length === 1 ? "" : "s"}`];
    if (data.skippedDuplicates) parts.push(`${data.skippedDuplicates} already researched`);
    if (data.feedErrors.length) parts.push(`unreachable: ${data.feedErrors.join(", ")}`);
    setMessage(parts.join(" · "));
    router.refresh();
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
      <div className="flex-1">
        <div className="font-medium text-sm">Find latest news</div>
        <div className="text-xs text-slate-400">
          {message || "Pull fresh items from every feed, skipping anything already in your library."}
        </div>
      </div>
      <button
        onClick={run}
        disabled={loading}
        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? "Discovering…" : "Discover"}
      </button>
    </div>
  );
}
