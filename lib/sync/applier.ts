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

    default:
      return 0;
  }
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
