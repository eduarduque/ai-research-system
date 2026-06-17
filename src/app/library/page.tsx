import Link from "next/link";
import { getSources, getBriefs } from "@/lib/db";
import type { Source, Brief } from "@/lib/types";

export default function LibraryPage() {
  const sources = getSources() as Source[];
  const briefs = getBriefs() as (Brief & { source_title: string; source_url: string })[];
  const briefBySource = Object.fromEntries(briefs.map((b) => [b.source_id, b]));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Research Library</h1>
      <p className="text-slate-400 text-sm mb-8">All ingested sources and their AI briefs.</p>

      {sources.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
          <p className="mb-4">No sources ingested yet.</p>
          <Link href="/ingest" className="inline-block bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Ingest a URL →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const brief = briefBySource[s.id];
            return (
              <div key={s.id} className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-300 hover:underline truncate block">
                      {s.title}
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(s.date_ingested).toLocaleDateString()} · {s.content.length.toLocaleString()} chars
                    </div>
                    {brief?.summary && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{brief.summary}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {brief ? (
                      <Link href={`/briefs/${brief.id}`} className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors">
                        View Brief
                      </Link>
                    ) : (
                      <GenerateBriefButton sourceId={s.id} />
                    )}
                    {brief?.product_opportunity_score != null && (
                      <span className="text-xs text-slate-500">
                        Score: <span className="text-emerald-400 font-medium">{brief.product_opportunity_score}/10</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GenerateBriefButton({ sourceId }: { sourceId: string }) {
  return (
    <form action={`/api/briefs/generate`} method="POST">
      <Link href={`/ingest?generate=${sourceId}`} className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-1.5 rounded transition-colors">
        Gen Brief
      </Link>
    </form>
  );
}
