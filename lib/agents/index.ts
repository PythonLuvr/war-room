// Agent registry + sendMessage wrapper.
//
// Resolves the configured backend from settings, dispatches to the right
// adapter, and handles cross-cutting concerns: session row in SQLite,
// user/assistant message logging, capturing CLI session ids when available.

import {
  addMessage,
  getChannelContextSettings,
  getChannelOverrideAgent,
  getCrossAgentContext,
  getSession,
  getSetting,
  resolveFrameworkId,
  setClaudeSessionId,
  upsertSession,
  type SessionRow,
} from "../db";
import { buildHandleMap } from "../agent-handles";
import { readFramework } from "../frameworks";
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
import { openclawCli } from "./openclaw-cli";
import { hermesCli } from "./hermes-cli";
import { semaclawCli } from "./semaclaw-cli";

export const ALL_ADAPTERS: AgentAdapter[] = [
  claudeCli,
  codexCli,
  geminiCli,
  openclawCli,
  hermesCli,
  semaclawCli,
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

  // Build the per-turn prompt overlays. Layer order (top to bottom in the
  // text the model sees): framework preamble → cross-agent context →
  // user prompt. Each layer is opt-in per channel; defaults skip them so
  // the existing single-agent flow behaves identically.
  let effectivePrompt = prompt;

  // Cross-agent context: when the channel is in "shared" mode, prepend a
  // per-turn system-message preamble describing what other agents in this
  // channel said recently.
  if (opts.channelId) {
    const ctx = getChannelContextSettings(opts.channelId);
    if (ctx.mode === "shared") {
      const cross = getCrossAgentContext(projectPath, adapter.id, {
        messages: ctx.messages,
        chars: ctx.chars,
      });
      if (cross.length > 0) {
        effectivePrompt = renderSharedContextPrompt(cross, effectivePrompt);
      }
    }
  }

  // Framework overlay: if a framework preset is pinned (per-channel) or
  // set as the global default, prepend its content as the outermost system
  // preamble. The framework wraps the cross-agent block + user prompt so
  // the model reads "behavior rules then channel context then user said X."
  const frameworkId = resolveFrameworkId(opts.channelId);
  if (frameworkId) {
    const text = readFramework(frameworkId);
    if (text) {
      effectivePrompt = renderFrameworkPrompt(text, effectivePrompt);
    } else {
      // Pinned to something the registry can't resolve (file deleted,
      // typo, presets dir missing in a misconfigured build). Tell the
      // client so the UI can surface a one-line toast; the chat still
      // proceeds with no framework rather than 500.
      onEvent({
        type: "system",
        subtype: "framework_missing",
        payload: { frameworkId },
      });
    }
  }

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
    prompt: effectivePrompt,
    sessionId,
    onEvent: wrappedOnEvent,
    signal,
  });

  if (row && assistantText.trim().length > 0) {
    addMessage(row.id, "assistant", assistantText, { agentId: adapter.id });
  }
}

// Wrap the agent framework markdown in a clearly-tagged block so the
// model reads it as "operating instructions" rather than user content.
// Position is outermost — the framework defines how the agent receives
// every other piece of text below it.
function renderFrameworkPrompt(framework: string, body: string): string {
  return [
    "[ AGENT FRAMEWORK — operating instructions for this turn.",
    "  These rules govern how you receive briefs, communicate, and gate",
    "  execution. Apply them to every part of the body below. ]",
    "",
    framework.trim(),
    "",
    "[ /AGENT FRAMEWORK ]",
    "",
    body,
  ].join("\n");
}

// Format the cross-agent preamble consistently across providers. Most
// CLI/API adapters accept any text; framing it as a clearly-tagged
// "SHARED CHANNEL CONTEXT" block keeps the model from confusing other
// agents' replies with its own past output.
function renderSharedContextPrompt(
  cross: ReturnType<typeof getCrossAgentContext>,
  userPrompt: string,
): string {
  // Build a stable handle map so attribution reads as @claude / @openai
  // rather than the bare adapter id. Use the raw ALL_ADAPTERS list (handle
  // building only needs id + kind; works regardless of configured state).
  const handles = new Map(
    buildHandleMap(ALL_ADAPTERS.map((a) => ({ id: a.id, kind: a.kind }))).map(
      (e) => [e.adapterId, e.handle],
    ),
  );
  const lines: string[] = [
    "[ SHARED CHANNEL CONTEXT — recent turns from OTHER agents in this channel.",
    "  Use as background only. Reply as yourself. Don't quote this block back. ]",
    "",
  ];
  for (const m of cross) {
    if (m.role === "user") {
      lines.push(`(user): ${m.content}`);
    } else {
      const handle = handles.get(m.adapterId) ?? m.adapterId;
      lines.push(`(@${handle}): ${m.content}`);
    }
    lines.push("");
  }
  lines.push("[ /SHARED CHANNEL CONTEXT ]");
  lines.push("");
  lines.push(userPrompt);
  return lines.join("\n");
}

export type { StreamEvent, SendOptions, AgentAdapter } from "./types";
