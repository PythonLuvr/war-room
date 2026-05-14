import { db } from "./db";

let _initialized = false;

function ensure() {
  if (_initialized) return;
  db().exec(`
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
  _initialized = true;
}

export type ActivityKind =
  | "chat.user"
  | "chat.assistant"
  | "chat.tool"
  | "service.check"
  | "service.down"
  | "approval.new"
  | "system";

export function logActivity(
  kind: ActivityKind,
  title: string,
  opts: { detail?: string; projectPath?: string } = {},
) {
  ensure();
  db()
    .prepare(
      `INSERT INTO activity(kind, title, detail, project_path, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(kind, title, opts.detail ?? null, opts.projectPath ?? null, Date.now());
}

export type ActivityRow = {
  id: number;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  project_path: string | null;
  created_at: number;
};

export function recentActivity(limit = 30): ActivityRow[] {
  ensure();
  return db()
    .prepare(
      `SELECT id, kind, title, detail, project_path, created_at
       FROM activity ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as ActivityRow[];
}
