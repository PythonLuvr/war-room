// Apply incoming sync events to the local SQLite cache. Runs on the
// Next server side via an API route. The browser-side sync client
// posts received events here so the same DB layer used by every
// other API endpoint stays the canonical writer.
//
// Each event kind upserts or deletes a single row. Last-writer-wins
// at the row level: if the same row id arrives in two events, the
// one with the later ts overwrites. Server-assigned `seq` guarantees
// every client sees events in the same order, so applying them
// idempotently produces convergent state.
//
// v1 syncs decisions, announcements, knowledge entries. The three
// team-collaboration surfaces where multiple people on the same
// workspace genuinely benefit from shared state. Per-user chat
// history, Claude sessions, the activity feed, channel/server
// definitions, and settings are explicitly NOT synced (some are
// per-machine concepts, some have migration semantics that don't
// belong in a v1).

import { db } from "@/lib/db";
import type { SyncEvent } from "./protocol";

export function applyEvent(event: SyncEvent): number {
  switch (event.kind) {
    case "decision.created":
    case "decision.updated":
      return upsertDecision(event);
    case "decision.deleted":
      return deleteRow("decisions", event.data.id as number);

    case "announcement.created":
    case "announcement.updated":
      return upsertAnnouncement(event);
    case "announcement.deleted":
      return deleteRow("announcements", event.data.id as number);

    case "knowledge.created":
    case "knowledge.updated":
      return upsertKnowledge(event);
    case "knowledge.deleted":
      return deleteRow("knowledge_entries", event.data.id as number);

    case "server.upserted":
      return upsertServer(event);
    case "server.deleted":
      return deleteServer(event);
    case "group.upserted":
      return upsertGroup(event);
    case "group.deleted":
      return deleteGroup(event);
    case "channel.upserted":
      return upsertChannel(event);
    case "channel.deleted":
      return deleteChannel(event);
    case "sidebar_role.upserted":
      return upsertSidebarRole(event);
    case "sidebar_role.deleted":
      return deleteSidebarRoleByName(event);
    case "sidebar_assignment.set":
      return setSidebarAssignmentFromEvent(event);
    case "agent_profile.set":
      return upsertAgentProfile(event);
    case "agent_profile.deleted":
      return deleteAgentProfileRow(event);

    default:
      return 0;
  }
}

// ───────────────────────────────────────────────────────────────────
// v2 workspace-structure handlers. Each event carries a natural key
// (server name, group label, channel slug, role name, adapter id) so
// it doesn't matter that two clients picked different local INTEGER
// ids for the "same" row; they reconcile by the user-visible name.
// ───────────────────────────────────────────────────────────────────

function lookupServerIdByName(name: string): number | null {
  const row = db()
    .prepare(`SELECT id FROM user_servers WHERE name = ? LIMIT 1`)
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function upsertServer(e: SyncEvent): number {
  const row = e.data as {
    name: string;
    icon: string;
    color: string;
    icon_url: string | null;
    position: number;
    created_at: number;
  };
  const d = db();
  const existing = lookupServerIdByName(row.name);
  if (existing) {
    return d
      .prepare(
        `UPDATE user_servers SET icon = ?, color = ?, icon_url = ?, position = ? WHERE id = ?`,
      )
      .run(row.icon, row.color, row.icon_url, row.position, existing).changes;
  }
  return d
    .prepare(
      `INSERT INTO user_servers(name, icon, color, icon_url, is_default, is_personal, position, created_at)
       VALUES(?, ?, ?, ?, 0, 0, ?, ?)`,
    )
    .run(row.name, row.icon, row.color, row.icon_url, row.position, row.created_at).changes;
}

function deleteServer(e: SyncEvent): number {
  const row = e.data as { name: string };
  const id = lookupServerIdByName(row.name);
  if (!id) return 0;
  const d = db();
  const flags = d
    .prepare(`SELECT is_default, is_personal FROM user_servers WHERE id = ?`)
    .get(id) as { is_default: number; is_personal: number } | undefined;
  // Never let a sync event delete the local seeded servers; those are
  // load-bearing on every install.
  if (flags?.is_default === 1 || flags?.is_personal === 1) return 0;
  d.prepare(`DELETE FROM user_channels WHERE server_id = ?`).run(id);
  d.prepare(`DELETE FROM user_groups WHERE server_id = ?`).run(id);
  return d.prepare(`DELETE FROM user_servers WHERE id = ?`).run(id).changes;
}

function upsertGroup(e: SyncEvent): number {
  const row = e.data as {
    server_name: string;
    label: string;
    position: number;
    created_at: number;
  };
  const sid = lookupServerIdByName(row.server_name);
  if (!sid) return 0;
  return db()
    .prepare(
      `INSERT INTO user_groups(server_id, label, position, created_at) VALUES(?, ?, ?, ?)
       ON CONFLICT(server_id, label) DO UPDATE SET position = excluded.position`,
    )
    .run(sid, row.label, row.position, row.created_at).changes;
}

function deleteGroup(e: SyncEvent): number {
  const row = e.data as { server_name: string; label: string };
  const sid = lookupServerIdByName(row.server_name);
  if (!sid) return 0;
  return db()
    .prepare(`DELETE FROM user_groups WHERE server_id = ? AND label = ?`)
    .run(sid, row.label).changes;
}

function upsertChannel(e: SyncEvent): number {
  const row = e.data as {
    server_name: string;
    slug: string;
    name: string;
    group_label: string;
    kind: string;
    project_path: string | null;
    is_private: number;
    description: string | null;
    sidebar_hidden: number;
    created_at: number;
  };
  const sid = lookupServerIdByName(row.server_name);
  if (!sid) return 0;
  const d = db();
  const existing = d
    .prepare(`SELECT id FROM user_channels WHERE slug = ?`)
    .get(row.slug) as { id: number } | undefined;
  if (existing) {
    return d
      .prepare(
        `UPDATE user_channels SET server_id = ?, name = ?, group_label = ?, kind = ?, project_path = ?, is_private = ?, description = ?, sidebar_hidden = ? WHERE id = ?`,
      )
      .run(
        sid,
        row.name,
        row.group_label,
        row.kind,
        row.project_path,
        row.is_private,
        row.description,
        row.sidebar_hidden,
        existing.id,
      ).changes;
  }
  return d
    .prepare(
      `INSERT INTO user_channels(server_id, slug, name, group_label, kind, project_path, is_private, description, sidebar_hidden, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sid,
      row.slug,
      row.name,
      row.group_label,
      row.kind,
      row.project_path,
      row.is_private,
      row.description,
      row.sidebar_hidden,
      row.created_at,
    ).changes;
}

function deleteChannel(e: SyncEvent): number {
  const row = e.data as { slug: string };
  return db().prepare(`DELETE FROM user_channels WHERE slug = ?`).run(row.slug).changes;
}

function lookupRoleIdByName(name: string): number | null {
  const row = db()
    .prepare(`SELECT id FROM sidebar_roles WHERE name = ? LIMIT 1`)
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function upsertSidebarRole(e: SyncEvent): number {
  const row = e.data as {
    name: string;
    color: string | null;
    position: number;
    created_at: number;
  };
  const d = db();
  const existing = lookupRoleIdByName(row.name);
  if (existing) {
    return d
      .prepare(`UPDATE sidebar_roles SET color = ?, position = ? WHERE id = ?`)
      .run(row.color, row.position, existing).changes;
  }
  return d
    .prepare(
      `INSERT INTO sidebar_roles(name, color, position, created_at) VALUES(?, ?, ?, ?)`,
    )
    .run(row.name, row.color, row.position, row.created_at).changes;
}

function deleteSidebarRoleByName(e: SyncEvent): number {
  const row = e.data as { name: string };
  const id = lookupRoleIdByName(row.name);
  if (!id) return 0;
  const d = db();
  d.prepare(`DELETE FROM sidebar_role_assignments WHERE role_id = ?`).run(id);
  return d.prepare(`DELETE FROM sidebar_roles WHERE id = ?`).run(id).changes;
}

function setSidebarAssignmentFromEvent(e: SyncEvent): number {
  const row = e.data as {
    member_kind: string;
    member_id: string;
    role_name: string | null;
  };
  const d = db();
  if (row.role_name === null) {
    return d
      .prepare(
        `DELETE FROM sidebar_role_assignments WHERE member_kind = ? AND member_id = ?`,
      )
      .run(row.member_kind, row.member_id).changes;
  }
  const roleId = lookupRoleIdByName(row.role_name);
  if (!roleId) return 0;
  return d
    .prepare(
      `INSERT INTO sidebar_role_assignments(role_id, member_kind, member_id) VALUES(?, ?, ?)
       ON CONFLICT(member_kind, member_id) DO UPDATE SET role_id = excluded.role_id`,
    )
    .run(roleId, row.member_kind, row.member_id).changes;
}

function upsertAgentProfile(e: SyncEvent): number {
  const row = e.data as {
    adapter_id: string;
    display_name: string | null;
    icon_url: string | null;
    accent: string | null;
    updated_at: number;
  };
  return db()
    .prepare(
      `INSERT INTO agent_profiles(adapter_id, display_name, icon_url, accent, updated_at)
       VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(adapter_id) DO UPDATE SET
         display_name = excluded.display_name,
         icon_url = excluded.icon_url,
         accent = excluded.accent,
         updated_at = excluded.updated_at`,
    )
    .run(row.adapter_id, row.display_name, row.icon_url, row.accent, row.updated_at).changes;
}

function deleteAgentProfileRow(e: SyncEvent): number {
  const row = e.data as { adapter_id: string };
  return db().prepare(`DELETE FROM agent_profiles WHERE adapter_id = ?`).run(row.adapter_id).changes;
}

function deleteRow(table: string, id: number): number {
  const r = db().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return r.changes;
}

function upsertDecision(e: SyncEvent): number {
  const row = e.data as {
    id: number;
    channel_id: string;
    title: string;
    summary: string;
    links_json: string | null;
    author: string;
    status: string;
    created_at: number;
  };
  const r = db()
    .prepare(
      `INSERT INTO decisions(id, channel_id, title, summary, links_json, author, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         channel_id = excluded.channel_id,
         title = excluded.title,
         summary = excluded.summary,
         links_json = excluded.links_json,
         author = excluded.author,
         status = excluded.status`,
    )
    .run(
      row.id,
      row.channel_id,
      row.title,
      row.summary,
      row.links_json,
      row.author,
      row.status,
      row.created_at,
    );
  return r.changes;
}

function upsertAnnouncement(e: SyncEvent): number {
  const row = e.data as {
    id: number;
    channel_id: string;
    title: string;
    body: string;
    author: string;
    status: string;
    created_at: number;
  };
  const r = db()
    .prepare(
      `INSERT INTO announcements(id, channel_id, title, body, author, status, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         channel_id = excluded.channel_id,
         title = excluded.title,
         body = excluded.body,
         author = excluded.author,
         status = excluded.status`,
    )
    .run(row.id, row.channel_id, row.title, row.body, row.author, row.status, row.created_at);
  return r.changes;
}

function upsertKnowledge(e: SyncEvent): number {
  const row = e.data as {
    id: number;
    channel_id: string;
    title: string;
    body: string;
    tags_json: string | null;
    author: string;
    created_at: number;
    updated_at: number;
  };
  const r = db()
    .prepare(
      `INSERT INTO knowledge_entries(id, channel_id, title, body, tags_json, author, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         channel_id = excluded.channel_id,
         title = excluded.title,
         body = excluded.body,
         tags_json = excluded.tags_json,
         author = excluded.author,
         updated_at = excluded.updated_at`,
    )
    .run(
      row.id,
      row.channel_id,
      row.title,
      row.body,
      row.tags_json,
      row.author,
      row.created_at,
      row.updated_at,
    );
  return r.changes;
}
