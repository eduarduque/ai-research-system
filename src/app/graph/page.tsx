import GraphView from "./GraphView";

export default function GraphPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Knowledge Graph</h1>
      <p className="text-slate-400 text-sm mb-6">
        Visual map of sources, topics, entities, and opportunities extracted from your briefs.
      </p>
      <GraphView />
    </div>
  );
}
