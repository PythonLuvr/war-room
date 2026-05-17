// Google Gemini API adapter — uses the streamGenerateContent endpoint
// which returns SSE chunks. Different shape from OpenAI's protocol, so it
// doesn't share the openai-compat sender.

import { getSetting } from "../db";
import { consumeSse } from "./anthropic-api";
import type { AgentAdapter, SendOptions } from "./types";

const DEFAULT_MODEL = "gemini-2.5-pro";

function apiKey(): string {
  return getSetting("agent.api.gemini.key") || process.env.GEMINI_API_KEY || "";
}

function model(): string {
  return getSetting("agent.api.gemini.model") || DEFAULT_MODEL;
}

export const geminiApi: AgentAdapter = {
  id: "gemini-api",
  iconUrl: "/agent-logos/gemini.png",
  name: "Google Gemini (API · BYOK)",
  kind: "api",
  capabilities: {
    toolUse: false,
    memory: false,
    fileAccess: false,
    notes: "Direct API call to Google Gemini. Chat only. Stateless.",
  },
  isConfigured() {
    return !!apiKey();
  },
  async send(opts: SendOptions) {
    const { prompt, onEvent, signal } = opts;
    const key = apiKey();
    if (!key) {
      onEvent({ type: "error", message: "Gemini API key not set" });
      onEvent({ type: "done", exitCode: -1 });
      return;
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
        signal,
      });
      if (!r.ok || !r.body) {
        const body = await r.text().catch(() => "");
        onEvent({ type: "error", message: `Gemini ${r.status}: ${body.slice(0, 200)}` });
        onEvent({ type: "done", exitCode: -1 });
        return;
      }
      await consumeSse(r.body, (data) => {
        try {
          const evt = JSON.parse(data);
          const parts = evt.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (typeof p.text === "string" && p.text.length > 0) {
              onEvent({ type: "text_delta", text: p.text });
            }
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
