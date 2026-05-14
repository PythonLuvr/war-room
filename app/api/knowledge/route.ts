import { NextRequest, NextResponse } from "next/server";
import {
  createKnowledge,
  deleteKnowledge,
  getKnowledge,
  listKnowledge,
  updateKnowledge,
} from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = "ej";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const entry = getKnowledge(Number(id));
    if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ entry });
  }
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({ items: listKnowledge(channelId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    title?: string;
    body?: string;
    tags?: string[];
  };
  if (!body.channelId || !body.title?.trim()) {
    return NextResponse.json({ error: "channelId + title required" }, { status: 400 });
  }
  const entry = createKnowledge({
    channelId: body.channelId,
    title: body.title.trim(),
    body: body.body ?? "",
    tags: body.tags,
    author: ME,
  });
  logActivity("system", `Knowledge entry: ${entry.title}`, {
    detail: entry.body.slice(0, 120),
  });
  return NextResponse.json({ entry });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    id?: number;
    title?: string;
    body?: string;
    tags?: string[] | null;
  };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  updateKnowledge(body.id, {
    title: body.title,
    body: body.body,
    tags: body.tags,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  deleteKnowledge(body.id);
  return NextResponse.json({ ok: true });
}
