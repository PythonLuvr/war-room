"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Send, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { TEAM, agentIdFor, localMember, type TeamMember } from "@/lib/team";

type AgentId = string;

type AgentMeta = {
  id: AgentId;
  name: string;
  human: string;
  color: TeamMember["color"];
  online: boolean;
};

const LOCAL = localMember();

const AGENTS: AgentMeta[] = TEAM.map((m) => ({
  id: agentIdFor(m),
  name: `${m.name}-Agent`,
  human: m.name,
  color: m.color,
  // Only the local member's agent is "online" for routing today. Remote
  // teammates' agents stay offline until the sync server lands.
  online: m.id === LOCAL.id,
}));

const COLOR: Record<TeamMember["color"], { dot: string; chip: string; text: string; bubble: string }> = {
  amber: {
    dot: "bg-amber-400",
    chip: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    text: "text-amber-300",
    bubble: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200",
  },
  sky: {
    dot: "bg-sky-400",
    chip: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    text: "text-sky-300",
    bubble: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200",
  },
  emerald: {
    dot: "bg-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    text: "text-emerald-300",
    bubble: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40 text-emerald-200",
  },
  violet: {
    dot: "bg-violet-400",
    chip: "bg-violet-500/15 text-violet-300 border-violet-500/40",
    text: "text-violet-300",
    bubble: "from-violet-500/30 to-violet-700/20 border-violet-500/40 text-violet-200",
  },
  fuchsia: {
    dot: "bg-fuchsia-400",
    chip: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    text: "text-fuchsia-300",
    bubble: "from-fuchsia-500/30 to-fuchsia-700/20 border-fuchsia-500/40 text-fuchsia-200",
  },
  rose: {
    dot: "bg-rose-400",
    chip: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    text: "text-rose-300",
    bubble: "from-rose-500/30 to-rose-700/20 border-rose-500/40 text-rose-200",
  },
};

const LOCAL_AGENT_ID = agentIdFor(LOCAL);
const AGENT_ID_RE = new RegExp(`@(${AGENTS.map((a) => a.id).join("|")})\\b`, "gi");

type ChatItem =
  | { kind: "user"; id: string; text: string; mentions: AgentId[]; ts: number }
  | { kind: "agent"; id: string; agent: AgentId; text: string; streaming: boolean; ts: number }
  | { kind: "system"; id: string; text: string; ts: number };

export function BoardroomChat() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [busyAgents, setBusyAgents] = useState<Set<AgentId>>(new Set());
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve the local member's primary workspace path (used to spawn the
  // local agent). Falls back to the first project the API returns.
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { projects: Array<{ path: string; label: string; group?: string }> }) => {
        const workspace = d.projects?.find((p) => p.group === "Workspaces") ?? d.projects?.[0];
        if (workspace) setLocalPath(workspace.path);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items]);

  const filteredAgents = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return AGENTS.filter((a) => a.id.includes(q) || a.name.toLowerCase().includes(q));
  }, [mentionQuery]);

  const onInputChange = (v: string) => {
    setInput(v);
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at >= 0) {
      const between = before.slice(at + 1);
      if (!/\s/.test(between)) {
        setMentionOpen(true);
        setMentionQuery(between);
        return;
      }
    }
    setMentionOpen(false);
    setMentionQuery("");
  };

  const insertMention = (agent: AgentId) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? input.length;
    const before = input.slice(0, pos);
    const after = input.slice(pos);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}@${agent} ${after}`;
    setInput(next);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const newPos = at + agent.length + 2;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  };

  const parseMentions = (text: string): AgentId[] => {
    const found = new Set<AgentId>();
    AGENT_ID_RE.lastIndex = 0;
    for (const m of text.matchAll(AGENT_ID_RE)) {
      found.add(m[1].toLowerCase());
    }
    return [...found];
  };

  const streamFromAgent = useCallback(
    async (asstId: string, prompt: string, projectPath: string, agentLabel: string) => {
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath, prompt }),
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
              const evt = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string };
              if (evt.type === "text_delta" && evt.text) {
                setItems((cur) =>
                  cur.map((it) =>
                    it.kind === "agent" && it.id === asstId
                      ? { ...it, text: it.text + evt.text }
                      : it,
                  ),
                );
              } else if (evt.type === "error") {
                setItems((cur) => [
                  ...cur,
                  {
                    kind: "system",
                    id: `e-${Date.now()}`,
                    text: `${agentLabel} error: ${evt.message ?? "unknown"}`,
                    ts: Date.now(),
                  },
                ]);
              }
            } catch {}
          }
        }
      } catch (e) {
        setItems((cur) => [
          ...cur,
          {
            kind: "system",
            id: `e-${Date.now()}`,
            text: `${agentLabel} failed: ${e instanceof Error ? e.message : String(e)}`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setItems((cur) =>
          cur.map((it) =>
            it.kind === "agent" && it.id === asstId ? { ...it, streaming: false } : it,
          ),
        );
        setBusyAgents((cur) => {
          const n = new Set(cur);
          n.delete(LOCAL_AGENT_ID);
          return n;
        });
      }
    },
    [],
  );

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const mentions = parseMentions(text);
    const now = Date.now();
    const userId = `u-${now}`;
    setItems((cur) => [...cur, { kind: "user", id: userId, text, mentions, ts: now }]);
    setInput("");
    setMentionOpen(false);

    for (const agentId of mentions) {
      const meta = AGENTS.find((a) => a.id === agentId);
      if (!meta) continue;
      if (!meta.online) {
        setItems((cur) => [
          ...cur,
          {
            kind: "system",
            id: `s-${Date.now()}-${agentId}`,
            text: `${meta.name} is offline (agent not connected yet).`,
            ts: Date.now(),
          },
        ]);
        continue;
      }
      if (agentId === LOCAL_AGENT_ID) {
        if (!localPath) {
          setItems((cur) => [
            ...cur,
            {
              kind: "system",
              id: `s-${Date.now()}-path`,
              text: `${meta.name} workspace path not resolved yet — try again in a moment.`,
              ts: Date.now(),
            },
          ]);
          continue;
        }
        const asstId = `a-${Date.now()}-${agentId}`;
        setItems((cur) => [
          ...cur,
          { kind: "agent", id: asstId, agent: agentId, text: "", streaming: true, ts: Date.now() },
        ]);
        setBusyAgents((cur) => new Set(cur).add(agentId));
        streamFromAgent(asstId, text, localPath, meta.name);
      }
    }
  }, [input, localPath, streamFromAgent]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && e.key === "Enter" && filteredAgents.length > 0) {
      e.preventDefault();
      insertMention(filteredAgents[0].id);
      return;
    }
    if (mentionOpen && e.key === "Escape") {
      setMentionOpen(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-900/60">
        <AtSign className="w-3 h-3" />
        Boardroom chat
        <span className="text-neutral-700">·</span>
        <span className="text-neutral-600 normal-case tracking-normal">
          mention an agent to talk
        </span>
        <div className="ml-auto flex items-center gap-2">
          {AGENTS.map((a) => (
            <span key={a.id} className="flex items-center gap-1 text-[10px] normal-case tracking-normal">
              <span className={`w-1.5 h-1.5 rounded-full ${a.online ? COLOR[a.color].dot : "bg-neutral-700"}`} />
              <span className={a.online ? COLOR[a.color].text : "text-neutral-600"}>{a.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-[12rem] overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="text-xs text-neutral-600 text-center py-4">
            Empty. Try <code className="text-neutral-400">@{LOCAL_AGENT_ID} what&apos;s on the docket today?</code>
          </div>
        ) : (
          items.map((it) => <ChatRow key={it.id} item={it} />)
        )}
      </div>

      <div className="relative px-4 py-3 border-t border-neutral-900/60">
        {mentionOpen && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 z-20 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden min-w-[220px]">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
              Mention an agent
            </div>
            {filteredAgents.map((a, i) => (
              <button
                key={a.id}
                onClick={() => insertMention(a.id)}
                className={`w-full px-2 py-1.5 flex items-center gap-2 text-left text-sm hover:bg-neutral-800 ${
                  i === 0 ? "bg-neutral-800/50" : ""
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${a.online ? COLOR[a.color].dot : "bg-neutral-700"}`} />
                <span className={COLOR[a.color].text}>@{a.id}</span>
                <span className="text-neutral-500 text-xs ml-auto">
                  {a.online ? a.human : "offline"}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus-within:border-neutral-700">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`@${LOCAL_AGENT_ID}  ·  message the boardroom`}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-neutral-600 py-1 max-h-32"
          />
          <button
            onClick={send}
            disabled={!input.trim() || busyAgents.size > 0}
            className="flex items-center gap-1.5 px-3 h-7 text-xs rounded-md bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatRow({ item }: { item: ChatItem }) {
  if (item.kind === "system") {
    return (
      <div className="text-[11px] text-amber-400/80 border-l-2 border-amber-900/50 pl-2 py-0.5">
        {item.text}
      </div>
    );
  }
  if (item.kind === "user") {
    return (
      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700 flex items-center justify-center text-[11px] font-semibold text-neutral-200 shrink-0">
          E
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-neutral-200">EJ</div>
          <div className="text-sm text-neutral-200 whitespace-pre-wrap">
            {renderWithMentions(item.text)}
          </div>
        </div>
      </div>
    );
  }
  // agent
  const meta = AGENTS.find((a) => a.id === item.agent)!;
  const c = COLOR[meta.color];
  return (
    <div className="flex gap-2">
      <div
        className={`w-7 h-7 rounded-full border bg-gradient-to-br ${c.bubble} flex items-center justify-center shrink-0`}
      >
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-semibold ${c.text}`}>{meta.name}</div>
        <div className="text-sm text-neutral-200">
          {item.text ? <Markdown>{item.text}</Markdown> : <Dots />}
          {item.streaming && item.text && (
            <span className="inline-block w-1 h-3.5 ml-0.5 bg-amber-400/70 animate-pulse align-middle rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

const AGENT_SPLIT_RE = new RegExp(`(@(?:${AGENTS.map((a) => a.id).join("|")})\\b)`, "gi");
const AGENT_MATCH_RE = new RegExp(`^@(${AGENTS.map((a) => a.id).join("|")})$`, "i");

function renderWithMentions(text: string) {
  const parts = text.split(AGENT_SPLIT_RE);
  return parts.map((p, i) => {
    const m = p.match(AGENT_MATCH_RE);
    if (m) {
      const agent = AGENTS.find((a) => a.id === m[1].toLowerCase());
      if (agent) {
        return (
          <span
            key={i}
            className={`px-1 py-0.5 rounded border text-[12px] ${COLOR[agent.color].chip}`}
          >
            {p}
          </span>
        );
      }
    }
    return <span key={i}>{p}</span>;
  });
}

function Dots() {
  return (
    <div className="flex items-center gap-1 py-1">
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
