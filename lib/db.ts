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

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS claude_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      claude_session_id TEXT,
      label TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      UNIQUE(project_path)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_user_channels_group ON user_channels(server_id, group_label);

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
  `);

  migrateAddServerId(d, "user_channels");
  migrateAddServerId(d, "user_groups");
  migrateAddColumn(d, "user_channels", "is_private", "INTEGER NOT NULL DEFAULT 0");
  migrateAddColumn(d, "user_channels", "description", "TEXT");
  migrateAddColumn(d, "user_channels", "sidebar_hidden", "INTEGER NOT NULL DEFAULT 0");
  migrateAddColumn(d, "channel_overrides", "project_path", "TEXT");
  migrateAddColumn(d, "channel_overrides", "description", "TEXT");
  migrateAddColumn(d, "decisions", "status", "TEXT NOT NULL DEFAULT 'open'");
  migrateAddColumn(d, "announcements", "status", "TEXT NOT NULL DEFAULT 'open'");

  const hasDefault = d
    .prepare(`SELECT COUNT(*) as n FROM user_servers WHERE is_default = 1`)
    .get() as { n: number };
  if (hasDefault.n === 0) {
    d.prepare(
      `INSERT INTO user_servers(id, name, icon, color, is_default, position, created_at) VALUES(1, ?, ?, ?, 1, 0, ?)`,
    ).run("Personal", "✦", "amber", Date.now());
  }
}

export type UserServerRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_default: number;
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

export function deleteUserServer(id: number) {
  if (id === 1) return;
  const d = db();
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
}> {
  return db()
    .prepare(`SELECT channel_id, is_private, project_path, description FROM channel_overrides`)
    .all() as Array<{
    channel_id: string;
    is_private: number;
    project_path: string | null;
    description: string | null;
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
  claude_session_id: string | null;
  label: string | null;
  created_at: number;
  last_used_at: number;
};

export function upsertSession(projectPath: string, label?: string): SessionRow {
  const now = Date.now();
  const d = db();
  d.prepare(
    `INSERT INTO claude_sessions(project_path, label, created_at, last_used_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_path) DO UPDATE SET last_used_at = excluded.last_used_at`,
  ).run(projectPath, label ?? null, now, now);
  return d
    .prepare(`SELECT * FROM claude_sessions WHERE project_path = ?`)
    .get(projectPath) as SessionRow;
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

export function getSession(projectPath: string): SessionRow | undefined {
  return db()
    .prepare(`SELECT * FROM claude_sessions WHERE project_path = ?`)
    .get(projectPath) as SessionRow | undefined;
}

export function addMessage(
  sessionId: number,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  rawJson?: string,
) {
  db()
    .prepare(
      `INSERT INTO chat_messages(session_id, role, content, created_at, raw_json) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(sessionId, role, content, Date.now(), rawJson ?? null);
}

export function getMessages(sessionId: number, limit = 200) {
  return db()
    .prepare(
      `SELECT id, role, content, created_at, raw_json FROM chat_messages
       WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`,
    )
    .all(sessionId, limit) as Array<{
    id: number;
    role: string;
    content: string;
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
