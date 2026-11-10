export type Source = {
  id: string;
  title: string;
  url: string;
  content: string;
  date_ingested: string;
};

export type Brief = {
  id: string;
  source_id: string;
  markdown: string;
  summary: string | null;
  key_ideas: string | null;
  entities_topics: string | null;
  opportunity_ideas: string | null;
  product_opportunity_score: number | null;
  recommended_next_action: string | null;
  why_it_matters: string | null;
  /** 1 when produced by the extractive (non-AI) fallback; regenerated on next request. */
  is_fallback: number;
  created_at: string;
};

export type RssFeed = {
  id: string;
  name: string;
  url: string;
  created_at: string;
};

export type RssItem = {
  title: string;
  link: string;
  content: string;
  pubDate?: string;
};

export type GraphNode = {
  id: string;
  label: string;
  type: "source" | "topic" | "entity" | "opportunity";
  /** Where clicking the node should navigate (source → its brief or the library). */
  href?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};
