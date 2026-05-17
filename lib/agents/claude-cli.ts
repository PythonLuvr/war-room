// Claude Code CLI adapter — the original spawn-`claude`-subprocess
// implementation lifted out of lib/claude-session.ts so it sits next to its
// siblings under lib/agents/.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";
import { isBinaryAvailable } from "./bin-probe";

function claudeBin(): string {
  return (
    getSetting("agent.cli.claude.bin") ||
    getSetting("onboarding.claudeBin") || // legacy key
    process.env.CLAUDE_BIN ||
    "claude"
  );
}

export const claudeCli: AgentAdapter = {
  id: "claude-cli",
  iconUrl: "/agent-logos/claude.png",
  name: "Claude Code (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Full Claude Code experience: tools, MCP servers, skills, hooks, session memory. Requires the `claude` binary on PATH.",
  },
  isConfigured() {
    return isBinaryAvailable(claudeBin());
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, sessionId, onEvent, signal } = opts;

    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    if (sessionId) args.push("--resume", sessionId);
    args.push(prompt);

    return new Promise((resolve) => {
      const child = spawn(claudeBin(), args, {
        cwd: projectPath,
        shell: process.platform === "win32",
        env: { ...process.env },
      });

      let stdoutBuf = "";

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
            handleEvent(JSON.parse(line));
          } catch (e) {
            onEvent({ type: "system", payload: { raw: line, parseError: String(e) } });
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        onEvent({ type: "system", subtype: "stderr", payload: chunk.toString("utf8") });
      });

      child.on("error", (err) => {
        onEvent({ type: "error", message: err.message });
      });

      child.on("close", (code) => {
        onEvent({ type: "done", exitCode: code ?? -1 });
        resolve();
      });

      function handleEvent(evt: Record<string, unknown>) {
        const t = evt.type as string | undefined;

        if (t === "system" && (evt.subtype === "init" || evt.session_id)) {
          const sid = (evt.session_id ?? evt.sessionId) as string | undefined;
          if (sid) onEvent({ type: "session_id", sessionId: sid });
          onEvent({ type: "system", subtype: String(evt.subtype ?? ""), payload: evt });
          return;
        }

        if (t === "assistant") {
          const message = evt.message as { content?: Array<Record<string, unknown>> } | undefined;
          if (message?.content) {
            for (const block of message.content) {
              if (block.type === "text" && typeof block.text === "string") {
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
  },
};
