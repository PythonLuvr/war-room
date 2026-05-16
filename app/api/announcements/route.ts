import { NextRequest, NextResponse } from "next/server";
import {
  ackAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  listAnnouncements,
  setAnnouncementStatus,
  unackAnnouncement,
} from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/sync/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = "ej";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({ items: listAnnouncements(channelId, ME) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    title?: string;
    body?: string;
    author?: string;
  };
  if (!body.channelId || !body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "channelId, title, body required" },
      { status: 400 },
    );
  }
  const announcement = createAnnouncement({
    channelId: body.channelId,
    title: body.title.trim(),
    body: body.body.trim(),
    author: body.author?.trim() || ME,
  });
  logActivity("system", `Announcement: ${announcement.title}`, {
    detail: announcement.body.slice(0, 120),
  });
  emitEvent("announcement.created", announcement as unknown as Record<string, unknown>);
  return NextResponse.json({ announcement });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    id?: number;
    ack?: boolean;
    status?: "open" | "archived";
  };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (typeof body.status === "string") {
    setAnnouncementStatus(body.id, body.status);
    const updated = getAnnouncementById(body.id);
    if (updated) emitEvent("announcement.updated", updated as unknown as Record<string, unknown>);
  } else if (body.ack === false) {
    unackAnnouncement(body.id, ME);
  } else if (body.ack !== undefined) {
    ackAnnouncement(body.id, ME);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  deleteAnnouncement(body.id);
  emitEvent("announcement.deleted", { id: body.id });
  return NextResponse.json({ ok: true });
}
