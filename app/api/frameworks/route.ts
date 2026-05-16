import { NextRequest, NextResponse } from "next/server";
import { listFrameworks, readFramework } from "@/lib/frameworks";
import { getSetting, setChannelFrameworkPreset, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/frameworks
//   Lists every bundled framework preset + the current global default.
// GET /api/frameworks?id=openwar&content=1
//   Returns the markdown for one preset (so the UI can preview it).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const wantContent = req.nextUrl.searchParams.get("content") === "1";
  if (id) {
    const text = readFramework(id);
    if (!text) return NextResponse.json({ error: "unknown framework" }, { status: 404 });
    return NextResponse.json({ id, content: wantContent ? text : null });
  }
  return NextResponse.json({
    frameworks: listFrameworks(),
    defaultId: getSetting("default.framework") ?? null,
  });
}

// POST /api/frameworks  → set global default
//   { defaultId: "openwar" | "none" | null }
// POST /api/frameworks  → set per-channel pin
//   { channelId, presetId: "openwar" | "none" | null }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    defaultId?: string | null;
    channelId?: string;
    presetId?: string | null;
  };

  if (body.channelId !== undefined) {
    const next =
      body.presetId === null || body.presetId === undefined ? null : body.presetId.trim() || null;
    if (next && next !== "none" && !readFramework(next)) {
      return NextResponse.json({ error: `unknown framework ${next}` }, { status: 400 });
    }
    setChannelFrameworkPreset(body.channelId, next);
    return NextResponse.json({ ok: true, channelId: body.channelId, presetId: next });
  }

  if (body.defaultId !== undefined) {
    const next =
      body.defaultId === null ? "" : body.defaultId.trim();
    if (next && next !== "none" && !readFramework(next)) {
      return NextResponse.json({ error: `unknown framework ${next}` }, { status: 400 });
    }
    setSetting("default.framework", next);
    return NextResponse.json({ ok: true, defaultId: next || null });
  }

  return NextResponse.json({ error: "no fields to update" }, { status: 400 });
}
