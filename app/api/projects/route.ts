import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { CLIENTS_ROOT, STATIC_WORKSPACES } from "@/lib/config";
import { listSessions } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATIC_ROOTS = STATIC_WORKSPACES.map((w) => ({
  path: w.path,
  label: w.name,
}));

async function safeReaddir(p: string) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function GET() {
  const projects: Array<{ path: string; label: string; group: string }> = [];

  for (const r of STATIC_ROOTS) {
    try {
      const stat = await fs.stat(r.path);
      if (stat.isDirectory()) projects.push({ ...r, group: "Workspaces" });
    } catch {}
  }

  const clientDirs = await safeReaddir(CLIENTS_ROOT);
  for (const d of clientDirs) {
    if (!d.isDirectory()) continue;
    if (d.name === "_adhoc") {
      const adhocDirs = await safeReaddir(path.join(CLIENTS_ROOT, "_adhoc"));
      for (const a of adhocDirs) {
        if (a.isDirectory()) {
          projects.push({
            path: path.join(CLIENTS_ROOT, "_adhoc", a.name),
            label: `_adhoc/${a.name}`,
            group: "Ad-hoc",
          });
        }
      }
    } else {
      projects.push({
        path: path.join(CLIENTS_ROOT, d.name),
        label: d.name,
        group: "Clients",
      });
    }
  }

  const sessions = listSessions();
  return NextResponse.json({ projects, sessions });
}
