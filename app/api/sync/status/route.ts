import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSyncClient, getSyncStatus } from "@/lib/sync/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Side-effect: touching this route boots (or re-boots) the sync
// client. Settings panel hits this on mount, so opening Settings is
// enough to pick up a URL the user just saved.
//
// Config sources, in precedence order:
//   1. WAR_ROOM_SYNC_URL env var
//   2. settings.onboarding.syncUrl (written by the wizard / SyncTab)
//
// The wizard-driven path is what makes "configure in the UI" actually
// connect. The env-var path is for power users who want a portable
// config across reinstalls.
export async function GET() {
  const row = db()
    .prepare(`SELECT value FROM settings WHERE key = 'onboarding.syncUrl'`)
    .get() as { value: string } | undefined;
  const dbUrl = row?.value ?? "";
  ensureSyncClient({ url: process.env.WAR_ROOM_SYNC_URL || dbUrl });
  return NextResponse.json(getSyncStatus());
}
