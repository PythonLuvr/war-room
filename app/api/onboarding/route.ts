import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import { getPersonalServer, getSetting, setSetting, updateUserServer } from "@/lib/db";

// First glyph of a string, normalized for use as a server icon. Handles
// emoji, multi-codepoint scripts (like flags), and plain ASCII.
function firstGlyph(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  // Intl.Segmenter respects grapheme clusters so multi-codepoint emoji
  // stay intact. Fall back to the first code unit if Segmenter isn't there.
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    const seg = new Seg(undefined, { granularity: "grapheme" });
    const first = seg.segment(trimmed)[Symbol.iterator]().next().value;
    return first?.segment?.toUpperCase() ?? trimmed[0]?.toUpperCase() ?? "";
  }
  return trimmed[0]?.toUpperCase() ?? "";
}

// Icons we treat as "still the seeded default", safe to overwrite when
// the user sets a display name. Anything else means they've customized
// it and we leave it alone.
const DEFAULT_PERSONAL_ICONS = new Set(["✦", "?"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEYS = [
  "onboarding.completed",
  "onboarding.identity",
  "onboarding.displayName",
  "onboarding.displayIcon",
  "onboarding.agentName",
  "onboarding.agentIcon",
  "onboarding.claudeBin",
  "onboarding.workspaceRoot",
  "onboarding.syncOptIn",
  "onboarding.syncUrl",
];

export async function GET() {
  const data: Record<string, string | null> = {};
  for (const k of KEYS) data[k] = getSetting(k);
  return NextResponse.json({
    settings: data,
    defaults: {
      claudeBin: process.env.CLAUDE_BIN || "claude",
      workspaceRoot: path.join(os.homedir(), "clients"),
      home: os.homedir(),
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<{
    identity: string;
    displayName: string;
    displayIcon: string;
    agentName: string;
    agentIcon: string;
    claudeBin: string;
    workspaceRoot: string;
    syncOptIn: boolean;
    syncUrl: string;
    completed: boolean;
  }>;

  if (body.agentName !== undefined) setSetting("onboarding.agentName", body.agentName);
  if (body.agentIcon !== undefined) setSetting("onboarding.agentIcon", body.agentIcon);
  if (body.displayIcon !== undefined) setSetting("onboarding.displayIcon", body.displayIcon);
  if (body.identity !== undefined) setSetting("onboarding.identity", body.identity);
  if (body.displayName !== undefined) {
    setSetting("onboarding.displayName", body.displayName);
    // Personal workspace icon defaults to the first letter of the user's
    // display name. Only overwrite if the icon is still one of the seeded
    // defaults, any custom value the user picked themselves is left alone.
    const glyph = firstGlyph(body.displayName);
    if (glyph) {
      const personal = getPersonalServer();
      if (personal && DEFAULT_PERSONAL_ICONS.has(personal.icon)) {
        updateUserServer(personal.id, { icon: glyph });
      }
    }
  }
  if (body.claudeBin !== undefined) setSetting("onboarding.claudeBin", body.claudeBin);
  if (body.workspaceRoot !== undefined) setSetting("onboarding.workspaceRoot", body.workspaceRoot);
  if (body.syncOptIn !== undefined) setSetting("onboarding.syncOptIn", body.syncOptIn ? "1" : "0");
  if (body.syncUrl !== undefined) setSetting("onboarding.syncUrl", body.syncUrl);
  if (body.completed !== undefined) setSetting("onboarding.completed", body.completed ? "1" : "0");

  return NextResponse.json({ ok: true });
}
