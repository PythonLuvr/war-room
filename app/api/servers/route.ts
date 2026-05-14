import { NextRequest, NextResponse } from "next/server";
import { createUserServer, deleteUserServer, listUserServers } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ servers: listUserServers() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string; icon?: string; color?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const s = createUserServer({
    name: body.name.trim(),
    icon: body.icon?.trim() || body.name.trim().slice(0, 2).toUpperCase(),
    color: body.color || "sky",
  });
  return NextResponse.json({ server: s });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (!body.id || body.id === 1) {
    return NextResponse.json({ error: "cannot delete default" }, { status: 400 });
  }
  deleteUserServer(body.id);
  return NextResponse.json({ ok: true });
}
