import { NextRequest, NextResponse } from "next/server";
import { getChannelFile } from "@/lib/db";
import { readFile } from "@/lib/file-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = getChannelFile(Number(id));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const bytes = await readFile(row.channel_id, row.filename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mime_type ?? "application/octet-stream",
        "Content-Length": String(row.size_bytes),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          row.original_name,
        )}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
