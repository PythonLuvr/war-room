import { NextRequest, NextResponse } from "next/server";
import { getChannelTree } from "@/lib/channels";
import { listDecisions, listAnnouncements, listKnowledge, listUserServers } from "@/lib/db";
import { getRequester } from "@/lib/team";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Self-location endpoint for the agent primer. When an agent inside
// a War Room chat needs to know "where am I, what have we discussed,
// what's pinned in this channel," it hits this endpoint with the
// channel id from its live context. Cheap query, returns a compact
// JSON blob the agent can summarize or reason over.
//
// Not user-facing UI; intentionally minimal shape. If the agent
// wants more (search by tag, decisions across channels, etc) it
// calls the existing /api/decisions /api/knowledge etc. endpoints.

const ME = getRequester();

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  let serverName: string | null = null;
  let channelMeta: {
    id: string;
    name: string;
    kind: string;
    projectPath?: string;
    description?: string;
  } | null = null;
  for (const s of listUserServers()) {
    const { channels } = await getChannelTree(s.id, { includeHidden: true });
    const hit = channels.find((c) => c.id === channelId);
    if (hit) {
      serverName = s.name;
      channelMeta = {
        id: hit.id,
        name: hit.name,
        kind: hit.kind,
        projectPath: hit.projectPath,
        description: hit.description,
      };
      break;
    }
  }

  if (!channelMeta) {
    return NextResponse.json({ error: "channel not found" }, { status: 404 });
  }

  const recentDecisions = listDecisions(channelId, 10).map((d) => ({
    id: d.id,
    title: d.title,
    summary: d.summary,
    status: d.status,
    author: d.author,
    created_at: d.created_at,
  }));
  const recentAnnouncements = listAnnouncements(channelId, ME, 10).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    status: a.status,
    author: a.author,
    created_at: a.created_at,
  }));
  const recentKnowledge = listKnowledge(channelId).slice(0, 10).map((k) => ({
    id: k.id,
    title: k.title,
    body: k.body.slice(0, 400),
    tags: k.tags_json ? JSON.parse(k.tags_json) : [],
    updated_at: k.updated_at,
  }));

  return NextResponse.json({
    server: { name: serverName },
    channel: channelMeta,
    recentDecisions,
    recentAnnouncements,
    recentKnowledge,
    endpoints: {
      logDecision: "POST /api/decisions",
      postAnnouncement: "POST /api/announcements",
      addKnowledge: "POST /api/knowledge",
    },
  });
}
