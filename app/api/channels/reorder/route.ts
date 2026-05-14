import { NextRequest, NextResponse } from "next/server";
import { setChannelPositions, setGroupPositions } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body =
  | { kind: "channel"; serverId: number; items: Array<{ channelId: string; position: number }> }
  | { kind: "group"; serverId: number; items: Array<{ label: string; position: number }> };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body.kind || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "kind + items required" }, { status: 400 });
  }
  const serverId = body.serverId ?? 1;
  if (body.kind === "channel") {
    setChannelPositions(serverId, body.items);
  } else if (body.kind === "group") {
    setGroupPositions(serverId, body.items);
  } else {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
