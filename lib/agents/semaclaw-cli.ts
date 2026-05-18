// SemaClaw CLI adapter, invokes the local `semaclaw` binary. SemaClaw
// is the framework family this cockpit was originally built around, so
// having it as a first-class adapter (instead of going through the
// generic custom-cli plumbing) gives it a proper logo + name in the
// boardroom seats and chat bubbles.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";
import { isBinaryAvailable } from "./bin-probe";

function semaclawBin(): string {
  return getSetting("agent.cli.semaclaw.bin") || process.env.SEMACLAW_BIN || "semaclaw";
}

export const semaclawCli: AgentAdapter = {
  id: "semaclaw-cli",
  iconUrl: "/agent-logos/semaclaw.png",
  name: "SemaClaw (CLI)",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      "Spawns the SemaClaw agent in your project directory. Requires the `semaclaw` binary on PATH.",
  },
  isConfigured() {
    return isBinaryAvailable(semaclawBin());
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    return new Promise((resolve) => {
      const child = spawn(semaclawBin(), ["run", prompt], {
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
