import Link from "next/link";
import { getSources, getBriefs } from "@/lib/db";
import type { Source, Brief } from "@/lib/types";

export default function Dashboard() {
  const sources = getSources() as Source[];
  const briefs = getBriefs() as Brief[];
  const recent = sources.slice(0, 5);

  const stats = [
    { label: "Sources Ingested", value: sources.length, href: "/library", color: "bg-sky-500" },
    { label: "Briefs Generated", value: briefs.length, href: "/library", color: "bg-violet-500" },
    { label: "RSS Feeds", value: 4, href: "/rss", color: "bg-emerald-500" },
  ];

  const quickActions = [
    { href: "/ingest", label: "Ingest a URL", desc: "Paste any article URL to extract and save it" },
    { href: "/rss", label: "Fetch from RSS", desc: "Browse AI news feeds and ingest an item" },
    { href: "/ask", label: "Ask Research", desc: "Query your saved research with AI" },
    { href: "/graph", label: "Knowledge Graph", desc: "Explore connections between sources and topics" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">AI Research Intelligence System</h1>
      <p className="text-slate-400 mb-8 text-sm">
        Capture research, generate AI briefs, and explore connections.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        {stats.map((c) => (
          <Link key={c.label} href={c.href} className="bg-slate-800 rounded-xl p-5 hover:bg-slate-700 transition-colors">
            <div className={`inline-block w-2 h-2 rounded-full ${c.color} mb-3`} />
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-slate-400 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-10">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition-colors">
            <div className="font-medium text-sm mb-1">{a.label}</div>
            <div className="text-xs text-slate-400">{a.desc}</div>
          </Link>
        ))}
      </div>

      {recent.length > 0 ? (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Recent Sources
          </h2>
          <div className="space-y-2">
            {recent.map((s) => (
              <Link key={s.id} href="/library" className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 hover:bg-slate-700 transition-colors">
                <span className="text-sm truncate max-w-xs">{s.title}</span>
                <span className="text-xs text-slate-500 shrink-0 ml-4">
                  {new Date(s.date_ingested).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
          <p className="text-lg mb-2">No sources yet</p>
          <p className="text-sm mb-4">Start by ingesting a URL or fetching from an RSS feed.</p>
          <Link href="/ingest" className="inline-block bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Ingest your first URL →
          </Link>
        </div>
      )}
    </div>
  );
}
