// War Room invite-block formatter and smart-paste parser.
//
// The invite block is plain text designed to paste legibly into Slack,
// Discord, email, SMS. The format is a contract: the parser on the
// join-form side detects the header line and pulls the three labeled
// fields out so a teammate can paste the whole block into one input
// and have URL / Workspace / Token auto-populate instead of cutting
// and pasting three times.

export const INVITE_HEADER = "War Room invite for workspace";

export type InvitePayload = {
  url: string;
  workspace: string;
  token: string;
};

export function formatInvite(p: InvitePayload): string {
  return [
    `${INVITE_HEADER} "${p.workspace}"`,
    `URL:       ${p.url}`,
    `Workspace: ${p.workspace}`,
    `Token:     ${p.token}`,
    ``,
    `Open War Room -> Settings -> Sync -> Connect to workspace, paste these three values.`,
  ].join("\n");
}

// Smart-paste. Accepts the full multi-line invite block (as produced
// by formatInvite) OR any text that contains the three labeled lines
// in any order. Whitespace around values is trimmed. Returns null if
// any of the three fields is missing or empty.
//
// Tolerant of:
// - Carriage returns (\r\n, \r) from cross-OS clipboards
// - Extra leading/trailing whitespace per line
// - Lines being reordered or interleaved with other text
//
// Intentionally strict about:
// - Field names must be exactly URL / Workspace / Token, case
//   insensitive but spelled correctly. Anyone editing the invite
//   block before pasting is on their own.
export function parseInvite(raw: string): InvitePayload | null {
  if (!raw) return null;
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const fields: Partial<InvitePayload> = {};
  for (const line of lines) {
    // Allow common chat-quote / bullet prefixes (> , - , * , | , #, plus
    // whitespace) before the label so a teammate can paste an entire
    // Slack / Discord / email reply containing the block.
    const m = line.match(/^[\s>\-*|#]*(URL|Workspace|Token)\s*:\s*(.+?)\s*$/i);
    if (!m) continue;
    const key = m[1].toLowerCase() as "url" | "workspace" | "token";
    const value = m[2];
    if (!value) continue;
    if (fields[key] === undefined) {
      fields[key] = value;
    }
  }
  if (!fields.url || !fields.workspace || !fields.token) return null;
  return { url: fields.url, workspace: fields.workspace, token: fields.token };
}

// True if the pasted text is recognizably a War Room invite block.
// Used by the join form's onPaste handler to decide whether to
// intercept the paste and auto-fill all three fields.
export function looksLikeInvite(raw: string): boolean {
  if (!raw) return false;
  return raw.includes(INVITE_HEADER) || parseInvite(raw) !== null;
}
