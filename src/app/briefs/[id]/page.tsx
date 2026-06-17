import Link from "next/link";
import { notFound } from "next/navigation";
import { getBriefById } from "@/lib/db";
import type { Brief } from "@/lib/types";

function renderMarkdown(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '$1')
    .replace(/\n/g, '<br>');
}

type Props = { params: Promise<{ id: string }> };

export default async function BriefDetailPage({ params }: Props) {
  const { id } = await params;
  const brief = getBriefById(id) as (Brief & { source_title: string; source_url: string }) | undefined;
  if (!brief) notFound();

  let keyIdeas: string[] = [];
  let entities: string[] = [];
  let opportunities: string[] = [];
  try { keyIdeas = JSON.parse(brief.key_ideas || "[]"); } catch { /* empty */ }
  try { entities = JSON.parse(brief.entities_topics || "[]"); } catch { /* empty */ }
  try { opportunities = JSON.parse(brief.opportunity_ideas || "[]"); } catch { /* empty */ }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/library" className="text-slate-500 hover:text-slate-300 text-sm">← Library</Link>
      </div>

      <h1 className="text-2xl font-bold mb-1">{brief.source_title}</h1>
      <a href={brief.source_url} target="_blank" rel="noreferrer" className="text-sky-400 text-sm hover:underline break-all">
        {brief.source_url}
      </a>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {/* Summary */}
        <div className="bg-slate-800 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Summary</h2>
          <p className="text-sm text-slate-200 leading-relaxed">{brief.summary}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Key Ideas */}
          <div className="bg-slate-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Key Ideas</h2>
            <ul className="space-y-1">
              {keyIdeas.map((idea, i) => (
                <li key={i} className="text-sm text-slate-200 flex gap-2">
                  <span className="text-slate-500 shrink-0">·</span>{idea}
                </li>
              ))}
            </ul>
          </div>

          {/* Entities / Topics */}
          <div className="bg-slate-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Entities / Topics</h2>
            <div className="flex flex-wrap gap-2">
              {entities.map((e, i) => (
                <span key={i} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">{e}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Why Hunter Should Care */}
        {brief.why_hunter_should_care && (
          <div className="bg-slate-800 rounded-lg p-5 border border-sky-800/40">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-sky-500 mb-2">Why This Matters</h2>
            <p className="text-sm text-slate-200 leading-relaxed">{brief.why_hunter_should_care}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Opportunity Ideas */}
          <div className="bg-slate-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Opportunity Ideas</h2>
            <ul className="space-y-1">
              {opportunities.map((o, i) => (
                <li key={i} className="text-sm text-slate-200 flex gap-2">
                  <span className="text-emerald-500 shrink-0">→</span>{o}
                </li>
              ))}
            </ul>
          </div>

          {/* Score + Action */}
          <div className="bg-slate-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Product Opportunity Score</h2>
            <div className="text-5xl font-bold text-emerald-400 mb-1">
              {brief.product_opportunity_score}
              <span className="text-xl text-slate-500">/10</span>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Next Action</h3>
              <p className="text-sm text-slate-200">{brief.recommended_next_action}</p>
            </div>
          </div>
        </div>

        {/* Full Markdown */}
        <details className="bg-slate-800 rounded-lg p-5">
          <summary className="text-xs font-semibold uppercase tracking-widest text-slate-500 cursor-pointer">
            Full Brief Markdown
          </summary>
          <pre className="mt-4 text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-auto">
            {brief.markdown}
          </pre>
        </details>
      </div>
    </div>
  );
}
