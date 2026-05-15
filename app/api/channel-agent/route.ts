import { NextRequest, NextResponse } from "next/server";
import { setChannelOverrideAgent } from "@/lib/db";
import { getAdapter } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Pin (or unpin) the AI backend for a single channel. Channel ids contain
// slashes (e.g. "user/foo", "system/activity"), so the id rides in the
// body instead of the URL.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    backendId?: string | null;
  };
  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  // null / empty string clears the pin and falls back to the global default.
  const next =
    body.backendId === null || body.backendId === undefined || body.backendId === ""
      ? null
      : body.backendId.trim();
  if (next && !getAdapter(next)) {
    return NextResponse.json({ error: `unknown backend ${next}` }, { status: 400 });
  }
  setChannelOverrideAgent(channelId, next);
  return NextResponse.json({ ok: true, channelId, backendId: next });
}
