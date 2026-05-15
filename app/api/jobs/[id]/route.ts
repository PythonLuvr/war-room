import { NextRequest, NextResponse } from "next/server";
import {
  deleteJob,
  getJob,
  listJobAssignees,
  listJobPosts,
  setJobStatus,
} from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const jobId = Number(id);
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    job,
    assignees: listJobAssignees(jobId),
    posts: listJobPosts(jobId),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const jobId = Number(id);
  const body = (await req.json()) as { status?: "active" | "recurring" | "finished" };
  if (body.status) {
    setJobStatus(jobId, body.status);
    const job = getJob(jobId);
    logActivity("system", `Job status → ${body.status}`, {
      detail: job?.title,
    });
  }
  return NextResponse.json({ job: getJob(jobId) });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  deleteJob(Number(id));
  return NextResponse.json({ ok: true });
}
