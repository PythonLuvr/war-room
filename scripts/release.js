#!/usr/bin/env node
// Build a War Room installer and ship it to the update server.
//
// One-line server-swap:
//   change UPDATE_HOST below (or set the env var) and re-run this script.
//   No other code changes needed.
//
// Usage:
//   node scripts/release.js                     # uses defaults below
//   UPDATE_HOST=user@new-server.com:/var/www/war-room-updates/ \
//     node scripts/release.js                   # ship to a different server

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Read .env.local + ~/.war-room/.env into process.env so release can run
// without exporting vars manually. First writer wins — process.env always
// trumps file values, so CLI overrides still work.
function loadDotEnv(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // optional
  }
}
loadDotEnv(path.join(__dirname, "..", ".env.local"));
loadDotEnv(path.join(os.homedir(), ".war-room", ".env"));

// ─── Server config — change these two lines when migrating to a new host. ────
const DEFAULT_UPDATE_HOST = "";
const DEFAULT_UPDATE_URL = "";
// ─────────────────────────────────────────────────────────────────────────────

const SSH_KEY = process.env.WAR_ROOM_SSH_KEY || `${process.env.USERPROFILE || process.env.HOME}/.ssh/id_ed25519`;
const UPDATE_HOST = process.env.UPDATE_HOST || DEFAULT_UPDATE_HOST;
const UPDATE_URL = process.env.UPDATE_URL || DEFAULT_UPDATE_URL;

function run(cmd, opts = {}) {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { stdio: "inherit", shell: true, ...opts });
}

function withPublishUrl(realUrl, action) {
  // electron-builder bakes publish.url into the .exe at build time. We need
  // the REAL URL for the build but want package.json's committed value to
  // stay a generic placeholder (open-source hygiene). Patch the file in
  // place, run the build, restore the original — no leak to git.
  const pkgPath = path.join(__dirname, "..", "package.json");
  const original = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(original);
  const placeholderUrl = pkg.build?.publish?.url;
  if (placeholderUrl === realUrl) {
    // already aligned (e.g. someone running release on a fork that committed
    // a real URL) — just run the action with no swap.
    return action();
  }
  pkg.build.publish.url = realUrl;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  try {
    return action();
  } finally {
    // Restore the original file verbatim (preserves formatting + trailing
    // newline) so the committed package.json never carries the real URL.
    fs.writeFileSync(pkgPath, original);
  }
}

function main() {
  if (!UPDATE_HOST || !UPDATE_URL) {
    console.error(
      "\n✗ release target not configured. Set UPDATE_HOST + UPDATE_URL env vars,\n" +
        "  or edit DEFAULT_UPDATE_HOST / DEFAULT_UPDATE_URL at the top of this file.\n" +
        "  Example:\n" +
        "    UPDATE_HOST=root@your-host:/var/www/war-room-updates/ \\\n" +
        "    UPDATE_URL=https://your-host/war-room-updates/ \\\n" +
        "    npm run release\n",
    );
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const version = pkg.version;
  const installer = `war-room-setup-${version}.exe`;
  const blockmap = `${installer}.blockmap`;
  const distDir = path.join(__dirname, "..", "dist-electron");

  console.log(`\nWar Room release\n  version : ${version}\n  url     : ${UPDATE_URL}\n  host    : ${UPDATE_HOST}\n  ssh key : ${SSH_KEY}\n`);

  // Bake the real UPDATE_URL into package.json just for the duration of the
  // build, then restore the placeholder. Keeps committed source clean.
  withPublishUrl(UPDATE_URL, () => {
    run("npm run electron:build -- --publish=never");
  });

  // Verify outputs
  const expected = ["latest.yml", installer, blockmap];
  for (const f of expected) {
    const p = path.join(distDir, f);
    if (!fs.existsSync(p)) {
      console.error(`✗ missing ${p}`);
      process.exit(1);
    }
  }

  // Upload
  const sshArg = SSH_KEY ? `-i "${SSH_KEY}"` : "";
  const filesToShip = expected.map((f) => `"${path.join(distDir, f)}"`).join(" ");
  run(`scp ${sshArg} -o StrictHostKeyChecking=accept-new ${filesToShip} ${UPDATE_HOST}`);

  console.log(`\n✓ Released v${version}`);
  console.log(`  Installer:  ${UPDATE_URL}${installer}`);
  console.log(`  Manifest:   ${UPDATE_URL}latest.yml`);
  console.log(`\n  Existing installs will pick this up on next launch.`);
}

main();
