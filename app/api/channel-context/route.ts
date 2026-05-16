import { NextRequest, NextResponse } from "next/server";
import { setChannelContextSettings, type ChannelContextMode } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Update the cross-agent context mode + budgets for a single channel.
// Channel ids contain slashes (e.g. "user/foo"), so the id rides in the
// body instead of the URL.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    mode?: ChannelContextMode;
    messages?: number;
    chars?: number;
  };
  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  const patch: { mode?: ChannelContextMode; messages?: number; chars?: number } = {};
  if (body.mode === "isolated" || body.mode === "shared") patch.mode = body.mode;
  if (typeof body.messages === "number" && Number.isFinite(body.messages)) {
    patch.messages = body.messages;
  }
  if (typeof body.chars === "number" && Number.isFinite(body.chars)) {
    patch.chars = body.chars;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  setChannelContextSettings(channelId, patch);
  return NextResponse.json({ ok: true });
}
