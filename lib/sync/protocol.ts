// War Room sync wire protocol (v1).
//
// Transport: WebSocket, JSON-encoded text frames, one message per frame.
//
// Model: append-only event log per workspace. Server is the source of
// truth for ordering (assigns monotonic `seq` numbers). Clients keep
// the highest seq they've applied locally and ask for everything
// after that when they reconnect, so a client can drop offline and
// catch up cleanly.
//
// Conflict resolution: last-writer-wins on whole records. The data
// model only syncs surfaces where conflicts are rare (decisions,
// announcements, knowledge entries, channel/server metadata). It does
// NOT sync per-user chat history, Claude sessions, the activity feed,
// or settings. Those are either per-user state or large append-only
// streams that don't need cross-machine reconciliation.
//
// Auth: optional shared token (passed via `?token=...` in the URL or
// `Authorization: Bearer ...` header). Reference server compares to
// `WAR_ROOM_SYNC_TOKEN` env. V1 has no per-user auth. Anyone who
// holds the token can read and write the workspace. Run your own
// server, don't expose the URL to people you don't trust.

export const PROTOCOL_VERSION = 1;

// ───────────────────────────────────────────────────────────────────
// Event kinds. Each kind names a (table, action) pair. The reference
// applier knows how to translate each one into a SQLite mutation.
// Adding a new kind requires both server and client to know about it,
// hence the explicit union. Drift is loud, not silent.
// ───────────────────────────────────────────────────────────────────

export type EventKind =
  | "decision.created"
  | "decision.updated"
  | "decision.deleted"
  | "announcement.created"
  | "announcement.updated"
  | "announcement.deleted"
  | "knowledge.created"
  | "knowledge.updated"
  | "knowledge.deleted";

// Wrapper applied to every event going across the wire. `seq` is
// server-assigned, monotonic per workspace. `clientId` lets a client
// skip events it originated (it already applied them locally).
export type SyncEvent = {
  seq: number;
  kind: EventKind;
  data: Record<string, unknown>;
  ts: number;
  clientId: string;
};

// ───────────────────────────────────────────────────────────────────
// Client → server frames.
// ───────────────────────────────────────────────────────────────────

export type ClientHello = {
  type: "hello";
  protocolVersion: number;
  clientId: string;
  workspaceId: string;
  lastSeen: number;
};

export type ClientEvent = {
  type: "event";
  kind: EventKind;
  data: Record<string, unknown>;
  ts: number;
  clientId: string;
};

export type ClientFrame = ClientHello | ClientEvent;

// ───────────────────────────────────────────────────────────────────
// Server → client frames.
// ───────────────────────────────────────────────────────────────────

export type ServerWelcome = {
  type: "welcome";
  protocolVersion: number;
  workspaceId: string;
  currentSeq: number;
};

export type ServerEvent = {
  type: "event";
  event: SyncEvent;
};

export type ServerError = {
  type: "error";
  message: string;
  fatal: boolean;
};

export type ServerFrame = ServerWelcome | ServerEvent | ServerError;
