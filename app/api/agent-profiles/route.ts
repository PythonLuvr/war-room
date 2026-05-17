import { NextRequest, NextResponse } from "next/server";
import {
  deleteAgentProfile,
  getAgentProfile,
  getAllAgentProfiles,
  setAgentProfile,
} from "@/lib/db";
import { ALL_ADAPTERS } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_ADAPTER_IDS = new Set(ALL_ADAPTERS.map((a) => a.id));

// Optional set of accents the UI is allowed to write. Keeps a malformed
// POST from injecting arbitrary classnames into the rendered output.
const VALID_ACCENTS = new Set(["amber", "sky", "emerald", "violet", "fuchsia", "rose"]);

// GET /api/agent-profiles                  -> all profiles
// GET /api/agent-profiles?adapterId=x      -> just one
export async function GET(req: NextRequest) {
  const adapterId = req.nextUrl.searchParams.get("adapterId");
  if (adapterId) {
    return NextResponse.json({ profile: getAgentProfile(adapterId) ?? null });
  }
  const all = getAllAgentProfiles();
  return NextResponse.json({
    profiles: Object.fromEntries(all.entries()),
  });
}

// POST /api/agent-profiles
//   { adapterId, displayName?, iconUrl?, accent? }   -> upsert
// Send a field as "" (empty string) to clear it back to the adapter's
// built-in default. Send a field as undefined / not present to leave
// it alone.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    adapterId?: string;
    displayName?: string | null;
    iconUrl?: string | null;
    accent?: string | null;
  };
  if (!body.adapterId || !VALID_ADAPTER_IDS.has(body.adapterId)) {
    return NextResponse.json({ error: "unknown adapterId" }, { status: 400 });
  }
  if (body.accent && !VALID_ACCENTS.has(body.accent)) {
    return NextResponse.json({ error: "unknown accent" }, { status: 400 });
  }
  setAgentProfile(body.adapterId, {
    display_name:
      body.displayName === undefined ? undefined : body.displayName?.trim() || null,
    icon_url:
      body.iconUrl === undefined ? undefined : body.iconUrl?.trim() || null,
    accent: body.accent === undefined ? undefined : body.accent || null,
  });
  return NextResponse.json({ ok: true, profile: getAgentProfile(body.adapterId) });
}

// DELETE clears the override row entirely. Same effect as POSTing all
// fields as empty, but cleaner intent.
export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { adapterId?: string };
  if (!body.adapterId || !VALID_ADAPTER_IDS.has(body.adapterId)) {
    return NextResponse.json({ error: "unknown adapterId" }, { status: 400 });
  }
  deleteAgentProfile(body.adapterId);
  return NextResponse.json({ ok: true });
}
