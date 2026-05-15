import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEYS = [
  "onboarding.completed",
  "onboarding.identity",
  "onboarding.displayName",
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
    claudeBin: string;
    workspaceRoot: string;
    syncOptIn: boolean;
    syncUrl: string;
    completed: boolean;
  }>;

  if (body.identity !== undefined) setSetting("onboarding.identity", body.identity);
  if (body.displayName !== undefined) setSetting("onboarding.displayName", body.displayName);
  if (body.claudeBin !== undefined) setSetting("onboarding.claudeBin", body.claudeBin);
  if (body.workspaceRoot !== undefined) setSetting("onboarding.workspaceRoot", body.workspaceRoot);
  if (body.syncOptIn !== undefined) setSetting("onboarding.syncOptIn", body.syncOptIn ? "1" : "0");
  if (body.syncUrl !== undefined) setSetting("onboarding.syncUrl", body.syncUrl);
  if (body.completed !== undefined) setSetting("onboarding.completed", body.completed ? "1" : "0");

  return NextResponse.json({ ok: true });
}
