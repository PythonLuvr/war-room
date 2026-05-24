import { NextRequest, NextResponse } from "next/server";
import { spawnSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// IDEs tried in order. First one whose binary resolves wins.
// Platform-aware: on macOS each entry also checks the bundled CLI path.
const EDITORS: Array<{ name: string; bin: string; macBin?: string }> = [
  {
    name: "Antigravity",
    bin: "antigravity",
    macBin: "/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity",
  },
  {
    name: "Cursor",
    bin: "cursor",
    macBin: "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
  },
  {
    name: "VS Code",
    bin: "code",
    macBin: "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  },
  {
    name: "Windsurf",
    bin: "windsurf",
    macBin: "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
  },
  {
    name: "Zed",
    bin: "zed",
  },
];

function resolveBin(entry: { bin: string; macBin?: string }): string | null {
  // Check macOS bundled CLI path first (doesn't require PATH setup).
  if (entry.macBin && process.platform === "darwin" && fs.existsSync(entry.macBin)) {
    return entry.macBin;
  }
  // Fall back to PATH lookup.
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    const r = spawnSync(cmd, [entry.bin], { encoding: "utf8", timeout: 1500, shell: false });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split("\n")[0];
  } catch {
    // Not found.
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { path?: string };
  const target = body.path?.trim();
  if (!target) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(target.replace(/^~/, os.homedir()));

  for (const editor of EDITORS) {
    const bin = resolveBin(editor);
    if (!bin) continue;
    try {
      const child = spawn(bin, [resolved], {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
      child.unref();
      return NextResponse.json({ ok: true, editor: editor.name, bin });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "No supported editor found (tried: antigravity, cursor, code, windsurf, zed)" },
    { status: 404 },
  );
}

export async function GET() {
  const found = EDITORS.map((e) => {
    const bin = resolveBin(e);
    return { name: e.name, available: !!bin, bin };
  }).filter((e) => e.available);
  return NextResponse.json({ editors: found });
}
