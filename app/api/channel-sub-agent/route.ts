import { NextRequest, NextResponse } from "next/server";
import { getChannelSubAgent, setChannelSubAgent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({ subAgentId: getChannelSubAgent(channelId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { channelId?: string; subAgentId?: string | null };
  const channelId = body.channelId?.trim();
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  const next =
    body.subAgentId === undefined || body.subAgentId === "" ? null : body.subAgentId;
  setChannelSubAgent(channelId, next);
  return NextResponse.json({ ok: true, channelId, subAgentId: next });
}
