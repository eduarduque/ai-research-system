"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Wrong access token.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <form onSubmit={submit} className="max-w-sm mt-16 space-y-3">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-sm text-slate-400">This instance is protected by an access token.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Access token"
        autoFocus
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-sky-500"
      />
      <button
        disabled={loading || !password}
        className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-medium py-3 rounded-lg text-sm"
      >
        {loading ? "Checking…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
