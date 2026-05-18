import { NextRequest, NextResponse } from "next/server";
import { getAllAgentProfiles, getSetting, setSetting } from "@/lib/db";
import { ALL_ADAPTERS, activeAdapterId } from "@/lib/agents";
import { brandAccentFor } from "@/lib/agents/brand-colors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// All settings keys the agent system reads. Listed here so the UI can hydrate
// + persist them in one round trip without each adapter file having to expose
// its own /api/* surface.
const SETTINGS_KEYS = [
  "agent.backend",
  // CLI bins
  "agent.cli.claude.bin",
  "agent.cli.codex.bin",
  "agent.cli.gemini.bin",
  "agent.cli.openclaw.bin",
  "agent.cli.hermes.bin",
  "agent.cli.semaclaw.bin",
  "agent.cli.custom.bin",
  "agent.cli.custom.template",
  // API keys + models
  "agent.api.anthropic.key",
  "agent.api.anthropic.model",
  "agent.api.openai.key",
  "agent.api.openai.model",
  "agent.api.gemini.key",
  "agent.api.gemini.model",
  "agent.api.grok.key",
  "agent.api.grok.model",
  "agent.api.openai-compat.baseUrl",
  "agent.api.openai-compat.key",
  "agent.api.openai-compat.model",
];

const SECRET_KEYS = new Set([
  "agent.api.anthropic.key",
  "agent.api.openai.key",
  "agent.api.gemini.key",
  "agent.api.grok.key",
  "agent.api.openai-compat.key",
]);

function maskSecret(value: string | null): string | null {
  if (!value) return value;
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(value.length - 8)}${value.slice(-4)}`;
}

export async function GET() {
  const settings: Record<string, string | null> = {};
  for (const k of SETTINGS_KEYS) {
    const raw = getSetting(k);
    settings[k] = SECRET_KEYS.has(k) ? maskSecret(raw) : raw;
  }
  const profiles = getAllAgentProfiles();
  return NextResponse.json({
    activeId: activeAdapterId(),
    settings,
    adapters: ALL_ADAPTERS.map((a) => {
      const p = profiles.get(a.id);
      const defaultAccent = brandAccentFor(a.id);
      return {
        id: a.id,
        // Built-in name + icon + accent are always returned as defaults
        // so the UI can show "[built-in] when no override is set" and
        // let the user revert with one click. Effective values are the
        // merged result.
        defaultName: a.name,
        defaultIconUrl: a.iconUrl ?? null,
        defaultAccent,
        name: p?.display_name?.trim() || a.name,
        iconUrl: p?.icon_url ?? a.iconUrl ?? null,
        accent: p?.accent ?? defaultAccent,
        kind: a.kind,
        capabilities: a.capabilities,
        isConfigured: a.isConfigured(),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, string | null | undefined>;
  for (const [k, v] of Object.entries(body)) {
    if (!SETTINGS_KEYS.includes(k)) continue;
    // Empty string clears, null/undefined skips. Saves typing in the UI.
    if (v === undefined || v === null) continue;
    // Don't write if the value looks like the masked placeholder we sent
    // back on GET, means the user didn't touch the secret field.
    if (SECRET_KEYS.has(k) && /^[\w-]{0,4}•+[\w-]{0,4}$/.test(v)) continue;
    setSetting(k, v);
  }
  return NextResponse.json({ ok: true });
}
