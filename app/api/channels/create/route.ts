import { NextRequest, NextResponse } from "next/server";
import {
  createUserChannel,
  createUserGroup,
  deleteUserChannel,
  deleteUserGroup,
  listAllUserChannels,
  listUserGroups,
  setChannelOverrideDescription,
  setChannelOverridePath,
  setChannelOverridePrivate,
  setChannelPrivate,
  updateUserChannel,
} from "@/lib/db";
import {
  emitChannelDelete,
  emitChannelUpsert,
  emitGroupDelete,
  emitGroupUpsert,
} from "@/lib/sync/emitters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    target: "channel" | "group";
    name?: string;
    groupLabel?: string;
    projectPath?: string;
    serverId?: number;
    isPrivate?: boolean;
    description?: string;
  };
  const serverId = body.serverId ?? 1;

  if (body.target === "group") {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    try {
      const g = createUserGroup(body.name.trim(), serverId);
      emitGroupUpsert({ ...g, server_id: serverId });
      return NextResponse.json({ group: g });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 409 },
      );
    }
  }

  if (body.target === "channel") {
    const name = body.name?.trim();
    const groupLabel = body.groupLabel?.trim();
    if (!name || !groupLabel) {
      return NextResponse.json({ error: "name and groupLabel required" }, { status: 400 });
    }
    const slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    try {
      const c = createUserChannel({
        slug,
        name,
        groupLabel,
        kind: "chat",
        projectPath: body.projectPath,
        serverId,
        isPrivate: !!body.isPrivate,
      });
      if (body.description?.trim()) {
        updateUserChannel(slug, { description: body.description.trim() });
      }
      const fresh = listAllUserChannels().find((x) => x.slug === slug) ?? c;
      emitChannelUpsert(fresh);
      return NextResponse.json({ channel: c });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ error: "unknown target" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as {
    target: "channel" | "group";
    slug?: string;
    label?: string;
    serverId?: number;
  };
  if (body.target === "channel" && body.slug) {
    deleteUserChannel(body.slug);
    emitChannelDelete(body.slug);
    return NextResponse.json({ ok: true });
  }
  if (body.target === "group" && body.label) {
    deleteUserGroup(body.label, body.serverId ?? 1);
    emitGroupDelete(body.serverId ?? 1, body.label);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad request" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as {
    channelId?: string;
    slug?: string;
    isPrivate?: boolean;
    name?: string;
    projectPath?: string | null;
    description?: string | null;
  };

  const channelId = body.channelId ?? (body.slug ? `user/${body.slug}` : undefined);
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  if (channelId.startsWith("user/")) {
    const slug = channelId.slice("user/".length);
    if (typeof body.isPrivate === "boolean") {
      setChannelPrivate(slug, body.isPrivate);
    }
    if (
      typeof body.name === "string" ||
      body.projectPath !== undefined ||
      body.description !== undefined
    ) {
      updateUserChannel(slug, {
        name: typeof body.name === "string" ? body.name : undefined,
        projectPath: body.projectPath === undefined ? undefined : body.projectPath || null,
        description: body.description === undefined ? undefined : body.description || null,
      });
    }
    const fresh = listAllUserChannels().find((c) => c.slug === slug);
    if (fresh) emitChannelUpsert(fresh);
  } else {
    if (typeof body.isPrivate === "boolean") {
      setChannelOverridePrivate(channelId, body.isPrivate);
    }
    if (body.projectPath !== undefined) {
      setChannelOverridePath(channelId, body.projectPath || null);
    }
    if (body.description !== undefined) {
      setChannelOverrideDescription(channelId, body.description || null);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ groups: listUserGroups() });
}
