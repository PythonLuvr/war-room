import { NextRequest, NextResponse } from "next/server";
import {
  listPinnedMessages,
  pinMessage,
  unpinMessage,
} from "@/lib/db";
import { getRequester } from "@/lib/team";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = getRequester();

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  return NextResponse.json({ items: listPinnedMessages(channelId) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    role?: string;
    content?: string;
    agentId?: string | null;
    originalCreatedAt?: number;
  };
  if (!body.channelId || !body.role || !body.content) {
    return NextResponse.json(
      { error: "channelId, role, content required" },
      { status: 400 },
    );
  }
  const pinned = pinMessage({
    channelId: body.channelId,
    role: body.role,
    content: body.content,
    agentId: body.agentId,
    pinnedBy: ME,
    originalCreatedAt: body.originalCreatedAt ?? Date.now(),
  });
  return NextResponse.json({ pinned });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  unpinMessage(body.id);
  return NextResponse.json({ ok: true });
}
