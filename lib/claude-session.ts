import { spawn } from "child_process";
import {
  addMessage,
  getSession,
  setClaudeSessionId,
  upsertSession,
  type SessionRow,
} from "./db";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

export type StreamEvent =
  | { type: "session_id"; sessionId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; input: unknown; id: string }
  | { type: "tool_result"; toolUseId: string; content: unknown }
  | { type: "assistant_message"; text: string }
  | { type: "system"; subtype?: string; payload: unknown }
  | { type: "error"; message: string }
  | { type: "done"; exitCode: number };

export type SendOptions = {
  projectPath: string;
  prompt: string;
  onEvent: (e: StreamEvent) => void;
  signal?: AbortSignal;
};

export async function sendMessage(opts: SendOptions): Promise<void> {
  const { projectPath, prompt, onEvent, signal } = opts;

  const row: SessionRow = upsertSession(projectPath);
  addMessage(row.id, "user", prompt);

  const existing = getSession(projectPath);
  const claudeSessionId = existing?.claude_session_id ?? null;

  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  if (claudeSessionId) {
    args.push("--resume", claudeSessionId);
  }
  args.push(prompt);

  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: projectPath,
      shell: process.platform === "win32",
      env: { ...process.env },
    });

    let stdoutBuf = "";
    let assistantText = "";
    let capturedSessionId: string | null = null;
    let lastRawAssistant: string | null = null;

    const flushAssistantToDb = () => {
      if (assistantText.trim().length > 0) {
        addMessage(row.id, "assistant", assistantText, lastRawAssistant ?? undefined);
      }
    };

    signal?.addEventListener("abort", () => {
      try {
        child.kill();
      } catch {}
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf8");
      let nl: number;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line);
          handleEvent(evt);
        } catch (e) {
          onEvent({ type: "system", payload: { raw: line, parseError: String(e) } });
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      onEvent({ type: "system", subtype: "stderr", payload: text });
    });

    child.on("error", (err) => {
      onEvent({ type: "error", message: err.message });
    });

    child.on("close", (code) => {
      flushAssistantToDb();
      onEvent({ type: "done", exitCode: code ?? -1 });
      resolve();
    });

    function handleEvent(evt: Record<string, unknown>) {
      const t = evt.type as string | undefined;

      if (t === "system" && (evt.subtype === "init" || evt.session_id)) {
        const sid = (evt.session_id ?? evt.sessionId) as string | undefined;
        if (sid && sid !== capturedSessionId) {
          capturedSessionId = sid;
          setClaudeSessionId(row.id, sid);
          onEvent({ type: "session_id", sessionId: sid });
        }
        onEvent({ type: "system", subtype: String(evt.subtype ?? ""), payload: evt });
        return;
      }

      if (t === "assistant") {
        const message = evt.message as { content?: Array<Record<string, unknown>> } | undefined;
        if (message?.content) {
          for (const block of message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
              onEvent({ type: "text_delta", text: block.text });
            } else if (block.type === "tool_use") {
              onEvent({
                type: "tool_use",
                name: String(block.name ?? ""),
                input: block.input,
                id: String(block.id ?? ""),
              });
            }
          }
          lastRawAssistant = JSON.stringify(evt);
        }
        return;
      }

      if (t === "user") {
        const message = evt.message as { content?: Array<Record<string, unknown>> } | undefined;
        if (message?.content) {
          for (const block of message.content) {
            if (block.type === "tool_result") {
              onEvent({
                type: "tool_result",
                toolUseId: String(block.tool_use_id ?? ""),
                content: block.content,
              });
            }
          }
        }
        return;
      }

      if (t === "result") {
        onEvent({ type: "system", subtype: "result", payload: evt });
        return;
      }

      onEvent({ type: "system", subtype: t ?? "unknown", payload: evt });
    }
  });
}
