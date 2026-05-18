import { NextRequest, NextResponse } from "next/server";
import {
  createJob,
  createUserChannel,
  listJobAssignees,
  listJobs,
  listUserServers,
} from "@/lib/db";
import { TEAM, getRequester } from "@/lib/team";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ME = getRequester();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const jobs = listJobs({ status: status ?? undefined });
  // attach assignees
  const out = jobs.map((j) => ({ ...j, assignees: listJobAssignees(j.id) }));
  return NextResponse.json({ items: out });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    title?: string;
    clientName?: string;
    description?: string;
    briefUrl?: string;
    dueDate?: string;
    status?: "active" | "recurring" | "finished";
    assignees?: string[];
  };
  const title = body.title?.trim();
  const assignees = body.assignees?.filter((a) => TEAM.some((m) => m.id === a)) ?? [];
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (assignees.length === 0) {
    return NextResponse.json({ error: "at least one assignee required" }, { status: 400 });
  }

  // Generate a unique slug
  let baseSlug = slugify(title);
  if (!baseSlug) baseSlug = `job-${Date.now()}`;
  let slug = baseSlug;
  let counter = 2;
  while (
    listJobs({}).some((j) => j.slug === slug) // small list, fine for v1
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  const job = createJob({
    slug,
    title,
    clientName: body.clientName?.trim(),
    status: body.status ?? "active",
    description: body.description,
    briefUrl: body.briefUrl,
    dueDate: body.dueDate,
    createdBy: ME,
    assignees,
  });

  // Auto-create personal execution channels for each assignee under their
  // personal server's project groups.
  const servers = listUserServers();
  const groupForStatus =
    job.status === "recurring"
      ? "Recurring projects"
      : job.status === "finished"
        ? "Finished projects"
        : "Active projects";
  for (const userId of assignees) {
    const member = TEAM.find((m) => m.id === userId);
    if (!member) continue;
    const personalServer = servers.find((s) => s.name === member.serverName);
    if (!personalServer) continue;
    const channelSlug = `s${personalServer.id}-job-${slug}`;
    try {
      createUserChannel({
        slug: channelSlug,
        name: slug,
        groupLabel: groupForStatus,
        kind: "chat",
        serverId: personalServer.id,
        isPrivate: false,
      });
    } catch {
      // Slug collision, channel already exists; tolerate.
    }
  }

  logActivity("system", `Job created: ${title}`, {
    detail: `Assigned ${assignees.length} · ${job.status}`,
  });

  return NextResponse.json({ job });
}
