import { NextRequest, NextResponse } from "next/server";
import {
  createUserServer,
  deleteUserServer,
  listUserServers,
  updateUserServer,
} from "@/lib/db";
import {
  emitServerDelete,
  emitServerUpsert,
} from "@/lib/sync/emitters";

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
  emitServerUpsert(s);
  return NextResponse.json({ server: s });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    id?: number;
    name?: string;
    icon?: string;
    color?: string;
    iconUrl?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const patch: { name?: string; icon?: string; color?: string; icon_url?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.icon === "string") patch.icon = body.icon.trim() || "?";
  if (typeof body.color === "string" && body.color.trim()) patch.color = body.color.trim();
  if (body.iconUrl !== undefined) patch.icon_url = body.iconUrl?.trim() || null;
  updateUserServer(body.id, patch);
  const updated = listUserServers().find((s) => s.id === body.id);
  if (updated) emitServerUpsert(updated);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (!body.id || body.id === 1) {
    return NextResponse.json({ error: "cannot delete default" }, { status: 400 });
  }
  const target = listUserServers().find((s) => s.id === body.id);
  deleteUserServer(body.id);
  if (target) emitServerDelete(target.name);
  return NextResponse.json({ ok: true });
}
