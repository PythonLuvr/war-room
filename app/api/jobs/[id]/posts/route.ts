import { NextRequest, NextResponse } from "next/server";
import { createJobPost, getJob } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = "ej";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const jobId = Number(id);
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const body = (await req.json()) as {
    body?: string;
    kind?: "comment" | "status-update" | "blocker" | "completion" | "file-share";
    author?: string;
  };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const post = createJobPost({
    jobId,
    author: body.author?.trim() || ME,
    kind: body.kind ?? "comment",
    body: body.body.trim(),
  });

  logActivity("system", `${post.author} → ${job.title}`, {
    detail: post.body.slice(0, 100),
  });

  return NextResponse.json({ post });
}
