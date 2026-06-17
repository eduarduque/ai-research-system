import { NextResponse } from "next/server";
import { getSources, getBriefs } from "@/lib/db";
import type { Source, Brief } from "@/lib/types";
import type { GraphNode, GraphEdge } from "@/lib/types";

export async function GET() {
  const sources = getSources() as Source[];
  const briefs = getBriefs() as (Brief & { source_title: string })[];

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    nodes.push({ id: `src-${source.id}`, label: source.title.slice(0, 40), type: "source" });

    const brief = briefs.find((b) => b.source_id === source.id);
    if (!brief) continue;

    let topics: string[] = [];
    let opportunities: string[] = [];
    try {
      topics = JSON.parse(brief.entities_topics || "[]");
      opportunities = JSON.parse(brief.opportunity_ideas || "[]");
    } catch {
      continue;
    }

    for (const topic of topics.slice(0, 3)) {
      const topicId = `topic-${topic.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`;
      if (!seen.has(topicId)) {
        nodes.push({ id: topicId, label: topic.slice(0, 30), type: "topic" });
        seen.add(topicId);
      }
      edges.push({
        id: `e-${source.id}-${topicId}`,
        source: `src-${source.id}`,
        target: topicId,
      });

      for (const opp of opportunities.slice(0, 2)) {
        const oppId = `opp-${opp.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`;
        if (!seen.has(oppId)) {
          nodes.push({ id: oppId, label: opp.slice(0, 30), type: "opportunity" });
          seen.add(oppId);
        }
        edges.push({
          id: `e-${topicId}-${oppId}`,
          source: topicId,
          target: oppId,
        });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
