// User-configurable OpenAI-compatible endpoint. Catches everything we don't
// natively support: OpenRouter, Groq, Together, Mistral, DeepSeek, local
// Ollama, custom proxies, etc.

import { getSetting } from "../db";
import { sendOpenAiCompat } from "./openai-compat";
import type { AgentAdapter, SendOptions } from "./types";

export const openaiCompatApi: AgentAdapter = {
  id: "openai-compat-api",
  name: "Custom OpenAI-compatible (API · BYOK)",
  kind: "api",
  capabilities: {
    toolUse: false,
    memory: false,
    fileAccess: false,
    notes:
      "Any provider that speaks the OpenAI Chat Completions protocol. Set base URL, API key, and model name. Works with OpenRouter, Groq, Together, Mistral, DeepSeek, local Ollama (http://localhost:11434/v1), and most others.",
  },
  isConfigured() {
    return !!(
      getSetting("agent.api.openai-compat.key") &&
      getSetting("agent.api.openai-compat.baseUrl") &&
      getSetting("agent.api.openai-compat.model")
    );
  },
  send(opts: SendOptions) {
    return sendOpenAiCompat(
      {
        baseUrl: getSetting("agent.api.openai-compat.baseUrl") || "",
        apiKey: getSetting("agent.api.openai-compat.key") || "",
        model: getSetting("agent.api.openai-compat.model") || "",
        label: "Custom",
      },
      opts,
    );
  },
};
