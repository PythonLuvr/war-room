"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { serverLandingPath, useServers } from "@/lib/server-context";
import { PulseDot } from "@/components/pulse-dot";
import { useInFullscreenPanel } from "./panel-context";

const COLOR_RING: Record<string, string> = {
  amber: "from-amber-500/40 to-amber-700/20 border-amber-500/50",
  sky: "from-sky-500/40 to-sky-700/20 border-sky-500/50",
  emerald: "from-emerald-500/40 to-emerald-700/20 border-emerald-500/50",
  violet: "from-violet-500/40 to-violet-700/20 border-violet-500/50",
};

const TEXT_COLOR: Record<string, string> = {
  amber: "text-amber-200",
  sky: "text-sky-200",
  emerald: "text-emerald-200",
  violet: "text-violet-200",
};

const EDGE_COLOR: Record<string, string> = {
  amber: "#f59e0b",
  sky: "#0ea5e9",
  emerald: "#10b981",
  violet: "#a78bfa",
};

type AgentNodeData = {
  label: string;
  icon: string;
  color: string;
  role: string;
  status: "online" | "offline" | "idle";
  serverId: number;
  isHub?: boolean;
};

function AgentNode({ data }: NodeProps) {
  const d = data as AgentNodeData;
  const ring = COLOR_RING[d.color] ?? COLOR_RING.amber;
  const text = TEXT_COLOR[d.color] ?? TEXT_COLOR.amber;
  return (
    <div className={`group rounded-2xl border bg-gradient-to-br ${ring} ${d.isHub ? "p-4 min-w-[180px]" : "p-3 min-w-[140px]"} backdrop-blur transition-shadow hover:shadow-lg hover:shadow-black/40`}>
      <Handle type="target" position={Position.Top} className="!bg-neutral-700 !border-0 !w-1.5 !h-1.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-700 !border-0 !w-1.5 !h-1.5" />
      <div className="flex items-center gap-2">
        <div className={`flex items-center justify-center font-semibold bg-neutral-950/60 border border-neutral-800 rounded-xl ${d.isHub ? "w-10 h-10 text-xl" : "w-8 h-8 text-sm"}`}>
          {d.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`${d.isHub ? "text-sm" : "text-xs"} font-semibold ${text} truncate`}>
            {d.label}
          </div>
          <div className="text-[10px] text-neutral-400 truncate">{d.role}</div>
        </div>
        <PulseDot tone={d.status === "online" ? "ok" : d.status === "idle" ? "warn" : "idle"} size={6} />
      </div>
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

export function AgentFlow() {
  const fullscreen = useInFullscreenPanel();
  const { servers, setCurrentId } = useServers();
  const router = useRouter();
  const serversMap = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);

  const { nodes, edges } = useMemo(() => {
    const warRoom = servers.find((s) => s.name === "The War Room");
    const personal = servers.filter((s) => s.name !== "The War Room");

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (warRoom) {
      nodes.push({
        id: `s-${warRoom.id}`,
        type: "agent",
        position: { x: 240, y: 20 },
        data: {
          label: warRoom.name,
          icon: warRoom.icon,
          color: warRoom.color,
          role: "shared hub",
          status: "online" as const,
          serverId: warRoom.id,
          isHub: true,
        },
      });
    }

    const startX = 40;
    const gap = 200;
    personal.forEach((s, i) => {
      const isMe = s.is_default === 1;
      nodes.push({
        id: `s-${s.id}`,
        type: "agent",
        position: { x: startX + i * gap, y: 220 },
        data: {
          label: s.name,
          icon: s.icon,
          color: s.color,
          role: isMe ? "you · online" : "teammate · offline",
          status: isMe ? ("online" as const) : ("offline" as const),
          serverId: s.id,
        },
      });

      if (warRoom) {
        edges.push({
          id: `e-${warRoom.id}-${s.id}`,
          source: `s-${warRoom.id}`,
          target: `s-${s.id}`,
          animated: isMe,
          style: {
            stroke: EDGE_COLOR[s.color] ?? "#525252",
            strokeWidth: isMe ? 1.5 : 1,
            opacity: isMe ? 0.9 : 0.4,
          },
        });
      }
    });

    return { nodes, edges };
  }, [servers]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const data = node.data as AgentNodeData;
    setCurrentId(data.serverId);
    const srv = serversMap.get(data.serverId);
    router.push(srv ? serverLandingPath(srv) : "/c/system/activity");
  };

  return (
    <div className={`relative ${fullscreen ? "h-full min-h-[600px]" : "h-72"}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        panOnScroll={false}
        preventScrolling={false}
        className="bg-neutral-950"
      >
        <Background gap={20} size={1} color="#1f1f1f" />
      </ReactFlow>
      <div className="absolute bottom-2 right-2 text-[10px] text-neutral-700 uppercase tracking-wider pointer-events-none">
        click an agent to enter their workspace
      </div>
    </div>
  );
}
