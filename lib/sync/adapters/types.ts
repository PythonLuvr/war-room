// Tunnel adapter interface. Every hosting mode (Cloudflare Quick,
// Cloudflare Named, Tailscale, Manual VPS) implements this. The
// tunnel manager calls start() with the embedded sync server's local
// port and the adapter returns the URL teammates should connect to.
//
// Adapters are responsible for their own subprocess lifecycle. They
// expose status via the events callback; the manager subscribes and
// forwards to the renderer.

export type AdapterStatus =
  | { state: "idle" }
  | { state: "starting"; message?: string }
  | { state: "running"; url: string }
  | { state: "error"; message: string };

export type AdapterEvents = {
  onStatus: (s: AdapterStatus) => void;
  /** Fired only when the adapter detects a URL change after running. */
  onUrlChanged?: (newUrl: string) => void;
};

export type AdapterStartContext = {
  /** Local TCP port the embedded sync server is bound to. */
  localPort: number;
  /** Workspace identifier (informational; tunnel doesn't care). */
  workspace: string;
};

export interface TunnelAdapter {
  readonly mode: "cloudflare-quick" | "cloudflare-named" | "tailscale" | "manual";
  start(ctx: AdapterStartContext, events: AdapterEvents): Promise<void>;
  stop(): Promise<void>;
  status(): AdapterStatus;
}
