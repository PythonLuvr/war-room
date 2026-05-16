import { NextRequest, NextResponse } from "next/server";
import {
  getChannelPrimerEnabled,
  getSetting,
  resolvePrimerEnabled,
  setChannelPrimerEnabled,
  setSetting,
} from "@/lib/db";
import { readAgentPrimer } from "@/lib/agent-primer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/primer
//   Returns the global default + whether the primer file is bundled.
// GET /api/primer?channelId=...
//   Adds per-channel pin + resolved-effective value for that channel.
// GET /api/primer?content=1
//   Returns the primer markdown content (for the Settings preview).
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const wantContent = req.nextUrl.searchParams.get("content") === "1";
  const primerLoaded = readAgentPrimer() !== null;
  const defaultRaw = getSetting("default.primer_enabled");
  const defaultEnabled = defaultRaw === "0" ? false : true;
  const payload: Record<string, unknown> = {
    defaultEnabled,
    primerLoaded,
  };
  if (channelId) {
    payload.channelPin = getChannelPrimerEnabled(channelId);
    payload.effective = resolvePrimerEnabled(channelId);
  }
  if (wantContent) {
    payload.content = readAgentPrimer();
  }
  return NextResponse.json(payload);
}

// POST /api/primer  → set global default
//   { defaultEnabled: true | false }
// POST /api/primer  → set per-channel pin
//   { channelId, enabled: true | false | null }   (null = inherit)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    defaultEnabled?: boolean;
    channelId?: string;
    enabled?: boolean | null;
  };

  if (body.channelId !== undefined) {
    const v: boolean | null =
      body.enabled === null || body.enabled === undefined ? null : !!body.enabled;
    setChannelPrimerEnabled(body.channelId, v);
    return NextResponse.json({ ok: true, channelId: body.channelId, enabled: v });
  }

  if (body.defaultEnabled !== undefined) {
    setSetting("default.primer_enabled", body.defaultEnabled ? "1" : "0");
    return NextResponse.json({ ok: true, defaultEnabled: body.defaultEnabled });
  }

  return NextResponse.json({ error: "no fields to update" }, { status: 400 });
}
