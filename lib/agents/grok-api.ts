import { getSetting } from "../db";
import { sendOpenAiCompat } from "./openai-compat";
import type { AgentAdapter, SendOptions } from "./types";

// xAI's API is OpenAI-Chat-Completions-compatible at /v1.
const DEFAULT_MODEL = "grok-3";

export const grokApi: AgentAdapter = {
  id: "grok-api",
  iconUrl: "/agent-logos/grok.svg",
  name: "xAI Grok (API · BYOK)",
  kind: "api",
  capabilities: {
    toolUse: false,
    memory: false,
    fileAccess: false,
    notes:
      "Direct API call to xAI. Chat only. Grok doesn't ship a Claude-Code-style CLI, so this is the only way to use it from War Room.",
  },
  isConfigured() {
    return !!(getSetting("agent.api.grok.key") || process.env.XAI_API_KEY);
  },
  send(opts: SendOptions) {
    return sendOpenAiCompat(
      {
        baseUrl: "https://api.x.ai/v1",
        apiKey: getSetting("agent.api.grok.key") || process.env.XAI_API_KEY || "",
        model: getSetting("agent.api.grok.model") || DEFAULT_MODEL,
        label: "xAI",
      },
      opts,
    );
  },
};
