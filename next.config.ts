import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import os from "os";

// Env file convention (all optional, all gitignored):
//   ~/.war-room/.env       (per-user shared overrides)
//   .env.local             (repo-local — Next loads this last automatically)
//   $WAR_ROOM_ENV_FILE     (custom path, lets users point at a team file)
//
// "First writer wins" — the order below is the precedence order. .env.local
// always wins on top of all of these because Next loads it after this file.
function loadEnvFile(p: string) {
  try {
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // All files optional.
  }
}

if (process.env.WAR_ROOM_ENV_FILE) loadEnvFile(process.env.WAR_ROOM_ENV_FILE);
loadEnvFile(path.join(os.homedir(), ".war-room", ".env"));

const nextConfig: NextConfig = {
  // Standalone output bundles a self-contained server.js + a minimal node_modules
  // tree. This is what the packaged Electron app launches as the API server.
  output: "standalone",
  // Native modules (better-sqlite3, etc.) must NOT be bundled by Webpack —
  // they're loaded from node_modules at runtime, both in dev and inside the
  // standalone build.
  serverExternalPackages: ["better-sqlite3"],
  // Pull arbitrary repo files into the standalone bundle so server-side
  // code that reads them at runtime (lib/frameworks.ts → presets/frameworks/*.md)
  // finds them after packaging. Without this, the first request that
  // touches a framework throws fs ENOENT, the embedded Next server crashes,
  // and the Electron main window shows "Page couldn't load."
  outputFileTracingIncludes: {
    "/**": ["./presets/**/*"],
  },
};

export default nextConfig;
