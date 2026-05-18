// Persistent host-state for the embedded sync server. Stored in the
// existing settings KV (single source of truth for app config) so
// migrations, backups, and exports already cover it.
//
// The tunnel token is the only field that warrants encryption.
// Electron's safeStorage API gives us OS-keychain backing on
// macOS/Windows and libsecret on Linux; on platforms where it isn't
// available we fall back to plaintext and flag it via the
// `tokenEncrypted` field so a future hardening pass can tell which
// rows need re-wrapping.
//
// HostingMode strings are deliberately stable. Changing them breaks
// existing installs that auto-resume; bumping requires a migration.

import { getSetting, setSetting } from "@/lib/db";
import { randomBytes } from "node:crypto";

export type HostingMode =
  | "cloudflare-quick"
  | "cloudflare-named"
  | "tailscale"
  | "manual";

export type HostState = {
  enabled: boolean;
  mode: HostingMode;
  workspace: string;
  /** The shared secret teammates need to connect. Generated on first enable. */
  token: string;
  /** Cloudflare Named Tunnel token (mode-specific). */
  namedTunnelToken: string | null;
  /** Port the embedded server bound to last run, if known. */
  lastPort: number | null;
  /** URL the host last copied into an invite block. Used by the URL-changed banner. */
  lastSharedUrl: string | null;
  /** True if the host had hosting on when they last quit. Drives auto-resume. */
  wasRunning: boolean;
  /** Marks whether the token was wrapped via Electron safeStorage. */
  tokenEncrypted: boolean;
};

const KEY = "sync.host_state";
const DEFAULT_WORKSPACE = "default";

const DEFAULT_STATE: HostState = {
  enabled: false,
  mode: "cloudflare-quick",
  workspace: DEFAULT_WORKSPACE,
  token: "",
  namedTunnelToken: null,
  lastPort: null,
  lastSharedUrl: null,
  wasRunning: false,
  tokenEncrypted: false,
};

// Electron's safeStorage is only available inside the Electron main
// process. The Next server runs inside Electron when the app is
// packaged but is also imported by `next dev` (where Electron isn't
// loaded). Lazy-load and fall back gracefully.
type SafeStorage = {
  isEncryptionAvailable: () => boolean;
  encryptString: (s: string) => Buffer;
  decryptString: (b: Buffer) => string;
};

function getSafeStorage(): SafeStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require("electron") as { safeStorage?: SafeStorage };
    const ss = electron.safeStorage;
    if (ss && typeof ss.isEncryptionAvailable === "function" && ss.isEncryptionAvailable()) {
      return ss;
    }
  } catch {
    // Not running inside Electron (e.g. `next dev`, tests).
  }
  return null;
}

function wrap(plain: string): { value: string; encrypted: boolean } {
  const ss = getSafeStorage();
  if (!ss) return { value: plain, encrypted: false };
  try {
    return { value: ss.encryptString(plain).toString("base64"), encrypted: true };
  } catch {
    return { value: plain, encrypted: false };
  }
}

function unwrap(stored: string, wasEncrypted: boolean): string {
  if (!wasEncrypted) return stored;
  const ss = getSafeStorage();
  if (!ss) return stored;
  try {
    return ss.decryptString(Buffer.from(stored, "base64"));
  } catch {
    return "";
  }
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

type StoredShape = {
  enabled?: boolean;
  mode?: HostingMode;
  workspace?: string;
  token?: string;
  namedTunnelToken?: string | null;
  lastPort?: number | null;
  lastSharedUrl?: string | null;
  wasRunning?: boolean;
  tokenEncrypted?: boolean;
};

function read(): HostState {
  const raw = getSetting(KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as StoredShape;
    return {
      enabled: parsed.enabled ?? false,
      mode: parsed.mode ?? "cloudflare-quick",
      workspace: parsed.workspace ?? DEFAULT_WORKSPACE,
      token: parsed.token ? unwrap(parsed.token, !!parsed.tokenEncrypted) : "",
      namedTunnelToken: parsed.namedTunnelToken
        ? unwrap(parsed.namedTunnelToken, !!parsed.tokenEncrypted)
        : null,
      lastPort: parsed.lastPort ?? null,
      lastSharedUrl: parsed.lastSharedUrl ?? null,
      wasRunning: parsed.wasRunning ?? false,
      tokenEncrypted: !!parsed.tokenEncrypted,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function write(state: HostState): void {
  const tokenWrap = state.token ? wrap(state.token) : { value: "", encrypted: false };
  const namedWrap = state.namedTunnelToken
    ? wrap(state.namedTunnelToken)
    : { value: "", encrypted: false };
  const stored: StoredShape = {
    enabled: state.enabled,
    mode: state.mode,
    workspace: state.workspace,
    token: tokenWrap.value,
    namedTunnelToken: state.namedTunnelToken ? namedWrap.value : null,
    lastPort: state.lastPort,
    lastSharedUrl: state.lastSharedUrl,
    wasRunning: state.wasRunning,
    tokenEncrypted: tokenWrap.encrypted,
  };
  setSetting(KEY, JSON.stringify(stored));
}

export function getHostState(): HostState {
  return read();
}

export function patchHostState(patch: Partial<HostState>): HostState {
  const cur = read();
  const next: HostState = { ...cur, ...patch };
  write(next);
  return next;
}

/**
 * Ensure a token exists on the state. First-time hosting enable
 * generates a 32-byte hex token; subsequent calls return the existing
 * one. Rotating happens via `rotateToken`.
 */
export function ensureToken(): string {
  const cur = read();
  if (cur.token) return cur.token;
  const t = generateToken();
  write({ ...cur, token: t });
  return t;
}

export function rotateToken(): string {
  const t = generateToken();
  patchHostState({ token: t });
  return t;
}

export function clearHostState(): void {
  setSetting(KEY, JSON.stringify(DEFAULT_STATE));
}
