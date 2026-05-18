#!/usr/bin/env node
// One-shot release pipeline:
//   1. Verify git working tree is clean (won't ship uncommitted code)
//   2. Bump version in package.json (patch by default)
//   3. Commit + tag the bump
//   4. Push commit + tag to GitHub
//   5. Build the installer and upload to the update server
//
// Usage:
//   npm run ship                  → patch bump (0.1.1 → 0.1.2)
//   npm run ship minor            → minor bump (0.1.1 → 0.2.0)
//   npm run ship major            → major bump (0.1.1 → 1.0.0)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BUMP = (process.argv[2] || "patch").toLowerCase();
if (!["patch", "minor", "major"].includes(BUMP)) {
  console.error(`✗ unknown bump '${BUMP}', expected patch | minor | major`);
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`\n▸ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", shell: true, ...opts });
}

function capture(cmd) {
  return execSync(cmd, { encoding: "utf8", shell: true }).trim();
}

// 1. Guard against shipping a dirty tree
const dirty = capture("git status --porcelain");
if (dirty) {
  console.error("\n✗ working tree is dirty. Commit or stash before shipping:");
  console.error(dirty);
  process.exit(1);
}

// 2 & 3. Bump version + auto-commit + auto-tag
//    npm version updates package.json, commits "vX.Y.Z", and tags vX.Y.Z
run(`npm version ${BUMP} -m "release: v%s"`);

// Read the new version for downstream logging
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
console.log(`\n✓ bumped to v${pkg.version}`);

// 4. Push commit + tag together
run("git push --follow-tags");

// 5. Build installer + upload to update server
run("npm run release");

console.log(`\n══════════════════════════════════════════`);
console.log(`✓ Shipped v${pkg.version}`);
console.log(`  Code:       pushed to origin/main + tag v${pkg.version}`);
console.log(`  Installer:  live on update server`);
console.log(`  Apps:       will auto-update on next launch`);
console.log(`══════════════════════════════════════════`);
