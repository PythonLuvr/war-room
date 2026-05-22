import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  createMeetingTranscript,
  deleteMeetingTranscript,
  getMeetingTranscript,
  listMeetingTranscripts,
} from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/sync/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The WhisperX worker authenticates with the LiveKit API secret as a
// bearer token. That keeps writes to a process that already holds the
// room credentials, no separate secret to manage. If LiveKit isn't
// configured the POST handler 503s, same as the token route, so the
// transcripts feature stays cleanly opt-in.
function workerAuthorized(req: NextRequest): boolean {
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.replace(/^Bearer\s+/i, "").trim();
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET: list saved transcripts (no body) or fetch one with ?id=.
// Read-only, served to the local boardroom panel like every other
// dashboard route, no auth.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const entry = getMeetingTranscript(Number(id));
    if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ transcript: entry });
  }
  return NextResponse.json({ transcripts: listMeetingTranscripts() });
}

// POST: the WhisperX worker saves a finished meeting transcript.
export async function POST(req: NextRequest) {
  if (!process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: "LiveKit not configured. Voice transcription is an opt-in module." },
      { status: 503 },
    );
  }
  if (!workerAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    room?: string;
    title?: string;
    body?: string;
    participants?: string[];
    startedAt?: number;
    endedAt?: number;
    durationSeconds?: number;
  };

  if (!body.room?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "room + body required" }, { status: 400 });
  }

  const transcript = createMeetingTranscript({
    room: body.room.trim(),
    title: body.title?.trim() || `Meeting · ${new Date().toLocaleString()}`,
    body: body.body,
    participants: Array.isArray(body.participants) ? body.participants : undefined,
    startedAt: body.startedAt ?? null,
    endedAt: body.endedAt ?? null,
    durationSeconds: body.durationSeconds ?? null,
  });

  logActivity("system", `Meeting transcript saved: ${transcript.title}`, {
    detail: transcript.body.slice(0, 120),
  });
  emitEvent("transcript.created", transcript as unknown as Record<string, unknown>);

  return NextResponse.json({ transcript }, { status: 201 });
}

// DELETE: remove a saved transcript from the boardroom panel.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deleteMeetingTranscript(Number(id));
  emitEvent("transcript.deleted", { id: Number(id) });
  return NextResponse.json({ ok: true });
}
