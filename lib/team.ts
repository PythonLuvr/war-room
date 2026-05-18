// Team roster. Drives boardroom seats, chat author labels, presence list,
// agent @-mentions, and identity-keyed colors throughout the app.
//
// Ships with one generic "You" entry so a fresh clone produces a working
// single-user cockpit out of the box. Add teammates by editing this file in
// your fork (or, once the sync server lands, the roster will come from the
// shared service instead).

import { LOCAL_USER } from "@/lib/config";

export type TeamMember = {
  id: string;
  name: string;
  /** Display name of this teammate's personal workspace server. */
  serverName: string;
  color: "amber" | "sky" | "emerald" | "violet" | "fuchsia" | "rose";
  /** User-customizable label for this teammate's paired agent. When unset
   *  the UI falls back to `${name}-Agent`. Set via the wizard's identity
   *  step or Settings → General. */
  agentName?: string;
};

export const TEAM: TeamMember[] = [
  { id: "you", name: "You", serverName: "Personal", color: "amber" },
  // Example additional teammates, uncomment and edit, or replace entirely.
  // { id: "alex", name: "Alex", serverName: "Alex's hub", color: "sky" },
  // { id: "sam", name: "Sam", serverName: "Sam's hub", color: "emerald" },
];

export function teamMember(id: string): TeamMember | undefined {
  return TEAM.find((m) => m.id === id);
}

/** The "main" local user this client represents. First entry by convention. */
export function localMember(): TeamMember {
  return TEAM[0];
}

/** The agent identity paired with a given human member. Convention: <id>-agent. */
export function agentIdFor(member: TeamMember | string): string {
  const id = typeof member === "string" ? member : member.id;
  return `${id}-agent`;
}

/** User-facing label for a teammate's paired agent. Honors the per-member
 *  `agentName` override; falls back to an empty string so callers can
 *  prefer the adapter's vendor name. As of v0.14.0 we no longer
 *  auto-prepend the human's display name onto the primary agent's
 *  label - every agent renders as its built-in vendor name by default,
 *  and per-adapter renaming lives in Settings -> Agent profiles. */
export function agentLabelFor(member: TeamMember): string {
  return member.agentName?.trim() ?? "";
}

/** Reverse of agentIdFor, peel the agent suffix to get the human id. */
export function humanIdForAgent(agentId: string): string | null {
  const m = agentId.match(/^(.+)-agent$/);
  return m ? m[1] : null;
}

/** Tailwind gradient + border + text classes per theme accent. Keyed by the
 *  `color` field on TeamMember so a fork picks the palette by editing
 *  `lib/team.ts`, not by adding entries to a hardcoded user-id map. */
export const THEME_CLASSES: Record<TeamMember["color"], string> = {
  amber: "from-amber-500/30 to-amber-700/15 border-amber-500/40 text-amber-200",
  sky: "from-sky-500/30 to-sky-700/15 border-sky-500/40 text-sky-200",
  emerald: "from-emerald-500/30 to-emerald-700/15 border-emerald-500/40 text-emerald-200",
  violet: "from-violet-500/30 to-violet-700/15 border-violet-500/40 text-violet-200",
  fuchsia: "from-fuchsia-500/30 to-fuchsia-700/15 border-fuchsia-500/40 text-fuchsia-200",
  rose: "from-rose-500/30 to-rose-700/15 border-rose-500/40 text-rose-200",
};

const FALLBACK_THEME_CLASSES =
  "from-neutral-700 to-neutral-900 border-neutral-700 text-neutral-300";

/** Resolve tailwind theme classes for a teammate by id. Falls back to a
 *  neutral palette when the id isn't in TEAM (e.g. a synced row from a
 *  teammate this client hasn't met yet). */
export function themeClassesFor(userId: string): string {
  const member = TEAM.find((m) => m.id === userId);
  return member ? THEME_CLASSES[member.color] : FALLBACK_THEME_CLASSES;
}

/** Identity attributed to server-side writes from this local install.
 *  Reads from config so a fork doesn't inherit any baked-in operator
 *  handle. Single-user-local-first by design; when a future build adds
 *  real per-request auth, swap this implementation without touching
 *  every caller. */
export function getRequester(): string {
  return LOCAL_USER;
}

/** Stable, deterministic server-slot number for a user id. Used to build
 *  channel-route slugs without privileging specific handles. djb2 hash,
 *  range 1..16. The receiving channel resolves by full slug, so collisions
 *  in this slot only cause a route to point at "user under their own
 *  workspace" anchors that still disambiguate via the rest of the slug. */
export function serverSlotFor(userId: string): number {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 16 + 1;
}

// The matching client-side hook, components that need to re-render when
// TEAM[0] is mutated (display name / agent label changes via the wizard)
// import `useIdentityVersion` from `lib/use-identity-version`. Kept in a
// separate file so this module stays safe to import from server code.
