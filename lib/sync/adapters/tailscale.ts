// Tailscale hosting mode. We do NOT bundle Tailscale. The user must
// have it installed and joined to a tailnet. The adapter shells out
// to `tailscale status --json` to find the host's tailnet IP and
// surfaces `ws://<ip>:<localPort>/` as the URL.
//
// If tailscale isn't on PATH the adapter reports an error state so
// the dropdown can grey the option out with a tooltip pointing at
// install instructions.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  AdapterEvents,
  AdapterStartContext,
  AdapterStatus,
  TunnelAdapter,
} from "./types";

const exec = promisify(execFile);

const TAILSCALE_FALLBACK_PATHS = [
  "C:\\Program Files\\Tailscale\\tailscale.exe",
  "/usr/local/bin/tailscale",
  "/usr/bin/tailscale",
  "/opt/homebrew/bin/tailscale",
];

async function resolveTailscaleBinary(): Promise<string | null> {
  const candidates = ["tailscale", ...TAILSCALE_FALLBACK_PATHS];
  for (const candidate of candidates) {
    try {
      await exec(candidate, ["version"], { timeout: 3000 });
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

async function getSelfIp(binary: string): Promise<string | null> {
  try {
    const { stdout } = await exec(binary, ["status", "--json"], { timeout: 5000 });
    const parsed = JSON.parse(stdout) as {
      Self?: { TailscaleIPs?: string[] };
    };
    const ips = parsed.Self?.TailscaleIPs ?? [];
    const ipv4 = ips.find((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip));
    return ipv4 ?? ips[0] ?? null;
  } catch {
    return null;
  }
}

export class TailscaleAdapter implements TunnelAdapter {
  readonly mode = "tailscale" as const;
  private _status: AdapterStatus = { state: "idle" };

  async start(ctx: AdapterStartContext, events: AdapterEvents): Promise<void> {
    this._status = { state: "starting", message: "detecting Tailscale" };
    events.onStatus(this._status);

    const binary = await resolveTailscaleBinary();
    if (!binary) {
      this._status = {
        state: "error",
        message: "Tailscale is not installed on this machine. Install from tailscale.com first.",
      };
      events.onStatus(this._status);
      return;
    }

    const ip = await getSelfIp(binary);
    if (!ip) {
      this._status = {
        state: "error",
        message: "Could not determine your Tailscale IP. Make sure you're signed in to a tailnet.",
      };
      events.onStatus(this._status);
      return;
    }

    const url = `ws://${ip}:${ctx.localPort}/`;
    this._status = { state: "running", url };
    events.onStatus(this._status);
  }

  async stop(): Promise<void> {
    this._status = { state: "idle" };
  }

  status(): AdapterStatus {
    return this._status;
  }
}

// Exposed for the dropdown UI so it can grey out the Tailscale option
// when the binary isn't found.
export async function isTailscaleInstalled(): Promise<boolean> {
  return (await resolveTailscaleBinary()) !== null;
}
