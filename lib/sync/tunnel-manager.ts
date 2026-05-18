// Tunnel manager. One module that owns the embedded sync server +
// the current tunnel adapter. API routes call into the manager to
// start, stop, swap modes, rotate tokens; the renderer polls
// /api/sync/hosting for status.
//
// Lifecycle: one manager per Next process (module-level singleton),
// same shape as lib/sync/client.ts.

import path from "node:path";
import {
  startEmbeddedSyncServerInRange,
  type EmbeddedServer,
} from "./embedded-server";
import { DATA_DIR } from "@/lib/config";
import {
  CloudflareNamedAdapter,
  type NamedAdapterOptions,
} from "./adapters/cloudflare-named";
import {
  CloudflareQuickAdapter,
  type QuickAdapterOptions,
} from "./adapters/cloudflare-quick";
import { ManualAdapter } from "./adapters/manual";
import { TailscaleAdapter } from "./adapters/tailscale";
import type {
  AdapterStatus,
  TunnelAdapter,
} from "./adapters/types";
import {
  ensureToken,
  getHostState,
  patchHostState,
  type HostingMode,
} from "./host-state";
import type { FetchProgress } from "./cloudflared-fetcher";

export type HostingStatus = {
  enabled: boolean;
  mode: HostingMode;
  workspace: string;
  url: string | null;
  port: number | null;
  adapter: AdapterStatus;
  lastSharedUrl: string | null;
  /** True when current adapter URL differs from lastSharedUrl AND lastSharedUrl is not null. */
  urlChanged: boolean;
  fetch: FetchProgress | null;
};

let _server: EmbeddedServer | null = null;
let _adapter: TunnelAdapter | null = null;
let _adapterStatus: AdapterStatus = { state: "idle" };
let _fetchProgress: FetchProgress | null = null;

function cloudflaredCacheDir(): string {
  return path.join(DATA_DIR, "cloudflared");
}

function syncDataDir(): string {
  return path.join(DATA_DIR, "sync-log");
}

function buildAdapter(
  mode: HostingMode,
  manualUrl: string,
  named: Pick<NamedAdapterOptions, "tunnelToken" | "publicUrl">,
): TunnelAdapter {
  const onFetchProgress = (p: FetchProgress) => {
    _fetchProgress = p;
  };
  switch (mode) {
    case "cloudflare-quick": {
      const opts: QuickAdapterOptions = {
        cacheDir: cloudflaredCacheDir(),
        onFetchProgress,
      };
      return new CloudflareQuickAdapter(opts);
    }
    case "cloudflare-named":
      return new CloudflareNamedAdapter({
        ...named,
        cacheDir: cloudflaredCacheDir(),
        onFetchProgress,
      });
    case "tailscale":
      return new TailscaleAdapter();
    case "manual":
      return new ManualAdapter(manualUrl);
  }
}

export async function startHosting(): Promise<HostingStatus> {
  if (_adapter) {
    return getHostingStatus();
  }
  const state = getHostState();
  const token = ensureToken();

  if (!_server) {
    _server = await startEmbeddedSyncServerInRange({
      token,
      dataDir: syncDataDir(),
    });
  }

  const adapter = buildAdapter(
    state.mode,
    state.lastSharedUrl ?? "",
    {
      tunnelToken: state.namedTunnelToken ?? "",
      publicUrl: state.lastSharedUrl ?? "",
    },
  );
  _adapter = adapter;
  _adapterStatus = { state: "starting" };

  await adapter.start(
    { localPort: _server.port, workspace: state.workspace },
    {
      onStatus: (s) => {
        _adapterStatus = s;
      },
      onUrlChanged: () => {
        // The URL-changed banner is driven by getHostingStatus()
        // comparing the adapter's current URL to lastSharedUrl. No
        // extra notification path needed here; the renderer polls.
      },
    },
  );

  patchHostState({ enabled: true, wasRunning: true, lastPort: _server.port });
  return getHostingStatus();
}

export async function stopHosting(): Promise<HostingStatus> {
  if (_adapter) {
    await _adapter.stop();
    _adapter = null;
    _adapterStatus = { state: "idle" };
  }
  if (_server) {
    await _server.stop();
    _server = null;
  }
  _fetchProgress = null;
  patchHostState({ enabled: false, wasRunning: false });
  return getHostingStatus();
}

export function getHostingStatus(): HostingStatus {
  const state = getHostState();
  const url =
    _adapterStatus.state === "running" ? _adapterStatus.url : null;
  const urlChanged =
    !!url && !!state.lastSharedUrl && url !== state.lastSharedUrl;
  return {
    enabled: state.enabled,
    mode: state.mode,
    workspace: state.workspace,
    url,
    port: _server?.port ?? null,
    adapter: _adapterStatus,
    lastSharedUrl: state.lastSharedUrl,
    urlChanged,
    fetch: _fetchProgress,
  };
}

export async function markUrlShared(url: string): Promise<HostingStatus> {
  patchHostState({ lastSharedUrl: url });
  return getHostingStatus();
}

export async function rotateAndRestart(): Promise<HostingStatus> {
  // Cold restart: stop, regenerate the token, start fresh. Teammates
  // will hit "connection rejected" until they re-paste the new
  // invite, which is the documented rotation flow.
  await stopHosting();
  const { rotateToken } = await import("./host-state");
  rotateToken();
  patchHostState({ lastSharedUrl: null });
  return startHosting();
}

export async function setMode(mode: HostingMode): Promise<HostingStatus> {
  const wasEnabled = !!_adapter;
  if (wasEnabled) {
    await stopHosting();
  }
  patchHostState({ mode, lastSharedUrl: null });
  if (wasEnabled) {
    return startHosting();
  }
  return getHostingStatus();
}

export async function setManualUrl(url: string): Promise<HostingStatus> {
  patchHostState({ mode: "manual", lastSharedUrl: url });
  return getHostingStatus();
}

export async function setNamedTunnelConfig(
  tunnelToken: string,
  publicUrl: string,
): Promise<HostingStatus> {
  patchHostState({
    mode: "cloudflare-named",
    namedTunnelToken: tunnelToken,
    lastSharedUrl: publicUrl,
  });
  return getHostingStatus();
}

export async function setWorkspace(workspace: string): Promise<HostingStatus> {
  const wasEnabled = !!_adapter;
  if (wasEnabled) {
    await stopHosting();
  }
  patchHostState({ workspace });
  if (wasEnabled) {
    return startHosting();
  }
  return getHostingStatus();
}

// Auto-resume hook. Called from db.ts boot path so a host whose app
// was hosting when they quit gets the tunnel back up on relaunch
// without any clicks.
export async function maybeAutoResumeHosting(): Promise<void> {
  const state = getHostState();
  if (!state.wasRunning || !state.enabled) return;
  try {
    await startHosting();
  } catch {
    // Surfaced via the status endpoint's adapter.state="error". The
    // host sees a banner in Settings on next launch.
  }
}
