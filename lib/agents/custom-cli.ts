// Custom CLI adapter, spawns whatever the user configured.
// Lets people bridge in tools we haven't explicitly added (Aider,
// Continue, Open Interpreter, in-house wrappers, etc.).
//
// Settings consumed:
//   agent.cli.custom.bin      , path to the executable
//   agent.cli.custom.template , args template; supports {{prompt}} and {{cwd}}
//                                 placeholders. Args are parsed with a simple
//                                 quote-aware splitter.

import { spawn } from "child_process";
import { getSetting } from "../db";
import type { AgentAdapter, SendOptions } from "./types";
import { isBinaryAvailable } from "./bin-probe";

function customBin(): string {
  return getSetting("agent.cli.custom.bin") || "";
}

function customTemplate(): string {
  return getSetting("agent.cli.custom.template") || "{{prompt}}";
}

// Quote-aware arg splitter: handles "double-quoted phrases" as a single arg.
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

export const customCli: AgentAdapter = {
  id: "custom-cli",
  name: "Custom CLI",
  kind: "cli",
  capabilities: {
    toolUse: true,
    memory: true,
    fileAccess: true,
    notes:
      'Spawns any binary you point us at. Set the path under settings → Agent backend → Custom. Use {{prompt}} and {{cwd}} placeholders in the template (default: just "{{prompt}}").',
  },
  isConfigured() {
    return isBinaryAvailable(customBin());
  },
  send(opts: SendOptions): Promise<void> {
    const { projectPath, prompt, onEvent, signal } = opts;
    const bin = customBin();
    if (!bin) {
      onEvent({ type: "error", message: "Custom CLI not configured" });
      onEvent({ type: "done", exitCode: -1 });
      return Promise.resolve();
    }
    const template = customTemplate();
    const args = splitArgs(template).map((a) =>
      a.replace(/\{\{prompt\}\}/g, prompt).replace(/\{\{cwd\}\}/g, projectPath),
    );
    return new Promise((resolve) => {
      const child = spawn(bin, args, {
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
