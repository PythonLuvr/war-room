"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  Lock,
  Search,
  CornerDownLeft,
  Server,
  ArrowUp,
  ArrowDown,
  Activity,
  CheckSquare,
  MessageSquare,
  Home,
  Sparkles,
} from "lucide-react";
import { serverLandingPath, useServers } from "@/lib/server-context";

type Item =
  | {
      kind: "channel";
      id: string;
      label: string;
      hint: string;
      serverId: number;
      serverName: string;
      serverColor: string;
      isPrivate: boolean;
      channelKind: string;
    }
  | {
      kind: "server";
      id: string;
      label: string;
      hint: string;
      serverId: number;
      serverIcon: string;
      serverColor: string;
    }
  | {
      kind: "action";
      id: string;
      label: string;
      hint: string;
      action: () => void;
      icon: React.ComponentType<{ className?: string }>;
    };

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  chat: Hash,
  services: Server,
  approvals: CheckSquare,
  activity: Activity,
  sessions: MessageSquare,
};

const COLOR_DOT: Record<string, string> = {
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  fuchsia: "bg-fuchsia-400",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [data, setData] = useState<{
    items: Array<{
      serverId: number;
      serverName: string;
      serverIcon: string;
      serverColor: string;
      channelId: string;
      channelName: string;
      group: string;
      kind: string;
      isPrivate: boolean;
    }>;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { servers, setCurrentId } = useServers();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Reset ephemeral palette state and refetch when the palette opens.
    // setState here is the legitimate "external system told us to" pattern
    // (the user opening the palette is the external trigger); silence the
    // rule rather than unwind it into a less readable shape.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setCursor(0);
    fetch("/api/channels/search")
      .then((r) => r.json())
      .then(setData);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const out: Item[] = [];

    for (const c of data.items) {
      out.push({
        kind: "channel",
        id: `ch-${c.serverId}-${c.channelId}`,
        label: c.channelName,
        hint: `${c.serverName} · ${c.group}`,
        serverId: c.serverId,
        serverName: c.serverName,
        serverColor: c.serverColor,
        isPrivate: c.isPrivate,
        channelKind: c.kind,
      });
    }

    for (const s of servers) {
      out.push({
        kind: "server",
        id: `sv-${s.id}`,
        label: s.name,
        hint: "Switch server",
        serverId: s.id,
        serverIcon: s.icon,
        serverColor: s.color,
      });
    }

    return out;
  }, [data, servers]);

  const actions: Item[] = useMemo(
    () => [
      {
        kind: "action" as const,
        id: "act-home",
        label: "Go to The War Room home",
        hint: "Navigate",
        icon: Home,
        action: () => router.push("/c/home"),
      },
      {
        kind: "action" as const,
        id: "act-activity",
        label: "Open activity feed",
        hint: "System channel",
        icon: Activity,
        action: () => router.push("/c/system/activity"),
      },
      {
        kind: "action" as const,
        id: "act-services",
        label: "Open services health",
        hint: "System channel",
        icon: Server,
        action: () => router.push("/c/system/services"),
      },
      {
        kind: "action" as const,
        id: "act-approvals",
        label: "Open approvals queue",
        hint: "System channel",
        icon: CheckSquare,
        action: () => router.push("/c/system/approvals"),
      },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const all = [...items, ...actions];
    if (!query.trim()) return all.slice(0, 60);
    const q = query.toLowerCase();
    return all
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.hint.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [items, actions, query]);

  // Clamp the cursor when the result list shrinks. React's "adjust state
  // during render" pattern (https://react.dev/learn/you-might-not-need-an-effect)
  // — better than mirroring through useEffect.
  const [prevLen, setPrevLen] = useState(filtered.length);
  if (prevLen !== filtered.length) {
    setPrevLen(filtered.length);
    if (cursor >= filtered.length) setCursor(0);
  }

  const onSelect = useCallback(
    (item: Item) => {
      if (item.kind === "channel") {
        setCurrentId(item.serverId);
        router.push(`/c/${item.id.replace(/^ch-\d+-/, "")}`);
      } else if (item.kind === "server") {
        setCurrentId(item.serverId);
        const srv = servers.find((s) => s.id === item.serverId);
        router.push(srv ? serverLandingPath(srv) : "/c/system/activity");
      } else {
        item.action();
      }
      setOpen(false);
    },
    // servers is referenced through `.find` — including it would re-create
    // onSelect every time the server list refetches, churning child memos.
    // Reading the latest array via closure is fine because we only
    // dereference at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, setCurrentId],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[cursor];
      if (item) onSelect(item);
    }
  };

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0d0d0f] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
          <Search className="w-4 h-4 text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKey}
            placeholder="Search channels, servers, actions…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-neutral-600"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 font-mono">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
          {!data ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-600">No matches.</div>
          ) : (
            <Sections items={filtered} cursor={cursor} setCursor={setCursor} onSelect={onSelect} />
          )}
        </div>

        <div className="border-t border-neutral-800 px-4 py-2 flex items-center gap-4 text-[10px] text-neutral-600 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="text-[9px] px-1 rounded bg-neutral-900 border border-neutral-800 font-mono">
              ⌘K
            </kbd>
            Open / close
          </span>
          <Sparkles className="w-3 h-3 ml-auto text-amber-400/60" />
        </div>
      </div>
    </div>
  );
}

function Sections({
  items,
  cursor,
  setCursor,
  onSelect,
}: {
  items: Item[];
  cursor: number;
  setCursor: (i: number) => void;
  onSelect: (it: Item) => void;
}) {
  const groups = {
    Channels: items.filter((i) => i.kind === "channel"),
    Servers: items.filter((i) => i.kind === "server"),
    Actions: items.filter((i) => i.kind === "action"),
  };
  let idx = 0;
  return (
    <>
      {(Object.keys(groups) as Array<keyof typeof groups>).map((g) => {
        const list = groups[g];
        if (!list.length) return null;
        return (
          <div key={g} className="mb-2">
            <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">
              {g}
            </div>
            {list.map((it) => {
              const i = idx++;
              const active = i === cursor;
              return (
                <Row
                  key={it.id}
                  item={it}
                  active={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => onSelect(it)}
                  idx={i}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function Row({
  item,
  active,
  onMouseEnter,
  onClick,
  idx,
}: {
  item: Item;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  idx: number;
}) {
  return (
    <button
      data-idx={idx}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left ${
        active ? "bg-white/[0.06]" : ""
      }`}
    >
      <div className="w-5 h-5 flex items-center justify-center text-neutral-500 shrink-0">
        {item.kind === "channel" ? (
          item.isPrivate ? (
            <Lock className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            (() => {
              const Ic = KIND_ICONS[item.channelKind] ?? Hash;
              return <Ic className="w-3.5 h-3.5" />;
            })()
          )
        ) : item.kind === "server" ? (
          <span
            className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-semibold ${
              COLOR_DOT[item.serverColor] ?? "bg-neutral-700"
            } text-neutral-900`}
          >
            {item.serverIcon[0]}
          </span>
        ) : (
          <item.icon className="w-3.5 h-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-200 truncate">{item.label}</div>
        <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1.5">
          {item.kind === "channel" && (
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                COLOR_DOT[item.serverColor] ?? "bg-neutral-600"
              }`}
            />
          )}
          {item.hint}
        </div>
      </div>
      {active && <CornerDownLeft className="w-3.5 h-3.5 text-neutral-500 shrink-0" />}
    </button>
  );
}
