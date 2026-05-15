import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return NextResponse.json({
      version: pkg.version ?? "0.0.0",
      name: pkg.productName ?? pkg.name ?? "War Room",
      repo: pkg.build?.publish?.url ?? null,
      demo: process.env.WAR_ROOM_DEMO === "1",
    });
  } catch {
    return NextResponse.json({
      version: "unknown",
      name: "War Room",
      repo: null,
      demo: process.env.WAR_ROOM_DEMO === "1",
    });
  }
}
