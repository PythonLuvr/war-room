// REST surface for the hosting Settings panel + chrome indicator.
// Single endpoint, action-routed POST shape (matches the rest of
// War Room's API style).

import { NextRequest, NextResponse } from "next/server";
import {
  getHostingStatus,
  markUrlShared,
  rotateAndRestart,
  setManualUrl,
  setMode,
  setNamedTunnelConfig,
  setWorkspace,
  startHosting,
  stopHosting,
  type HostingStatus,
} from "@/lib/sync/tunnel-manager";
import type { HostingMode } from "@/lib/sync/host-state";
import { getHostState } from "@/lib/sync/host-state";
import { formatInvite } from "@/lib/sync/invite-format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MODES = new Set<HostingMode>([
  "cloudflare-quick",
  "cloudflare-named",
  "tailscale",
  "manual",
]);

type Body = {
  action?:
    | "start"
    | "stop"
    | "set-mode"
    | "set-manual-url"
    | "set-named-config"
    | "set-workspace"
    | "rotate-token"
    | "mark-shared";
  mode?: string;
  url?: string;
  tunnelToken?: string;
  publicUrl?: string;
  workspace?: string;
};

function payload(status: HostingStatus) {
  const state = getHostState();
  const url = status.url ?? state.lastSharedUrl ?? "";
  const invite =
    url && state.token
      ? formatInvite({ url, workspace: state.workspace, token: state.token })
      : null;
  return {
    ...status,
    token: state.token,
    namedTunnelToken: state.namedTunnelToken,
    invite,
  };
}

export async function GET() {
  return NextResponse.json(payload(getHostingStatus()));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  switch (body.action) {
    case "start":
      return NextResponse.json(payload(await startHosting()));
    case "stop":
      return NextResponse.json(payload(await stopHosting()));
    case "set-mode": {
      if (!body.mode || !VALID_MODES.has(body.mode as HostingMode)) {
        return NextResponse.json({ error: "unknown mode" }, { status: 400 });
      }
      return NextResponse.json(payload(await setMode(body.mode as HostingMode)));
    }
    case "set-manual-url": {
      if (!body.url) {
        return NextResponse.json({ error: "url required" }, { status: 400 });
      }
      return NextResponse.json(payload(await setManualUrl(body.url)));
    }
    case "set-named-config": {
      if (!body.tunnelToken || !body.publicUrl) {
        return NextResponse.json(
          { error: "tunnelToken and publicUrl required" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        payload(await setNamedTunnelConfig(body.tunnelToken, body.publicUrl)),
      );
    }
    case "set-workspace": {
      if (!body.workspace?.trim()) {
        return NextResponse.json({ error: "workspace required" }, { status: 400 });
      }
      return NextResponse.json(payload(await setWorkspace(body.workspace.trim())));
    }
    case "rotate-token":
      return NextResponse.json(payload(await rotateAndRestart()));
    case "mark-shared": {
      if (!body.url) {
        return NextResponse.json({ error: "url required" }, { status: 400 });
      }
      return NextResponse.json(payload(await markUrlShared(body.url)));
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
