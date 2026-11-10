"use client";
import { Fragment, useState } from "react";

type Citation = { n: number; source_id: string; title: string; url: string; snippet: string; score: number };
type AskResult = {
  answer: string;
  sources: { id: string; title: string; url: string }[];
  citations: Citation[];
  retrieval: { mode: "hybrid" | "vector" | "keyword"; embeddingModel: string | null; candidates: number };
};

/** Render inline [n] markers as links that jump to the matching excerpt. */
function withCitations(text: string, max: number) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= max) {
      return (
        <a key={i} href={`#cite-${m[1]}`} className="text-sky-400 hover:underline font-medium">
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function renderAnswer(text: string, max: number) {
  // The retrieved-passages panel below replaces the model's own "Sources Used" list.
  const body = text.split(/\n## Sources Used/i)[0];
  return body.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return <h2 key={i} className="text-sm font-semibold uppercase tracking-widest text-slate-400 mt-2 mb-2">{line.slice(3)}</h2>;
    }
    if (/^[-*] /.test(line)) {
      return <li key={i} className="text-sm text-slate-200 ml-4 list-disc">{withCitations(line.slice(2), max)}</li>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-slate-200 leading-relaxed">{withCitations(line.replace(/\*\*/g, ""), max)}</p>;
  });
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim() }),
    });
    const data = await res.json().catch(() => ({ error: "Invalid response" }));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Request failed.");
      return;
    }
    setResult(data);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Ask Research</h1>
      <p className="text-slate-400 text-sm mb-8">
        Ask anything. Answers come only from your saved research, with every claim linked to the passage it came from.
      </p>

      <div className="space-y-3 mb-6">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleAsk())}
          placeholder="e.g. What are the latest trends in AI agents?"
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
          disabled={loading}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg text-sm transition-colors"
        >
          {loading ? "Searching and generating answer…" : "Ask"}
        </button>
      </div>

      {error && <div className="bg-red-900/40 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {result && (
        <>
          <div className="bg-slate-800 rounded-lg p-6 space-y-1">{renderAnswer(result.answer, result.citations.length)}</div>

          {result.citations.length > 0 && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between mb-3 gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Retrieved passages</h2>
                <span className="text-[11px] text-slate-500 text-right">
                  {result.retrieval.mode === "hybrid" ? "Hybrid BM25 + vector" : "Keyword (BM25)"} ·{" "}
                  {result.retrieval.candidates} chunks searched
                </span>
              </div>
              <div className="space-y-2">
                {result.citations.map((c) => (
                  <div key={c.n} id={`cite-${c.n}`} className="bg-slate-800/70 rounded-lg p-4 scroll-mt-4 target:ring-1 target:ring-sky-500">
                    <div className="flex gap-2 items-baseline mb-1 min-w-0">
                      <span className="text-sky-400 text-xs font-bold shrink-0">[{c.n}]</span>
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-sky-300 hover:underline truncate">
                        {c.title}
                      </a>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{c.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
