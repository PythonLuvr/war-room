import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo-seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only available when the server was started in demo mode. Real installs
// can't accidentally trigger it, there's no UI for it either; the demo
// runner script (`npm run demo`) hits this endpoint once the server is up.
function isDemoMode() {
  return process.env.WAR_ROOM_DEMO === "1";
}

export async function POST() {
  if (!isDemoMode()) {
    return NextResponse.json(
      { error: "demo seed only available with WAR_ROOM_DEMO=1" },
      { status: 403 },
    );
  }
  try {
    seedDemoData();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
