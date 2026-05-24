// Nous Research Hermes Agent CLI adapter, invokes the local `hermes`
// binary in non-interactive mode. Hermes wraps multiple LLM providers
// (OpenAI, Anthropic, OpenRouter…) under one agent loop with persistent
// memory, MCP tools, and an optional messaging gateway. War Room treats
// it as a single CLI adapter; Hermes's underlying LLM choice is its own
// internal config.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";
import { isBinaryAvailable } from "./bin-probe";

function hermesBin(): string {
  return getSetting("agent.cli.hermes.bin") || process.env.HERMES_BIN || "hermes";
}

export const hermesCli: AgentAdapter = {
  id: "hermes-cli",
  iconUrl: "/agent-logos/hermes.png",
  name: "Hermes (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Spawns the Nous Research Hermes agent in your project directory. Requires the `hermes` binary on PATH; the agent's underlying LLM provider is configured inside Hermes itself.",
  },
  isConfigured() {
    return isBinaryAvailable(hermesBin());
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    return new Promise((resolve) => {
      // `hermes chat -q <prompt> -Q` runs a single non-interactive turn.
      // -Q suppresses the banner/spinner for clean stdout capture.
      const child = spawn(hermesBin(), ["chat", "-q", prompt, "-Q"], {
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
