import fs from "fs/promises";
import path from "path";
import { CLIENTS_ROOT, HOME } from "./config";
import {
  listChannelOverrides,
  listChannelPositions,
  listGroupPositions,
  listSessions,
  listUserChannels,
  listUserGroups,
  listUserServers,
} from "./db";

const SHARED_SERVER_NAME = "The War Room";

export type ChannelKind =
  | "home"
  | "chat"
  | "services"
  | "approvals"
  | "activity"
  | "sessions"
  | "decisions"
  | "announcements"
  | "knowledge";

export type Channel = {
  id: string;
  name: string;
  group: string;
  kind: ChannelKind;
  projectPath?: string;
  accent?: string;
  archived?: boolean;
  badge?: string;
  userCreated?: boolean;
  isPrivate?: boolean;
  description?: string;
  /** Adapter id pinned for this channel, e.g. "claude-cli" or "openai-api".
   *  null/undefined = inherit the global default at send time. */
  agentBackend?: string | null;
  /** "shared" if cross-agent context injection is on for this channel.
   *  Defaults to "isolated". */
  contextMode?: "isolated" | "shared";
  contextMessages?: number;
  contextChars?: number;
  /** Framework preset id pinned for this channel (e.g. "openwar"), or
   *  "none" for explicit opt-out, or null/undefined to inherit the
   *  global default at send time. */
  frameworkPreset?: string | null;
};

export type ChannelGroup = {
  label: string;
  channels: Channel[];
  userCreated?: boolean;
};

const GROUP_ORDER = [
  "Home",
  "Active projects",
  "Workspaces",
  "System",
  "Finished projects",
  // Legacy labels kept so existing user_groups + channel_positions rows
  // still sort sensibly until a forker renames them by hand.
  "Active Clients",
  "Finished Clients",
];

// Static workspace shortcuts come from WAR_ROOM_WORKSPACES env (JSON array).
// Ships with empty default so a fresh clone doesn't dangle references to
// machine-specific folders.
import { STATIC_WORKSPACES as CONFIGURED_WORKSPACES } from "./config";
const STATIC_WORKSPACES: Array<{ path: string; name: string }> = CONFIGURED_WORKSPACES;

const HOME_CHANNEL: Channel = {
  id: "home",
  name: "home",
  group: "Home",
  kind: "home",
  accent: "amber",
};

const BASE_SYSTEM_CHANNELS: Channel[] = [
  {
    id: "system/activity",
    name: "activity",
    group: "System",
    kind: "activity",
    accent: "sky",
  },
  {
    id: "system/approvals",
    name: "approvals",
    group: "System",
    kind: "approvals",
    accent: "violet",
  },
];

const DEFAULT_SERVER_EXTRA_SYSTEM: Channel[] = [
  { id: "system/services", name: "services", group: "System", kind: "services", accent: "emerald" },
  {
    id: "system/sessions",
    name: "sessions",
    group: "System",
    kind: "sessions",
    accent: "fuchsia",
  },
];

async function safeReaddir(p: string) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readBriefFinished(briefPath: string): Promise<boolean> {
  try {
    const text = await fs.readFile(briefPath, "utf8");
    const m = text.match(/^status:\s*(finished|archived|done)\s*$/im);
    return !!m;
  } catch {
    return false;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getChannelTree(
  serverId: number = 1,
  opts: { includeHidden?: boolean } = {},
): Promise<{
  groups: ChannelGroup[];
  channels: Channel[];
}> {
  const channels: Channel[] = [];
  const servers = listUserServers();
  const currentServer = servers.find((s) => s.id === serverId);
  const isShared = currentServer?.name === SHARED_SERVER_NAME;
  const isPersonal = currentServer?.is_personal === 1;

  // The shared War Room dashboard surface lives on its own server with
  // exactly one channel — /c/home — that renders the dashboard widgets.
  // Personal and custom servers have their own landing (system/activity)
  // and don't need a separate "home" entry in the sidebar.
  if (isShared) {
    channels.push(HOME_CHANNEL);
  }

  // System category lives on every non-shared server. The Personal server
  // additionally gets the workspace + project-folder auto-discovery groups.
  if (!isShared) {
    for (const c of BASE_SYSTEM_CHANNELS) channels.push(c);
    for (const c of DEFAULT_SERVER_EXTRA_SYSTEM) channels.push(c);
  }

  if (isPersonal) for (const ws of STATIC_WORKSPACES) {
    try {
      await fs.stat(ws.path);
      channels.push({
        id: `ws/${ws.name}`,
        name: ws.name,
        group: "Workspaces",
        kind: "chat",
        projectPath: ws.path,
      });
    } catch {}
  }

  const clientEntries = isPersonal ? await safeReaddir(CLIENTS_ROOT) : [];
  for (const d of clientEntries) {
    if (!d.isDirectory()) continue;
    if (d.name.startsWith("_") || d.name.startsWith(".")) continue;
    const projectPath = path.join(CLIENTS_ROOT, d.name);
    const finished = await readBriefFinished(path.join(projectPath, "brief.md"));
    channels.push({
      id: `client/${slugify(d.name)}`,
      name: d.name,
      group: finished ? "Finished projects" : "Active projects",
      kind: "chat",
      projectPath,
      archived: finished,
    });
  }

  const userChannels = listUserChannels(serverId, { includeHidden: opts.includeHidden });
  for (const uc of userChannels) {
    channels.push({
      id: `user/${uc.slug}`,
      name: uc.name,
      group: uc.group_label,
      kind: (uc.kind as ChannelKind) ?? "chat",
      projectPath: uc.project_path ?? STATIC_WORKSPACES[0]?.path ?? HOME,
      userCreated: true,
      isPrivate: uc.is_private === 1,
      description: uc.description ?? undefined,
    });
  }

  const sessions = listSessions();
  for (const ch of channels) {
    if (ch.projectPath) {
      const s = sessions.find((x) => x.project_path === ch.projectPath);
      if (s?.claude_session_id) ch.badge = "live";
    }
  }

  const overrides = listChannelOverrides();
  const overrideMap = new Map(overrides.map((o) => [o.channel_id, o]));
  for (const ch of channels) {
    const o = overrideMap.get(ch.id);
    if (!o) continue;
    ch.isPrivate = o.is_private === 1;
    if (o.project_path) ch.projectPath = o.project_path;
    if (o.description) ch.description = o.description;
    if (o.agent_backend) ch.agentBackend = o.agent_backend;
    if (o.context_mode) ch.contextMode = o.context_mode === "shared" ? "shared" : "isolated";
    if (o.context_messages != null) ch.contextMessages = o.context_messages;
    if (o.context_chars != null) ch.contextChars = o.context_chars;
    if (o.framework_preset !== null) ch.frameworkPreset = o.framework_preset;
  }

  const byGroup = new Map<string, Channel[]>();
  for (const ch of channels) {
    if (!byGroup.has(ch.group)) byGroup.set(ch.group, []);
    byGroup.get(ch.group)!.push(ch);
  }

  const userGroups = listUserGroups(serverId);
  const userGroupLabels = new Set(userGroups.map((ug) => ug.label));
  for (const ug of userGroups) {
    if (!byGroup.has(ug.label)) byGroup.set(ug.label, []);
  }

  const groupPositions = new Map(listGroupPositions(serverId).map((r) => [r.label, r.position]));
  const channelPositions = new Map(
    listChannelPositions(serverId).map((r) => [r.channel_id, r.position]),
  );

  const allLabels = Array.from(byGroup.keys());
  const defaultGroupOrder = (label: string): number => {
    const idx = GROUP_ORDER.indexOf(label);
    return idx >= 0 ? idx * 1000 : 100_000 + label.charCodeAt(0);
  };
  const ordered = allLabels.sort((a, b) => {
    const pa = groupPositions.get(a) ?? defaultGroupOrder(a);
    const pb = groupPositions.get(b) ?? defaultGroupOrder(b);
    return pa - pb;
  });

  const groups: ChannelGroup[] = ordered.map((label) => ({
    label,
    userCreated: userGroupLabels.has(label),
    channels: byGroup
      .get(label)!
      .sort((a, b) => {
        const pa = channelPositions.get(a.id);
        const pb = channelPositions.get(b.id);
        if (pa !== undefined && pb !== undefined) return pa - pb;
        if (pa !== undefined) return -1;
        if (pb !== undefined) return 1;
        return a.name.localeCompare(b.name);
      }),
  }));

  return { groups, channels };
}

export function findChannel(channels: Channel[], id: string): Channel | undefined {
  return channels.find((c) => c.id === id);
}
