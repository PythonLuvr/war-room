// Single env-reading layer for War Room.
//
// Every other file imports from here. Generic defaults ship in source; real
// values live in .env.local (gitignored) at the repo root or in
// ~/.war-room/.env (also gitignored). This file is the only place that
// touches `process.env.*` for app-level config.

import os from "os";
import path from "path";

export const HOME = os.homedir();

function parseJsonEnv<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── VPS / shared host for sync, updates, file storage ───────────────────────
// Unset = monitoring panels show "configure to enable" placeholders.
export const VPS = {
  host: process.env.WAR_ROOM_VPS_HOST ?? "",
  user: process.env.WAR_ROOM_VPS_USER ?? "root",
  keyPath: process.env.WAR_ROOM_VPS_KEY ?? path.join(HOME, ".ssh", "id_ed25519"),
};

export const VPS_SERVICES = parseCsvEnv(process.env.WAR_ROOM_VPS_SERVICES);

// ─── Local services to probe ─────────────────────────────────────────────────
// Override with WAR_ROOM_LOCAL_SERVICES (JSON array). Defaults empty so a
// fresh clone doesn't dangle references to services that aren't installed.
export const LOCAL_SERVICES: Array<{ name: string; port: number; hint?: string }> =
  parseJsonEnv(process.env.WAR_ROOM_LOCAL_SERVICES, []);

// ─── Filesystem roots ────────────────────────────────────────────────────────
export const CLIENTS_ROOT =
  process.env.WAR_ROOM_CLIENTS_ROOT ?? path.join(HOME, "clients");

export const CLAUDE_PROJECTS =
  process.env.WAR_ROOM_CLAUDE_PROJECTS ?? path.join(HOME, ".claude", "projects");

export const DATA_DIR =
  process.env.WAR_ROOM_DATA_DIR ?? path.join(HOME, ".war-room");

// Static workspace shortcuts that show up at the top of every personal server.
// Each entry: { path: string, name: string }. Defaults to empty array so the
// public build doesn't reference any specific machine layout.
export const STATIC_WORKSPACES: Array<{ path: string; name: string }> =
  parseJsonEnv(process.env.WAR_ROOM_WORKSPACES, []);

// ─── Extra .env files to merge at boot ───────────────────────────────────────
// User can point at additional .env files (e.g. shared team-wide secrets).
// Defaults to just the per-user ~/.war-room/.env if present.
export const EXTRA_ENV_FILES: string[] = (() => {
  const extra = process.env.WAR_ROOM_ENV_FILE;
  const base = path.join(HOME, ".war-room", ".env");
  return extra ? [extra, base] : [base];
})();

// ─── LiveKit (Boardroom voice/video) ─────────────────────────────────────────
// Unset = Boardroom panel renders in visual-only mode with a "configure
// LiveKit to enable voice" notice. The token-issuing API route returns
// configured:false until both API key + secret are set.
export const LIVEKIT = {
  url: process.env.LIVEKIT_URL ?? "",
  apiKey: process.env.LIVEKIT_API_KEY ?? "",
  apiSecret: process.env.LIVEKIT_API_SECRET ?? "",
};

export function isLiveKitConfigured(): boolean {
  return !!(LIVEKIT.url && LIVEKIT.apiKey && LIVEKIT.apiSecret);
}

// ─── Update server (electron-updater target) ─────────────────────────────────
// Used at build time by scripts/release.js and read at runtime by the
// electron-updater bundled into the .exe.
export const UPDATE_URL = process.env.WAR_ROOM_UPDATE_URL ?? "";
