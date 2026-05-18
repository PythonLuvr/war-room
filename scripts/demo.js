#!/usr/bin/env node
// War Room, demo mode launcher.
//
// Boots a fresh dev server pointed at an isolated demo data dir
// (~/.war-room-demo/), seeds it with synthetic data via /api/demo-seed,
// and opens on port 3031. Never touches a real install:
//
//   • .env.local is stashed (restored on Ctrl+C)
//   • WAR_ROOM_DATA_DIR is forced to ~/.war-room-demo/, wiped each run
//   • WAR_ROOM_DEMO=1 is set so the seed endpoint and banner activate
//
// Usage:
//   npm run demo
//   open http://localhost:3031

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const ENV_FILE = path.join(REPO, ".env.local");
const ENV_STASH = path.join(os.tmpdir(), `war-room-env-stash-demo-${process.pid}`);
const DATA_DIR = path.join(os.homedir(), ".war-room-demo");
const PORT = 3031;

// ─── Better-sqlite3 ABI guard ──────────────────────────────────────────────
// Same probe-then-rebuild pattern as dev:blank. The rebuild only runs when
// the binary doesn't match the system Node ABI; otherwise it would fail on
// Windows whenever any other process holds the .node file open.
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
    console.error("✗ npm rebuild failed. Likely another process has the .node file open. Close it and try again.");
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
    } catch (e) {
      console.error(
        `\n✗ could not restore .env.local automatically. Your file is at ${ENV_STASH}, move it back manually. ${e.message}`,
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

// ─── Wait for the dev server to be reachable, then trigger the seed. ──────
function waitForReady(timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port: PORT, path: "/api/about" }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(1000, () => req.destroy(new Error("timeout")));
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error("server did not start in time"));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function postJSON(pathName) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: pathName, method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode < 400) resolve(body);
          else reject(new Error(`${res.statusCode}: ${body}`));
        });
      },
    );
    req.on("error", reject);
    req.end("{}");
  });
}

async function seedAfterReady() {
  try {
    await waitForReady();
    await postJSON("/api/demo-seed");
    console.log("\n▸ demo data seeded, open http://localhost:" + PORT);
  } catch (e) {
    console.error(`\n✗ demo seed failed: ${e.message}`);
    console.error("  The dev server is still running. You can retry by POSTing to http://localhost:" + PORT + "/api/demo-seed");
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────
function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("  War Room, DEMO mode");
  console.log("══════════════════════════════════════════\n");
  console.log(`  port      : http://localhost:${PORT}`);
  console.log(`  data dir  : ${DATA_DIR}  (wiped + reseeded each run)`);
  console.log(`  env       : ignored (.env.local stashed)`);
  console.log(`  use this  : show prospective forkers what a populated War Room looks like\n`);
  console.log("  When done, hit Ctrl+C, your real .env.local is restored automatically.\n");

  ensureSystemNodeBuild();
  stashEnv();

  // Wipe + recreate the demo dir so each run is deterministic.
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const next = path.join(REPO, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  const child = spawn(next, ["dev", "-p", String(PORT)], {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      WAR_ROOM_DATA_DIR: DATA_DIR,
      WAR_ROOM_DEMO: "1",
      // Belt-and-suspenders: stay disconnected from any real env-driven
      // services so the demo doesn't accidentally probe a real host.
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

  // Trigger the seed once Next.js answers /api/about.
  seedAfterReady();

  child.on("exit", (code) => {
    ensureRestoreOnce();
    process.exit(code ?? 0);
  });
}

main();
