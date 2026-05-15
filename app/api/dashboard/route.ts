import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CLIENTS_ROOT, STATIC_WORKSPACES } from "@/lib/config";
import { TEAM } from "@/lib/team";
import { db, listSessions, listUserServers } from "@/lib/db";
import { recentActivity } from "@/lib/activity";
import { getHealthReport } from "@/lib/services-check";
import { getChannelTree } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isDemo = () => process.env.WAR_ROOM_DEMO === "1";

async function countActiveClients(): Promise<number> {
  // Demo mode: derive the count from the seeded "Active projects" channels
  // so the KPI matches what the user sees in the sidebar instead of
  // returning 0 (the empty filesystem CLIENTS_ROOT walk).
  if (isDemo()) {
    const row = db()
      .prepare(
        `SELECT COUNT(*) as n FROM user_channels WHERE group_label = 'Active projects'`,
      )
      .get() as { n: number };
    return row?.n ?? 0;
  }
  try {
    const entries = await fs.readdir(CLIENTS_ROOT, { withFileTypes: true });
    let active = 0;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
      try {
        const briefText = await fs.readFile(
          path.join(CLIENTS_ROOT, e.name, "brief.md"),
          "utf8",
        );
        if (/^status:\s*(finished|archived|done)\s*$/im.test(briefText)) continue;
        active++;
      } catch {
        active++;
      }
    }
    return active;
  } catch {
    return 0;
  }
}

function countDemoApprovals(): number {
  // Count seeded "approval.new" events in the last 24h. The demo seed
  // sprinkles 2-4 of these; this turns the KPI light up.
  if (!isDemo()) return 0;
  const since = Date.now() - 24 * 3600 * 1000;
  const row = db()
    .prepare(
      `SELECT COUNT(*) as n FROM activity WHERE kind = 'approval.new' AND created_at >= ?`,
    )
    .get(since) as { n: number };
  return Math.min(row?.n ?? 0, 5);
}

function activityByDay(days = 7): Array<{ day: string; date: string; count: number }> {
  const now = new Date();
  const buckets: Array<{ day: string; date: string; count: number; start: number; end: number }> =
    [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    const label = d.toLocaleDateString(undefined, { weekday: "short" });
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    buckets.push({ day: label, date: dateStr, count: 0, start, end });
  }
  const rows = db()
    .prepare(
      `SELECT created_at FROM activity WHERE created_at >= ? AND created_at < ?`,
    )
    .all(buckets[0].start, buckets[buckets.length - 1].end) as Array<{ created_at: number }>;
  for (const r of rows) {
    for (const b of buckets) {
      if (r.created_at >= b.start && r.created_at < b.end) {
        b.count++;
        break;
      }
    }
  }
  return buckets.map(({ day, date, count }) => ({ day, date, count }));
}

function topChannels(limit = 5): Array<{ name: string; count: number; projectPath: string }> {
  const rows = db()
    .prepare(
      `SELECT project_path, COUNT(*) as count FROM activity
       WHERE project_path IS NOT NULL
       GROUP BY project_path
       ORDER BY count DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ project_path: string; count: number }>;
  return rows.map((r) => ({
    name: r.project_path.split(/[\\/]/).pop() ?? r.project_path,
    count: r.count,
    projectPath: r.project_path,
  }));
}

function activityToday(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = db()
    .prepare(`SELECT COUNT(*) as n FROM activity WHERE created_at >= ?`)
    .get(start.getTime()) as { n: number };
  return row?.n ?? 0;
}

function activityByKind(): Array<{ kind: string; count: number }> {
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  return db()
    .prepare(
      `SELECT kind, COUNT(*) as count FROM activity WHERE created_at >= ? GROUP BY kind ORDER BY count DESC`,
    )
    .all(since) as Array<{ kind: string; count: number }>;
}

function hourlyHeatmap(): { days: string[]; matrix: number[][] } {
  const now = new Date();
  const days: string[] = [];
  const matrix: number[][] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    matrix.push(Array(24).fill(0));
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const rows = db()
    .prepare(`SELECT created_at FROM activity WHERE created_at >= ?`)
    .all(start.getTime()) as Array<{ created_at: number }>;
  for (const r of rows) {
    const d = new Date(r.created_at);
    const dayIdx = Math.floor((d.getTime() - start.getTime()) / (24 * 3600 * 1000));
    const hour = d.getHours();
    if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
      matrix[dayIdx][hour]++;
    }
  }
  return { days, matrix };
}

async function perServerStats() {
  const servers = listUserServers();
  const since = Date.now() - 24 * 3600 * 1000;
  const out: Array<{
    id: number;
    name: string;
    icon: string;
    color: string;
    channelCount: number;
    activity24h: number;
  }> = [];
  for (const s of servers) {
    const { channels } = await getChannelTree(s.id);
    // Approx per-server activity: count rows where any channel in this server has matching project_path
    const paths = channels.map((c) => c.projectPath).filter(Boolean) as string[];
    let act = 0;
    if (paths.length) {
      const placeholders = paths.map(() => "?").join(",");
      const row = db()
        .prepare(
          `SELECT COUNT(*) as n FROM activity WHERE created_at >= ? AND project_path IN (${placeholders})`,
        )
        .get(since, ...paths) as { n: number };
      act = row?.n ?? 0;
    }
    out.push({
      id: s.id,
      name: s.name,
      icon: s.icon,
      color: s.color,
      channelCount: channels.length,
      activity24h: act,
    });
  }
  return out;
}

function topSessions(limit = 5) {
  return db()
    .prepare(
      `SELECT s.id, s.project_path, COUNT(m.id) as message_count, s.last_used_at
       FROM claude_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
       GROUP BY s.id
       ORDER BY message_count DESC, s.last_used_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    project_path: string;
    message_count: number;
    last_used_at: number;
  }>;
}

async function recentFiles(limit = 8) {
  const roots = [
    ...STATIC_WORKSPACES.map((w) => w.path),
    CLIENTS_ROOT,
  ];
  const items: Array<{ path: string; name: string; mtime: number; size: number }> = [];
  for (const root of roots) {
    await walk(root, items, 2, 0);
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return items.slice(0, limit);
}

async function walk(
  dir: string,
  out: Array<{ path: string; name: string; mtime: number; size: number }>,
  maxDepth: number,
  depth: number,
) {
  if (depth > maxDepth) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".next") continue;
      const p = path.join(dir, e.name);
      if (e.isFile()) {
        try {
          const st = await fs.stat(p);
          out.push({ path: p, name: e.name, mtime: st.mtimeMs, size: st.size });
        } catch {}
      } else if (e.isDirectory() && depth < maxDepth) {
        await walk(p, out, maxDepth, depth + 1);
      }
    }
  } catch {}
}

export async function GET() {
  const [clients, health, perServer, files] = await Promise.all([
    countActiveClients(),
    getHealthReport(),
    perServerStats(),
    recentFiles(8),
  ]);
  const sessions = listSessions();
  const vpsOnline = health.vps.error
    ? 0
    : health.vps.services.filter((s) => s.status === "online").length;
  const vpsTotal = health.vps.error ? 0 : health.vps.services.length;

  // Demo mode: synthesize VPS counts + team presence + approvals so the
  // KPI strip looks like a real operator's daily view instead of zeros.
  // The first three KPIs are derived from the seeded data already.
  const demo = isDemo();
  const teamTotal = demo ? 4 : TEAM.length;
  const teamOnline = demo ? 3 : 1;
  const vpsOnlineFinal = demo ? 4 : vpsOnline;
  const vpsTotalFinal = demo ? 5 : vpsTotal;
  const vpsError = demo ? null : (health.vps.error ?? null);

  return NextResponse.json({
    kpi: {
      activeClients: clients,
      openApprovals: demo ? countDemoApprovals() : 0,
      activityToday: activityToday(),
      vps: { online: vpsOnlineFinal, total: vpsTotalFinal, error: vpsError },
      activeSessions: sessions.length,
      teamOnline,
      teamTotal,
    },
    timeseries: activityByDay(7),
    topChannels: topChannels(5),
    recentActivity: recentActivity(15),
    activityByKind: activityByKind(),
    hourlyHeatmap: hourlyHeatmap(),
    perServerStats: perServer,
    topSessions: topSessions(5),
    recentFiles: files,
    checkedAt: new Date().toISOString(),
  });
}
