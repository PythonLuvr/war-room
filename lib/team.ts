// Team roster. Drives boardroom seats, chat author labels, presence list,
// agent @-mentions, and identity-keyed colors throughout the app.
//
// Ships with one generic "You" entry so a fresh clone produces a working
// single-user cockpit out of the box. Add teammates by editing this file in
// your fork (or, once the sync server lands, the roster will come from the
// shared service instead).

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
  // Example additional teammates — uncomment and edit, or replace entirely.
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
 *  `agentName` override; falls back to `<DisplayName>-Agent`. */
export function agentLabelFor(member: TeamMember): string {
  return member.agentName?.trim() || `${member.name}-Agent`;
}

/** Reverse of agentIdFor — peel the agent suffix to get the human id. */
export function humanIdForAgent(agentId: string): string | null {
  const m = agentId.match(/^(.+)-agent$/);
  return m ? m[1] : null;
}

// ─── Client-side reactivity hook ───────────────────────────────────────────
//
// TEAM is mutated in place by IdentityHydrator when the user finishes the
// onboarding wizard (or refocuses the tab). Components that render
// `LOCAL.name` need a re-render trigger to pick up the new value, since
// mutating an object property doesn't notify React on its own. Any subtree
// that displays the local human's name should call useIdentityVersion() —
// it's a no-op state hook that re-renders the caller on every
// "war-room:identity-changed" event.
//
// Lives in this module (not a separate hook file) so the import sits next
// to the rest of the team helpers.
import { useEffect, useState } from "react";
export function useIdentityVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const onChange = () => setV((n) => n + 1);
    window.addEventListener("war-room:identity-changed", onChange);
    return () => window.removeEventListener("war-room:identity-changed", onChange);
  }, []);
  return v;
}
