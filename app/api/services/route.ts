import { NextResponse } from "next/server";
import { getHealthReport, type HealthReport } from "@/lib/services-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Synthetic health report used when WAR_ROOM_DEMO=1. Real installs hit
// the SSH probe in services-check.ts; the demo never has VPS credentials
// so the page would otherwise read as "VPS not configured" + zero rows.
function demoHealthReport(): HealthReport {
  const now = Date.now();
  const uptimeStart = (hours: number) => now - hours * 3600 * 1000;
  return {
    vps: {
      reachable: true,
      services: [
        { name: "war-room-sync", status: "online", cpu: 1.2, mem: 142 * 1024 * 1024, uptime: uptimeStart(186), restarts: 0 },
        { name: "agent-router", status: "online", cpu: 0.4, mem: 96 * 1024 * 1024, uptime: uptimeStart(186), restarts: 1 },
        { name: "livekit", status: "online", cpu: 2.1, mem: 312 * 1024 * 1024, uptime: uptimeStart(72), restarts: 0 },
        { name: "render-worker", status: "errored", cpu: 0, mem: 0, uptime: uptimeStart(0.5), restarts: 4 },
        { name: "nginx", status: "online", cpu: 0.1, mem: 28 * 1024 * 1024, uptime: uptimeStart(720), restarts: 0 },
      ],
    },
    local: [
      { name: "Next dev server", port: 3031, hint: "the cockpit itself", reachable: true },
      { name: "Discord bridge", port: 7891, hint: "router local agent", reachable: true },
      { name: "Voice tray", port: 7892, hint: "push-to-talk daemon", reachable: false },
    ],
    env: [
      { path: "~/.war-room-demo/.env", exists: true, keys: ["DEMO_KEY", "SHARED_KEY"], size: 184 },
    ],
    checkedAt: new Date().toISOString(),
  };
}

export async function GET() {
  if (process.env.WAR_ROOM_DEMO === "1") {
    return NextResponse.json(demoHealthReport());
  }
  const report = await getHealthReport();
  return NextResponse.json(report);
}
