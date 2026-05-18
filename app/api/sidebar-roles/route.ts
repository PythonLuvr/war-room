import { NextRequest, NextResponse } from "next/server";
import {
  createSidebarRole,
  deleteSidebarRole,
  listSidebarAssignments,
  listSidebarRoles,
  setSidebarAssignment,
  updateSidebarRole,
} from "@/lib/db";
import {
  emitSidebarAssignment,
  emitSidebarRoleDelete,
  emitSidebarRoleUpsert,
} from "@/lib/sync/emitters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_COLORS = new Set([
  "amber",
  "sky",
  "emerald",
  "violet",
  "fuchsia",
  "rose",
  "neutral",
]);
const VALID_KINDS = new Set(["agent", "human"]);

export async function GET() {
  return NextResponse.json({
    roles: listSidebarRoles(),
    assignments: listSidebarAssignments(),
  });
}

// POST shape variants:
//   { action: "create", name, color? }
//   { action: "update", id, name?, color?, position? }
//   { action: "delete", id }
//   { action: "assign", memberKind, memberId, roleId | null }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: string;
    id?: number;
    name?: string;
    color?: string | null;
    position?: number;
    memberKind?: string;
    memberId?: string;
    roleId?: number | null;
  };

  if (body.action === "create") {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (body.color && !VALID_COLORS.has(body.color)) {
      return NextResponse.json({ error: "unknown color" }, { status: 400 });
    }
    const role = createSidebarRole({
      name: body.name.trim(),
      color: body.color ?? null,
    });
    emitSidebarRoleUpsert(role);
    return NextResponse.json({ role });
  }

  if (body.action === "update") {
    if (typeof body.id !== "number") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (body.color && !VALID_COLORS.has(body.color)) {
      return NextResponse.json({ error: "unknown color" }, { status: 400 });
    }
    updateSidebarRole(body.id, {
      name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
      color: body.color === undefined ? undefined : body.color,
      position: typeof body.position === "number" ? body.position : undefined,
    });
    const fresh = listSidebarRoles().find((r) => r.id === body.id);
    if (fresh) emitSidebarRoleUpsert(fresh);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    if (typeof body.id !== "number") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const target = listSidebarRoles().find((r) => r.id === body.id);
    deleteSidebarRole(body.id);
    if (target) emitSidebarRoleDelete(target.name);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign") {
    if (!body.memberKind || !VALID_KINDS.has(body.memberKind)) {
      return NextResponse.json({ error: "memberKind required" }, { status: 400 });
    }
    if (!body.memberId) {
      return NextResponse.json({ error: "memberId required" }, { status: 400 });
    }
    const kind = body.memberKind as "agent" | "human";
    const rid = body.roleId ?? null;
    setSidebarAssignment(kind, body.memberId, rid);
    emitSidebarAssignment(kind, body.memberId, rid);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
