"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteSourceButton({ sourceId, title }: { sourceId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete "${title}" and its brief?`)) return;
    setBusy(true);
    const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      aria-label={`Delete ${title}`}
      className="text-xs text-slate-500 hover:text-red-300 disabled:opacity-50 transition-colors"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
