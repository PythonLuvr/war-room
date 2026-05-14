import { notFound } from "next/navigation";
import { getJob, listJobAssignees, listJobPosts } from "@/lib/db";
import { JobPageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  const job = getJob(jobId);
  if (!job) notFound();
  const assignees = listJobAssignees(jobId);
  const posts = listJobPosts(jobId);
  return <JobPageClient initialJob={job} initialAssignees={assignees} initialPosts={posts} />;
}
