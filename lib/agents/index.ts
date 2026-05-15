// Agent registry + sendMessage wrapper.
//
// Resolves the configured backend from settings, dispatches to the right
// adapter, and handles cross-cutting concerns: session row in SQLite,
// user/assistant message logging, capturing CLI session ids when available.

import {
  addMessage,
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
};

/**
 * High-level entry point used by /api/chat. Wraps the active adapter with
 * SQLite bookkeeping so individual adapters don't have to care about it.
 */
export async function sendMessage(opts: SendMessageOptions): Promise<void> {
  const { projectPath, prompt, onEvent, signal, recordToDb = true } = opts;
  const adapter = activeAdapter();

  let row: SessionRow | null = null;
  if (recordToDb) {
    row = upsertSession(projectPath);
    addMessage(row.id, "user", prompt);
  }
  const existing = recordToDb ? getSession(projectPath) : null;
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
    addMessage(row.id, "assistant", assistantText);
  }
}

export type { StreamEvent, SendOptions, AgentAdapter } from "./types";
