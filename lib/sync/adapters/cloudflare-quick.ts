// Cloudflare Quick Tunnel adapter. Spawns the lazy-fetched
// cloudflared binary in quick-tunnel mode and parses the public
// trycloudflare.com URL out of its stdout.
//
// URL changes on every restart (that's the trade-off Quick Tunnel
// makes for not needing a Cloudflare account or domain). The tunnel
// manager pairs this with the URL-changed re-share banner so the
// host always knows to redistribute the invite after a restart.

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

// trycloudflare URLs appear on a line that looks like:
//   |  https://gentle-piano-prairie.trycloudflare.com           |
// cloudflared has changed its output format a couple of times; this
// regex matches any https://*.trycloudflare.com appearance.
const TRYCF_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export type QuickAdapterOptions = {
  /** Cache directory for the lazy-fetched cloudflared binary. */
  cacheDir: string;
  onFetchProgress?: (p: FetchProgress) => void;
};

export class CloudflareQuickAdapter implements TunnelAdapter {
  readonly mode = "cloudflare-quick" as const;
  private _status: AdapterStatus = { state: "idle" };
  private _proc: ChildProcess | null = null;
  private _lastUrl: string | null = null;

  constructor(private opts: QuickAdapterOptions) {}

  async start(ctx: AdapterStartContext, events: AdapterEvents): Promise<void> {
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
      this._status = {
        state: "error",
        message: (e as Error).message,
      };
      events.onStatus(this._status);
      return;
    }

    this._status = { state: "starting", message: "starting tunnel" };
    events.onStatus(this._status);

    const args = [
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://127.0.0.1:${ctx.localPort}`,
    ];
    const proc = spawn(binaryPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    this._proc = proc;

    const onChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const m = text.match(TRYCF_URL_RE);
      if (m) {
        const url = m[0];
        if (url !== this._lastUrl) {
          if (this._lastUrl !== null) {
            events.onUrlChanged?.(url);
          }
          this._lastUrl = url;
          this._status = { state: "running", url };
          events.onStatus(this._status);
        }
      }
    };
    proc.stdout?.on("data", onChunk);
    proc.stderr?.on("data", onChunk);

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
