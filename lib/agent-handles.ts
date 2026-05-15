// Mention handle ↔ adapter id resolution.
//
// Adapter ids are stable backend identifiers (e.g. "claude-cli",
// "openai-api"). Mention handles are the friendlier strings users actually
// type in chat (`@claude`, `@openai`). Stripping the trailing `-cli`/`-api`
// gets us most of the way; when both CLI and API of the same provider are
// configured we disambiguate to `provider.cli` / `provider.api`.

import type { AgentAdapter } from "./agents/types";

export type HandleEntry = { handle: string; adapterId: string };

export function buildHandleMap(adapters: Pick<AgentAdapter, "id" | "kind">[]): HandleEntry[] {
  const stems = adapters.map((a) => ({ raw: a, stem: a.id.replace(/-(cli|api)$/i, "") }));
  const counts = new Map<string, number>();
  for (const s of stems) counts.set(s.stem, (counts.get(s.stem) ?? 0) + 1);
  return stems.map(({ raw, stem }) => {
    const collides = (counts.get(stem) ?? 0) > 1;
    const handle = collides ? `${stem}.${raw.kind}` : stem;
    return { handle, adapterId: raw.id };
  });
}

/** Find the first @handle in `text` that matches a known adapter. Returns
 *  the adapter id, or null if none of the @-tokens correspond to an agent.
 *  Does not modify `text` — the prompt is forwarded verbatim. */
export function resolveMentionedBackend(
  text: string,
  entries: HandleEntry[],
): string | null {
  if (entries.length === 0) return null;
  // Sort longest-first so `@openai-compat` wins over `@openai` when both
  // are valid handles in the map.
  const sorted = [...entries].sort((a, b) => b.handle.length - a.handle.length);
  const escaped = sorted.map((e) => e.handle.replace(/[.\-]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})\\b`, "i");
  const m = text.match(re);
  if (!m) return null;
  const handle = m[1].toLowerCase();
  const hit = sorted.find((e) => e.handle.toLowerCase() === handle);
  return hit?.adapterId ?? null;
}
