// Map a filesystem path to a workspace label + a stable Tailwind color.
// Used to visually attribute cross-workspace activity (the "where did this
// come from" stripe on activity rows, file lists, etc.).

const CLIENT_PALETTE = [
  { stripe: "bg-rose-500", text: "text-rose-300", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  { stripe: "bg-orange-500", text: "text-orange-300", chip: "bg-orange-500/15 text-orange-300 border-orange-500/40" },
  { stripe: "bg-cyan-500", text: "text-cyan-300", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  { stripe: "bg-fuchsia-500", text: "text-fuchsia-300", chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40" },
  { stripe: "bg-lime-500", text: "text-lime-300", chip: "bg-lime-500/15 text-lime-300 border-lime-500/40" },
  { stripe: "bg-teal-500", text: "text-teal-300", chip: "bg-teal-500/15 text-teal-300 border-teal-500/40" },
  { stripe: "bg-indigo-500", text: "text-indigo-300", chip: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40" },
  { stripe: "bg-pink-500", text: "text-pink-300", chip: "bg-pink-500/15 text-pink-300 border-pink-500/40" },
];

export type WorkspaceColor = {
  label: string;
  /** Tailwind class for a left-edge solid stripe / dot fill */
  stripe: string;
  /** Tailwind class for the chip background, border, and text together */
  chip: string;
  /** Tailwind class for the text-only accent */
  text: string;
};

// Known workspace shortcuts pulled from STATIC_WORKSPACES env. Anything not
// listed there gets either a per-client palette color (under /clients/) or
// falls back to the generic "Workspace" color.
import { STATIC_WORKSPACES } from "./config";

const SYSTEM: WorkspaceColor = {
  label: "System",
  stripe: "bg-neutral-600",
  chip: "bg-neutral-800 text-neutral-400 border-neutral-700",
  text: "text-neutral-400",
};

const APP: WorkspaceColor = {
  label: "Dashboard",
  stripe: "bg-sky-500",
  chip: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  text: "text-sky-300",
};

const GENERIC_WORKSPACE: WorkspaceColor = {
  label: "Workspace",
  stripe: "bg-amber-500",
  chip: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  text: "text-amber-300",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve a filesystem path or label to a workspace color. */
export function colorForPath(projectPath: string | null | undefined): WorkspaceColor {
  if (!projectPath) return SYSTEM;
  const p = projectPath.replace(/\\/g, "/");

  // Match the running dashboard install (current directory).
  if (/(^|\/)war-room(\/|$)/.test(p)) return APP;

  // Match any configured static workspace by its trailing segment.
  for (const ws of STATIC_WORKSPACES) {
    const seg = ws.path.replace(/\\/g, "/").replace(/\/$/, "").split("/").pop();
    if (seg && new RegExp(`(^|\\/)${escapeRegex(seg)}(\\/|$)`).test(p)) {
      return { ...GENERIC_WORKSPACE, label: ws.name };
    }
  }

  // Client folders: /clients/<slug> or /clients/_adhoc/<slug>
  const client = p.match(/\/clients\/(?:_adhoc\/)?([^/]+)/);
  if (client) {
    const slug = client[1];
    const palette = CLIENT_PALETTE[hashString(slug) % CLIENT_PALETTE.length];
    return { label: slug, ...palette };
  }

  return SYSTEM;
}

import { TEAM } from "./team";

const TEAM_COLOR_CLASS: Record<string, Omit<WorkspaceColor, "label">> = {
  amber: { stripe: "bg-amber-500", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40", text: "text-amber-300" },
  sky: { stripe: "bg-sky-500", chip: "bg-sky-500/15 text-sky-300 border-sky-500/40", text: "text-sky-300" },
  emerald: { stripe: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", text: "text-emerald-300" },
  violet: { stripe: "bg-violet-500", chip: "bg-violet-500/15 text-violet-300 border-violet-500/40", text: "text-violet-300" },
  fuchsia: { stripe: "bg-fuchsia-500", chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40", text: "text-fuchsia-300" },
  rose: { stripe: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40", text: "text-rose-300" },
};

const AUTHOR_FALLBACK: WorkspaceColor = {
  label: "Unknown",
  stripe: "bg-neutral-600",
  chip: "bg-neutral-800 text-neutral-400 border-neutral-700",
  text: "text-neutral-400",
};

/** Resolve a team-member identity to a stable color (derived from TEAM). */
export function colorForAuthor(author: string | null | undefined): WorkspaceColor {
  if (!author) return AUTHOR_FALLBACK;
  const member = TEAM.find((m) => m.id === author.toLowerCase());
  if (!member) return { ...AUTHOR_FALLBACK, label: author };
  const classes = TEAM_COLOR_CLASS[member.color] ?? TEAM_COLOR_CLASS.amber;
  return { label: member.name, ...classes };
}
