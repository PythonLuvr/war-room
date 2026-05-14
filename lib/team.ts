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

/** Reverse of agentIdFor — peel the agent suffix to get the human id. */
export function humanIdForAgent(agentId: string): string | null {
  const m = agentId.match(/^(.+)-agent$/);
  return m ? m[1] : null;
}
