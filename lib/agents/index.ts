// Agent registry + sendMessage wrapper.
//
// Resolves the configured backend from settings, dispatches to the right
// adapter, and handles cross-cutting concerns: session row in SQLite,
// user/assistant message logging, capturing CLI session ids when available.

import {
  addMessage,
  getChannelOverrideAgent,
  getSession,
  getSetting,
  setClaudeSessionId,
  upsertSession,
  type SessionRow,
} from "../db";
import type { AgentAdapter, SendOptions, StreamEvent } from "./types";
import { claudeCli } from "./claude-cli";
import { codexCli } from "./codex-cli";
import { geminiCli } from "./gemini-cli";
import { customCli } from "./custom-cli";
import { anthropicApi } from "./anthropic-api";
import { openaiApi } from "./openai-api";
import { geminiApi } from "./gemini-api";
import { grokApi } from "./grok-api";
import { openaiCompatApi } from "./openai-compat-api";

export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCli,
  codexCli,
  geminiCli,
  customCli,
  anthropicApi,
  openaiApi,
  geminiApi,
  grokApi,
  openaiCompatApi,
];

const BY_ID = Object.fromEntries(ALL_ADAPTERS.map((a) => [a.id, a]));

export function getAdapter(id: string): AgentAdapter | undefined {
  return BY_ID[id];
}

export function activeAdapterId(): string {
  return getSetting("agent.backend") || "claude-cli";
}

export function activeAdapter(): AgentAdapter {
  return getAdapter(activeAdapterId()) ?? claudeCli;
}

export type SendMessageOptions = Omit<SendOptions, "sessionId"> & {
  /** If false, skip persisting the user/assistant turn to SQLite. */
  recordToDb?: boolean;
  /** Explicit adapter id. Wins over the per-channel override and the global
   *  default. Used by the boardroom when the user @-mentions a specific
   *  agent. */
  backendId?: string;
  /** Channel id to consult for a per-channel agent override. Falls back to
   *  the global default when no override is set. */
  channelId?: string;
};

/** Resolve the adapter id for a given send. Precedence:
 *  explicit backendId > channel override > global default. */
export function resolveAdapterId(opts: { backendId?: string; channelId?: string }): string {
  if (opts.backendId && getAdapter(opts.backendId)) return opts.backendId;
  if (opts.channelId) {
    const pinned = getChannelOverrideAgent(opts.channelId);
    if (pinned && getAdapter(pinned)) return pinned;
  }
  return activeAdapterId();
}

/**
 * High-level entry point used by /api/chat. Wraps the active adapter with
 * SQLite bookkeeping so individual adapters don't have to care about it.
 */
export async function sendMessage(opts: SendMessageOptions): Promise<void> {
  const { projectPath, prompt, onEvent, signal, recordToDb = true } = opts;
  const adapterId = resolveAdapterId({ backendId: opts.backendId, channelId: opts.channelId });
  const adapter = getAdapter(adapterId) ?? activeAdapter();

  // Sessions and history are scoped per (project, adapter), so each agent
  // keeps its own --resume token and its own private conversation thread
  // with the underlying provider. The UI later joins them back into one
  // canonical timeline for display.
  // Tell the client which agent owns this turn before any text starts.
  onEvent({ type: "adapter", adapterId: adapter.id });

  let row: SessionRow | null = null;
  if (recordToDb) {
    row = upsertSession(projectPath, adapter.id);
    addMessage(row.id, "user", prompt, { agentId: null });
  }
  const existing = recordToDb ? getSession(projectPath, adapter.id) : null;
  const sessionId = existing?.claude_session_id ?? null;

  let assistantText = "";
  const wrappedOnEvent = (e: StreamEvent) => {
    if (e.type === "session_id" && row) {
      setClaudeSessionId(row.id, e.sessionId);
    }
    if (e.type === "text_delta") {
      assistantText += e.text;
    }
    onEvent(e);
  };

  await adapter.send({
    projectPath,
    prompt,
    sessionId,
    onEvent: wrappedOnEvent,
    signal,
  });

  if (row && assistantText.trim().length > 0) {
    addMessage(row.id, "assistant", assistantText, { agentId: adapter.id });
  }
}

export type { StreamEvent, SendOptions, AgentAdapter } from "./types";
