"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ color }} className="font-bold text-[9px] uppercase tracking-wider mb-0.5">
        {data.nodeType}
      </div>
      <div className="leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { custom: CustomNode };

function toFlowNodes(nodes: GraphNode[]): Node[] {
  return nodes.map((n, i) => ({
    id: n.id,
    type: "custom",
    position: {
      x: (i % 6) * 200 + Math.random() * 30,
      y: Math.floor(i / 6) * 160 + Math.random() * 30,
    },
    data: { label: n.label, nodeType: n.type },
  }));
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
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
    if ((node.data as { nodeType: string }).nodeType === "source") {
      // source node id format: src-<uuid>
      const sourceId = node.id.replace(/^src-/, "");
      window.open(`/library`, "_self");
      void sourceId;
    }
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
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#334155" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => TYPE_COLORS[(n.data as { nodeType: string }).nodeType] || "#64748b"}
            style={{ background: "#1e293b" }}
          />
        </ReactFlow>
      </div>
      <p className="text-xs text-slate-500 mt-2">Click a source node to view the library.</p>
    </div>
  );
}
