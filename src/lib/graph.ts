import { getSources, getBriefs } from "./db";
import type { Source, Brief, GraphNode, GraphEdge } from "./types";

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseList(json: string | null): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Sources → topics/entities they mention → opportunities they suggest.
 * Topics are merged across sources case-insensitively, which is what makes the
 * graph useful: two articles that both mention "Anthropic" share one node.
 * Opportunities hang off their source (not off every topic, which produced an
 * n×m edge explosion), and node ids use the full slug so long labels can't collide.
 */
export function buildGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const sources = getSources() as Source[];
  const briefsBySource = new Map((getBriefs() as Brief[]).map((b) => [b.source_id, b]));

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const addEdge = (source: string, target: string, label?: string) => {
    const id = `e:${source}->${target}`;
    if (!edges.has(id)) edges.set(id, { id, source, target, ...(label && { label }) });
  };

  for (const source of sources) {
    const srcId = `src:${source.id}`;
    const brief = briefsBySource.get(source.id);
    nodes.set(srcId, {
      id: srcId,
      label: source.title.slice(0, 48),
      type: "source",
      href: brief ? `/briefs/${brief.id}` : "/library",
    });

    if (!brief) continue;

    for (const raw of parseList(brief.entities_topics).slice(0, 5)) {
      // "Retrieval-augmented generation (RAG)" and "retrieval-augmented generation" are one topic.
      const topic = raw.replace(/\s*\([^)]*\)\s*/g, " ").trim() || raw;
      const id = `topic:${slug(topic)}`;
      if (id === "topic:") continue;
      if (!nodes.has(id)) nodes.set(id, { id, label: topic.slice(0, 32), type: "topic" });
      addEdge(srcId, id);
    }
    for (const opp of parseList(brief.opportunity_ideas).slice(0, 2)) {
      const id = `opp:${slug(opp)}`;
      if (id === "opp:") continue;
      if (!nodes.has(id)) nodes.set(id, { id, label: opp.length > 40 ? `${opp.slice(0, 39)}…` : opp, type: "opportunity" });
      addEdge(srcId, id, "suggests");
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
