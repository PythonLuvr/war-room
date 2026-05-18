import { getSetting } from "../db";
import { sendOpenAiCompat } from "./openai-compat";
import type { AgentAdapter, SendOptions } from "./types";

const DEFAULT_MODEL = "gpt-5";

export const openaiApi: AgentAdapter = {
  id: "openai-api",
  iconUrl: "/agent-logos/openai.jpg",
  name: "OpenAI GPT (API · BYOK)",
  kind: "api",
  capabilities: {
    toolUse: false,
    memory: false,
    fileAccess: false,
    notes:
      "Direct API call to OpenAI. Chat only, no tools, no file access. Stateless: each message starts fresh.",
  },
  isConfigured() {
    return !!(getSetting("agent.api.openai.key") || process.env.OPENAI_API_KEY);
  },
  send(opts: SendOptions) {
    return sendOpenAiCompat(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: getSetting("agent.api.openai.key") || process.env.OPENAI_API_KEY || "",
        model: getSetting("agent.api.openai.model") || DEFAULT_MODEL,
        label: "OpenAI",
      },
      opts,
    );
  },
};
