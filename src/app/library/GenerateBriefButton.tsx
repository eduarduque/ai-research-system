"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateBriefButton({
  sourceId,
  force = false,
  label = "Gen Brief",
  className,
}: {
  sourceId: string;
  force?: boolean;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/briefs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: sourceId, force }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !data.id) {
      setError(data.error || "Failed");
      return;
    }
    router.push(`/briefs/${data.id}`);
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          "bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium px-3 py-1.5 rounded transition-colors"
        }
      >
        {loading ? "Generating…" : label}
      </button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </span>
  );
}
