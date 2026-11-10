"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNode, GraphEdge } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  source: "#0ea5e9",
  topic: "#8b5cf6",
  entity: "#10b981",
  opportunity: "#f59e0b",
};

function CustomNode({ data }: { data: { label: string; nodeType: string } }) {
  const color = TYPE_COLORS[data.nodeType] || "#64748b";
  return (
    <div
      style={{ borderColor: color }}
      className="px-3 py-2 rounded-lg border-2 bg-slate-800 text-slate-100 text-xs max-w-[140px] shadow-md cursor-pointer"
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <div style={{ color }} className="font-bold text-[9px] uppercase tracking-wider mb-0.5">
        {data.nodeType}
      </div>
      <div className="leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { custom: CustomNode };

// Layered layout: sources -> topics -> opportunities, left to right. Each layer wraps
// into several columns so a large library stays roughly as wide as it is tall, and
// layers are vertically centred on each other. Deterministic: no jumping between visits.
const LAYER: Record<GraphNode["type"], number> = { source: 0, topic: 1, entity: 1, opportunity: 2 };
const COL_W = 190;
const ROW_H = 78;
const LAYER_GAP = 140;

function toFlowNodes(nodes: GraphNode[]): Node[] {
  const layers: GraphNode[][] = [[], [], []];
  for (const n of nodes) layers[LAYER[n.type] ?? 1].push(n);

  const maxRows = Math.max(6, Math.ceil(Math.sqrt(nodes.length * 1.5)));
  const shapes = layers.map((l) => {
    const cols = Math.max(1, Math.ceil(l.length / maxRows));
    return { cols, rows: Math.ceil(l.length / cols) || 0 };
  });
  const tallest = Math.max(...shapes.map((s) => s.rows));

  const out: Node[] = [];
  let x0 = 0;
  layers.forEach((layer, li) => {
    const { cols, rows } = shapes[li];
    const yOffset = ((tallest - rows) * ROW_H) / 2;
    layer.forEach((n, i) => {
      out.push({
        id: n.id,
        type: "custom",
        position: { x: x0 + Math.floor(i / rows) * COL_W, y: yOffset + (i % rows) * ROW_H },
        data: { label: n.label, nodeType: n.type, href: n.href },
      });
    });
    if (layer.length) x0 += cols * COL_W + LAYER_GAP;
  });
  return out;
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: { stroke: "#475569" },
    animated: false,
  }));
}

export default function GraphView() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [legend] = useState(Object.entries(TYPE_COLORS));

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then(({ nodes: gn, edges: ge }: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        setNodes(toFlowNodes(gn));
        setEdges(toFlowEdges(ge));
        setLoading(false);
      });
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const href = (node.data as { href?: string }).href;
    if (href) window.location.href = href;
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm py-8">Building graph…</div>;
  }

  if (nodes.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
        <p className="mb-2">No graph data yet.</p>
        <p className="text-sm">Ingest sources and generate briefs to populate the graph.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-4 mb-4 flex-wrap">
        {legend.map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>
      <div style={{ height: 560 }} className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          colorMode="dark"
          minZoom={0.1}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          // Custom nodes are measured after the first paint; fit again once they are.
          onInit={(instance) => requestAnimationFrame(() => instance.fitView({ padding: 0.1 }))}
        >
          <Background color="#334155" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => TYPE_COLORS[(n.data as { nodeType: string }).nodeType] || "#64748b"}
            style={{ background: "#1e293b", width: 140, height: 90 }}
            maskColor="rgba(15, 23, 42, 0.7)"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
      <p className="text-xs text-slate-500 mt-2">Click a source node to open its brief. Topics shared by several sources are merged into one node.</p>
    </div>
  );
}
