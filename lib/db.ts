import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config";

const DB_DIR = DATA_DIR;
const DB_PATH = path.join(DB_DIR, "app.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrateAddServerId(d: Database.Database, table: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "server_id")) {
    d.exec(
      `ALTER TABLE ${table} ADD COLUMN server_id INTEGER NOT NULL DEFAULT 1`,
    );
  }
}

function migrateAddColumn(
  d: Database.Database,
  table: string,
  col: string,
  ddl: string,
) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}

// Rebuild claude_sessions when an old DB still has UNIQUE(project_path)
// instead of UNIQUE(project_path, adapter_id). SQLite can't drop a uniqueness
// constraint in place, so we copy rows into a fresh table, drop the old one,
// rename, and rebuild indexes. chat_messages.session_id keeps pointing at
// the same session ids since we preserve the PK column.
function migrateClaudeSessionsAdapterId(d: Database.Database) {
  const cols = d
    .prepare(`PRAGMA table_info(claude_sessions)`)
    .all() as Array<{ name: string }>;
  if (cols.length === 0) return; // first-run, table created with new schema
  if (cols.some((c) => c.name === "adapter_id")) return; // already migrated

  // SQLite requires foreign_keys=OFF during a rebuild of any table that's
  // referenced by an FK (chat_messages.session_id → claude_sessions.id).
  // Per the official "ALTER TABLE" recipe: flip the pragma off, do the
  // table swap inside a transaction, run foreign_key_check before commit,
  // then re-enable. The ids are preserved by SELECTing them through, so
  // existing chat_messages rows continue to resolve to the right session.
  const fkBefore = (d.pragma("foreign_keys", { simple: true }) as number) === 1;
  d.pragma("foreign_keys = OFF");
  try {
    d.exec(`
      BEGIN;

      CREATE TABLE claude_sessions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_path TEXT NOT NULL,
        adapter_id TEXT NOT NULL DEFAULT 'claude-cli',
        claude_session_id TEXT,
        label TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        UNIQUE(project_path, adapter_id)
      );

      INSERT INTO claude_sessions_new
        (id, project_path, adapter_id, claude_session_id, label, created_at, last_used_at)
      SELECT
        id, project_path, 'claude-cli', claude_session_id, label, created_at, last_used_at
      FROM claude_sessions;

      DROP TABLE claude_sessions;
      ALTER TABLE claude_sessions_new RENAME TO claude_sessions;

      COMMIT;
    `);
    const violations = d.prepare(`PRAGMA foreign_key_check`).all();
    if (violations.length > 0) {
      throw new Error(`foreign key violations after rebuild: ${JSON.stringify(violations)}`);
    }
  } finally {
    if (fkBefore) d.pragma("foreign_keys = ON");
  }
}

/** Runs every schema migration the app needs, plus the canonical seeds.
 *  Exported so tests can apply migrations to a fixture DB without booting
 *  the rest of the app. Safe to call repeatedly — every step is idempotent. */
export function migrate(d: Database.Database) {
  d.exec(`
    -- Sessions are scoped per (project, adapter) so each agent maintains
    -- its own conversation thread and CLI --resume token. Lets you bounce
    -- between Claude and GPT in the same channel without one clobbering
    -- the other's session id.
    CREATE TABLE IF NOT EXISTS claude_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      adapter_id TEXT NOT NULL DEFAULT 'claude-cli',
      claude_session_id TEXT,
      label TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      UNIQUE(project_path, adapter_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_id TEXT,
      created_at INTEGER NOT NULL,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_msg_session ON chat_messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '✦',
      color TEXT NOT NULL DEFAULT 'amber',
      is_default INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL DEFAULT 1,
      label TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL,
      UNIQUE(server_id, label)
    );

    CREATE TABLE IF NOT EXISTS user_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL DEFAULT 1,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      group_label TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat',
      project_path TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_overrides (
      channel_id TEXT PRIMARY KEY,
      is_private INTEGER NOT NULL DEFAULT 0,
      project_path TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_positions (
      server_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      position REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (server_id, label)
    );

    CREATE TABLE IF NOT EXISTS channel_positions (
      server_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      position REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (server_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      links_json TEXT,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_channel ON decisions(channel_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_channel ON announcements(channel_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS announcement_acks (
      announcement_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      ack_at INTEGER NOT NULL,
      PRIMARY KEY (announcement_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags_json TEXT,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_channel ON knowledge_entries(channel_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS channel_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      mime_type TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_files_channel ON channel_files(channel_id, uploaded_at DESC);

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      client_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      brief_url TEXT,
      due_date TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS job_assignees (
      job_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'contributor',
      assigned_at INTEGER NOT NULL,
      PRIMARY KEY (job_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS job_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'comment',
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobposts_job ON job_posts(job_id, created_at DESC);

    -- Activity table: lib/activity.ts also lazily creates this, but having
    -- it here means a fresh-clone /api/dashboard call doesn't 500 before
    -- anything has logged.
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      project_path TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
  `);

  migrateClaudeSessionsAdapterId(d);
  migrateAddColumn(d, "chat_messages", "agent_id", "TEXT");
  migrateAddServerId(d, "user_channels");
  migrateAddServerId(d, "user_groups");
  // Index lives here (not in the CREATE TABLE block) because legacy DBs
  // get server_id added by the migration above; running it earlier would
  // hit "no such column".
  d.exec(
    `CREATE INDEX IF NOT EXISTS idx_user_channels_group ON user_channels(server_id, group_label);`,
  );
  migrateAddColumn(d, "user_channels", "is_private", "INTEGER NOT NULL DEFAULT 0");
  migrateAddColumn(d, "user_channels", "description", "TEXT");
  migrateAddColumn(d, "user_channels", "sidebar_hidden", "INTEGER NOT NULL DEFAULT 0");
  migrateAddColumn(d, "channel_overrides", "project_path", "TEXT");
  migrateAddColumn(d, "channel_overrides", "description", "TEXT");
  // Per-channel AI backend pin. NULL means "use whatever the global default
  // is right now" — surfaces in the channel header agent chip.
  migrateAddColumn(d, "channel_overrides", "agent_backend", "TEXT");
  // Per-channel context mode for multi-agent threads:
  //   "isolated" (default, NULL): each agent sees only its own past turns
  //   "shared":   server prepends recent cross-agent history, attributed,
  //               to every adapter call so models can reason about what
  //               other agents in the channel said. Both budgets nullable
  //               with sensible defaults applied at read time (15 msgs,
  //               3000 chars).
  migrateAddColumn(d, "channel_overrides", "context_mode", "TEXT");
  migrateAddColumn(d, "channel_overrides", "context_messages", "INTEGER");
  migrateAddColumn(d, "channel_overrides", "context_chars", "INTEGER");
  // Framework preset id (e.g. "openwar") that War Room prepends as a
  // system-prompt overlay to every adapter call in this channel. NULL =
  // inherit the global `default.framework` setting; "none" = explicit
  // opt-out (overrides the global default for this channel only).
  migrateAddColumn(d, "channel_overrides", "framework_preset", "TEXT");
  migrateAddColumn(d, "decisions", "status", "TEXT NOT NULL DEFAULT 'open'");
  migrateAddColumn(d, "announcements", "status", "TEXT NOT NULL DEFAULT 'open'");
  // is_personal marks the user's local "Personal" workspace — the server
  // that auto-discovers workspaces + project folders and carries the
  // System category. Distinct from is_default, which now points at the
  // shared "The War Room" dashboard server.
  migrateAddColumn(d, "user_servers", "is_personal", "INTEGER NOT NULL DEFAULT 0");

  seedDefaultServers(d);
  seedDefaultFramework(d);
}

const SHARED_SERVER_NAME = "The War Room";

function seedDefaultFramework(d: Database.Database) {
  // Cold-clone DBs get OpenWar set as the global default agent framework.
  // Existing installs keep whatever they had (this only inserts when the
  // setting row doesn't exist). User can opt out via the wizard or the
  // per-channel chip without leaving the app.
  const existing = d
    .prepare(`SELECT 1 FROM settings WHERE key = 'default.framework'`)
    .get();
  if (!existing) {
    d.prepare(`INSERT INTO settings(key, value) VALUES('default.framework', 'openwar')`).run();
  }
}

function seedDefaultServers(d: Database.Database) {
  const now = Date.now();

  // 1. Make sure the canonical shared War Room dashboard server exists.
  //    It carries no auto-discovered project channels — the dashboard widgets
  //    aggregate state from across all servers.
  const warRoom = d
    .prepare(`SELECT id FROM user_servers WHERE name = ?`)
    .get(SHARED_SERVER_NAME) as { id: number } | undefined;
  if (!warRoom) {
    d.prepare(
      `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
       VALUES(?, ?, ?, 1, 0, ?, ?)`,
    ).run(SHARED_SERVER_NAME, "⚔", "violet", -100, now);
    // Whatever else used to be the default loses that flag — landing
    // routes through War Room from now on.
    d.prepare(`UPDATE user_servers SET is_default = 0 WHERE name != ?`).run(SHARED_SERVER_NAME);
  } else {
    // Idempotent: enforce the canonical icon/color and default flag in case
    // a prior migration set them differently.
    d.prepare(
      `UPDATE user_servers SET icon = ?, color = ?, is_default = 1, is_personal = 0 WHERE id = ?`,
    ).run("⚔", "violet", warRoom.id);
    d.prepare(`UPDATE user_servers SET is_default = 0 WHERE id != ?`).run(warRoom.id);
  }

  // 2. Make sure a personal workspace server exists. For pre-existing
  //    installs we promote the legacy "Personal" row (id=1) instead of
  //    creating a duplicate so its channels and history stay attached.
  const existingPersonal = d
    .prepare(`SELECT id FROM user_servers WHERE is_personal = 1 LIMIT 1`)
    .get() as { id: number } | undefined;
  if (!existingPersonal) {
    const legacy = d
      .prepare(
        `SELECT id FROM user_servers WHERE name != ? ORDER BY position ASC, created_at ASC LIMIT 1`,
      )
      .get(SHARED_SERVER_NAME) as { id: number } | undefined;
    if (legacy) {
      d.prepare(`UPDATE user_servers SET is_personal = 1 WHERE id = ?`).run(legacy.id);
    } else {
      d.prepare(
        `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
         VALUES(?, ?, ?, 0, 1, ?, ?)`,
      ).run("Personal", "✦", "amber", 0, now);
    }
  }
}

export type UserServerRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_default: number;
  is_personal: number;
  position: number;
  created_at: number;
};

export function listUserServers(): UserServerRow[] {
  return db()
    .prepare(`SELECT * FROM user_servers ORDER BY position ASC, created_at ASC`)
    .all() as UserServerRow[];
}

export function createUserServer(input: { name: string; icon?: string; color?: string }): UserServerRow {
  const now = Date.now();
  const r = db()
    .prepare(
      `INSERT INTO user_servers(name, icon, color, is_default, position, created_at) VALUES(?, ?, ?, 0, ?, ?)`,
    )
    .run(input.name, input.icon ?? "#", input.color ?? "sky", 100, now);
  return db()
    .prepare(`SELECT * FROM user_servers WHERE id = ?`)
    .get(Number(r.lastInsertRowid)) as UserServerRow;
}

export function updateUserServer(
  id: number,
  patch: { name?: string; icon?: string; color?: string },
) {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.icon !== undefined) {
    fields.push("icon = ?");
    values.push(patch.icon);
  }
  if (patch.color !== undefined) {
    fields.push("color = ?");
    values.push(patch.color);
  }
  if (fields.length === 0) return;
  values.push(id);
  db()
    .prepare(`UPDATE user_servers SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

/** Find the user's personal workspace server (is_personal=1). */
export function getPersonalServer(): UserServerRow | undefined {
  return db()
    .prepare(`SELECT * FROM user_servers WHERE is_personal = 1 LIMIT 1`)
    .get() as UserServerRow | undefined;
}

export function deleteUserServer(id: number) {
  const d = db();
  // The two seeded canonicals (shared War Room + Personal workspace) are
  // load-bearing — landing routes, system surfaces, and project discovery
  // all assume they exist. Custom servers users create are fine to remove.
  const row = d
    .prepare(`SELECT is_default, is_personal FROM user_servers WHERE id = ?`)
    .get(id) as { is_default: number; is_personal: number } | undefined;
  if (!row) return;
  if (row.is_default === 1 || row.is_personal === 1) return;
  d.prepare(`DELETE FROM user_channels WHERE server_id = ?`).run(id);
  d.prepare(`DELETE FROM user_groups WHERE server_id = ?`).run(id);
  d.prepare(`DELETE FROM user_servers WHERE id = ?`).run(id);
}

export type UserGroupRow = {
  id: number;
  label: string;
  position: number;
  created_at: number;
};

export type UserChannelRow = {
  id: number;
  server_id: number;
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

export function listUserGroups(serverId = 1): UserGroupRow[] {
  return db()
    .prepare(`SELECT * FROM user_groups WHERE server_id = ? ORDER BY position, label`)
    .all(serverId) as UserGroupRow[];
}

export function listUserChannels(
  serverId = 1,
  opts: { includeHidden?: boolean } = {},
): UserChannelRow[] {
  const where = opts.includeHidden
    ? "WHERE server_id = ?"
    : "WHERE server_id = ? AND (sidebar_hidden = 0 OR sidebar_hidden IS NULL)";
  return db().prepare(`SELECT * FROM user_channels ${where} ORDER BY name`).all(serverId) as UserChannelRow[];
}

// All channels across all servers — for the universal route resolver, includes hidden
export function listAllUserChannels(): UserChannelRow[] {
  return db()
    .prepare(`SELECT * FROM user_channels ORDER BY server_id, name`)
    .all() as UserChannelRow[];
}

export function createUserGroup(label: string, serverId = 1): UserGroupRow {
  const now = Date.now();
  db()
    .prepare(`INSERT INTO user_groups(server_id, label, position, created_at) VALUES(?, ?, ?, ?)`)
    .run(serverId, label, 50, now);
  return db()
    .prepare(`SELECT * FROM user_groups WHERE server_id = ? AND label = ?`)
    .get(serverId, label) as UserGroupRow;
}

export function deleteUserGroup(label: string, serverId = 1) {
  db().prepare(`DELETE FROM user_groups WHERE server_id = ? AND label = ?`).run(serverId, label);
}

export function createUserChannel(input: {
  slug: string;
  name: string;
  groupLabel: string;
  kind?: string;
  projectPath?: string;
  serverId?: number;
  isPrivate?: boolean;
}): UserChannelRow {
  const now = Date.now();
  const sid = input.serverId ?? 1;
  db()
    .prepare(
      `INSERT INTO user_channels(server_id, slug, name, group_label, kind, project_path, is_private, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sid,
      input.slug,
      input.name,
      input.groupLabel,
      input.kind ?? "chat",
      input.projectPath ?? null,
      input.isPrivate ? 1 : 0,
      now,
    );
  return db().prepare(`SELECT * FROM user_channels WHERE slug = ?`).get(input.slug) as UserChannelRow;
}

export function setChannelPrivate(slug: string, isPrivate: boolean) {
  db()
    .prepare(`UPDATE user_channels SET is_private = ? WHERE slug = ?`)
    .run(isPrivate ? 1 : 0, slug);
}

export function setChannelOverridePrivate(channelId: string, isPrivate: boolean) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, is_private, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET is_private = excluded.is_private, updated_at = excluded.updated_at`,
    )
    .run(channelId, isPrivate ? 1 : 0, now, now);
}

export function setChannelOverridePath(channelId: string, projectPath: string | null) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, project_path, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET project_path = excluded.project_path, updated_at = excluded.updated_at`,
    )
    .run(channelId, projectPath, now, now);
}

export function setChannelOverrideDescription(channelId: string, description: string | null) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, description, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET description = excluded.description, updated_at = excluded.updated_at`,
    )
    .run(channelId, description, now, now);
}

export function setChannelOverrideAgent(channelId: string, agentBackend: string | null) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, agent_backend, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET agent_backend = excluded.agent_backend, updated_at = excluded.updated_at`,
    )
    .run(channelId, agentBackend, now, now);
}

export function getChannelOverrideAgent(channelId: string): string | null {
  const row = db()
    .prepare(`SELECT agent_backend FROM channel_overrides WHERE channel_id = ?`)
    .get(channelId) as { agent_backend: string | null } | undefined;
  return row?.agent_backend ?? null;
}

// ─── Cross-agent context settings ──────────────────────────────────────────

export type ChannelContextMode = "isolated" | "shared";
export type ChannelContextSettings = {
  mode: ChannelContextMode;
  /** Hard cap on number of cross-agent messages to inject. */
  messages: number;
  /** Hard cap on total character count of the injected preamble. */
  chars: number;
};

/** Defaults applied at read time when the channel hasn't been customized. */
export const DEFAULT_CONTEXT_SETTINGS: ChannelContextSettings = {
  mode: "isolated",
  messages: 15,
  chars: 3000,
};

export function getChannelContextSettings(channelId: string): ChannelContextSettings {
  const row = db()
    .prepare(
      `SELECT context_mode, context_messages, context_chars FROM channel_overrides WHERE channel_id = ?`,
    )
    .get(channelId) as
    | {
        context_mode: string | null;
        context_messages: number | null;
        context_chars: number | null;
      }
    | undefined;
  return {
    mode: row?.context_mode === "shared" ? "shared" : "isolated",
    messages: row?.context_messages ?? DEFAULT_CONTEXT_SETTINGS.messages,
    chars: row?.context_chars ?? DEFAULT_CONTEXT_SETTINGS.chars,
  };
}

export function setChannelContextSettings(
  channelId: string,
  patch: Partial<ChannelContextSettings>,
) {
  const now = Date.now();
  const cur = getChannelContextSettings(channelId);
  const next: ChannelContextSettings = {
    mode: patch.mode ?? cur.mode,
    messages: clamp(patch.messages ?? cur.messages, 1, 200),
    chars: clamp(patch.chars ?? cur.chars, 100, 50_000),
  };
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, context_mode, context_messages, context_chars, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         context_mode = excluded.context_mode,
         context_messages = excluded.context_messages,
         context_chars = excluded.context_chars,
         updated_at = excluded.updated_at`,
    )
    .run(channelId, next.mode, next.messages, next.chars, now, now);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// ─── Framework preset settings ────────────────────────────────────────────
//
// "Framework" = a system-prompt preamble War Room prepends to every adapter
// call. OpenWar is the bundled default; users can opt-out per-channel or
// globally. Resolution order (per send):
//   1. channel_overrides.framework_preset (NULL = inherit global)
//   2. settings["default.framework"] (NULL = no framework)
//   3. "none" anywhere short-circuits to no framework
//
// Stored as the preset's id ("openwar"); the actual markdown content lives
// in /presets/frameworks/<id>.md and is loaded at adapter-call time.

export type ChannelFrameworkSetting = string | null;

export function getChannelFrameworkPreset(channelId: string): ChannelFrameworkSetting {
  const row = db()
    .prepare(`SELECT framework_preset FROM channel_overrides WHERE channel_id = ?`)
    .get(channelId) as { framework_preset: string | null } | undefined;
  return row?.framework_preset ?? null;
}

export function setChannelFrameworkPreset(channelId: string, preset: string | null) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, framework_preset, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET
         framework_preset = excluded.framework_preset,
         updated_at = excluded.updated_at`,
    )
    .run(channelId, preset, now, now);
}

/** Resolve the effective framework id for a given channel:
 *  channel pin (when not null) > global default > null. */
export function resolveFrameworkId(channelId: string | undefined): string | null {
  if (channelId) {
    const pin = getChannelFrameworkPreset(channelId);
    if (pin === "none") return null; // explicit opt-out
    if (pin) return pin;
  }
  const fallback = getSetting("default.framework");
  if (!fallback || fallback === "none") return null;
  return fallback;
}

/** Pulls cross-agent history for a project — every message NOT generated by
 *  `excludeAdapterId` — newest-last, capped by both budgets. Used by the
 *  agents wrapper to inject "what other agents said" before each call when
 *  a channel is in shared-context mode. */
export function getCrossAgentContext(
  projectPath: string,
  excludeAdapterId: string,
  budget: { messages: number; chars: number },
): Array<{ role: string; agentId: string | null; adapterId: string; content: string; created_at: number }> {
  // Fetch up to 2x the message budget, then trim by char budget. Going
  // wider than `messages` lets us drop verbose ones in favor of more turns
  // when the char budget is tight.
  const rows = db()
    .prepare(
      `SELECT m.role, m.agent_id, m.content, m.created_at, s.adapter_id
       FROM chat_messages m
       JOIN claude_sessions s ON s.id = m.session_id
       WHERE s.project_path = ? AND s.adapter_id != ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
    )
    .all(projectPath, excludeAdapterId, budget.messages * 2) as Array<{
    role: string;
    agent_id: string | null;
    content: string;
    created_at: number;
    adapter_id: string;
  }>;

  // Walk newest-first, accept while within both budgets, then reverse so
  // the caller gets chronological order suitable for a preamble.
  const accepted: typeof rows = [];
  let chars = 0;
  for (const r of rows) {
    if (accepted.length >= budget.messages) break;
    const cost = r.content.length;
    if (chars + cost > budget.chars && accepted.length > 0) break;
    accepted.push(r);
    chars += cost;
  }
  accepted.reverse();
  return accepted.map((r) => ({
    role: r.role,
    agentId: r.agent_id,
    adapterId: r.adapter_id,
    content: r.content,
    created_at: r.created_at,
  }));
}

export function updateUserChannel(
  slug: string,
  patch: { name?: string; projectPath?: string | null; description?: string | null },
) {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (typeof patch.name === "string") {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.projectPath !== undefined) {
    fields.push("project_path = ?");
    values.push(patch.projectPath);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    values.push(patch.description);
  }
  if (!fields.length) return;
  values.push(slug);
  db()
    .prepare(`UPDATE user_channels SET ${fields.join(", ")} WHERE slug = ?`)
    .run(...values);
}

export function listChannelOverrides(): Array<{
  channel_id: string;
  is_private: number;
  project_path: string | null;
  description: string | null;
  agent_backend: string | null;
  context_mode: string | null;
  context_messages: number | null;
  context_chars: number | null;
  framework_preset: string | null;
}> {
  return db()
    .prepare(
      `SELECT channel_id, is_private, project_path, description, agent_backend,
              context_mode, context_messages, context_chars, framework_preset
       FROM channel_overrides`,
    )
    .all() as Array<{
    channel_id: string;
    is_private: number;
    project_path: string | null;
    description: string | null;
    agent_backend: string | null;
    context_mode: string | null;
    context_messages: number | null;
    context_chars: number | null;
    framework_preset: string | null;
  }>;
}

export function listGroupPositions(serverId: number): Array<{ label: string; position: number }> {
  return db()
    .prepare(`SELECT label, position FROM group_positions WHERE server_id = ?`)
    .all(serverId) as Array<{ label: string; position: number }>;
}

export function listChannelPositions(serverId: number): Array<{ channel_id: string; position: number }> {
  return db()
    .prepare(`SELECT channel_id, position FROM channel_positions WHERE server_id = ?`)
    .all(serverId) as Array<{ channel_id: string; position: number }>;
}

export function setGroupPositions(serverId: number, items: Array<{ label: string; position: number }>) {
  const now = Date.now();
  const stmt = db().prepare(
    `INSERT INTO group_positions(server_id, label, position, updated_at)
     VALUES(?, ?, ?, ?)
     ON CONFLICT(server_id, label) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
  );
  const tx = db().transaction((rows: Array<{ label: string; position: number }>) => {
    for (const r of rows) stmt.run(serverId, r.label, r.position, now);
  });
  tx(items);
}

// Decisions
export type DecisionRow = {
  id: number;
  channel_id: string;
  title: string;
  summary: string;
  links_json: string | null;
  author: string;
  status: string;
  created_at: number;
};

export function listDecisions(channelId: string, limit = 100): DecisionRow[] {
  return db()
    .prepare(
      `SELECT * FROM decisions WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(channelId, limit) as DecisionRow[];
}

export function createDecision(input: {
  channelId: string;
  title: string;
  summary: string;
  links?: string[];
  author: string;
}): DecisionRow {
  const now = Date.now();
  const res = db()
    .prepare(
      `INSERT INTO decisions(channel_id, title, summary, links_json, author, created_at) VALUES(?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.channelId,
      input.title,
      input.summary,
      input.links && input.links.length ? JSON.stringify(input.links) : null,
      input.author,
      now,
    );
  return db()
    .prepare(`SELECT * FROM decisions WHERE id = ?`)
    .get(Number(res.lastInsertRowid)) as DecisionRow;
}

// Announcements
export type AnnouncementRow = {
  id: number;
  channel_id: string;
  title: string;
  body: string;
  author: string;
  status: string;
  created_at: number;
  ack_count: number;
  acked_by_me: number;
};

export function listAnnouncements(
  channelId: string,
  meId: string,
  limit = 50,
): AnnouncementRow[] {
  return db()
    .prepare(
      `SELECT a.*,
        (SELECT COUNT(*) FROM announcement_acks WHERE announcement_id = a.id) AS ack_count,
        (SELECT COUNT(*) FROM announcement_acks WHERE announcement_id = a.id AND user_id = ?) AS acked_by_me
       FROM announcements a
       WHERE a.channel_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(meId, channelId, limit) as AnnouncementRow[];
}

export function createAnnouncement(input: {
  channelId: string;
  title: string;
  body: string;
  author: string;
}): AnnouncementRow {
  const now = Date.now();
  const res = db()
    .prepare(
      `INSERT INTO announcements(channel_id, title, body, author, created_at) VALUES(?, ?, ?, ?, ?)`,
    )
    .run(input.channelId, input.title, input.body, input.author, now);
  return db()
    .prepare(`SELECT *, 0 as ack_count, 0 as acked_by_me FROM announcements WHERE id = ?`)
    .get(Number(res.lastInsertRowid)) as AnnouncementRow;
}

export function ackAnnouncement(announcementId: number, userId: string): boolean {
  const now = Date.now();
  try {
    db()
      .prepare(
        `INSERT INTO announcement_acks(announcement_id, user_id, ack_at) VALUES(?, ?, ?)`,
      )
      .run(announcementId, userId, now);
    return true;
  } catch {
    return false; // already acked
  }
}

export function unackAnnouncement(announcementId: number, userId: string) {
  db()
    .prepare(`DELETE FROM announcement_acks WHERE announcement_id = ? AND user_id = ?`)
    .run(announcementId, userId);
}

export function setDecisionStatus(id: number, status: "open" | "archived" | "reversed") {
  db().prepare(`UPDATE decisions SET status = ? WHERE id = ?`).run(status, id);
}

export function deleteDecision(id: number) {
  db().prepare(`DELETE FROM decisions WHERE id = ?`).run(id);
}

export function setAnnouncementStatus(id: number, status: "open" | "archived") {
  db().prepare(`UPDATE announcements SET status = ? WHERE id = ?`).run(status, id);
}

export function deleteAnnouncement(id: number) {
  const d = db();
  d.prepare(`DELETE FROM announcement_acks WHERE announcement_id = ?`).run(id);
  d.prepare(`DELETE FROM announcements WHERE id = ?`).run(id);
}

// Knowledge entries
export type KnowledgeEntryRow = {
  id: number;
  channel_id: string;
  title: string;
  body: string;
  tags_json: string | null;
  author: string;
  created_at: number;
  updated_at: number;
};

export function listKnowledge(channelId: string, withBody = false): KnowledgeEntryRow[] {
  const cols = withBody
    ? "*"
    : "id, channel_id, title, '' as body, tags_json, author, created_at, updated_at";
  return db()
    .prepare(
      `SELECT ${cols} FROM knowledge_entries WHERE channel_id = ? ORDER BY updated_at DESC`,
    )
    .all(channelId) as KnowledgeEntryRow[];
}

export function getKnowledge(id: number): KnowledgeEntryRow | undefined {
  return db()
    .prepare(`SELECT * FROM knowledge_entries WHERE id = ?`)
    .get(id) as KnowledgeEntryRow | undefined;
}

export function createKnowledge(input: {
  channelId: string;
  title: string;
  body: string;
  tags?: string[];
  author: string;
}): KnowledgeEntryRow {
  const now = Date.now();
  const res = db()
    .prepare(
      `INSERT INTO knowledge_entries(channel_id, title, body, tags_json, author, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.channelId,
      input.title,
      input.body,
      input.tags && input.tags.length ? JSON.stringify(input.tags) : null,
      input.author,
      now,
      now,
    );
  return db()
    .prepare(`SELECT * FROM knowledge_entries WHERE id = ?`)
    .get(Number(res.lastInsertRowid)) as KnowledgeEntryRow;
}

export function updateKnowledge(
  id: number,
  patch: { title?: string; body?: string; tags?: string[] | null },
) {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (typeof patch.title === "string") {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (typeof patch.body === "string") {
    fields.push("body = ?");
    values.push(patch.body);
  }
  if (patch.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(patch.tags && patch.tags.length ? JSON.stringify(patch.tags) : null);
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);
  db()
    .prepare(`UPDATE knowledge_entries SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function deleteKnowledge(id: number) {
  db().prepare(`DELETE FROM knowledge_entries WHERE id = ?`).run(id);
}

// Channel files
export type ChannelFileRow = {
  id: number;
  channel_id: string;
  filename: string;
  original_name: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: number;
};

export function listChannelFiles(channelId: string): ChannelFileRow[] {
  return db()
    .prepare(
      `SELECT * FROM channel_files WHERE channel_id = ? ORDER BY uploaded_at DESC`,
    )
    .all(channelId) as ChannelFileRow[];
}

export function getChannelFile(id: number): ChannelFileRow | undefined {
  return db()
    .prepare(`SELECT * FROM channel_files WHERE id = ?`)
    .get(id) as ChannelFileRow | undefined;
}

export function createChannelFile(input: {
  channelId: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
  mimeType?: string | null;
  uploadedBy: string;
}): ChannelFileRow {
  const now = Date.now();
  const res = db()
    .prepare(
      `INSERT INTO channel_files(channel_id, filename, original_name, size_bytes, mime_type, uploaded_by, uploaded_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.channelId,
      input.filename,
      input.originalName,
      input.sizeBytes,
      input.mimeType ?? null,
      input.uploadedBy,
      now,
    );
  return db()
    .prepare(`SELECT * FROM channel_files WHERE id = ?`)
    .get(Number(res.lastInsertRowid)) as ChannelFileRow;
}

export function deleteChannelFileRow(id: number) {
  db().prepare(`DELETE FROM channel_files WHERE id = ?`).run(id);
}

// Jobs
export type JobRow = {
  id: number;
  slug: string;
  title: string;
  client_name: string | null;
  status: string;
  description: string | null;
  brief_url: string | null;
  due_date: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
};

export type JobAssigneeRow = {
  job_id: number;
  user_id: string;
  role: string;
  assigned_at: number;
};

export type JobPostRow = {
  id: number;
  job_id: number;
  author: string;
  kind: string;
  body: string;
  created_at: number;
};

export function listJobs(opts: { status?: string } = {}): JobRow[] {
  if (opts.status) {
    return db()
      .prepare(`SELECT * FROM jobs WHERE status = ? ORDER BY updated_at DESC`)
      .all(opts.status) as JobRow[];
  }
  return db().prepare(`SELECT * FROM jobs ORDER BY updated_at DESC`).all() as JobRow[];
}

export function getJob(id: number): JobRow | undefined {
  return db().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRow | undefined;
}

export function getJobBySlug(slug: string): JobRow | undefined {
  return db().prepare(`SELECT * FROM jobs WHERE slug = ?`).get(slug) as JobRow | undefined;
}

export function createJob(input: {
  slug: string;
  title: string;
  clientName?: string;
  status?: "active" | "recurring" | "finished";
  description?: string;
  briefUrl?: string;
  dueDate?: string;
  createdBy: string;
  assignees: string[];
}): JobRow {
  const now = Date.now();
  const d = db();
  const tx = d.transaction(() => {
    const r = d
      .prepare(
        `INSERT INTO jobs(slug, title, client_name, status, description, brief_url, due_date, created_by, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.slug,
        input.title,
        input.clientName ?? null,
        input.status ?? "active",
        input.description ?? null,
        input.briefUrl ?? null,
        input.dueDate ?? null,
        input.createdBy,
        now,
        now,
      );
    const jobId = Number(r.lastInsertRowid);
    const assignStmt = d.prepare(
      `INSERT INTO job_assignees(job_id, user_id, role, assigned_at) VALUES(?, ?, ?, ?)`,
    );
    for (const u of input.assignees) {
      assignStmt.run(jobId, u, "contributor", now);
    }
    return jobId;
  });
  const id = tx();
  return getJob(id)!;
}

export function listJobAssignees(jobId: number): JobAssigneeRow[] {
  return db()
    .prepare(`SELECT * FROM job_assignees WHERE job_id = ? ORDER BY assigned_at`)
    .all(jobId) as JobAssigneeRow[];
}

export function setJobStatus(jobId: number, status: "active" | "recurring" | "finished") {
  db()
    .prepare(`UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?`)
    .run(status, Date.now(), jobId);
}

export function listJobPosts(jobId: number, limit = 200): JobPostRow[] {
  return db()
    .prepare(`SELECT * FROM job_posts WHERE job_id = ? ORDER BY created_at ASC LIMIT ?`)
    .all(jobId, limit) as JobPostRow[];
}

export function createJobPost(input: {
  jobId: number;
  author: string;
  kind?: "comment" | "status-update" | "blocker" | "completion" | "file-share";
  body: string;
}): JobPostRow {
  const now = Date.now();
  const r = db()
    .prepare(
      `INSERT INTO job_posts(job_id, author, kind, body, created_at) VALUES(?, ?, ?, ?, ?)`,
    )
    .run(input.jobId, input.author, input.kind ?? "comment", input.body, now);
  db().prepare(`UPDATE jobs SET updated_at = ? WHERE id = ?`).run(now, input.jobId);
  return db()
    .prepare(`SELECT * FROM job_posts WHERE id = ?`)
    .get(Number(r.lastInsertRowid)) as JobPostRow;
}

export function deleteJob(id: number) {
  const d = db();
  d.prepare(`DELETE FROM job_posts WHERE job_id = ?`).run(id);
  d.prepare(`DELETE FROM job_assignees WHERE job_id = ?`).run(id);
  d.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
}

export function setChannelPositions(serverId: number, items: Array<{ channelId: string; position: number }>) {
  const now = Date.now();
  const stmt = db().prepare(
    `INSERT INTO channel_positions(server_id, channel_id, position, updated_at)
     VALUES(?, ?, ?, ?)
     ON CONFLICT(server_id, channel_id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
  );
  const tx = db().transaction((rows: Array<{ channelId: string; position: number }>) => {
    for (const r of rows) stmt.run(serverId, r.channelId, r.position, now);
  });
  tx(items);
}

export function deleteUserChannel(slug: string) {
  db().prepare(`DELETE FROM user_channels WHERE slug = ?`).run(slug);
}

export type SessionRow = {
  id: number;
  project_path: string;
  adapter_id: string;
  claude_session_id: string | null;
  label: string | null;
  created_at: number;
  last_used_at: number;
};

export function upsertSession(
  projectPath: string,
  adapterId: string,
  label?: string,
): SessionRow {
  const now = Date.now();
  const d = db();
  d.prepare(
    `INSERT INTO claude_sessions(project_path, adapter_id, label, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_path, adapter_id) DO UPDATE SET last_used_at = excluded.last_used_at`,
  ).run(projectPath, adapterId, label ?? null, now, now);
  return d
    .prepare(`SELECT * FROM claude_sessions WHERE project_path = ? AND adapter_id = ?`)
    .get(projectPath, adapterId) as SessionRow;
}

export function setClaudeSessionId(rowId: number, claudeSessionId: string) {
  db()
    .prepare(`UPDATE claude_sessions SET claude_session_id = ?, last_used_at = ? WHERE id = ?`)
    .run(claudeSessionId, Date.now(), rowId);
}

export function listSessions(): SessionRow[] {
  return db()
    .prepare(`SELECT * FROM claude_sessions ORDER BY last_used_at DESC`)
    .all() as SessionRow[];
}

/** Looks up the session row for a specific (project, adapter) pair. */
export function getSession(projectPath: string, adapterId: string): SessionRow | undefined {
  return db()
    .prepare(`SELECT * FROM claude_sessions WHERE project_path = ? AND adapter_id = ?`)
    .get(projectPath, adapterId) as SessionRow | undefined;
}

/** All sessions in a project, one row per adapter that's ever spoken there. */
export function getSessionsForProject(projectPath: string): SessionRow[] {
  return db()
    .prepare(`SELECT * FROM claude_sessions WHERE project_path = ? ORDER BY last_used_at DESC`)
    .all(projectPath) as SessionRow[];
}

export function addMessage(
  sessionId: number,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  opts: { agentId?: string | null; rawJson?: string } = {},
) {
  db()
    .prepare(
      `INSERT INTO chat_messages(session_id, role, content, agent_id, created_at, raw_json) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(sessionId, role, content, opts.agentId ?? null, Date.now(), opts.rawJson ?? null);
}

export function getMessages(sessionId: number, limit = 200) {
  return db()
    .prepare(
      `SELECT id, role, content, agent_id, created_at, raw_json FROM chat_messages
       WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`,
    )
    .all(sessionId, limit) as Array<{
    id: number;
    role: string;
    content: string;
    agent_id: string | null;
    created_at: number;
    raw_json: string | null;
  }>;
}

/** Channel-wide canonical timeline: every message across every adapter
 *  session for a project, in time order. Used by the chat history endpoint
 *  so the UI can render a single thread of record with per-bubble agent
 *  attribution. */
export function getProjectMessages(projectPath: string, limit = 500) {
  return db()
    .prepare(
      `SELECT m.id, m.role, m.content, m.agent_id, m.created_at, m.raw_json, s.adapter_id
       FROM chat_messages m
       JOIN claude_sessions s ON s.id = m.session_id
       WHERE s.project_path = ?
       ORDER BY m.created_at ASC
       LIMIT ?`,
    )
    .all(projectPath, limit) as Array<{
    id: number;
    role: string;
    content: string;
    agent_id: string | null;
    adapter_id: string;
    created_at: number;
    raw_json: string | null;
  }>;
}

export function getSetting(key: string): string | null {
  const row = db().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      `INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    )
    .run(key, value);
}
