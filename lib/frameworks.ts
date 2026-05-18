// Bundled agent-framework presets (OpenWar etc.) loader.
//
// Frameworks are markdown files in /presets/frameworks/. War Room reads
// them at adapter-call time and prepends the content as a system-prompt
// overlay to the user's prompt. Same injection point as cross-agent
// context, just a different layer (framework first, cross-agent context
// second, user prompt last).
//
// Files are read once and cached in-process, they're static assets,
// not user state.

import fs from "fs";
import path from "path";

// Resolve presets/frameworks at module-load time, robust to where Next
// thinks "cwd" is. In dev process.cwd() = repo root and "./presets/..."
// just works; in the packaged Electron build the standalone server boots
// from a deeper path inside the asar, so we walk a few candidate roots
// (cwd, the standalone server's __dirname plus its ancestors) and pick
// the first one that contains presets/frameworks/.
function resolveFrameworksDir(): string {
  const candidates: string[] = [];
  candidates.push(path.join(process.cwd(), "presets", "frameworks"));
  // Walk up from this module's directory, covers .next/standalone/lib,
  // resources/app/lib, etc. Eight levels is more than enough.
  let here = __dirname;
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(here, "presets", "frameworks"));
    const parent = path.dirname(here);
    if (parent === here) break;
    here = parent;
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isDirectory()) return c;
    } catch {}
  }
  // Fall back to the cwd path; readFramework will return null gracefully
  // for callers when the dir is missing (treated as "no frameworks
  // bundled, opt-out behavior").
  return candidates[0];
}

const FRAMEWORKS_DIR = resolveFrameworksDir();

const cache = new Map<string, string>();

export type FrameworkPreset = {
  id: string;
  /** Display name pulled from the first H1 in the file, falling back to id. */
  name: string;
  /** Short summary pulled from the first non-empty paragraph after the H1. */
  description: string;
};

let listCache: FrameworkPreset[] | null = null;

/** Drop the in-process registry cache so the next call re-scans the
 *  frameworks directory. Used by the dev watcher when a markdown file
 *  changes on disk, and by tests that manipulate the dir between runs. */
export function refreshFrameworkCache(): void {
  listCache = null;
  cache.clear();
}

export function listFrameworks(opts: { refresh?: boolean } = {}): FrameworkPreset[] {
  if (opts.refresh) refreshFrameworkCache();
  if (listCache) return listCache;
  const out: FrameworkPreset[] = [];
  try {
    const entries = fs.readdirSync(FRAMEWORKS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const id = e.name.slice(0, -3);
      const text = readFramework(id);
      if (!text) continue;
      const h1 = text.match(/^#\s+(.+?)\s*$/m);
      const name = h1?.[1]?.trim() ?? id;
      const afterH1 = h1 ? text.slice((h1.index ?? 0) + h1[0].length) : text;
      const para = afterH1.replace(/\r/g, "").split(/\n\n+/).find((p) => p.trim().length > 0);
      const description = (para ?? "").trim().split(/\s+/).slice(0, 30).join(" ").slice(0, 200);
      out.push({ id, name, description });
    }
  } catch {
    // No frameworks dir or unreadable, return empty list.
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  listCache = out;
  return out;
}

export function readFramework(id: string): string | null {
  if (!/^[a-z0-9_-]+$/i.test(id)) return null; // path-traversal guard
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  try {
    const text = fs.readFileSync(path.join(FRAMEWORKS_DIR, `${id}.md`), "utf8");
    cache.set(id, text);
    return text;
  } catch {
    return null;
  }
}
