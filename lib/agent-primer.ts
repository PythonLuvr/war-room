// Loader for the War Room agent primer. Mirrors lib/frameworks.ts's
// path-resolution approach so the bundled primer file works the same
// in dev (process.cwd() = repo root) and in the packaged Electron
// build (standalone server runs from deeper inside the asar tree).
//
// The primer is one file at presets/agent-primer/war-room.md. It's
// not user-configurable like frameworks are; there's exactly one
// primer per release. If/when a user wants a custom primer, this
// loader is the place to grow (read user-overridable path first,
// then fall back to bundled).

import fs from "fs";
import path from "path";

function resolvePrimerDir(): string {
  const candidates: string[] = [];
  candidates.push(path.join(process.cwd(), "presets", "agent-primer"));
  let here = __dirname;
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(here, "presets", "agent-primer"));
    const parent = path.dirname(here);
    if (parent === here) break;
    here = parent;
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isDirectory()) return c;
    } catch {}
  }
  return candidates[0];
}

const PRIMER_DIR = resolvePrimerDir();
let _cached: string | null | undefined;

export function readAgentPrimer(): string | null {
  if (_cached !== undefined) return _cached;
  try {
    _cached = fs.readFileSync(path.join(PRIMER_DIR, "war-room.md"), "utf8");
  } catch {
    _cached = null;
  }
  return _cached;
}

export function refreshAgentPrimerCache(): void {
  _cached = undefined;
}
