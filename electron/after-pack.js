// electron-builder afterPack hook — copies the Next.js standalone bundle
// into the packaged app's resources folder. Done manually because
// electron-builder's extraResources strips node_modules + .next from this
// specific structure.

const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const projectRoot = context.packager.info.projectDir;
  const appOutDir = context.appOutDir;
  const dest = path.join(appOutDir, "resources", "app", ".next", "standalone");

  // Wipe whatever electron-builder copied first (it may have partial contents).
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });

  // 1. Standalone server + bundled minimal node_modules + compiled .next/server
  fs.cpSync(path.join(projectRoot, ".next", "standalone"), dest, {
    recursive: true,
  });

  // 2. Static assets (CSS, JS chunks) — Next puts these at .next/static/ but
  //    the standalone server expects them at .next/standalone/.next/static/
  fs.cpSync(
    path.join(projectRoot, ".next", "static"),
    path.join(dest, ".next", "static"),
    { recursive: true },
  );

  // 3. /public — same story, must sit beside the standalone server
  if (fs.existsSync(path.join(projectRoot, "public"))) {
    fs.cpSync(
      path.join(projectRoot, "public"),
      path.join(dest, "public"),
      { recursive: true },
    );
  }

  // 3b. /presets — bundled framework markdown (OpenWar etc.) that
  //     lib/frameworks.ts reads at runtime. Without this the framework
  //     loader returns null for every preset, the OpenWar overlay never
  //     fires, and the wizard's framework picker shows an empty list.
  if (fs.existsSync(path.join(projectRoot, "presets"))) {
    fs.cpSync(
      path.join(projectRoot, "presets"),
      path.join(dest, "presets"),
      { recursive: true },
    );
    console.log(`[after-pack] copied presets/ into standalone bundle`);
  }

  // 4. Native modules — @electron/rebuild compiled better-sqlite3 against
  //    Electron's ABI into the project root's node_modules. The standalone
  //    bundle's own copy of node_modules/better-sqlite3 has the JS but no
  //    /build dir (next build runs before the rebuild step). Copy the
  //    rebuilt /build over so the standalone server can dlopen it.
  // Refuse to ship a native binary that's still tagged with Node's ABI.
  // After-pack itself runs under Node so we can't compare against
  // process.versions.modules. Instead we hardcode the Electron major→ABI
  // map (Electron 41 = ABI 145). Mismatch here means scripts/rebuild-native.js
  // didn't actually refresh the binary — fail loud rather than ship a
  // crash-on-launch installer.
  const ELECTRON_ABI = { 41: 145, 40: 142, 39: 138 };
  const electronMajor = parseInt(
    require(path.join(projectRoot, "node_modules", "electron", "package.json")).version.split(".")[0],
    10,
  );
  const expectedAbi = String(ELECTRON_ABI[electronMajor] ?? "");
  for (const mod of ["better-sqlite3"]) {
    const src = path.join(projectRoot, "node_modules", mod, "build");
    const dst = path.join(dest, "node_modules", mod, "build");
    if (!fs.existsSync(src)) continue;
    const binBase = mod.replace(/-/g, "_");
    const binPath = path.join(src, "Release", `${binBase}.node`);
    if (fs.existsSync(binPath) && expectedAbi) {
      const buf = fs.readFileSync(binPath);
      const tag = buf.toString("utf8").match(/NODE_MODULE_VERSION\s+(\d+)/);
      const found = tag ? tag[1] : null;
      if (found && found !== expectedAbi) {
        throw new Error(
          `[after-pack] ${mod} ABI mismatch: binary tagged NODE_MODULE_VERSION ${found}, ` +
          `Electron ${electronMajor} needs ${expectedAbi}. Run: npm run electron:rebuild-native`,
        );
      }
    }
    fs.cpSync(src, dst, { recursive: true });
    console.log(`[after-pack] copied rebuilt ${mod} native binary into standalone (ABI=${expectedAbi})`);
  }

  console.log(`[after-pack] copied standalone bundle to ${dest}`);
};
