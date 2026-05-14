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

  console.log(`[after-pack] copied standalone bundle to ${dest}`);
};
