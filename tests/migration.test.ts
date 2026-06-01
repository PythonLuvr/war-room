// DB migration test. Hand-builds a v0.1.0-shape SQLite database, runs the
// app's migration pipeline against it, and asserts the new schema lands +
// existing rows survive + re-running is idempotent.
//
// Run via: npm run test:migration
// (Uses tsx + Node's built-in test runner, no Vitest, no Jest.)

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { migrate } from "../lib/db";

function freshDb(): { db: Database.Database; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "war-room-mig-"));
  const file = path.join(dir, "app.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return {
    db,
    cleanup: () => {
      try {
        db.close();
      } catch {}
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────────
// "v0.1.0 shape", what the schema looked like before the multi-agent
// rework + two-server seed + per-channel agent override landed. Just enough
// of the old tables to exercise every migration path.
function seedV010Schema(db: Database.Database) {
  db.exec(`
    CREATE TABLE claude_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      claude_session_id TEXT,
      label TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      UNIQUE(project_path)
    );

    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      raw_json TEXT
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE user_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '✦',
      color TEXT NOT NULL DEFAULT 'amber',
      is_default INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE user_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      group_label TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat',
      project_path TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE user_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL,
      UNIQUE(label)
    );

    CREATE TABLE channel_overrides (
      channel_id TEXT PRIMARY KEY,
      is_private INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Pre-existing user state that must survive the migration.
    INSERT INTO user_servers(name, icon, color, is_default, position, created_at)
      VALUES('Personal', '✦', 'amber', 1, 0, ${Date.now()});

    INSERT INTO claude_sessions(project_path, claude_session_id, label, created_at, last_used_at)
      VALUES('/legacy/project', 'legacy-session-id', 'legacy', ${Date.now()}, ${Date.now()});

    INSERT INTO chat_messages(session_id, role, content, created_at, raw_json)
      VALUES(1, 'user', 'pre-migration message', ${Date.now()}, NULL);
  `);
}

// ─── Tests ─────────────────────────────────────────────────────────────────
test("migrate adds adapter_id + agent_id + new seeds without losing legacy rows", () => {
  const { db, cleanup } = freshDb();
  try {
    seedV010Schema(db);

    migrate(db);

    // claude_sessions gained adapter_id, with the legacy row defaulted.
    const sessionCols = db.prepare(`PRAGMA table_info(claude_sessions)`).all() as Array<{ name: string }>;
    assert.ok(
      sessionCols.some((c) => c.name === "adapter_id"),
      "adapter_id column missing on claude_sessions",
    );
    const legacySession = db
      .prepare(`SELECT * FROM claude_sessions WHERE project_path = ?`)
      .get("/legacy/project") as { adapter_id: string; claude_session_id: string };
    assert.equal(legacySession.adapter_id, "claude-cli", "legacy session should default to claude-cli");
    assert.equal(legacySession.claude_session_id, "legacy-session-id", "legacy session id should survive");

    // chat_messages gained agent_id.
    const msgCols = db.prepare(`PRAGMA table_info(chat_messages)`).all() as Array<{ name: string }>;
    assert.ok(
      msgCols.some((c) => c.name === "agent_id"),
      "agent_id column missing on chat_messages",
    );
    const legacyMsg = db
      .prepare(`SELECT content FROM chat_messages WHERE id = 1`)
      .get() as { content: string };
    assert.equal(legacyMsg.content, "pre-migration message", "legacy chat message should survive");

    // user_servers gained is_personal, and the seed promoted the legacy
    // Personal row + inserted The War Room as the new default.
    const serverCols = db.prepare(`PRAGMA table_info(user_servers)`).all() as Array<{ name: string }>;
    assert.ok(
      serverCols.some((c) => c.name === "is_personal"),
      "is_personal column missing on user_servers",
    );
    const personal = db
      .prepare(`SELECT * FROM user_servers WHERE is_personal = 1`)
      .get() as { name: string };
    assert.equal(personal.name, "Personal", "legacy Personal should be flagged is_personal");
    const warRoom = db
      .prepare(`SELECT * FROM user_servers WHERE is_default = 1`)
      .get() as { name: string };
    assert.equal(warRoom.name, "The War Room", "War Room should be the new default");

    // channel_overrides gained agent_backend + cross-agent context fields
    // + framework_preset (the per-channel OpenWar opt-in).
    const overrideCols = db.prepare(`PRAGMA table_info(channel_overrides)`).all() as Array<{ name: string }>;
    for (const required of [
      "agent_backend",
      "context_mode",
      "context_messages",
      "context_chars",
      "framework_preset",
    ]) {
      assert.ok(
        overrideCols.some((c) => c.name === required),
        `${required} column missing on channel_overrides`,
      );
    }

    // OpenWar is opt-in/default-off on cold-clone installs now. Legacy
    // installs that never set a framework should stay unset instead of
    // getting the old default-on seed reintroduced by migration.
    const fw = db.prepare(`SELECT value FROM settings WHERE key = ?`).get("default.framework") as
      | { value: string }
      | undefined;
    assert.equal(fw, undefined, "default.framework should stay unset until the user opts in");
  } finally {
    cleanup();
  }
});

test("migrate is idempotent, running twice doesn't double-seed or error", () => {
  const { db, cleanup } = freshDb();
  try {
    seedV010Schema(db);
    migrate(db);

    const beforeCount = (db.prepare(`SELECT COUNT(*) AS n FROM user_servers`).get() as { n: number }).n;

    migrate(db);

    const afterCount = (db.prepare(`SELECT COUNT(*) AS n FROM user_servers`).get() as { n: number }).n;
    assert.equal(afterCount, beforeCount, "second migrate should not insert duplicate canonical servers");

    // Schema should still reflect the same column set.
    const serverCols = db.prepare(`PRAGMA table_info(user_servers)`).all() as Array<{ name: string }>;
    assert.ok(serverCols.some((c) => c.name === "is_personal"));
  } finally {
    cleanup();
  }
});

test("fresh DB (no legacy tables) gets full schema from cold", () => {
  const { db, cleanup } = freshDb();
  try {
    migrate(db);

    // All canonical tables exist.
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;
    const names = new Set(tables.map((t) => t.name));
    for (const required of [
      "claude_sessions",
      "chat_messages",
      "user_servers",
      "user_channels",
      "user_groups",
      "channel_overrides",
      "activity",
      "decisions",
      "announcements",
      "knowledge_entries",
      "channel_files",
      "jobs",
    ]) {
      assert.ok(names.has(required), `cold-clone DB missing table ${required}`);
    }

    // Both canonicals seeded.
    const warRoom = db.prepare(`SELECT * FROM user_servers WHERE name = ?`).get("The War Room");
    assert.ok(warRoom, "cold-clone DB should have War Room seeded");
    const personal = db.prepare(`SELECT * FROM user_servers WHERE is_personal = 1`).get();
    assert.ok(personal, "cold-clone DB should have a personal workspace seeded");

    // Behavioral overlays are explicit opt-ins. A new database should not
    // silently enable OpenWar for users who already bring their own prompt.
    const fw = db.prepare(`SELECT value FROM settings WHERE key = ?`).get("default.framework");
    assert.equal(fw, undefined, "cold-clone DB should not auto-enable OpenWar");
  } finally {
    cleanup();
  }
});
