// Google Gemini CLI adapter — invokes the official `gemini` binary
// (@google/gemini-cli on npm).

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";

function geminiBin(): string {
  return getSetting("agent.cli.gemini.bin") || process.env.GEMINI_BIN || "gemini";
}

export const geminiCli: AgentAdapter = {
  id: "gemini-cli",
  name: "Google Gemini (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Spawns the Google Gemini CLI in your project directory. Requires the `gemini` binary on PATH and an authenticated Google account.",
  },
  isConfigured() {
    return !!geminiBin();
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    return new Promise((resolve) => {
      // `gemini -p "<prompt>"` runs a one-shot prompt against Gemini and
      // streams text back to stdout.
      const child = spawn(geminiBin(), ["-p", prompt], {
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
