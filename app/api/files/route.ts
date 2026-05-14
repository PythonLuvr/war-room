import { NextRequest, NextResponse } from "next/server";
import {
  createChannelFile,
  deleteChannelFileRow,
  getChannelFile,
  listChannelFiles,
} from "@/lib/db";
import { deleteFile, storageBackend, writeFile } from "@/lib/file-storage";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = "ej";
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB v1 cap

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({
    items: listChannelFiles(channelId),
    backend: storageBackend(),
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const channelId = formData.get("channelId");
  const file = formData.get("file");

  if (typeof channelId !== "string" || !channelId.trim()) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds 100MB cap (${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await writeFile(channelId, file.name, bytes);
  const row = createChannelFile({
    channelId,
    filename: stored.filename,
    originalName: file.name,
    sizeBytes: stored.size,
    mimeType: file.type || null,
    uploadedBy: ME,
  });

  logActivity("system", `File uploaded: ${file.name}`, {
    detail: `${(stored.size / 1024).toFixed(0)} KB · ${channelId}`,
  });

  return NextResponse.json({ file: row });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const row = getChannelFile(body.id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteFile(row.channel_id, row.filename);
  deleteChannelFileRow(body.id);
  return NextResponse.json({ ok: true });
}
