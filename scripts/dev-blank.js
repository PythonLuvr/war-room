#!/usr/bin/env node
// Boot a fresh War Room, what a stranger cloning the repo sees on first
// run. Non-destructive: your real .env.local + ~/.war-room/ are left alone.
//
// What this does:
//   1. Stashes .env.local to a temp location so no personal config leaks in
//   2. Points WAR_ROOM_DATA_DIR at a fresh temp SQLite folder
//   3. Auto-rebuilds better-sqlite3 if its native binary's ABI doesn't match
//      the system Node (handles the dev <-> packaged-build cycle)
//   4. Starts next dev on port 3030 so it doesn't clash with anything else
//      already on 3000
//   5. Restores .env.local when you Ctrl+C
//
// Usage:
//   npm run dev:blank
//   open http://localhost:3030

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const ENV_FILE = path.join(REPO, ".env.local");
const ENV_STASH = path.join(os.tmpdir(), `war-room-env-stash-${process.pid}`);
const DATA_DIR = path.join(os.tmpdir(), `war-room-blank-${Date.now()}`);
const PORT = 3030;

// ─── Better-sqlite3 ABI guard ────────────────────────────────────────────────
// The packaged-build path (npm run ship) rebuilds better-sqlite3 against
// Electron's Node ABI. Switching back to dev needs the binary rebuilt for
// system Node. We probe first (cheap subprocess that just tries to load the
// module), and only rebuild on mismatch. Always-rebuild was deterministic
// but failed on Windows whenever any other process, a stranded dev server,
// the running Electron app, had the .node file mapped (EBUSY/EPERM on
// unlink). The probe runs in a fresh Node process so a stale loaded copy in
// this script's memory doesn't poison the result.
function ensureSystemNodeBuild() {
  const probe = spawnSync(
    process.execPath,
    ["-e", "require('better-sqlite3'); process.exit(0)"],
    { cwd: REPO },
  );
  if (probe.status === 0) {
    console.log(`▸ better-sqlite3 already matches system Node (ABI ${process.versions.modules}), skipping rebuild`);
    return;
  }
  console.log(`▸ rebuilding better-sqlite3 for system Node (ABI ${process.versions.modules})…`);
  const rebuild = spawnSync("npm", ["rebuild", "better-sqlite3"], {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (rebuild.status !== 0) {
    console.error(
      "✗ npm rebuild failed. Likely another process (Electron app, prior dev server) has the .node file open. Close them and try again, or run `npm rebuild better-sqlite3` manually.",
    );
    process.exit(1);
  }
}

// ─── Env shuffle ────────────────────────────────────────────────────────────
function stashEnv() {
  if (fs.existsSync(ENV_FILE)) {
    fs.renameSync(ENV_FILE, ENV_STASH);
    console.log(`▸ stashed .env.local → ${ENV_STASH}`);
  }
}
function restoreEnv() {
  if (fs.existsSync(ENV_STASH)) {
    try {
      fs.renameSync(ENV_STASH, ENV_FILE);
      console.log("▸ restored .env.local");
    } catch {
      console.error(
        `\n✗ could not restore .env.local automatically. Your file is at ${ENV_STASH}, move it back manually.`,
      );
    }
  }
}

let restored = false;
function ensureRestoreOnce() {
  if (restored) return;
  restored = true;
  restoreEnv();
}
process.on("exit", ensureRestoreOnce);
process.on("SIGINT", () => {
  ensureRestoreOnce();
  process.exit(0);
});
process.on("SIGTERM", () => {
  ensureRestoreOnce();
  process.exit(0);
});

// ─── Run ────────────────────────────────────────────────────────────────────
function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  War Room, blank-state preview");
  console.log("══════════════════════════════════════════\n");
  console.log(`  port      : http://localhost:${PORT}`);
  console.log(`  data dir  : ${DATA_DIR}`);
  console.log(`  env       : ignored (.env.local stashed)`);
  console.log(`  use this  : like a stranger seeing War Room for the first time\n`);
  console.log("  When done, hit Ctrl+C, your real .env.local is restored automatically.\n");

  ensureSystemNodeBuild();
  stashEnv();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const next = path.join(REPO, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  const child = spawn(next, ["dev", "-p", String(PORT)], {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      WAR_ROOM_DATA_DIR: DATA_DIR,
      // Belt-and-suspenders: even if .env.local couldn't be stashed, blank
      // out the keys we care about so the experience is truly empty.
      WAR_ROOM_WORKSPACES: "",
      WAR_ROOM_CLIENTS_ROOT: "",
      WAR_ROOM_VPS_HOST: "",
      WAR_ROOM_VPS_SERVICES: "",
      WAR_ROOM_LOCAL_SERVICES: "",
      LIVEKIT_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "",
    },
  });

  child.on("exit", (code) => {
    ensureRestoreOnce();
    process.exit(code ?? 0);
  });
}

main();
