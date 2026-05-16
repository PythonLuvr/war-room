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
          <AgentChip
            channelId={channel.id}
            pinned={channel.agentBackend ?? null}
            contextMode={channel.contextMode ?? "isolated"}
            contextMessages={channel.contextMessages ?? 15}
            contextChars={channel.contextChars ?? 3000}
            frameworkPin={channel.frameworkPreset ?? null}
          />
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
  contextMode,
  contextMessages,
  contextChars,
  frameworkPin,
}: {
  channelId: string;
  pinned: string | null;
  contextMode: "isolated" | "shared";
  contextMessages: number;
  contextChars: number;
  /** Channel-level framework override. null = inherit global default. */
  frameworkPin: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");
  const [pin, setPin] = useState<string | null>(pinned);
  const [mode, setMode] = useState<"isolated" | "shared">(contextMode);
  const [msgBudget, setMsgBudget] = useState<number>(contextMessages);
  const [charBudget, setCharBudget] = useState<number>(contextChars);
  const [framework, setFramework] = useState<string | null>(frameworkPin);
  const [frameworkList, setFrameworkList] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultFramework, setDefaultFramework] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // React's "state derived from props" pattern: when the parent passes
  // different values (or the user navigates to another channel), reset
  // local state during render. Avoids the setState-in-effect cascade.
  const [prevPinned, setPrevPinned] = useState(pinned);
  const [prevChannelId, setPrevChannelId] = useState(channelId);
  const [prevContextMode, setPrevContextMode] = useState(contextMode);
  const [prevContextMessages, setPrevContextMessages] = useState(contextMessages);
  const [prevContextChars, setPrevContextChars] = useState(contextChars);
  const [prevFramework, setPrevFramework] = useState(frameworkPin);
  if (
    prevPinned !== pinned ||
    prevChannelId !== channelId ||
    prevContextMode !== contextMode ||
    prevContextMessages !== contextMessages ||
    prevContextChars !== contextChars ||
    prevFramework !== frameworkPin
  ) {
    setPrevPinned(pinned);
    setPrevChannelId(channelId);
    setPrevContextMode(contextMode);
    setPrevContextMessages(contextMessages);
    setPrevContextChars(contextChars);
    setPrevFramework(frameworkPin);
    setPin(pinned);
    setMode(contextMode);
    setMsgBudget(contextMessages);
    setCharBudget(contextChars);
    setFramework(frameworkPin);
  }

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AdapterMeta[] }) => {
        setAdapters(d.adapters ?? []);
        setActiveId(d.activeId);
      })
      .catch(() => {});
    // Pull the bundled framework list + global default once for the popover.
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then((d: { frameworks: Array<{ id: string; name: string }>; defaultId: string | null }) => {
        setFrameworkList(d.frameworks ?? []);
        setDefaultFramework(d.defaultId ?? null);
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

  const persistContext = async (
    patch: Partial<{ mode: "isolated" | "shared"; messages: number; chars: number }>,
  ) => {
    try {
      await fetch("/api/channel-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, ...patch }),
      });
    } catch {
      // Best-effort. Picked up on next channel load.
    }
  };

  const persistFramework = async (next: string | null) => {
    setFramework(next);
    try {
      await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, presetId: next }),
      });
    } catch {
      // Best-effort. Picked up on next channel load.
    }
  };

  // Mid-conversation switches surface a confirmation modal explaining
  // that the next turn uses the new framework but existing context
  // stays as-is. The chip skips the modal on initial set (when no
  // framework was previously pinned and global default was implicit).
  const [pendingFw, setPendingFw] = useState<string | null | "__sentinel__">("__sentinel__");
  const requestFrameworkChange = (next: string | null) => {
    if (framework === next) return;
    // First-touch on this channel (no existing pin) — no modal needed.
    if (framework === null && next === null) return;
    setPendingFw(next);
  };
  const confirmFrameworkChange = () => {
    if (pendingFw === "__sentinel__") return;
    void persistFramework(pendingFw);
    setPendingFw("__sentinel__");
  };
  const cancelFrameworkChange = () => setPendingFw("__sentinel__");

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

          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Cross-agent context
          </div>
          <div className="px-3 py-2 flex flex-col gap-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setMode("isolated");
                  void persistContext({ mode: "isolated" });
                }}
                className={`flex-1 px-2 py-1.5 text-[11px] rounded border transition-colors ${
                  mode === "isolated"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                Isolated
              </button>
              <button
                onClick={() => {
                  setMode("shared");
                  void persistContext({ mode: "shared" });
                }}
                className={`flex-1 px-2 py-1.5 text-[11px] rounded border transition-colors ${
                  mode === "shared"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                }`}
              >
                Shared
              </button>
            </div>
            <div className="text-[10px] text-neutral-600 leading-snug">
              <strong className="text-neutral-500">Isolated</strong>: each agent only sees its own
              past replies (default). <strong className="text-neutral-500">Shared</strong>: every
              agent gets the recent cross-agent thread prepended as context, attributed by{" "}
              <code className="text-neutral-500">@handle</code>.
            </div>
            {mode === "shared" && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <BudgetField
                  label="Max messages"
                  value={msgBudget}
                  min={1}
                  max={200}
                  onCommit={(v) => {
                    setMsgBudget(v);
                    void persistContext({ messages: v });
                  }}
                />
                <BudgetField
                  label="Max chars"
                  value={charBudget}
                  min={100}
                  max={50_000}
                  step={100}
                  onCommit={(v) => {
                    setCharBudget(v);
                    void persistContext({ chars: v });
                  }}
                />
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/openwar-logo.svg" alt="" className="w-3 h-3" />
            Agent framework
          </div>
          <div className="px-3 py-2 flex flex-col gap-2">
            <select
              value={framework ?? "__inherit__"}
              onChange={(e) => {
                const v = e.target.value;
                const next = v === "__inherit__" ? null : v;
                requestFrameworkChange(next);
              }}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-700"
            >
              <option value="__inherit__">
                Inherit global default
                {defaultFramework
                  ? ` (${frameworkList.find((f) => f.id === defaultFramework)?.name ?? defaultFramework})`
                  : " (none)"}
              </option>
              <option value="none">None — raw model behavior</option>
              {frameworkList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-neutral-600 leading-snug">
              Framework prepended to every message in this channel as a system preamble. OpenWar
              ships built-in; install more by dropping markdown files in{" "}
              <code className="text-neutral-500">presets/frameworks/</code>.
            </div>
          </div>
        </div>
      )}

      {pendingFw !== "__sentinel__" && (
        <FrameworkSwitchModal
          fromId={framework}
          toId={pendingFw}
          adapters={frameworkList}
          onCancel={cancelFrameworkChange}
          onConfirm={confirmFrameworkChange}
        />
      )}
    </div>
  );
}

function FrameworkSwitchModal({
  fromId,
  toId,
  adapters,
  onCancel,
  onConfirm,
}: {
  fromId: string | null;
  toId: string | null;
  adapters: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = (id: string | null) => {
    if (id === null) return "Inherit global default";
    if (id === "none") return "None — raw model behavior";
    return adapters.find((a) => a.id === id)?.name ?? id;
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);
  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm framework switch"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-lg font-semibold mb-2">Switch framework mid-conversation?</h2>
        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          You&apos;re changing the agent framework from{" "}
          <strong className="text-neutral-200">{label(fromId)}</strong> to{" "}
          <strong className="text-neutral-200">{label(toId)}</strong>. The agent&apos;s next turn
          uses the new framework. Existing context in this channel stays as-is. CLI agents with
          their own session memory will not retroactively re-read prior turns under the new rules.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
          >
            Switch framework
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  // Sync local input when the parent value changes (e.g. switching channels).
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(value));
    const clamped = Math.max(min, Math.min(max, Math.round(n / step) * step));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-neutral-700"
      />
    </label>
  );
}
