"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IngestPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const router = useRouter();

  async function handleIngest() {
    if (!url.trim()) return;
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/ingest/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Failed to ingest URL.");
      return;
    }

    setSourceId(data.id);
    setStatus("done");
    setMessage(`"${data.title}" saved successfully.`);
  }

  async function handleGenerateBrief() {
    if (!sourceId) return;
    setStatus("loading");
    setMessage("Generating AI brief…");

    const res = await fetch("/api/briefs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Failed to generate brief.");
      return;
    }

    router.push(`/briefs/${data.id}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Ingest URL</h1>
      <p className="text-slate-400 text-sm mb-8">
        Paste any article or page URL to extract its content and save it as a research source.
      </p>

      <div className="space-y-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleIngest()}
          placeholder="https://example.com/article"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          disabled={status === "loading"}
        />
        <button
          onClick={handleIngest}
          disabled={status === "loading" || !url.trim()}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg text-sm transition-colors"
        >
          {status === "loading" && !sourceId ? "Extracting content…" : "Ingest URL"}
        </button>
      </div>

      {message && (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${status === "error" ? "bg-red-900/40 text-red-300" : "bg-emerald-900/40 text-emerald-300"}`}>
          {message}
        </div>
      )}

      {status === "done" && sourceId && (
        <button
          onClick={handleGenerateBrief}
          className="mt-4 w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-lg text-sm transition-colors"
        >
          Generate AI Brief →
        </button>
      )}
    </div>
  );
}
