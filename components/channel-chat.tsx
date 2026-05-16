"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { ToolCall } from "@/components/tool-call";
import { Send, Square, Slash, Sparkles } from "lucide-react";
import { agentLabelFor, localMember } from "@/lib/team";
import { useIdentityVersion } from "@/lib/use-identity-version";

const LOCAL = localMember();

type HistoryMessage = {
  id: number;
  role: string;
  content: string;
  agent_id: string | null;
  adapter_id: string;
  created_at: number;
};

type AdapterMeta = { id: string; name: string; iconUrl: string | null };

type ChatItem =
  | { kind: "user"; text: string; id: string; ts: number }
  | {
      kind: "assistant";
      text: string;
      id: string;
      streaming: boolean;
      ts: number;
      /** Which adapter generated this turn. Filled from the `adapter`
       *  stream event before any text arrives, or from history rows. */
      agentId: string | null;
    }
  | { kind: "tool"; name: string; input: unknown; id: string; ts: number }
  | { kind: "system"; text: string; id: string; ts: number };

// Stable color per adapter so the same agent always reads the same way
// across the chat. Mirrors the rotation used in the boardroom.
const AGENT_COLOR_ROTATION = ["amber", "sky", "emerald", "violet", "fuchsia", "rose"] as const;
type AgentColor = (typeof AGENT_COLOR_ROTATION)[number];
function colorForAgent(agentId: string | null): AgentColor {
  if (!agentId) return "amber";
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
  return AGENT_COLOR_ROTATION[h % AGENT_COLOR_ROTATION.length];
}
const AGENT_PALETTE: Record<AgentColor, { ring: string; chip: string; name: string; avatar: string }> = {
  amber: {
    ring: "from-amber-500/30 to-amber-700/20 border-amber-500/40",
    chip: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    name: "text-amber-300",
    avatar: "text-amber-200",
  },
  sky: {
    ring: "from-sky-500/30 to-sky-700/20 border-sky-500/40",
    chip: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    name: "text-sky-300",
    avatar: "text-sky-200",
  },
  emerald: {
    ring: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    name: "text-emerald-300",
    avatar: "text-emerald-200",
  },
  violet: {
    ring: "from-violet-500/30 to-violet-700/20 border-violet-500/40",
    chip: "bg-violet-500/15 text-violet-300 border-violet-500/40",
    name: "text-violet-300",
    avatar: "text-violet-200",
  },
  fuchsia: {
    ring: "from-fuchsia-500/30 to-fuchsia-700/20 border-fuchsia-500/40",
    chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    name: "text-fuchsia-300",
    avatar: "text-fuchsia-200",
  },
  rose: {
    ring: "from-rose-500/30 to-rose-700/20 border-rose-500/40",
    chip: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    name: "text-rose-300",
    avatar: "text-rose-200",
  },
};

export function ChannelChat({
  channelId,
  channelName,
  projectPath,
  description,
}: {
  channelId?: string;
  channelName: string;
  projectPath: string;
  description?: string;
}) {
  // Re-render when the user changes their display name in the wizard so
  // both the message author label and the avatar initial stay current.
  useIdentityVersion();
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Adapter id → meta lookup, used to label + brand assistant bubbles.
  const adapterMap = useMemo(() => {
    const m = new Map<string, AdapterMeta>();
    for (const a of adapters) m.set(a.id, a);
    return m;
  }, [adapters]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { adapters: AdapterMeta[] }) => setAdapters(d.adapters ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingHistory(true);
    fetch(`/api/chat/history?projectPath=${encodeURIComponent(projectPath)}`)
      .then((r) => r.json())
      .then((d: { messages: HistoryMessage[] }) => {
        setItems(
          (d.messages ?? []).map((m, i) =>
            m.role === "user"
              ? { kind: "user", text: m.content, id: `h-${i}`, ts: m.created_at }
              : {
                  kind: "assistant",
                  text: m.content,
                  id: `h-${i}`,
                  streaming: false,
                  ts: m.created_at,
                  // Prefer the explicit agent_id stamped on the row; fall
                  // back to the session's adapter (covers messages written
                  // before agent_id existed).
                  agentId: m.agent_id ?? m.adapter_id ?? null,
                },
          ),
        );
      })
      .finally(() => setLoadingHistory(false));
  }, [projectPath]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items]);

  const send = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const prompt = input;
    setInput("");
    const now = Date.now();
    const userId = `u-${now}`;
    const asstId = `a-${now}`;
    setItems((cur) => [
      ...cur,
      { kind: "user", text: prompt, id: userId, ts: now },
      { kind: "assistant", text: "", id: asstId, streaming: true, ts: now, agentId: null },
    ]);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, prompt, channelId }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            applyEvent(evt, asstId);
          } catch {}
        }
      }
    } catch (e) {
      setItems((cur) => [
        ...cur,
        {
          kind: "system",
          text: `Error: ${e instanceof Error ? e.message : String(e)}`,
          id: `e-${Date.now()}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setItems((cur) =>
        cur.map((it) =>
          it.kind === "assistant" && it.id === asstId ? { ...it, streaming: false } : it,
        ),
      );
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, projectPath, streaming, channelId]);

  function applyEvent(evt: { type: string } & Record<string, unknown>, asstId: string) {
    switch (evt.type) {
      case "text_delta":
        setItems((cur) =>
          cur.map((it) =>
            it.kind === "assistant" && it.id === asstId
              ? { ...it, text: it.text + (evt.text as string) }
              : it,
          ),
        );
        break;
      case "tool_use":
        setItems((cur) => [
          ...cur,
          {
            kind: "tool",
            name: String(evt.name ?? "tool"),
            input: evt.input,
            id: `t-${evt.id ?? Date.now()}`,
            ts: Date.now(),
          },
        ]);
        break;
      case "session_id":
        // Per-(project, adapter) session id is server-side state now; the
        // client doesn't need to track it.
        break;
      case "adapter":
        setItems((cur) =>
          cur.map((it) =>
            it.kind === "assistant" && it.id === asstId
              ? { ...it, agentId: String(evt.adapterId) }
              : it,
          ),
        );
        break;
      case "system": {
        // The server emits a system event when a pinned framework can't
        // be resolved (file deleted, typo, presets dir missing). Surface
        // it inline so the user knows their channel's primary lost its
        // framework, instead of silently running raw-model behavior.
        const sub = String(evt.subtype ?? "");
        if (sub === "framework_missing") {
          const payload = (evt.payload ?? {}) as { frameworkId?: string };
          const fwId = payload.frameworkId ?? "(unknown)";
          setItems((cur) => [
            ...cur,
            {
              kind: "system",
              text: `Framework "${fwId}" not found in presets/frameworks/. Falling back to no framework for this turn. Pick another in the AI chip popover.`,
              id: `fw-${Date.now()}`,
              ts: Date.now(),
            },
          ]);
        }
        break;
      }
      case "error":
        setItems((cur) => [
          ...cur,
          { kind: "system", text: `Error: ${evt.message}`, id: `e-${Date.now()}`, ts: Date.now() },
        ]);
        break;
    }
  }

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {loadingHistory ? (
          <ChatSkeleton />
        ) : items.length === 0 ? (
          <Welcome
            channelName={channelName}
            projectPath={projectPath}
            description={description}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((it, i) => (
              <ChatMessage
                key={it.id}
                item={it}
                prev={items[i - 1]}
                adapterMap={adapterMap}
              />
            ))}
          </div>
        )}
      </div>
      {items.length === 0 && !loadingHistory && (
        <FirstChatHint
          projectPath={projectPath}
          onUse={(text) => setInput(text)}
        />
      )}
      <Composer
        value={input}
        onChange={setInput}
        onSend={send}
        onStop={stop}
        streaming={streaming}
        channelName={channelName}
        sessionLive={false}
      />
    </div>
  );
}

function ChatSkeleton() {
  const widths = [70, 45, 65, 40, 60];
  return (
    <div className="flex flex-col gap-5 py-4 animate-pulse">
      {widths.map((w, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-neutral-900 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="h-3 w-20 bg-neutral-800 rounded" />
              <div className="h-3 w-12 bg-neutral-900 rounded" />
            </div>
            <div className="h-3 bg-neutral-800/70 rounded" style={{ width: `${w}%` }} />
            {i % 2 === 0 && (
              <div className="h-3 bg-neutral-900 rounded" style={{ width: `${w - 15}%` }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Welcome({
  channelName,
  projectPath,
  description,
}: {
  channelName: string;
  projectPath: string;
  description?: string;
}) {
  return (
    <div className="py-6 mb-2 flex items-start gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/war-bit/friendly.png"
        alt=""
        width={96}
        height={96}
        className="w-20 h-20 [image-rendering:pixelated] shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-semibold mb-1">Welcome to #{channelName}.</div>
        {description ? (
          <div className="text-sm text-neutral-300 mb-3 max-w-2xl">{description}</div>
        ) : (
          <div className="text-sm text-neutral-500 mb-3">
            This is the start of the{" "}
            <span className="text-neutral-300 font-medium">#{channelName}</span> channel.
          </div>
        )}
        <div className="text-xs text-neutral-500 flex items-center gap-2">
          <code className="text-neutral-400">📍 {projectPath}</code>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({
  item,
  prev,
  adapterMap,
}: {
  item: ChatItem;
  prev?: ChatItem;
  adapterMap: Map<string, AdapterMeta>;
}) {
  if (item.kind === "system") {
    return (
      <div className="text-xs text-amber-400/80 border-l-2 border-amber-900/50 pl-3 py-1 ml-12 my-2">
        {item.text}
      </div>
    );
  }
  if (item.kind === "tool") {
    return (
      <div className="ml-12 my-1">
        <ToolCall name={item.name} input={item.input} />
      </div>
    );
  }
  const isUser = item.kind === "user";
  // "Same author" now means same kind AND, for assistant turns, the same
  // agent — so a Claude bubble followed by a Gemini bubble re-renders the
  // header instead of pretending it's one continuous reply.
  const sameAuthor =
    prev &&
    (prev.kind === "user") === isUser &&
    item.ts - (prev.ts ?? 0) < 5 * 60 * 1000 &&
    (isUser ||
      (prev.kind === "assistant" &&
        item.kind === "assistant" &&
        prev.agentId === item.agentId));

  const agentId = item.kind === "assistant" ? item.agentId : null;
  const palette = AGENT_PALETTE[colorForAgent(agentId)];
  const adapter = agentId ? adapterMap.get(agentId) : null;
  const agentName = adapter?.name ?? agentId ?? "Agent";

  return (
    <div className={`flex gap-3 ${sameAuthor ? "mt-0.5" : "mt-4"} group hover:bg-neutral-900/30 rounded -mx-2 px-2 py-0.5`}>
      <div className="w-9 shrink-0">
        {!sameAuthor && (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border bg-gradient-to-br ${
              isUser
                ? "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200"
                : `${palette.ring} ${palette.avatar}`
            }`}
          >
            {isUser ? (
              LOCAL.name[0]
            ) : adapter?.iconUrl ? (
              // Brand mark for the adapter that produced this turn. The
              // SVG is monochrome and inherits the palette text color.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={adapter.iconUrl} alt="" className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!sameAuthor && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className={`text-sm font-semibold ${
                isUser ? "text-sky-300" : palette.name
              }`}
            >
              {isUser ? LOCAL.name : agentName}
            </span>
            {!isUser && (
              <span
                className={`text-[9px] uppercase tracking-wider px-1 py-0.5 rounded border ${palette.chip}`}
                title={agentId ?? "agent"}
              >
                AI
              </span>
            )}
            <span className="text-[10px] text-neutral-600">{formatTime(item.ts)}</span>
          </div>
        )}
        {item.kind === "user" ? (
          <div className="text-sm text-neutral-200 whitespace-pre-wrap">{item.text}</div>
        ) : item.text ? (
          <Markdown>{item.text}</Markdown>
        ) : (
          <Dots />
        )}
        {item.kind === "assistant" && item.streaming && item.text && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-amber-400/70 animate-pulse align-middle rounded-sm" />
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div className="flex items-center gap-1.5 text-neutral-500 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse" />
      <span
        className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

// One-time prompt nudge that appears above the composer when a chat
// channel has zero messages. Goes away the instant the user sends
// anything because items.length stops being 0. No localStorage. The
// data state IS the dismissal signal, which means it correctly
// reappears if the user wipes history and walks back in.
function FirstChatHint({
  projectPath,
  onUse,
}: {
  projectPath: string;
  onUse: (text: string) => void;
}) {
  const folder = projectPath.split(/[\\/]+/).filter(Boolean).pop() ?? "this folder";
  const agent = agentLabelFor(localMember());
  const suggestion = `@${agent} what's in ${folder}?`;
  return (
    <div className="px-6 pt-3 pb-1">
      <div className="flex items-center gap-3 text-xs text-neutral-500 border border-neutral-800/70 rounded-lg bg-neutral-900/30 px-3 py-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          New here? Try{" "}
          <code className="text-neutral-300 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
            {suggestion}
          </code>{" "}
          to see what your agent can do.
        </span>
        <button
          onClick={() => onUse(suggestion)}
          className="shrink-0 text-amber-300 hover:text-amber-200 underline underline-offset-2"
        >
          Use this
        </button>
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  channelName,
  sessionLive,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  channelName: string;
  sessionLive: boolean;
}) {
  return (
    <div className="relative bg-neutral-950 px-6 py-3">
      <span aria-hidden className="hairline-h top" />
      <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 focus-within:border-neutral-700 transition-colors">
        <button
          title="Slash commands (coming soon)"
          className="w-8 h-8 shrink-0 rounded-md hover:bg-neutral-800 text-neutral-500 flex items-center justify-center"
        >
          <Slash className="w-4 h-4" />
        </button>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={streaming}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-neutral-600 py-1.5 max-h-40"
        />
        {streaming ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 h-8 text-xs rounded-md border border-red-900/60 bg-red-950/40 text-red-200 hover:bg-red-950"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 h-8 text-xs rounded-md bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        )}
      </div>
      <div className="text-[10px] text-neutral-600 mt-1.5 px-1 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${sessionLive ? "bg-emerald-500" : "bg-amber-500"}`} />
        {sessionLive ? "session live · same brain as VS Code" : "new session on send"}
        <span className="ml-auto">Enter to send · Shift+Enter for newline</span>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
