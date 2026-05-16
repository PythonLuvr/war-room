// Synchronous "is this CLI actually callable?" check used by every CLI
// adapter's isConfigured() so the UI's green-dot signal means "yes, this
// binary exists" instead of "yes, the setting is non-empty."
//
// Two strategies:
//   • Absolute / relative path → fs.existsSync
//   • Bare command name        → resolve via PATH using `where` (Windows)
//                                 or `which` (POSIX)
//
// Results are cached per binary string (key includes the literal value the
// caller passed). When the user pastes a new path under Settings → Agent
// the new string is a different cache key, so it gets re-probed on first
// look.

import { spawnSync } from "child_process";
import fs from "fs";

const cache = new Map<string, boolean>();
// 30s TTL so users don't have to restart the dev server after installing
// a missing CLI mid-session — the probe re-runs at most twice a minute
// while staying snappy for back-to-back UI fetches.
const TTL_MS = 30_000;
const stamps = new Map<string, number>();

export function isBinaryAvailable(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  const stamp = stamps.get(trimmed);
  if (stamp !== undefined && Date.now() - stamp < TTL_MS) {
    return cache.get(trimmed) ?? false;
  }

  const ok = probe(trimmed);
  cache.set(trimmed, ok);
  stamps.set(trimmed, Date.now());
  return ok;
}

function probe(name: string): boolean {
  // Absolute path or any path with a separator — check existence directly.
  if (/[\\/]/.test(name)) {
    try {
      return fs.existsSync(name);
    } catch {
      return false;
    }
  }
  // Bare command — ask the OS to resolve it via PATH. `where` returns 0
  // when at least one match is found, non-zero when nothing's on PATH.
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    const r = spawnSync(cmd, [name], {
      encoding: "utf8",
      timeout: 1500,
      shell: false,
    });
    return r.status === 0 && r.stdout.trim().length > 0;
  } catch {
    return false;
  }
}
