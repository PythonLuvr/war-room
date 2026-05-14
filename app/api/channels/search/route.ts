import { NextResponse } from "next/server";
import { getChannelTree } from "@/lib/channels";
import { listUserServers } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const servers = listUserServers();
  const out: Array<{
    serverId: number;
    serverName: string;
    serverIcon: string;
    serverColor: string;
    channelId: string;
    channelName: string;
    group: string;
    kind: string;
    isPrivate: boolean;
    projectPath?: string;
  }> = [];
  for (const s of servers) {
    const { channels } = await getChannelTree(s.id);
    for (const c of channels) {
      out.push({
        serverId: s.id,
        serverName: s.name,
        serverIcon: s.icon,
        serverColor: s.color,
        channelId: c.id,
        channelName: c.name,
        group: c.group,
        kind: c.kind,
        isPrivate: !!c.isPrivate,
        projectPath: c.projectPath,
      });
    }
  }
  return NextResponse.json({ items: out, servers });
}
