"use client";

import { Plus, Sparkles, Settings, Cloud, X } from "lucide-react";
import { SettingsModal, type SettingsTab } from "@/components/settings-modal";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useServers, serverLandingPath, type ServerRow } from "@/lib/server-context";

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
    </div>
  );
}

function ServerIcon({
  server,
  active,
  onClick,
}: {
  server: ServerRow;
  active: boolean;
  onClick: () => void;
}) {
  // The canonical War Room server is always rendered with its purple
  // brand wrapper + SVG mark, regardless of whatever color the row carries
  // in the database. Forkers can rename or recolor everything else, but the
  // shared War Room emblem stays consistent across every install.
  const isWarRoom = isWarRoomServer(server);
  const palette = isWarRoom
    ? COLOR_MAP.violet
    : COLOR_MAP[server.color] ?? COLOR_MAP.amber;
  return (
    <button
      onClick={onClick}
      title={server.name}
      className="relative group"
    >
      {active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-10 bg-white rounded-r-full transition-all" />
      )}
      {!active && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-2 bg-neutral-700 rounded-r-full group-hover:h-5 transition-all" />
      )}
      <div
        className={`w-11 h-11 rounded-full bg-gradient-to-br border flex items-center justify-center font-semibold transition-all duration-150 ${palette} ${
          active ? "rounded-2xl" : "group-hover:rounded-2xl"
        } ${isEmoji(server.icon) ? "text-2xl" : "text-sm"}`}
      >
        {isWarRoom ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/war-room-logo.svg" alt="" className="w-7 h-7" />
        ) : (
          <span className="leading-none">{server.icon}</span>
        )}
      </div>
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
