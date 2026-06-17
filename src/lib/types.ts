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
  why_hunter_should_care: string | null;
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
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};
