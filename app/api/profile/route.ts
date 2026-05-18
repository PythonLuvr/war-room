import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read + write the local user's avatar fields. Display name lives in
// the wizard / onboarding flow already; this surface is the standalone
// "what does my profile look like" read for the right sidebar +
// chat-bubble renderers, and the write target for the Settings ->
// General profile edit row.

export async function GET() {
  return NextResponse.json({
    displayName: getSetting("onboarding.displayName") ?? "",
    iconUrl: getSetting("onboarding.displayIcon") ?? "",
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { displayName?: string; iconUrl?: string };
  if (typeof body.displayName === "string") {
    setSetting("onboarding.displayName", body.displayName.trim());
  }
  if (typeof body.iconUrl === "string") {
    setSetting("onboarding.displayIcon", body.iconUrl.trim());
  }
  return NextResponse.json({ ok: true });
}
