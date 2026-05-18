import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Saves an uploaded file into <DATA_DIR>/uploads/ and returns the
// URL the client should use to render it. Files are content-addressed
// (SHA-256 of the bytes) so duplicate uploads dedupe automatically
// and the URL is stable across renames.
//
// Accepts multipart/form-data with a single "file" field. Caps body
// at 10 MB to keep stray large uploads from filling the data dir.
// MIME type comes from the form data; we trust it for the response
// header but the renderer (img tag) reads the bytes regardless.

const MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// Pulled from the file's MIME so served bytes set a sensible
// content-type header. Unknown types fall back to octet-stream;
// browsers still render images correctly because the actual sniff
// happens on the bytes.
const ALLOWED_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no file field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES} bytes)` },
      { status: 413 },
    );
  }
  const mime = file.type || "application/octet-stream";
  const ext = ALLOWED_EXT[mime] ?? "bin";
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
  const filename = `${hash}.${ext}`;
  const target = path.join(UPLOAD_DIR, filename);
  // Content-addressed: if the file with this hash already exists we
  // can skip the write entirely. Saves disk + makes re-uploads free.
  try {
    await fs.access(target);
  } catch {
    await fs.writeFile(target, buf);
  }
  return NextResponse.json({
    url: `/api/uploads/${filename}`,
    bytes: file.size,
    mime,
  });
}
