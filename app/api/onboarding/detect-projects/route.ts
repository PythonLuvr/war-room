import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-level scan of a handful of common project-root locations on the
// user's home dir. For each direct subdirectory that "looks like a
// project" (has a recognizable marker file), return a row the wizard
// can render as a pre-checked add-as-channel option.
//
// Marker files come from: any version control, any common package
// manifest, or the most popular language project files. If a folder
// has none of these it doesn't show. Keeps Downloads, Pictures, etc.
// out of the list without needing a hardcoded ignore list.
//
// Cost is bounded: at most one readdir per location, at most one
// existsSync per marker per candidate folder. Realistic worst case
// is a few hundred stat calls, all on local disk.

const COMMON_ROOTS = [
  "code",
  "Code",
  "projects",
  "Projects",
  "clients",
  "Clients",
  "dev",
  "Dev",
  "src",
  "work",
  "Work",
  "repos",
  "github",
  "Documents/code",
  "Documents/projects",
  "Documents/GitHub",
  "Desktop",
];

const MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "Makefile",
  "CMakeLists.txt",
];

type Detected = {
  name: string;
  path: string;
  markers: string[];
};

function detectMarkers(dir: string): string[] {
  const found: string[] = [];
  for (const m of MARKERS) {
    try {
      if (fs.existsSync(path.join(dir, m))) found.push(m);
    } catch {}
  }
  return found;
}

function scanLocation(loc: string): Detected[] {
  const out: Detected[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(loc, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".")) continue;
    const full = path.join(loc, e.name);
    const markers = detectMarkers(full);
    if (markers.length === 0) continue;
    out.push({ name: e.name, path: full, markers });
  }
  return out;
}

export async function GET() {
  const home = os.homedir();
  const seen = new Set<string>();
  const detected: Detected[] = [];

  for (const rel of COMMON_ROOTS) {
    const loc = path.join(home, rel);
    if (!fs.existsSync(loc)) continue;
    for (const d of scanLocation(loc)) {
      if (seen.has(d.path)) continue;
      seen.add(d.path);
      detected.push(d);
    }
  }

  detected.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ detected, home, markers: MARKERS });
}
