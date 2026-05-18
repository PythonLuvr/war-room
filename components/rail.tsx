"use client";

import { Plus, Settings, Cloud, X, UserPlus } from "lucide-react";
import { SettingsModal, type SettingsTab } from "@/components/settings-modal";
import { InviteModal } from "@/components/invite-modal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useServers, serverLandingPath, type ServerRow } from "@/lib/server-context";
import { UploadButton } from "@/components/upload-button";

const COLOR_MAP: Record<string, string> = {
  amber: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-300",
  sky: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-300",
  emerald: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40 text-emerald-300",
  violet: "from-violet-500/30 to-violet-700/20 border-violet-500/40 text-violet-300",
  rose: "from-rose-500/30 to-rose-700/20 border-rose-500/40 text-rose-300",
  fuchsia: "from-fuchsia-500/30 to-fuchsia-700/20 border-fuchsia-500/40 text-fuchsia-300",
};

const COLOR_PICKS = ["amber", "sky", "emerald", "violet", "rose", "fuchsia"];

function isEmoji(s: string): boolean {
  if (!s) return false;
  return /[\p{Emoji_Presentation}\p{Extended_Pictographic}☀-➿]/u.test(s);
}

function isWarRoomServer(server: ServerRow): boolean {
  // Match the official War Room server: by name, or by the legacy ⚔ icon
  // we used before the SVG existed.
  return /war.?room/i.test(server.name) || server.icon === "⚔" || server.icon === "⚔️";
}

export function Rail() {
  const { servers, currentId, setCurrentId, refresh } = useServers();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ServerRow | null>(null);
  const [inviting, setInviting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<SettingsTab | null>(null);
  const router = useRouter();

  // Cross-component listener: anywhere in the app can dispatch
  // `war-room:open-settings` (with optional detail.tab) to surface the
  // settings modal on the right tab. Used by the welcome banner.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: SettingsTab }>).detail;
      setSettingsOpen(detail?.tab ?? "general");
    };
    window.addEventListener("war-room:open-settings", handler);
    return () => window.removeEventListener("war-room:open-settings", handler);
  }, []);

  const switchTo = (s: ServerRow) => {
    setCurrentId(s.id);
    router.push(serverLandingPath(s));
  };

  return (
    <div className="w-[72px] shrink-0 bg-neutral-950 border-r border-neutral-900 flex flex-col items-center py-3 gap-2 overflow-y-auto">
      {servers.map((s) => (
        <ServerIcon
          key={s.id}
          server={s}
          active={s.id === currentId}
          onClick={() => switchTo(s)}
          onEdit={() => setEditing(s)}
        />
      ))}

      <div className="w-8 h-px bg-neutral-800 my-1" />

      <button
        onClick={() => setCreating(true)}
        title="Create server"
        className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-neutral-400 hover:text-emerald-300 flex items-center justify-center transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>

      <div className="flex-1" />

      <button
        title="Invite teammates"
        onClick={() => setInviting(true)}
        className="w-11 h-11 rounded-full hover:bg-neutral-900 text-neutral-600 hover:text-amber-300 flex items-center justify-center"
      >
        <UserPlus className="w-4 h-4" />
      </button>
      <button
        title="Sync status"
        onClick={() => setSettingsOpen("sync")}
        className="w-11 h-11 rounded-full hover:bg-neutral-900 text-neutral-600 hover:text-neutral-300 flex items-center justify-center"
      >
        <Cloud className="w-4 h-4" />
      </button>
      <button
        title="Settings"
        onClick={() => setSettingsOpen("general")}
        className="w-11 h-11 rounded-full hover:bg-neutral-900 text-neutral-500 hover:text-neutral-300 flex items-center justify-center"
      >
        <Settings className="w-4 h-4" />
      </button>

      {settingsOpen && (
        <SettingsModal initialTab={settingsOpen} onClose={() => setSettingsOpen(null)} />
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} />}

      {creating && (
        <CreateServerModal
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            const r = await fetch("/api/servers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            });
            if (r.ok) {
              const d = (await r.json()) as { server: ServerRow };
              await refresh();
              switchTo(d.server);
              setCreating(false);
            }
          }}
        />
      )}

      {editing && (
        <EditServerModal
          server={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await fetch("/api/servers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: editing.id, ...patch }),
            });
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ServerIcon({
  server,
  active,
  onClick,
  onEdit,
}: {
  server: ServerRow;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
}) {
  // The canonical War Room server is always rendered with its purple
  // brand wrapper + SVG mark, regardless of whatever color the row carries
  // in the database. Forkers can rename or recolor everything else, but the
  // shared War Room emblem stays consistent across every install.
  const isWarRoom = isWarRoomServer(server);
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onEdit) return;
        e.preventDefault();
        onEdit();
      }}
      title={`${server.name} · right-click to edit`}
      className="relative group"
    >
      {active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-10 bg-white rounded-r-full transition-all" />
      )}
      {!active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-700 rounded-r-full group-hover:h-5 transition-all" />
      )}
      {isWarRoom ? (
        <div
          className={`w-11 h-11 rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center transition-all duration-150 ${
            active ? "rounded-2xl" : "group-hover:rounded-2xl"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/war-room-logo.svg" alt="" className="w-full h-full object-cover" />
        </div>
      ) : server.icon_url ? (
        // User-uploaded image fills the chip cleanly, no gradient or
        // colored border.
        <div
          className={`w-11 h-11 rounded-full overflow-hidden bg-neutral-900 transition-all duration-150 ${
            active ? "rounded-2xl" : "group-hover:rounded-2xl"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={server.icon_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        // Fallback: neutral grey + the first letter of the name (or
        // whatever glyph the user picked). Distinguishable across
        // multiple no-image workspaces without rainbow-vomit.
        <div
          className={`w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-semibold text-neutral-300 transition-all duration-150 ${
            active ? "rounded-2xl" : "group-hover:rounded-2xl"
          } ${isEmoji(server.icon) ? "text-2xl" : "text-sm"}`}
        >
          <span className="leading-none">
            {isEmoji(server.icon) ? server.icon : (server.name.trim()[0] ?? "?").toUpperCase()}
          </span>
        </div>
      )}
    </button>
  );
}

function CreateServerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: { name: string; icon: string; color: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("sky");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">Create server</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Servers hold your own channels + categories. Personal or shared.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br border flex items-center justify-center text-2xl font-semibold ${
              COLOR_MAP[color] ?? COLOR_MAP.amber
            }`}
          >
            {icon || (name.trim() ? name.trim().slice(0, 2).toUpperCase() : "?")}
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Server name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 mt-1"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
            Icon (1-2 chars or emoji)
          </label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 4))}
            placeholder="auto"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
          />
        </div>

        <div className="mb-6">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
            Color
          </label>
          <div className="flex gap-2">
            {COLOR_PICKS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg bg-gradient-to-br border ${COLOR_MAP[c]} ${
                  color === c ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0d0d0f]" : ""
                }`}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => onCreate({ name: name.trim(), icon: icon.trim(), color })}
            className="px-4 py-2 text-sm rounded-md bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditServerModal({
  server,
  onClose,
  onSave,
}: {
  server: ServerRow;
  onClose: () => void;
  onSave: (input: { name: string; icon: string; color: string; iconUrl: string | null }) => void | Promise<void>;
}) {
  const [name, setName] = useState(server.name);
  const [icon, setIcon] = useState(server.icon);
  const [color, setColor] = useState(server.color);
  const [iconUrl, setIconUrl] = useState(server.icon_url ?? "");
  const isWarRoom = isWarRoomServer(server);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">Edit server</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Rename, change the icon, or recolor the wrapper.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isWarRoom && (
          <div className="mb-4 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-200/90 leading-relaxed">
            This is the canonical War Room. The brand mark + violet wrapper stay locked so the
            shared dashboard reads the same across every install. Renaming is allowed if you
            want to fork your own.
          </div>
        )}

        <div className="flex items-center gap-4 mb-5">
          {isWarRoom ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-900 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/war-room-logo.svg" alt="" className="w-full h-full object-cover" />
            </div>
          ) : iconUrl ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-2xl font-semibold text-neutral-300">
              {icon || (name.trim() ? name.trim()[0].toUpperCase() : "?")}
            </div>
          )}
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Server name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 mt-1"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
            Workspace image
          </label>
          <div className="flex items-center gap-2">
            <input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://... or click Upload"
              disabled={isWarRoom}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {!isWarRoom && (
              <UploadButton onUploaded={(url) => setIconUrl(url)} />
            )}
            {iconUrl && !isWarRoom && (
              <button
                onClick={() => setIconUrl("")}
                className="text-[11px] text-neutral-500 hover:text-red-300"
                title="Clear image"
              >
                clear
              </button>
            )}
          </div>
          {!isWarRoom && (
            <div className="text-[10px] text-neutral-600 mt-1">
              Paste a URL or upload from your computer. Falls back to the letter glyph below when blank.
            </div>
          )}
        </div>

        <div className="mb-5">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
            Letter glyph (used when no image URL is set)
          </label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 4))}
            placeholder="auto"
            disabled={isWarRoom}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {isWarRoom && (
            <div className="text-[10px] text-neutral-600 mt-1">
              Locked to the War Room mark.
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
            Color
          </label>
          <div className="flex gap-2">
            {COLOR_PICKS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                disabled={isWarRoom}
                className={`w-8 h-8 rounded-lg bg-gradient-to-br border ${COLOR_MAP[c]} ${
                  color === c ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0d0d0f]" : ""
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={c}
              />
            ))}
          </div>
          {isWarRoom && (
            <div className="text-[10px] text-neutral-600 mt-1">
              Locked to violet to match the brand.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => onSave({ name: name.trim(), icon: icon.trim(), color, iconUrl: iconUrl.trim() || null })}
            className="px-4 py-2 text-sm rounded-md bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
