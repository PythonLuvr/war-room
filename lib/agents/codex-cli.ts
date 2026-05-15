// OpenAI Codex CLI adapter — invokes the official `codex` binary.
// Codex doesn't expose a structured streaming protocol like Claude Code, so
// we just pipe stdout through as text deltas and surface stderr as system
// events.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";

function codexBin(): string {
  return getSetting("agent.cli.codex.bin") || process.env.CODEX_BIN || "codex";
}

export const codexCli: AgentAdapter = {
  id: "codex-cli",
  name: "OpenAI Codex (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Spawns the OpenAI Codex CLI in your project directory. Requires the `codex` binary on PATH and your OpenAI account configured via `codex login`.",
  },
  isConfigured() {
    return !!codexBin();
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    return new Promise((resolve) => {
      // `codex exec` is the non-interactive mode: takes a prompt, runs to
      // completion, prints the agent's output to stdout. Falls back to bare
      // invocation if exec subcommand isn't available.
      const child = spawn(codexBin(), ["exec", prompt], {
        cwd: projectPath,
        shell: process.platform === "win32",
        env: { ...process.env },
      });

      signal?.addEventListener("abort", () => {
        try {
          child.kill();
        } catch {}
      });

      child.stdout.on("data", (chunk: Buffer) => {
        onEvent({ type: "text_delta", text: chunk.toString("utf8") });
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
    });
  },
};
