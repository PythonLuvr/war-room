"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Plus,
  Search,
  Server,
  CheckSquare,
  Activity,
  MessageSquare,
  Home,
  X,
  FolderPlus,
  Lock,
  MoreVertical,
  Gavel,
  Megaphone,
  BookOpen,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChannelMenu } from "./channel-menu";
import { ChannelDialog, type ChannelDraft } from "./channel-dialog";
import { DashboardWidgets } from "./dashboard-widgets";
import type { ChannelGroup, Channel } from "@/lib/channels";
import { useServers } from "@/lib/server-context";

const KIND_ICONS = {
  home: Home,
  chat: Hash,
  services: Server,
  approvals: CheckSquare,
  activity: Activity,
  sessions: MessageSquare,
  decisions: Gavel,
  announcements: Megaphone,
  knowledge: BookOpen,
} as const;

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  fuchsia: "bg-fuchsia-400",
};

export function ChannelList() {
  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "Finished projects": true,
    "Finished Clients": true, // legacy
  });
  const [query, setQuery] = useState("");
  const [creatingInGroup, setCreatingInGroup] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [menu, setMenu] = useState<{ channel: Channel; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<Channel | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { servers, currentId } = useServers();
  const currentServer = servers.find((s) => s.id === currentId);

  const refresh = useCallback(() => {
    fetch(`/api/channels?serverId=${currentId}`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []));
  }, [currentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The War Room renders the Home channel via the DashboardWidgets section,
  // so suppress the "Home" group from the channel list on that server.
  const sourceGroups =
    currentServer?.name === "The War Room"
      ? groups.filter((g) => g.label !== "Home")
      : groups;

  const filtered = query
    ? sourceGroups
        .map((g) => ({
          ...g,
          channels: g.channels.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase()),
          ),
        }))
        .filter((g) => g.channels.length > 0)
    : sourceGroups;

  const createChannel = async (
    groupLabel: string,
    draft: ChannelDraft,
  ): Promise<void> => {
    const r = await fetch("/api/channels/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "channel",
        name: draft.name,
        groupLabel,
        serverId: currentId,
        isPrivate: draft.isPrivate,
        projectPath: draft.projectPath || undefined,
        description: draft.description || undefined,
      }),
    });
    if (r.ok) {
      const data = (await r.json()) as { channel: { slug: string } };
      setCreatingInGroup(null);
      await refresh();
      router.push(`/c/user/${data.channel.slug}`);
    }
  };

  const saveChannelEdits = async (channel: Channel, draft: ChannelDraft): Promise<void> => {
    const isUser = channel.userCreated === true;
    const payload: Record<string, unknown> = {
      channelId: channel.id,
      isPrivate: draft.isPrivate,
      projectPath: draft.projectPath || null,
      description: draft.description || null,
    };
    if (isUser && draft.name && draft.name !== channel.name) payload.name = draft.name;
    await fetch("/api/channels/create", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditing(null);
    refresh();
  };

  const toggleChannelPrivacy = async (channel: Channel) => {
    // Optimistic: flip locally first
    const prev = groups;
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        channels: g.channels.map((c) =>
          c.id === channel.id ? { ...c, isPrivate: !c.isPrivate } : c,
        ),
      })),
    );
    const r = await fetch("/api/channels/create", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, isPrivate: !channel.isPrivate }),
    });
    if (!r.ok) setGroups(prev);
  };

  const createGroup = async (label: string) => {
    // Optimistic: add empty group locally
    setCreatingGroup(false);
    setGroups((cur) => [...cur, { label, channels: [] }]);
    const r = await fetch("/api/channels/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "group", name: label, serverId: currentId }),
    });
    if (r.ok) {
      refresh();
    } else {
      // Revert if failed
      setGroups((cur) => cur.filter((g) => g.label !== label));
    }
  };

  const deleteGroup = async (label: string) => {
    if (!confirm(`Delete category "${label}"? Channels inside will be ungrouped.`)) return;
    const prev = groups;
    setGroups((cur) => cur.filter((g) => g.label !== label));
    const r = await fetch("/api/channels/create", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "group", label, serverId: currentId }),
    });
    if (!r.ok) setGroups(prev);
    else refresh();
  };

  const deleteChannel = async (slug: string) => {
    const channelId = `user/${slug}`;
    const prev = groups;
    // Optimistic: remove immediately
    setGroups((cur) =>
      cur
        .map((g) => ({ ...g, channels: g.channels.filter((c) => c.id !== channelId) }))
        .filter((g) => g.channels.length > 0 || !g.label),
    );
    const r = await fetch("/api/channels/create", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "channel", slug }),
    });
    if (!r.ok) setGroups(prev);
    else refresh();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);

    if (a.startsWith("group:") && o.startsWith("group:")) {
      const oldIdx = filtered.findIndex((g) => `group:${g.label}` === a);
      const newIdx = filtered.findIndex((g) => `group:${g.label}` === o);
      if (oldIdx < 0 || newIdx < 0) return;
      const next = arrayMove(filtered, oldIdx, newIdx);
      setGroups(next);
      fetch("/api/channels/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "group",
          serverId: currentId,
          items: next.map((g, i) => ({ label: g.label, position: i })),
        }),
      });
      return;
    }

    if (a.startsWith("channel:") && o.startsWith("channel:")) {
      const aId = a.slice("channel:".length);
      const oId = o.slice("channel:".length);
      const gIdx = filtered.findIndex((g) => g.channels.some((c) => c.id === aId));
      if (gIdx < 0) return;
      const group = filtered[gIdx];
      const oldIdx = group.channels.findIndex((c) => c.id === aId);
      const newIdx = group.channels.findIndex((c) => c.id === oId);
      if (newIdx < 0) return;
      const newChannels = arrayMove(group.channels, oldIdx, newIdx);
      const next = [...filtered];
      next[gIdx] = { ...group, channels: newChannels };
      setGroups(next);
      fetch("/api/channels/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "channel",
          serverId: currentId,
          items: newChannels.map((c, i) => ({ channelId: c.id, position: i })),
        }),
      });
    }
  };

  return (
    <aside className="w-[216px] shrink-0 bg-neutral-950 border-r border-neutral-900 flex flex-col">
      <div className="px-4 py-4 border-b border-neutral-900">
        <div className="text-base font-semibold tracking-tight">
          {currentServer?.name ?? "Loading…"}
        </div>
        <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">
          {describeServer(currentServer)}
        </div>
      </div>
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md text-xs pl-7 pr-2 py-1.5 focus:outline-none focus:border-neutral-700 placeholder:text-neutral-600"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {currentServer?.name === "The War Room" && <DashboardWidgets />}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filtered.map((g) => `group:${g.label}`)}
            strategy={verticalListSortingStrategy}
          >
            {filtered.map((g) => {
              const isCol = collapsed[g.label];
              return (
                <SortableGroup key={g.label} label={g.label}>
                  <div className="flex items-center gap-1 px-3 group">
                    <button
                      onClick={() => setCollapsed({ ...collapsed, [g.label]: !isCol })}
                      className="flex items-center gap-1 py-1 text-xs uppercase tracking-wider font-semibold text-neutral-500 hover:text-neutral-300 flex-1"
                    >
                      {isCol ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      <span>{g.label}</span>
                      <span className="ml-auto text-neutral-700">{g.channels.length}</span>
                    </button>
                    <button
                      title={`Create channel in ${g.label}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setCollapsed({ ...collapsed, [g.label]: false });
                        setCreatingInGroup(g.label);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-300 p-0.5"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {g.userCreated && (
                      <button
                        title={`Delete category "${g.label}"`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => deleteGroup(g.label)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {!isCol && (
                    <SortableContext
                      items={g.channels.map((c) => `channel:${c.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col">
                        {g.channels.map((c) => (
                          <SortableChannelRow
                            key={c.id}
                            channel={c}
                            active={pathname === `/c/${c.id}`}
                            onOpenMenu={(e) => {
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenu({ channel: c, x: rect.right + 4, y: rect.top });
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setMenu({ channel: c, x: e.clientX, y: e.clientY });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </SortableGroup>
              );
            })}
          </SortableContext>
        </DndContext>

        {creatingGroup && (
          <div className="px-3 mt-2">
            <InlineCreate
              placeholder="New category"
              onSubmit={createGroup}
              onCancel={() => setCreatingGroup(false)}
            />
          </div>
        )}
      </div>

      {menu && (
        <ChannelMenu
          channel={menu.channel}
          anchor={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditing(menu.channel);
            setMenu(null);
          }}
          onTogglePrivacy={() => toggleChannelPrivacy(menu.channel)}
          onDelete={
            menu.channel.userCreated
              ? () => deleteChannel(menu.channel.id.replace(/^user\//, ""))
              : undefined
          }
        />
      )}

      {creatingInGroup && (
        <ChannelDialog
          mode="create"
          groupLabel={creatingInGroup}
          serverName={currentServer?.name}
          onSave={(draft) => createChannel(creatingInGroup, draft)}
          onClose={() => setCreatingInGroup(null)}
        />
      )}

      {editing && (
        <ChannelDialog
          mode="edit"
          serverName={currentServer?.name}
          initial={{
            name: editing.name,
            isPrivate: !!editing.isPrivate,
            projectPath: editing.projectPath ?? "",
            description: editing.description ?? "",
          }}
          onSave={(draft) => saveChannelEdits(editing, draft)}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="px-2 py-2 border-t border-neutral-900 flex items-center gap-1">
        <button
          onClick={() => setCreatingGroup(true)}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 rounded-md transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New category
        </button>
      </div>
    </aside>
  );
}

function InlineCreate({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="mx-2 my-1 flex items-center gap-1">
      <Hash className="w-3.5 h-3.5 text-neutral-600 ml-1" />
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) onSubmit(v.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-neutral-900 border border-neutral-800 rounded text-xs px-2 py-1 focus:outline-none focus:border-neutral-700"
      />
      <button onClick={onCancel} className="p-1 text-neutral-600 hover:text-neutral-300">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}


type ServerLike = { name: string; is_default: number } | undefined;

function describeServer(s: ServerLike): string {
  if (!s) return "";
  if (s.name === "The War Room") return "Shared team workspace";
  if (s.is_default) return `${s.name} · your personal workspace`;
  const m = s.name.match(/^(.+?)-Brain$/i);
  if (m) return `${m[1]}'s personal workspace`;
  return `${s.name} · personal workspace`;
}

function SortableGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group:${label}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2"
    >
      {children}
    </div>
  );
}

function SortableChannelRow(props: {
  channel: Channel;
  active: boolean;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `channel:${props.channel.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ChannelRow {...props} />
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onOpenMenu,
  onContextMenu,
}: {
  channel: Channel;
  active: boolean;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const fallback = KIND_ICONS[channel.kind] ?? Hash;
  const Icon = channel.isPrivate ? Lock : fallback;
  return (
    <div
      onContextMenu={onContextMenu}
      className={`mx-2 px-2 py-1 rounded-md flex items-center gap-2 text-sm transition-colors group ${
        active
          ? "bg-white/[0.08] text-neutral-50"
          : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
      } ${channel.archived ? "opacity-50" : ""}`}
    >
      <Link href={`/c/${channel.id}`} className="flex items-center gap-2 flex-1 min-w-0">
        <Icon
          className={`w-3.5 h-3.5 shrink-0 ${
            channel.isPrivate ? "text-amber-300" : "text-neutral-500 group-hover:text-neutral-400"
          }`}
        />
        <span className="truncate flex-1">{channel.name}</span>
      </Link>
      {channel.badge === "live" && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            ACCENT_DOT[channel.accent ?? "emerald"] ?? "bg-emerald-400"
          } animate-pulse`}
        />
      )}
      {channel.badge === "adhoc" && (
        <span className="text-[9px] text-neutral-600 uppercase tracking-wider">adhoc</span>
      )}
      <button
        onClick={onOpenMenu}
        className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded p-0.5"
        title="Channel options (or right-click)"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
