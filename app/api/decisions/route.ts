import { NextRequest, NextResponse } from "next/server";
import { createDecision, deleteDecision, listDecisions, setDecisionStatus } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({ items: listDecisions(channelId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    title?: string;
    summary?: string;
    links?: string[];
    author?: string;
  };
  if (!body.channelId || !body.title?.trim() || !body.summary?.trim()) {
    return NextResponse.json(
      { error: "channelId, title, summary required" },
      { status: 400 },
    );
  }
  const decision = createDecision({
    channelId: body.channelId,
    title: body.title.trim(),
    summary: body.summary.trim(),
    links: body.links,
    author: body.author?.trim() || "ej",
  });
  logActivity("system", `Decision logged: ${decision.title}`, {
    detail: decision.summary.slice(0, 120),
  });
  return NextResponse.json({ decision });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id?: number; status?: "open" | "archived" | "reversed" };
  if (typeof body.id !== "number" || !body.status) {
    return NextResponse.json({ error: "id + status required" }, { status: 400 });
  }
  setDecisionStatus(body.id, body.status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  deleteDecision(body.id);
  return NextResponse.json({ ok: true });
}
