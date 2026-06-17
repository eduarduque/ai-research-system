"use client";
import { useState } from "react";

function renderAnswer(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-semibold uppercase tracking-widest text-slate-400 mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("- ")) return <li key={i} className="text-sm text-slate-200 ml-4 list-disc">{line.slice(2)}</li>;
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} className="text-sm text-slate-200 leading-relaxed">{line}</p>;
  });
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string; sources: { id: string; title: string; url: string }[] } | null>(null);
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
    const data = await res.json();
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
        Ask any question — the AI answers using your saved research library.
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

      {error && (
        <div className="bg-red-900/40 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {result && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-1">
          {renderAnswer(result.answer)}
        </div>
      )}
    </div>
  );
}
