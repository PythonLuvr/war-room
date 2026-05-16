// OpenClaw CLI adapter — invokes the local `openclaw` binary in
// non-interactive mode. OpenClaw is a self-hostable agent framework with
// its own skill system + chat-app gateways; from War Room's POV it's
// just another CLI we pipe a prompt into and stream stdout back from.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";
import { isBinaryAvailable } from "./bin-probe";

function openclawBin(): string {
  return getSetting("agent.cli.openclaw.bin") || process.env.OPENCLAW_BIN || "openclaw";
}

export const openclawCli: AgentAdapter = {
  id: "openclaw-cli",
  iconUrl: "/agent-logos/openclaw.svg",
  name: "OpenClaw (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Spawns the OpenClaw agent in your project directory. Requires the `openclaw` binary on PATH and `openclaw onboard` already completed at least once.",
  },
  isConfigured() {
    return isBinaryAvailable(openclawBin());
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    return new Promise((resolve) => {
      // `openclaw run` is the documented non-interactive entry: takes a
      // prompt, runs to completion, prints results to stdout.
      const child = spawn(openclawBin(), ["run", prompt], {
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
