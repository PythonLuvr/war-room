"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PulseDot } from "@/components/pulse-dot";
import { Sparkles, Server, Activity as ActivityIcon, MessageSquare, Wrench } from "lucide-react";
import type { HealthReport } from "@/lib/services-check";

type ActivityRow = {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  created_at: number;
};

type SessionRow = {
  id: number;
  project_path: string;
  claude_session_id: string | null;
  last_used_at: number;
};

export function HomeChannel() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const [h, a, p] = await Promise.all([
        fetch("/api/services").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/activity").then((r) => (r.ok ? r.json() : { items: [] })),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : { sessions: [] })),
      ]);
      setHealth(h);
      setActivity(a.items ?? []);
      setSessions(p.sessions ?? []);
    };
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const vpsOk = health ? !health.vps.error : null;
  const vpsOnline = health?.vps.services.filter((s) => s.status === "online").length ?? 0;
  const vpsTotal = health?.vps.services.length ?? 0;
  const localOk = health?.local.every((l) => l.reachable) ?? null;
  const envOk = health?.env.every((e) => e.exists) ?? null;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h2 className="text-2xl font-semibold tracking-tight">Welcome to The War Room</h2>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Local cockpit · Localhost · $0 infra
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Tile
          icon={<Server className="w-4 h-4" />}
          label="VPS"
          value={vpsOk === null ? "…" : `${vpsOnline}/${vpsTotal}`}
          tone={vpsOk === null ? "idle" : vpsOk ? "ok" : "bad"}
          sub="services up"
          href="/c/system/services"
        />
        <Tile
          icon={<ActivityIcon className="w-4 h-4" />}
          label="Local"
          value={localOk === null ? "…" : localOk ? "OK" : "down"}
          tone={localOk === null ? "idle" : localOk ? "ok" : "warn"}
          sub="daemons"
          href="/c/system/services"
        />
        <Tile
          icon={<Wrench className="w-4 h-4" />}
          label="Env"
          value={envOk === null ? "…" : envOk ? `${health?.env.reduce((n, e) => n + e.keys.length, 0) ?? 0}` : "missing"}
          tone={envOk === null ? "idle" : envOk ? "ok" : "warn"}
          sub="keys loaded"
          href="/c/system/services"
        />
        <Tile
          icon={<MessageSquare className="w-4 h-4" />}
          label="Sessions"
          value={sessions === null ? "…" : `${sessions.length}`}
          tone={sessions === null ? "idle" : sessions.length > 0 ? "ok" : "idle"}
          sub="tracked"
          href="/c/system/sessions"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Recent activity" subtitle={activity === null ? "…" : `${activity.length} events`}>
          {activity === null ? (
            <SkeletonList count={5} />
          ) : activity.length === 0 ? (
            <Empty text="No activity yet." />
          ) : (
            <div className="flex flex-col">
              {activity.slice(0, 10).map((a) => (
                <div key={a.id} className="px-3 py-2 hover:bg-neutral-900/40 border-b border-neutral-900 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-200 truncate">{a.title}</span>
                    <span className="text-[10px] text-neutral-600 shrink-0 ml-2">
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                  {a.detail && (
                    <div className="text-xs text-neutral-500 truncate mt-0.5">{a.detail}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Active sessions" subtitle={sessions === null ? "…" : `${sessions.length} tracked`}>
          {sessions === null ? (
            <SkeletonList count={4} />
          ) : sessions.length === 0 ? (
            <Empty text="No sessions yet. Pick a channel and send a message." />
          ) : (
            <div className="flex flex-col">
              {sessions.slice(0, 8).map((s) => {
                const name = s.project_path.split(/[\\/]/).pop() ?? s.project_path;
                return (
                  <Link
                    key={s.id}
                    href="/c/home"
                    className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-900/40 border-b border-neutral-900 last:border-b-0"
                  >
                    <PulseDot tone={s.claude_session_id ? "ok" : "idle"} size={6} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 truncate">{name}</div>
                      <div className="text-xs text-neutral-500 truncate">{s.project_path}</div>
                    </div>
                    <div className="text-[10px] text-neutral-600">{timeAgo(s.last_used_at)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warn" | "bad" | "idle";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase tracking-wider mb-2">
        {icon}
        {label}
        <div className="ml-auto">
          <PulseDot tone={tone} size={6} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-neutral-100">{value}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>
    </>
  );
  const cls =
    "rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 transition-colors";
  if (href)
    return (
      <Link href={href} className={`${cls} hover:border-neutral-700 hover:bg-neutral-900 cursor-pointer block`}>
        {body}
      </Link>
    );
  return <div className={cls}>{body}</div>;
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-800/80">
        <div className="text-sm font-medium">{title}</div>
        <div className="ml-auto text-xs text-neutral-500">{subtitle}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 text-center text-xs text-neutral-600">{text}</div>
  );
}

function SkeletonList({ count }: { count: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-3 py-2.5 border-b border-neutral-900 last:border-b-0 space-y-1.5">
          <div className="h-3 bg-neutral-800 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
          <div className="h-2.5 bg-neutral-900 rounded animate-pulse" style={{ width: `${30 + Math.random() * 30}%` }} />
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
