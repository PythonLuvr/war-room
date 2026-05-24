// AgentAdapter, common contract every backend implements. Lets the chat
// API dispatch to whichever agent the user picked in onboarding (Claude
// Code CLI, OpenAI Codex CLI, raw API call to Anthropic / OpenAI / Gemini /
// Grok, or a custom command / OpenAI-compatible endpoint).
//
// Adapters stream events. They own the network/spawn; the wrapper around
// them handles DB bookkeeping (session row, message log, captured session id).

export type StreamEvent =
  /** Synthesized by the chat wrapper before adapter output starts. Tells
   *  the client which agent is about to respond, matters when @mentions
   *  or channel pins routed the turn somewhere other than the global
   *  default, so the UI can attribute the bubble to the right agent. */
  | { type: "adapter"; adapterId: string }
  | { type: "session_id"; sessionId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; input: unknown; id: string }
  | { type: "tool_result"; toolUseId: string; content: unknown }
  | { type: "system"; subtype?: string; payload: unknown }
  | { type: "error"; message: string }
  | { type: "done"; exitCode: number };

export type SendOptions = {
  /** Filesystem directory the agent should treat as its working root. */
  projectPath: string;
  prompt: string;
  /** Provider-specific session id to resume (CLI only, APIs are stateless). */
  sessionId?: string | null;
  /** Channel id forwarded so adapters can read per-channel overrides. */
  channelId?: string;
  onEvent: (e: StreamEvent) => void;
  signal?: AbortSignal;
};

export type AgentCapabilities = {
  toolUse: boolean;
  /** Maintains context across calls (CLIs do; raw API mode does not). */
  memory: boolean;
  fileAccess: boolean;
  /** Reasonable user-facing description of what's possible. */
  notes?: string;
};

export type AgentAdapter = {
  id: string;
  name: string;
  kind: "cli" | "api";
  capabilities: AgentCapabilities;
  /**
   * Path (relative to /public) of the brand mark used wherever this adapter
   * appears: boardroom seats, chat bubbles, agent picker rows. Falls back
   * to a generic Sparkles glyph when unset. The user's per-channel /
   * per-agent override (`onboarding.agentIcon`) wins over this.
   */
  iconUrl?: string;
  /**
   * Returns true if this adapter has everything it needs (binary on PATH,
   * API key set, etc.) to actually run. UI uses this to surface "not
   * configured" states.
   */
  isConfigured(): boolean;
  send(opts: SendOptions): Promise<void>;
};
