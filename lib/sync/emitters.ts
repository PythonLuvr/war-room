// Convenience wrappers around emitEvent for workspace-structure
// mutations. API routes call these after a successful local write
// instead of constructing event payloads by hand, so the wire shape
// stays consistent and only this file has to change when a column
// migrates.
//
// Every helper is best-effort: if sync is disabled or the socket is
// down, emitEvent returns false and we silently drop. Local state is
// already saved; sync is additive.

import { db } from "@/lib/db";
import { emitEvent } from "./client";

type ServerLike = {
  id?: number;
  name: string;
  icon: string;
  color: string;
  icon_url?: string | null;
  position: number;
  created_at: number;
};

type GroupLike = {
  server_id: number;
  label: string;
  position: number;
  created_at: number;
};

type ChannelLike = {
  server_id: number;
  slug: string;
  name: string;
  group_label: string;
  kind: string;
  project_path: string | null;
  is_private: number;
  description?: string | null;
  sidebar_hidden?: number;
  created_at: number;
};

type RoleLike = {
  id?: number;
  name: string;
  color: string | null;
  position: number;
  created_at: number;
};

type AgentProfileLike = {
  adapter_id: string;
  display_name: string | null;
  icon_url: string | null;
  accent: string | null;
  updated_at: number;
};

function serverNameById(id: number): string | null {
  const row = db()
    .prepare(`SELECT name FROM user_servers WHERE id = ? LIMIT 1`)
    .get(id) as { name: string } | undefined;
  return row?.name ?? null;
}

function roleNameById(id: number): string | null {
  const row = db()
    .prepare(`SELECT name FROM sidebar_roles WHERE id = ? LIMIT 1`)
    .get(id) as { name: string } | undefined;
  return row?.name ?? null;
}

export function emitServerUpsert(s: ServerLike): void {
  emitEvent("server.upserted", {
    name: s.name,
    icon: s.icon,
    color: s.color,
    icon_url: s.icon_url ?? null,
    position: s.position,
    created_at: s.created_at,
  });
}

export function emitServerDelete(name: string): void {
  emitEvent("server.deleted", { name });
}

export function emitGroupUpsert(g: GroupLike): void {
  const serverName = serverNameById(g.server_id);
  if (!serverName) return;
  emitEvent("group.upserted", {
    server_name: serverName,
    label: g.label,
    position: g.position,
    created_at: g.created_at,
  });
}

export function emitGroupDelete(serverId: number, label: string): void {
  const serverName = serverNameById(serverId);
  if (!serverName) return;
  emitEvent("group.deleted", { server_name: serverName, label });
}

export function emitChannelUpsert(c: ChannelLike): void {
  const serverName = serverNameById(c.server_id);
  if (!serverName) return;
  emitEvent("channel.upserted", {
    server_name: serverName,
    slug: c.slug,
    name: c.name,
    group_label: c.group_label,
    kind: c.kind,
    project_path: c.project_path,
    is_private: c.is_private,
    description: c.description ?? null,
    sidebar_hidden: c.sidebar_hidden ?? 0,
    created_at: c.created_at,
  });
}

export function emitChannelDelete(slug: string): void {
  emitEvent("channel.deleted", { slug });
}

export function emitSidebarRoleUpsert(r: RoleLike): void {
  emitEvent("sidebar_role.upserted", {
    name: r.name,
    color: r.color,
    position: r.position,
    created_at: r.created_at,
  });
}

export function emitSidebarRoleDelete(name: string): void {
  emitEvent("sidebar_role.deleted", { name });
}

export function emitSidebarAssignment(
  memberKind: "agent" | "human",
  memberId: string,
  roleId: number | null,
): void {
  const roleName = roleId === null ? null : roleNameById(roleId);
  emitEvent("sidebar_assignment.set", {
    member_kind: memberKind,
    member_id: memberId,
    role_name: roleName,
  });
}

export function emitAgentProfileSet(p: AgentProfileLike): void {
  emitEvent("agent_profile.set", {
    adapter_id: p.adapter_id,
    display_name: p.display_name,
    icon_url: p.icon_url,
    accent: p.accent,
    updated_at: p.updated_at,
  });
}

export function emitAgentProfileDelete(adapterId: string): void {
  emitEvent("agent_profile.deleted", { adapter_id: adapterId });
}
