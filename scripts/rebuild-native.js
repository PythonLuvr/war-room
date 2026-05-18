// Force-rebuild native modules against Electron's ABI before electron-builder
// packages them. @electron/rebuild caches aggressively and silently no-ops
// when it thinks the work is already done, which has shipped binaries built
// for Node's ABI inside Electron-bundled apps, the symptom is a blank
// "Server Components render" error on first launch because better-sqlite3
// fails ERR_DLOPEN_FAILED when the renderer hits the DB.
//
// We wipe the build/ dir first so the rebuild can't no-op, then invoke
// @electron/rebuild and verify the output binary's NODE_MODULE_VERSION
// matches Electron's expected ABI.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MODULES = ["better-sqlite3"];
const root = process.cwd();

const electronPkg = require(path.join(root, "node_modules", "electron", "package.json"));
const electronVersion = electronPkg.version;
console.log(`[rebuild-native] electron ${electronVersion}`);

for (const mod of MODULES) {
  const buildDir = path.join(root, "node_modules", mod, "build");
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log(`[rebuild-native] wiped ${mod}/build`);
  }
}

execSync(`npx --yes @electron/rebuild --force --types prod --only ${MODULES.join(",")}`, {
  stdio: "inherit",
  cwd: root,
});

// Verify each binary's NODE_MODULE_VERSION tag.
for (const mod of MODULES) {
  const binBase = mod.replace(/-/g, "_");
  const binPath = path.join(root, "node_modules", mod, "build", "Release", `${binBase}.node`);
  if (!fs.existsSync(binPath)) {
    throw new Error(`[rebuild-native] ${mod} binary missing after rebuild: ${binPath}`);
  }
  const buf = fs.readFileSync(binPath);
  const tag = buf.toString("utf8").match(/NODE_MODULE_VERSION\s+(\d+)/);
  if (!tag) {
    console.warn(`[rebuild-native] ${mod} binary has no NODE_MODULE_VERSION tag (can't verify ABI)`);
  } else {
    console.log(`[rebuild-native] ${mod} ABI=${tag[1]}`);
  }
}
