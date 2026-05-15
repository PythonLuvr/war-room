"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  FolderOpen,
  CheckSquare,
  Activity as ActivityIcon,
  Server,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Bot,
  Maximize2,
  X,
} from "lucide-react";
import { PanelFullscreenContext } from "./panel-context";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { FileText, Briefcase } from "lucide-react";
import { PulseDot } from "@/components/pulse-dot";
import { AgentFlow } from "./agent-flow";
import { MeetingRoom } from "./meeting-room";
import { BoardroomChat } from "./boardroom-chat";
import { ActiveJobsPanel } from "./active-jobs-panel";
import { colorForPath } from "@/lib/workspace-color";
import { useMeeting } from "@/lib/meeting-context";
import { TEAM, useIdentityVersion, type TeamMember } from "@/lib/team";
import { WelcomeBanner } from "@/components/welcome-banner";
import { useServers } from "@/lib/server-context";

type Dashboard = {
  kpi: {
    activeClients: number;
    openApprovals: number;
    activityToday: number;
    vps: { online: number; total: number; error: string | null };
    activeSessions: number;
    teamOnline: number;
    teamTotal: number;
  };
  timeseries: Array<{ day: string; date: string; count: number }>;
  topChannels: Array<{ name: string; count: number; projectPath: string }>;
  recentActivity: Array<{
    id: number;
    kind: string;
    title: string;
    detail: string | null;
    project_path: string | null;
    created_at: number;
  }>;
  activityByKind: Array<{ kind: string; count: number }>;
  hourlyHeatmap: { days: string[]; matrix: number[][] };
  perServerStats: Array<{
    id: number;
    name: string;
    icon: string;
    color: string;
    channelCount: number;
    activity24h: number;
  }>;
  topSessions: Array<{
    id: number;
    project_path: string;
    message_count: number;
    last_used_at: number;
  }>;
  recentFiles: Array<{ path: string; name: string; mtime: number; size: number }>;
  checkedAt: string;
};

const SERVER_PALETTE: Record<string, string> = {
  amber: "from-amber-500/20 to-amber-700/10 border-amber-500/30 text-amber-200",
  sky: "from-sky-500/20 to-sky-700/10 border-sky-500/30 text-sky-200",
  emerald: "from-emerald-500/20 to-emerald-700/10 border-emerald-500/30 text-emerald-200",
  violet: "from-violet-500/20 to-violet-700/10 border-violet-500/30 text-violet-200",
};

const KIND_META: Record<string, { dot: string; label: string }> = {
  "chat.user": { dot: "bg-sky-500", label: "you" },
  "chat.assistant": { dot: "bg-emerald-500", label: "claude" },
  "chat.tool": { dot: "bg-amber-500", label: "tool" },
  "service.check": { dot: "bg-neutral-500", label: "check" },
  "service.down": { dot: "bg-red-500", label: "down" },
  "approval.new": { dot: "bg-violet-500", label: "approval" },
  system: { dot: "bg-neutral-600", label: "system" },
};

export function WarRoomDashboard() {
  // Re-render when the user updates their display name via the wizard so
  // the team-presence list + dashboard header refresh.
  useIdentityVersion();
  const [data, setData] = useState<Dashboard | null>(null);
  const router = useRouter();
  const search = useSearchParams();
  const expandedPanel = search?.get("panel") ?? null;

  const setExpandedPanel = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(search?.toString() ?? "");
      if (id) params.set("panel", id);
      else params.delete("panel");
      const qs = params.toString();
      router.replace(`/c/home${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, search],
  );

  useEffect(() => {
    const load = () =>
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then(setData);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div id="overview" className="scroll-mt-6" />
      <WelcomeBanner />
      <DashboardHeader checkedAt={data?.checkedAt} />

      {/* KPI strip — Tier 1: Pulse */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
        <Kpi
          icon={<FolderOpen className="w-4 h-4" />}
          label="Active clients"
          value={data?.kpi.activeClients}
          tone="ok"
          href="/c/system/services"
        />
        <Kpi
          icon={<CheckSquare className="w-4 h-4" />}
          label="Open approvals"
          value={data?.kpi.openApprovals}
          tone={data?.kpi.openApprovals && data.kpi.openApprovals > 0 ? "warn" : "idle"}
          href="/c/system/approvals"
        />
        <Kpi
          icon={<ActivityIcon className="w-4 h-4" />}
          label="Activity today"
          value={data?.kpi.activityToday}
          tone={data?.kpi.activityToday && data.kpi.activityToday > 0 ? "ok" : "idle"}
          href="/c/system/activity"
        />
        <Kpi
          icon={<Server className="w-4 h-4" />}
          label="VPS"
          value={data ? `${data.kpi.vps.online}/${data.kpi.vps.total}` : undefined}
          tone={
            !data
              ? "idle"
              : data.kpi.vps.error
                ? "bad"
                : data.kpi.vps.online === data.kpi.vps.total
                  ? "ok"
                  : "warn"
          }
          href="/c/system/services"
        />
        <Kpi
          icon={<MessageSquare className="w-4 h-4" />}
          label="Sessions"
          value={data?.kpi.activeSessions}
          tone={data?.kpi.activeSessions && data.kpi.activeSessions > 0 ? "ok" : "idle"}
          href="/c/system/sessions"
        />
        <Kpi
          icon={<Users className="w-4 h-4" />}
          label="Team online"
          value={data ? `${data.kpi.teamOnline}/${data.kpi.teamTotal}` : undefined}
          tone={
            !data
              ? "idle"
              : data.kpi.teamOnline === data.kpi.teamTotal
                ? "ok"
                : data.kpi.teamOnline > 0
                  ? "warn"
                  : "idle"
          }
        />
      </div>

      {/* Active Jobs panel — the heart of team coordination */}
      <Panel
        title="Active jobs"
        subtitle="Click to open · auto-creates personal channels"
        icon={<Briefcase className="w-4 h-4" />}
        className="mb-7"
        expandable
        panelId="active-jobs"
        anchorId="active-jobs"
        openByParam={expandedPanel}
        onPanelChange={setExpandedPanel}
      >
        <ActiveJobsPanel />
      </Panel>

      {/* Boardroom — meeting + voice */}
      <BoardroomPanel
        expandedPanel={expandedPanel}
        setExpandedPanel={setExpandedPanel}
      />

      {/* Per-server stats row */}
      <div id="per-server" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7 scroll-mt-6">
        {!data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-neutral-800 bg-neutral-900/40 animate-pulse"
              />
            ))
          : data.perServerStats.map((s) => (
              <ServerStat key={s.id} s={s} />
            ))}
      </div>

      {/* Tier 2: Trend + Team presence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <Panel
          title="Activity · last 7 days"
          subtitle={data ? `${data.timeseries.reduce((n, d) => n + d.count, 0)} events` : ""}
          icon={<TrendingUp className="w-4 h-4" />}
          className="lg:col-span-2"
          expandable
          panelId="activity"
          anchorId="activity"
          openByParam={expandedPanel}
          onPanelChange={setExpandedPanel}
        >
          <div className="h-48 px-2 pb-2">
            {!data ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeseries} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#262626" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="#525252"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#525252"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0d0d0f",
                      border: "1px solid #262626",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a3a3a3" }}
                    cursor={{ stroke: "#404040", strokeDasharray: "2 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#a78bfa"
                    strokeWidth={1.5}
                    fill="url(#activityFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Team presence" subtitle={`${TEAM.length} member${TEAM.length === 1 ? "" : "s"}`} icon={<Users className="w-4 h-4" />} anchorId="presence">
          <div className="flex flex-col">
            {TEAM.map((m, i) => (
              <Member
                key={m.id}
                name={m.name}
                role={`${i === 0 ? "you" : "teammate"} · ${m.serverName}`}
                status={i === 0 ? "online" : "offline"}
                color={m.color}
              />
            ))}
          </div>
        </Panel>
      </div>


      {/* Tier 3: Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <Panel
          title="Recent team activity"
          subtitle={data ? `${data.recentActivity.length} events` : ""}
          icon={<ActivityIcon className="w-4 h-4" />}
          className="lg:col-span-2"
          actionLabel="View all"
          actionHref="/c/system/activity"
          expandable
          panelId="recent-activity"
          anchorId="recent-activity"
          openByParam={expandedPanel}
          onPanelChange={setExpandedPanel}
        >
          {!data ? (
            <FeedSkeleton />
          ) : data.recentActivity.length === 0 ? (
            <Empty text="Quiet for now. Send a message in any chat channel and it'll show up here." />
          ) : (
            <div className="flex flex-col">
              {data.recentActivity.map((a) => {
                const meta = KIND_META[a.kind] ?? { dot: "bg-neutral-600", label: a.kind };
                const ws = colorForPath(a.project_path);
                return (
                  <div
                    key={a.id}
                    className="relative flex items-start gap-3 pl-5 pr-4 py-2.5 border-b border-neutral-900 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-sm ${ws.stripe}`} title={ws.label} />
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-200 truncate flex-1">{a.title}</span>
                        <span className={`text-[10px] shrink-0 uppercase tracking-wider px-1.5 py-0.5 rounded border ${ws.chip}`}>
                          {ws.label}
                        </span>
                        <span className="text-[10px] text-neutral-600 shrink-0 uppercase tracking-wider">
                          {meta.label}
                        </span>
                      </div>
                      {a.detail && (
                        <div className="text-xs text-neutral-500 truncate mt-0.5">{a.detail}</div>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-600 shrink-0 mt-1">
                      {timeAgo(a.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Recently touched"
          subtitle="Files across workspaces"
          icon={<FileText className="w-4 h-4" />}
          expandable
          panelId="recent-files"
          anchorId="recent-files"
          openByParam={expandedPanel}
          onPanelChange={setExpandedPanel}
        >
          {!data ? (
            <FeedSkeleton />
          ) : data.recentFiles.length === 0 ? (
            <Empty text="Nothing modified recently." />
          ) : (
            <div className="flex flex-col">
              {data.recentFiles.map((f) => {
                const ws = colorForPath(f.path);
                return (
                  <div
                    key={f.path}
                    className="relative flex items-center gap-3 pl-5 pr-4 py-2.5 border-b border-neutral-900 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-sm ${ws.stripe}`} title={ws.label} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-neutral-200 truncate flex-1">{f.name}</div>
                        <span className={`text-[10px] shrink-0 uppercase tracking-wider px-1.5 py-0.5 rounded border ${ws.chip}`}>
                          {ws.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-600 truncate">{f.path}</div>
                    </div>
                    <div className="text-[10px] text-neutral-600 shrink-0">
                      {timeAgo(f.mtime)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Agent flow — visual / secondary */}
      <Panel
        title="Agent flow"
        subtitle="Team graph · click an agent to enter"
        icon={<Bot className="w-4 h-4" />}
        className="mb-7"
        expandable
        panelId="agent-flow"
        anchorId="agent-flow"
        openByParam={expandedPanel}
        onPanelChange={setExpandedPanel}
      >
        <AgentFlow />
      </Panel>

      {/* Quick actions */}
      <Panel title="Quick actions" subtitle="Common jumps" anchorId="quick-actions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
          <ActionTile
            icon={<Plus className="w-4 h-4" />}
            label="New brief"
            hint="Add a client engagement"
            href="/c/system/approvals"
          />
          <ActionTile
            icon={<Bot className="w-4 h-4" />}
            label="Agent traffic"
            hint="Cross-agent activity"
            href="/c/user/s6-agent-traffic"
          />
          <ActionTile
            icon={<Server className="w-4 h-4" />}
            label="Service health"
            hint="VPS + local check"
            href="/c/system/services"
          />
          <ActionTile
            icon={<ActivityIcon className="w-4 h-4" />}
            label="Full activity"
            hint="Filterable feed"
            href="/c/system/activity"
          />
        </div>
      </Panel>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  tone: "ok" | "warn" | "bad" | "idle";
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase tracking-wider mb-2">
        {icon}
        <span className="truncate">{label}</span>
        <div className="ml-auto">
          <PulseDot tone={tone} size={6} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-neutral-100 leading-none">
        {value === undefined ? <span className="text-neutral-700">—</span> : value}
      </div>
    </>
  );
  const cls =
    "rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-3.5 transition-colors";
  if (href) {
    return (
      <Link
        href={href}
        className={`${cls} hover:border-neutral-700 hover:bg-neutral-900 cursor-pointer block group`}
      >
        <div className="relative">
          {inner}
          <ArrowUpRight className="w-3 h-3 absolute -top-0.5 -right-0.5 text-neutral-700 group-hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function Panel({
  title,
  subtitle,
  icon,
  children,
  className = "",
  actionLabel,
  actionHref,
  expandable = false,
  panelId,
  openByParam,
  onPanelChange,
  anchorId,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actionLabel?: string;
  actionHref?: string;
  expandable?: boolean;
  panelId?: string;
  openByParam?: string | null;
  onPanelChange?: (id: string | null) => void;
  anchorId?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = !!panelId && !!onPanelChange;
  const fullscreen = isControlled ? openByParam === panelId : internalOpen;
  const setFullscreen = (next: boolean) => {
    if (isControlled) {
      onPanelChange!(next ? panelId! : null);
    } else {
      setInternalOpen(next);
    }
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // setFullscreen is stable (either local setState or the parent's setter
    // via panelId/onPanelChange); listing it would force re-subscribing to
    // keydown on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  const header = (full: boolean) => (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-800/80">
      {icon && <span className="text-neutral-500">{icon}</span>}
      <div className="text-sm font-medium">{title}</div>
      <div className="ml-auto text-xs text-neutral-500 flex items-center gap-2">
        <span>{subtitle}</span>
        {actionHref && !full && (
          <Link
            href={actionHref}
            className="text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
          >
            {actionLabel ?? "Open"}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
        {expandable && !full && (
          <button
            onClick={() => setFullscreen(true)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
        {full && (
          <button
            onClick={() => setFullscreen(false)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <PanelFullscreenContext.Provider value={fullscreen}>
      <div
        id={anchorId}
        className={`border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden scroll-mt-6 ${className}`}
      >
        {header(false)}
        <div className={fullscreen ? "p-8 text-center text-xs text-neutral-600" : ""}>
          {fullscreen ? "Currently expanded — press Esc to restore" : children}
        </div>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-center p-4 sm:p-8 drawer-fade"
          onClick={() => setFullscreen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[110rem] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {header(true)}
            <div className="flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      )}
    </PanelFullscreenContext.Provider>
  );
}

function Member({
  name,
  role,
  status,
  color,
}: {
  name: string;
  role: string;
  status: "online" | "offline" | "idle";
  color: TeamMember["color"];
}) {
  const palette = {
    amber: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200",
    sky: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200",
    emerald: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40 text-emerald-200",
    violet: "from-violet-500/30 to-violet-700/20 border-violet-500/40 text-violet-200",
    fuchsia: "from-fuchsia-500/30 to-fuchsia-700/20 border-fuchsia-500/40 text-fuchsia-200",
    rose: "from-rose-500/30 to-rose-700/20 border-rose-500/40 text-rose-200",
  }[color];
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-900 last:border-b-0">
      <div
        className={`w-9 h-9 rounded-full border bg-gradient-to-br flex items-center justify-center text-xs font-semibold shrink-0 ${palette}`}
      >
        {name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-200">{name}</div>
        <div className="text-[10px] text-neutral-500 truncate">{role}</div>
      </div>
      <PulseDot tone={status === "online" ? "ok" : status === "idle" ? "warn" : "idle"} size={6} />
    </div>
  );
}

function ServerStat({
  s,
}: {
  s: {
    id: number;
    name: string;
    icon: string;
    color: string;
    channelCount: number;
    activity24h: number;
  };
}) {
  const palette = SERVER_PALETTE[s.color] ?? SERVER_PALETTE.amber;
  return (
    <div
      className={`relative rounded-xl border bg-gradient-to-br p-3.5 ${palette} group transition-shadow hover:shadow-lg hover:shadow-black/30`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-center justify-center text-base font-semibold">
          {s.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{s.name}</div>
          <div className="text-[10px] text-neutral-500">workspace</div>
        </div>
      </div>
      <div className="flex items-end justify-between text-[11px] text-neutral-400">
        <div>
          <div className="font-mono text-neutral-300 text-base leading-none">
            {s.channelCount}
          </div>
          <div className="text-neutral-500">channels</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-neutral-300 text-base leading-none">
            {s.activity24h}
          </div>
          <div className="text-neutral-500">events 24h</div>
        </div>
      </div>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border border-neutral-800 rounded-lg p-3 hover:border-neutral-700 hover:bg-neutral-900/60 transition-colors flex items-start gap-2"
    >
      <div className="text-neutral-400 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-neutral-200">{label}</div>
        <div className="text-[10px] text-neutral-500">{hint}</div>
      </div>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-xs text-neutral-600">{text}</div>;
}

// Deterministic skeleton widths — Math.random in render breaks React purity
// (every render re-rolls and produces a layout shift). The shimmer is the
// thing readers notice; the exact widths only need to look "varied enough".
const SKELETON_BAR_HEIGHTS = [40, 78, 32, 65, 50, 72, 45];
const SKELETON_LINE_WIDTHS_TOP = [62, 48, 70, 55, 44];
const SKELETON_LINE_WIDTHS_BOTTOM = [38, 52, 33, 47, 41];

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-end gap-1.5 px-2 py-2">
      {SKELETON_BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 bg-neutral-900 rounded-t animate-pulse"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col">
      {SKELETON_LINE_WIDTHS_TOP.map((top, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-2.5 border-b border-neutral-900 last:border-b-0"
        >
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 bg-neutral-800 rounded animate-pulse"
              style={{ width: `${top}%` }}
            />
            <div
              className="h-2.5 bg-neutral-900 rounded animate-pulse"
              style={{ width: `${SKELETON_LINE_WIDTHS_BOTTOM[i]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function DashboardHeader({ checkedAt }: { checkedAt?: string }) {
  const { servers, currentId } = useServers();
  const current = servers.find((s) => s.id === currentId);
  // Special-case the canonical shared "War Room" server with the original
  // emblem + name. Personal / custom servers get a generic header derived
  // from their own name so cold-clone forks don't see "The War Room"
  // on a server they never created.
  const isShared = !!current && /war.?room/i.test(current.name);
  const title = isShared ? "The War Room" : current?.name ?? "Dashboard";
  const subtitle = isShared
    ? `Team command center · ${TEAM.map((m) => m.name).join(" · ")}`
    : "Your cockpit · agent activity, files, jobs at a glance";
  return (
    <header className="mb-7">
      <div className="flex items-center gap-2 mb-1">
        {isShared ? (
          <span className="text-2xl">⚔</span>
        ) : (
          <span className="text-2xl">{current?.icon ?? "✦"}</span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <span className="ml-auto text-[10px] text-neutral-600 uppercase tracking-wider">
          {checkedAt ? `refreshed ${new Date(checkedAt).toLocaleTimeString()}` : "loading…"}
        </span>
      </div>
      <p className="text-sm text-neutral-500">{subtitle}</p>
    </header>
  );
}

function BoardroomPanel({
  expandedPanel,
  setExpandedPanel,
}: {
  expandedPanel: string | null;
  setExpandedPanel: (id: string | null) => void;
}) {
  const meeting = useMeeting();
  const [chatOpen, setChatOpen] = useState(false);

  // Auto-fullscreen when joining a meeting; collapse back on leave.
  const prevPhase = useRef(meeting.phase);
  useEffect(() => {
    if (prevPhase.current !== meeting.phase) {
      if (meeting.phase === "in-meeting") {
        setExpandedPanel("boardroom");
      } else if (meeting.phase === "pre-join" && expandedPanel === "boardroom") {
        setExpandedPanel(null);
      }
      prevPhase.current = meeting.phase;
    }
  }, [meeting.phase, expandedPanel, setExpandedPanel]);

  return (
    <Panel
      title="Boardroom"
      subtitle={meeting.phase === "in-meeting" ? "In meeting" : "Pre-flight · device check + join"}
      icon={<Users className="w-4 h-4" />}
      className="mb-7"
      expandable
      panelId="boardroom"
      anchorId="boardroom"
      openByParam={expandedPanel}
      onPanelChange={setExpandedPanel}
    >
      <div className="flex flex-col md:flex-row md:items-stretch h-full">
        <div className="flex-1 min-w-0 md:border-r border-neutral-900">
          <MeetingRoom chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />
        </div>
        {chatOpen && (
          <div className="md:w-96 lg:w-[28rem] shrink-0 border-t md:border-t-0 border-neutral-900 flex flex-col min-h-0">
            <BoardroomChat />
          </div>
        )}
      </div>
    </Panel>
  );
}
