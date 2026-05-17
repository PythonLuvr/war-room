// Anthropic Messages API adapter (BYOK lite mode).
// Direct fetch to api.anthropic.com — no MCP, no tools, no project files.
// Just streams text back. For users who don't have Claude Code installed.

import { getSetting } from "../db";
import type { AgentAdapter, SendOptions, StreamEvent } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function apiKey(): string {
  return getSetting("agent.api.anthropic.key") || process.env.ANTHROPIC_API_KEY || "";
}

function model(): string {
  return getSetting("agent.api.anthropic.model") || DEFAULT_MODEL;
}

export const anthropicApi: AgentAdapter = {
  id: "anthropic-api",
  iconUrl: "/agent-logos/claude.png",
  name: "Claude (API · BYOK)",
  kind: "api",
  capabilities: {
    toolUse: false,
    memory: false,
    fileAccess: false,
    notes:
      "Direct API call to Anthropic. Chat only — no MCP, no skills, no tool use, no project files. Stateless: each message starts fresh.",
  },
  isConfigured() {
    return !!apiKey();
  },
  async send(opts: SendOptions) {
    const { prompt, onEvent, signal } = opts;
    const key = apiKey();
    if (!key) {
      onEvent({ type: "error", message: "Anthropic API key not set" });
      onEvent({ type: "done", exitCode: -1 });
      return;
    }
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model(),
          max_tokens: 4096,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        }),
        signal,
      });
      if (!r.ok || !r.body) {
        const body = await r.text().catch(() => "");
        onEvent({ type: "error", message: `Anthropic ${r.status}: ${body.slice(0, 200)}` });
        onEvent({ type: "done", exitCode: -1 });
        return;
      }
      await consumeSse(r.body, (data) => {
        try {
          const evt = JSON.parse(data);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            onEvent({ type: "text_delta", text: String(evt.delta.text ?? "") });
          } else if (evt.type === "error") {
            onEvent({ type: "error", message: evt.error?.message ?? "anthropic error" });
          }
        } catch {}
      });
      onEvent({ type: "done", exitCode: 0 });
    } catch (e) {
      onEvent({ type: "error", message: e instanceof Error ? e.message : String(e) });
      onEvent({ type: "done", exitCode: -1 });
    }
  },
};

// Shared SSE-line consumer. Emits each `data: ...` payload (minus that
// prefix) as a string for the caller to JSON.parse.
async function consumeSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void) {
  const reader = body.getReader();
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
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          onData(data);
        }
      }
    }
  }
}

export { consumeSse };

// Type-marker so TS knows StreamEvent is used (silences the import-only-type
// check on emit-on-error builds).
export type _StreamEventRef = StreamEvent;
