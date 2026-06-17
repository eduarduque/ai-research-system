"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateBriefButton({ sourceId }: { sourceId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    const res = await fetch("/api/briefs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok && data.id) {
      router.push(`/briefs/${data.id}`);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium px-3 py-1.5 rounded transition-colors"
    >
      {loading ? "Generating…" : "Gen Brief"}
    </button>
  );
}
