import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tryClaude(bin: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["--version"], { shell: process.platform === "win32" });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => resolve({ ok: false, error: e.message }));
    child.on("close", (code) => {
      if (code === 0) resolve({ ok: true, version: out.trim() || "ok" });
      else resolve({ ok: false, error: err.trim() || `exit ${code}` });
    });
  });
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { claudeBin, workspaceRoot } = (await req.json()) as {
    claudeBin?: string;
    workspaceRoot?: string;
  };

  const result: {
    claude?: { ok: boolean; version?: string; error?: string };
    workspace?: { ok: boolean; error?: string };
  } = {};

  if (claudeBin) {
    result.claude = await tryClaude(claudeBin);
  }
  if (workspaceRoot) {
    const ok = await dirExists(workspaceRoot);
    result.workspace = ok ? { ok: true } : { ok: false, error: "directory not found" };
  }

  return NextResponse.json(result);
}
