import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import {
  getChannelSupervisor,
  setChannelSupervisor,
  db,
  getSetting,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET  ?channelId= → return current supervisor settings for the channel
// POST { channelId, agentId, everyN }        → save settings
// POST { channelId, run: true }              → trigger a supervisor pass now

type RecentMessage = { role: string; content: string; agent_id: string | null };

function getRecentMessages(channelId: string, limit: number): RecentMessage[] {
  // Channels are linked to projects via channel_overrides.project_path OR
  // user_channels.project_path. We join both to find the session.
  const rows = db()
    .prepare(
      `SELECT cm.role, cm.content, cm.agent_id
       FROM chat_messages cm
       JOIN claude_sessions cs ON cs.id = cm.session_id
       WHERE cs.project_path IN (
         SELECT project_path FROM channel_overrides WHERE channel_id = ? AND project_path IS NOT NULL
         UNION
         SELECT project_path FROM user_channels WHERE slug = ? AND project_path IS NOT NULL
       )
       ORDER BY cm.created_at DESC
       LIMIT ?`,
    )
    .all(channelId, channelId, limit) as RecentMessage[];
  return rows.reverse();
}

function compressMessages(messages: RecentMessage[]): string {
  if (messages.length === 0) return "(no messages yet)";
  return messages
    .map((m) => {
      const speaker = m.role === "user" ? "USER" : `AGENT(${m.agent_id ?? "?"})`;
      const body = m.content.slice(0, 300) + (m.content.length > 300 ? "…" : "");
      return `${speaker}: ${body}`;
    })
    .join("\n\n");
}

function claudeBin(): string {
  return getSetting("agent.cli.claude.bin") || getSetting("onboarding.claudeBin") || "claude";
}

function runSupervisor(agentId: string, compressedContext: string): Promise<string> {
  return new Promise((resolve) => {
    const prompt = [
      "You are a lightweight supervisor reviewing a compressed excerpt of a multi-agent channel.",
      "Read the recent exchanges below and reply with ONE brief paragraph (max 80 words) of",
      "concrete, actionable improvement suggestions for the next turn. Be direct and terse.",
      "Focus on: task progress, gaps, inefficiencies, or next best action.",
      "",
      "CHANNEL CONTEXT (compressed):",
      compressedContext,
    ].join("\n");

    const args = ["-p", "--agent", agentId, "--bare", prompt];
    const child = spawn(claudeBin(), args, {
      shell: process.platform === "win32",
      env: { ...process.env },
    });

    let out = "";
    let err = "";
    child.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { err += chunk.toString("utf8"); });
    child.on("close", () => {
      const text = out.trim() || err.trim() || "(no output)";
      resolve(text);
    });
    child.on("error", (e) => resolve(`(supervisor error: ${e.message})`));
  });
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  const settings = getChannelSupervisor(channelId);
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    agentId?: string | null;
    everyN?: number;
    run?: boolean;
  };
  const channelId = body.channelId?.trim();
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  // Config-only update
  if (!body.run) {
    const agentId = body.agentId === undefined ? undefined : body.agentId;
    const everyN = body.everyN ?? 0;
    const current = getChannelSupervisor(channelId);
    setChannelSupervisor(
      channelId,
      agentId === undefined ? current.agentId : (agentId ?? null),
      everyN,
    );
    return NextResponse.json({ ok: true });
  }

  // Trigger a supervisor run
  const settings = getChannelSupervisor(channelId);
  const agentId = settings.agentId ?? "meta-analyzer";

  const messages = getRecentMessages(channelId, 20);
  const compressed = compressMessages(messages);
  const note = await runSupervisor(agentId, compressed);

  return NextResponse.json({ note, agentId });
}
