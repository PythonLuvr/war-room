import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("path");
  const target = requested && requested.trim() ? path.resolve(requested) : os.homedir();

  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = path.dirname(target);
    return NextResponse.json({
      path: target,
      parent: parent === target ? null : parent,
      home: os.homedir(),
      dirs,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), path: target },
      { status: 400 },
    );
  }
}
