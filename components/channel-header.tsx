"use client";

import { useEffect, useRef, useState } from "react";
import {
  Hash,
  Pin,
  Bell,
  Users,
  Search,
  Lock,
  Paperclip,
  Bot,
  Check,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import type { Channel } from "@/lib/channels";
import { FilesPanel } from "./files-panel";

type AdapterMeta = {
  id: string;
  name: string;
  kind: "cli" | "api";
  isConfigured: boolean;
};

export function ChannelHeader({
  channel,
  onToggleRight,
}: {
  channel: Channel;
  onToggleRight?: () => void;
}) {
  const [filesOpen, setFilesOpen] = useState(false);
  // Only show the agent chip on channels that actually fire chat. Pinning
  // an AI on a system surface (activity, services, approvals…) doesn't do
  // anything because those don't talk to the agent layer.
  const showAgentChip = channel.kind === "chat";

  return (
    <div className="relative h-12 bg-neutral-950 px-5 flex items-center gap-3 sticky top-0 z-10">
      {channel.isPrivate ? (
        <Lock className="w-4 h-4 text-amber-300" />
      ) : (
        <Hash className="w-4 h-4 text-neutral-500" />
      )}
      <div className="text-sm font-medium">{channel.name}</div>
      {channel.isPrivate && (
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          private
        </span>
      )}
      {channel.description && (
        <div className="text-xs text-neutral-400 truncate hidden md:block max-w-md">
          <span className="text-neutral-700">·</span> {channel.description}
        </div>
      )}
      {!channel.description && channel.projectPath && (
        <div className="text-xs text-neutral-500 truncate hidden md:block">
          <span className="text-neutral-700">·</span>{" "}
          <code className="text-neutral-500">{channel.projectPath}</code>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1 text-neutral-500">
        {showAgentChip && (
          <AgentChip channelId={channel.id} pinned={channel.agentBackend ?? null} />
        )}
        <IconBtn title="Files" onClick={() => setFilesOpen(true)}>
          <Paperclip className="w-4 h-4" />
        </IconBtn>
        <IconBtn title="Pinned"><Pin className="w-4 h-4" /></IconBtn>
        <IconBtn title="Notifications"><Bell className="w-4 h-4" /></IconBtn>
        <IconBtn title="Members" onClick={onToggleRight}><Users className="w-4 h-4" /></IconBtn>
        <div className="relative ml-2">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            placeholder="Search"
            className="w-44 bg-neutral-900 border border-neutral-800 rounded-md text-xs pl-7 pr-2 py-1 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>
      <span aria-hidden className="hairline-h bottom" />
      {filesOpen && (
        <FilesPanel
          channelId={channel.id}
          channelName={channel.name}
          onClose={() => setFilesOpen(false)}
        />
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-md hover:bg-neutral-900 hover:text-neutral-300 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

// ─── Agent picker chip ───────────────────────────────────────────────────────
//
// Sits in the right-side action group of the channel header. Shows the
// currently-active backend for this channel (channel pin > global default)
// and opens a popover listing every adapter the user has wired up. Picking
// one writes a per-channel override; "Use default" clears the pin.

function AgentChip({
  channelId,
  pinned,
}: {
  channelId: string;
  pinned: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");
  const [pin, setPin] = useState<string | null>(pinned);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPin(pinned);
  }, [pinned, channelId]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AdapterMeta[] }) => {
        setAdapters(d.adapters ?? []);
        setActiveId(d.activeId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const effectiveId = pin ?? activeId;
  const effective = adapters.find((a) => a.id === effectiveId);
  const label = effective?.name ?? effectiveId;

  const setPinned = async (next: string | null) => {
    setSaving(true);
    setPin(next);
    try {
      await fetch("/api/channel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, backendId: next }),
      });
    } catch {
      // Best-effort. The pin will be re-fetched next time the channel loads.
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const ready = effective?.isConfigured ?? false;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={
          pin
            ? `Primary AI: ${label} · @mention another agent in chat to call them ad-hoc`
            : `No primary set · using global default (${label}) · @mention any agent to override per-turn`
        }
        className={`flex items-center gap-1.5 px-2 h-7 rounded-md border text-[11px] transition-colors ${
          pin
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
        } ${saving ? "opacity-60" : ""}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-neutral-700"}`}
        />
        <Bot className="w-3 h-3" />
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Primary AI for this channel
          </div>
          <button
            onClick={() => setPinned(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-900 ${
              !pin ? "bg-neutral-900/80" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-neutral-200">Use global default</div>
              <div className="text-[10px] text-neutral-500 truncate">
                {adapters.find((a) => a.id === activeId)?.name ?? activeId}
              </div>
            </div>
            {!pin && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          </button>
          <div className="border-t border-neutral-900" />
          <div className="max-h-72 overflow-y-auto">
            {adapters.map((a) => {
              const isPinned = pin === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setPinned(a.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-900 ${
                    isPinned ? "bg-neutral-900/80" : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      a.isConfigured ? "bg-emerald-500" : "bg-neutral-700"
                    }`}
                    title={a.isConfigured ? "Configured" : "Needs setup"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-neutral-200 truncate">{a.name}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                      {a.kind === "cli" ? "CLI bridge" : "API"}
                    </div>
                  </div>
                  {isPinned && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-neutral-900 text-[10px] text-neutral-600 leading-snug">
            The primary handles every message by default in this channel. Other agents stay
            reachable — just <code className="text-neutral-500">@mention</code> them in chat to
            route a single turn elsewhere. Unconfigured agents (grey dot) will fail until you
            set them up under Settings → Agent.
          </div>
        </div>
      )}
    </div>
  );
}
