import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streams an uploaded file back. Path-traversal guard: we only allow
// the exact <hash>.<ext> shape we hand out from POST /api/upload, so
// "../" or absolute paths can't sneak in via the URL.
//
// Cache-Control is 1 year + immutable because the URL is content-
// addressed (the bytes will never change for a given hash). Browsers
// can hold onto the image forever.

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const FILENAME_RE = /^[a-f0-9]{1,64}\.(png|jpg|jpeg|gif|webp|svg|bin)$/i;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bin: "application/octet-stream",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!FILENAME_RE.test(name)) {
    return NextResponse.json({ error: "bad filename" }, { status: 400 });
  }
  const target = path.join(UPLOAD_DIR, name);
  try {
    const data = await fs.readFile(target);
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
