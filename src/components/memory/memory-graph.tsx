"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  Panel,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import {
  nodeTypes,
  type ExplorerNodeData,
} from "@/components/memory/graph-nodes";
import type { FactCategory } from "@/types/deal";
import type {
  GraphNodeType,
  MemoryGraphEdge,
  MemoryGraphNode,
  MemoryRelationshipType,
} from "@/types/memory";

export type ExplorerFilterMode = "all" | "deal" | "learning" | "recommendations";

export interface GraphFocusRequest {
  ids: string[];
  nonce: number;
}

type FlowNode = Node<ExplorerNodeData>;

const NODE_WIDTH = 230;
const NODE_HEIGHT = 118;
const COLUMN_GAP = 40;
const ROW_GAP = 44;
const BLOCK_GAP = 140;
const MEMORY_COLUMNS = 3;

const EDGE_COLORS: Record<MemoryRelationshipType, string> = {
  BELONGS_TO: "#94a3b8",
  DISCOVERED_IN: "#64748b",
  RELATED_TO: "#3b82f6",
  ADDRESSES: "#8b5cf6",
  UPDATED_BY: "#f59e0b",
  INFLUENCED: "#10b981",
  CONFIRMS: "#14b8a6",
  CONTRADICTS: "#ef4444",
};

const EDGE_DASHES: Partial<Record<MemoryRelationshipType, string>> = {
  RELATED_TO: "4 3",
  UPDATED_BY: "6 3",
  CONTRADICTS: "5 3",
};

const STRUCTURAL_EDGES = new Set<MemoryRelationshipType>([
  "BELONGS_TO",
  "DISCOVERED_IN",
]);

interface Position {
  x: number;
  y: number;
}

function layoutNodes(
  nodes: MemoryGraphNode[],
  edges: MemoryGraphEdge[],
): FlowNode[] {
  const positions = new Map<string, Position>();
  const deal = nodes.find((node) => node.type === "deal");
  const calls = nodes
    .filter((node) => node.type === "call")
    .sort(
      (a, b) =>
        Number((a.data as { callNumber?: number }).callNumber ?? 0) -
        Number((b.data as { callNumber?: number }).callNumber ?? 0),
    );
  const memories = nodes.filter((node) => node.type === "memory");
  const techniques = nodes.filter((node) => node.type === "technique");
  const recommendations = nodes.filter(
    (node) => node.type === "recommendation",
  );

  const memoriesByCall = new Map<string, MemoryGraphNode[]>();
  for (const memory of memories) {
    const callId = (memory.data as { callId?: string }).callId;
    if (!callId) continue;
    const list = memoriesByCall.get(callId) ?? [];
    list.push(memory);
    memoriesByCall.set(callId, list);
  }

  let cursorX = 0;
  let bottomY = 260;

  for (const call of calls) {
    const callId = call.id.split(":")[1];
    const callMemories = memoriesByCall.get(callId) ?? [];
    const columns = Math.min(
      MEMORY_COLUMNS,
      Math.max(1, callMemories.length),
    );
    const rows = Math.max(1, Math.ceil(callMemories.length / columns));
    const blockWidth = Math.max(
      NODE_WIDTH,
      columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP,
    );

    positions.set(call.id, {
      x: cursorX + blockWidth / 2 - NODE_WIDTH / 2,
      y: 150,
    });

    callMemories.forEach((memory, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(memory.id, {
        x: cursorX + column * (NODE_WIDTH + COLUMN_GAP),
        y: 270 + row * (NODE_HEIGHT + ROW_GAP),
      });
    });

    bottomY = Math.max(
      bottomY,
      270 + rows * (NODE_HEIGHT + ROW_GAP),
    );
    cursorX += blockWidth + BLOCK_GAP;
  }

  const orphanMemories = memories.filter((memory) => !positions.has(memory.id));
  if (orphanMemories.length > 0) {
    orphanMemories.forEach((memory, index) => {
      positions.set(memory.id, {
        x: index * (NODE_WIDTH + COLUMN_GAP),
        y: bottomY + 40,
      });
    });
    bottomY += NODE_HEIGHT + ROW_GAP + 40;
  }

  const totalWidth = Math.max(cursorX - BLOCK_GAP, NODE_WIDTH);
  if (deal) {
    positions.set(deal.id, {
      x: totalWidth / 2 - NODE_WIDTH / 2,
      y: 0,
    });
  }

  if (techniques.length > 0) {
    const y = bottomY + 70;
    techniques.forEach((technique, index) => {
      positions.set(technique.id, {
        x: index * (NODE_WIDTH + COLUMN_GAP),
        y,
      });
    });
    bottomY = y + NODE_HEIGHT + ROW_GAP;
  }

  if (recommendations.length > 0) {
    const y = bottomY + 70;
    let nextX = 0;
    for (const recommendation of recommendations) {
      const influencing = edges.filter(
        (edge) =>
          edge.type === "INFLUENCED" && edge.target === recommendation.id,
      );
      const sourceXs = influencing
        .map((edge) => positions.get(edge.source)?.x)
        .filter((value): value is number => typeof value === "number");
      const averageX =
        sourceXs.length > 0
          ? sourceXs.reduce((sum, value) => sum + value, 0) / sourceXs.length
          : nextX;
      const x = Math.max(averageX, nextX);
      positions.set(recommendation.id, { x, y });
      nextX = x + NODE_WIDTH + COLUMN_GAP;
    }
    bottomY = y + NODE_HEIGHT + ROW_GAP;
  }

  let fallbackX = 0;
  for (const node of nodes) {
    if (positions.has(node.id)) continue;
    positions.set(node.id, { x: fallbackX, y: bottomY + 40 });
    fallbackX += NODE_WIDTH + COLUMN_GAP;
  }

  return nodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      type: node.type,
      position,
      data: {
        ...(node.data as unknown as ExplorerNodeData),
        nodeType: node.type as GraphNodeType,
      },
      draggable: false,
      selectable: true,
    };
  });
}

function isNodeVisible(
  node: FlowNode,
  mode: ExplorerFilterMode,
  categories: Set<FactCategory>,
): boolean {
  const nodeType = node.data.nodeType;
  if (nodeType === "memory" && !categories.has(node.data.category as FactCategory)) {
    return false;
  }
  if (mode === "all") return true;
  if (mode === "deal") {
    return nodeType === "deal" || nodeType === "call" || nodeType === "memory";
  }
  if (mode === "learning") {
    return nodeType === "technique" || nodeType === "memory";
  }
  return (
    nodeType === "recommendation" ||
    nodeType === "memory" ||
    nodeType === "call"
  );
}

export function MemoryGraph({
  nodes,
  edges,
  mode,
  selectedCategories,
  showInferred,
  selectedNodeId,
  focusRequest,
  onSelectNode,
}: {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  mode: ExplorerFilterMode;
  selectedCategories: Set<FactCategory>;
  showInferred: boolean;
  selectedNodeId: string | null;
  focusRequest: GraphFocusRequest | null;
  onSelectNode: (id: string | null) => void;
}) {
  const instanceRef = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);

  const layoutedNodes = useMemo(
    () => layoutNodes(nodes, edges),
    [nodes, edges],
  );

  const visibleNodes = useMemo(
    () => layoutedNodes.filter((node) => isNodeVisible(node, mode, selectedCategories)),
    [layoutedNodes, mode, selectedCategories],
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target) &&
          (showInferred || edge.origin !== "INFERRED"),
      ),
    [edges, visibleNodeIds, showInferred],
  );

  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const connected = new Set<string>([selectedNodeId]);
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) connected.add(edge.target);
      if (edge.target === selectedNodeId) connected.add(edge.source);
    }
    return connected;
  }, [selectedNodeId, visibleEdges]);

  const displayNodes = useMemo<FlowNode[]>(
    () =>
      visibleNodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        data: {
          ...node.data,
          highlighted: connectedIds?.has(node.id) ?? false,
          dimmed: connectedIds ? !connectedIds.has(node.id) : false,
        },
      })),
    [visibleNodes, selectedNodeId, connectedIds],
  );

  const displayEdges = useMemo<Edge[]>(
    () =>
      visibleEdges.map((edge) => {
        const dimmed = connectedIds
          ? !(
              edge.source === selectedNodeId ||
              edge.target === selectedNodeId
            )
          : false;
        const color = EDGE_COLORS[edge.type] ?? "#94a3b8";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          data: {
            relationshipType: edge.type,
            origin: edge.origin,
            explanation: edge.explanation,
          },
          label: STRUCTURAL_EDGES.has(edge.type) ? undefined : edge.label,
          labelStyle: { fontSize: 9, fill: color, fontWeight: 600 },
          labelBgStyle: { fill: "var(--background)", fillOpacity: 0.85 },
          labelBgPadding: [3, 2] as [number, number],
          labelBgBorderRadius: 4,
          animated: edge.type === "CONTRADICTS",
          style: {
            stroke: color,
            strokeWidth: 1.5,
            opacity: dimmed ? 0.12 : 0.75,
            strokeDasharray:
              edge.origin === "INFERRED"
                ? "2 4"
                : EDGE_DASHES[edge.type],
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 14,
            height: 14,
          },
        };
      }),
    [visibleEdges, connectedIds, selectedNodeId],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<FlowNode, Edge>) => {
      instanceRef.current = instance;
    },
    [],
  );

  useEffect(() => {
    if (!focusRequest || !instanceRef.current) return;
    const ids = focusRequest.ids.filter((id) => visibleNodeIds.has(id));
    if (ids.length === 0) return;
    instanceRef.current.fitView({
      nodes: ids.map((id) => ({ id })),
      duration: 600,
      padding: 1.2,
      maxZoom: 1.3,
    });
  }, [focusRequest, visibleNodeIds]);

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      onInit={handleInit}
      onNodeClick={(_event, node) => onSelectNode(node.id)}
      onPaneClick={() => onSelectNode(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={1.8}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: false }}
      className="bg-neutral-50 dark:bg-neutral-950"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={2}
        style={{ width: 150, height: 100 }}
        nodeColor={(node) => {
          const type = (node.data as ExplorerNodeData | undefined)?.nodeType;
          if (type === "deal") return "#171717";
          if (type === "call") return "#64748b";
          if (type === "technique") return "#8b5cf6";
          if (type === "recommendation") return "#10b981";
          return "#94a3b8";
        }}
        className="!bg-white/80 dark:!bg-neutral-900/80"
      />
      <Panel position="top-right">
        <button
          type="button"
          onClick={() =>
            instanceRef.current?.fitView({ duration: 400, padding: 0.2 })
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 shadow-sm transition hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
        >
          <Maximize2 className="h-3 w-3" />
          Fit view
        </button>
      </Panel>
    </ReactFlow>
  );
}
