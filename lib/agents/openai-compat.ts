// Shared sender for any OpenAI-Chat-Completions-compatible API.
// Used directly by openai-api, grok-api, and openai-compat-api adapters,
// since they all speak the same wire protocol.

import { consumeSse } from "./anthropic-api";
import type { SendOptions } from "./types";

export type OpenAiCompatConfig = {
  baseUrl: string; // e.g. https://api.openai.com/v1
  apiKey: string;
  model: string;
  /** Extra headers (e.g. some providers want x-org-id). */
  extraHeaders?: Record<string, string>;
  /** Display label for error messages. */
  label: string;
};

export async function sendOpenAiCompat(
  cfg: OpenAiCompatConfig,
  opts: SendOptions,
): Promise<void> {
  const { prompt, onEvent, signal } = opts;
  if (!cfg.apiKey) {
    onEvent({ type: "error", message: `${cfg.label} API key not set` });
    onEvent({ type: "done", exitCode: -1 });
    return;
  }
  if (!cfg.baseUrl) {
    onEvent({ type: "error", message: `${cfg.label} base URL not set` });
    onEvent({ type: "done", exitCode: -1 });
    return;
  }
  try {
    const r = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(cfg.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!r.ok || !r.body) {
      const body = await r.text().catch(() => "");
      onEvent({
        type: "error",
        message: `${cfg.label} ${r.status}: ${body.slice(0, 200)}`,
      });
      onEvent({ type: "done", exitCode: -1 });
      return;
    }
    await consumeSse(r.body, (data) => {
      try {
        const evt = JSON.parse(data);
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          onEvent({ type: "text_delta", text: delta });
        }
      } catch {}
    });
    onEvent({ type: "done", exitCode: 0 });
  } catch (e) {
    onEvent({ type: "error", message: e instanceof Error ? e.message : String(e) });
    onEvent({ type: "done", exitCode: -1 });
  }
}
