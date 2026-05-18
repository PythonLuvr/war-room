// Cloudflare Named Tunnel adapter. The user has already configured a
// tunnel in their Cloudflare dashboard (domain they own, hostname
// pointing at the tunnel) and has a tunnel token. The app spawns
// `cloudflared tunnel run --token <token>` and trusts whatever
// hostname Cloudflare has on file for that tunnel.
//
// We can't introspect the hostname from `cloudflared` directly, so
// the user supplies it via Settings ("Public URL"). The adapter just
// reports it back as the URL.

import { type ChildProcess, spawn } from "node:child_process";
import {
  ensureCloudflared,
  type FetchProgress,
} from "../cloudflared-fetcher";
import type {
  AdapterEvents,
  AdapterStartContext,
  AdapterStatus,
  TunnelAdapter,
} from "./types";

export type NamedAdapterOptions = {
  /** Cloudflare-dashboard tunnel token. Required. */
  tunnelToken: string;
  /** Public URL the user configured for this tunnel. Required. */
  publicUrl: string;
  cacheDir: string;
  onFetchProgress?: (p: FetchProgress) => void;
};

export class CloudflareNamedAdapter implements TunnelAdapter {
  readonly mode = "cloudflare-named" as const;
  private _status: AdapterStatus = { state: "idle" };
  private _proc: ChildProcess | null = null;

  constructor(private opts: NamedAdapterOptions) {}

  async start(_ctx: AdapterStartContext, events: AdapterEvents): Promise<void> {
    if (!this.opts.tunnelToken) {
      this._status = {
        state: "error",
        message: "Tunnel token is required. Generate one in your Cloudflare dashboard.",
      };
      events.onStatus(this._status);
      return;
    }
    if (!this.opts.publicUrl) {
      this._status = {
        state: "error",
        message: "Public URL is required (the hostname you configured for this tunnel).",
      };
      events.onStatus(this._status);
      return;
    }

    this._status = { state: "starting", message: "fetching cloudflared" };
    events.onStatus(this._status);

    let binaryPath: string;
    try {
      const r = await ensureCloudflared({
        cacheDir: this.opts.cacheDir,
        onProgress: this.opts.onFetchProgress,
      });
      binaryPath = r.binaryPath;
    } catch (e) {
      this._status = { state: "error", message: (e as Error).message };
      events.onStatus(this._status);
      return;
    }

    this._status = { state: "starting", message: "starting tunnel" };
    events.onStatus(this._status);

    const args = ["tunnel", "--no-autoupdate", "run", "--token", this.opts.tunnelToken];
    const proc = spawn(binaryPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    this._proc = proc;

    // Named tunnels are durable. Once the process is up and stdout
    // settles, we trust the public URL the user configured.
    let announced = false;
    const announceRunning = () => {
      if (announced) return;
      announced = true;
      this._status = { state: "running", url: this.opts.publicUrl };
      events.onStatus(this._status);
    };

    proc.stdout?.on("data", () => announceRunning());
    proc.stderr?.on("data", () => announceRunning());

    proc.on("exit", (code) => {
      if (this._status.state !== "idle") {
        this._status = {
          state: "error",
          message: `cloudflared exited with code ${code ?? "unknown"}`,
        };
        events.onStatus(this._status);
      }
      this._proc = null;
    });

    proc.on("error", (err) => {
      this._status = { state: "error", message: err.message };
      events.onStatus(this._status);
    });
  }

  async stop(): Promise<void> {
    this._status = { state: "idle" };
    if (this._proc) {
      try {
        this._proc.kill();
      } catch {
        // Process may already be dead.
      }
      this._proc = null;
    }
  }

  status(): AdapterStatus {
    return this._status;
  }
}
