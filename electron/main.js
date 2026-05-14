// War Room — Electron main process.
//
// Two windows:
//   - Main window: the dashboard. Boots the bundled Next.js server in prod
//     and points the webview at it (dev points at the externally-running
//     dev server).
//   - Mini window: a frameless always-on-top control strip. Hidden by
//     default; shown by the main window via IPC whenever the user is in a
//     meeting AND the main window is not in focus. Lets users mute/leave
//     and re-expand the main window from any other app.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";
const PROD_PORT = 33773;

let mainWindow = null;
let miniWindow = null;
let nextProcess = null;
let inMeeting = false;
let userClosedMini = false;

function targetUrl() {
  return isDev ? DEV_URL : `http://127.0.0.1:${PROD_PORT}`;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
          res.resume();
        });
        req.on("error", reject);
        req.setTimeout(1000, () => req.destroy(new Error("timeout")));
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server at ${url} did not come up within ${timeoutMs}ms`);
}

function startBundledServer() {
  const standaloneDir = path.join(process.resourcesPath, "app", ".next", "standalone");
  const serverScript = path.join(standaloneDir, "server.js");
  const env = {
    ...process.env,
    PORT: String(PROD_PORT),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };
  nextProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextProcess.stdout.on("data", (d) => console.log("[next]", d.toString().trim()));
  nextProcess.stderr.on("data", (d) => console.error("[next:err]", d.toString().trim()));
  nextProcess.on("exit", (code) => {
    console.log(`[next] exited with code ${code}`);
    if (!app.isQuitting) app.quit();
  });
}

async function createMainWindow() {
  if (!isDev) startBundledServer();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    title: "War Room",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(targetUrl())) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Show / hide the mini window based on main window focus + meeting state.
  const evaluateMini = () => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    const focused = mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused();
    const minimized = mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized();
    const shouldShow = inMeeting && !userClosedMini && (!focused || minimized);
    if (shouldShow && !miniWindow.isVisible()) miniWindow.showInactive();
    if (!shouldShow && miniWindow.isVisible()) miniWindow.hide();
  };

  mainWindow.on("focus", evaluateMini);
  mainWindow.on("blur", evaluateMini);
  mainWindow.on("minimize", evaluateMini);
  mainWindow.on("restore", () => {
    userClosedMini = false;
    evaluateMini();
  });
  mainWindow.on("show", evaluateMini);
  mainWindow.on("hide", evaluateMini);
  mainWindow._evaluateMini = evaluateMini;

  try {
    await waitForServer(targetUrl());
    await mainWindow.loadURL(targetUrl());
  } catch (e) {
    console.error("Failed to reach Next.js server:", e);
    await mainWindow.loadURL(
      "data:text/html,<h1 style='font-family:sans-serif;color:#eee;background:#0a0a0a;padding:2rem'>War Room could not start its local server.<br><small>" +
        (e && e.message ? e.message.replace(/[<>]/g, "") : "unknown error") +
        "</small></h1>",
    );
    mainWindow.show();
  }

  // Allow F12 / Ctrl+Shift+I to toggle DevTools even in production builds —
  // we don't ship a menu bar, so without this users have no diagnostic path
  // when something goes wrong.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrlShiftI = input.control && input.shift && input.key.toLowerCase() === "i";
    if (input.key === "F12" || ctrlShiftI) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

async function createMiniWindow() {
  miniWindow = new BrowserWindow({
    width: 340,
    height: 76,
    x: 60,
    y: 60,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#0a0a0a",
    show: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  miniWindow.setAlwaysOnTop(true, "floating", 1);
  miniWindow.setVisibleOnAllWorkspaces(true);

  try {
    await waitForServer(targetUrl());
    await miniWindow.loadURL(`${targetUrl()}/mini`);
  } catch (e) {
    console.error("Mini load failed:", e);
  }
}

// ─── IPC plumbing ───────────────────────────────────────────────────────────

ipcMain.on("main:set-in-meeting", (_evt, value) => {
  inMeeting = !!value;
  if (!inMeeting) userClosedMini = false;
  if (mainWindow && mainWindow._evaluateMini) mainWindow._evaluateMini();
});

ipcMain.on("meeting:state", (_evt, payload) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send("meeting:state", payload);
  }
});

ipcMain.on("meeting:action", (_evt, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("meeting:action", payload);
  }
});

ipcMain.on("mini:show", () => {
  if (miniWindow && !miniWindow.isDestroyed() && !miniWindow.isVisible()) {
    miniWindow.showInactive();
  }
});

ipcMain.on("mini:hide", () => {
  if (miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()) {
    userClosedMini = true;
    miniWindow.hide();
  }
});

// ─── Auto-update ────────────────────────────────────────────────────────────
// Updates download in the background, but instead of silently restarting we
// surface a popup in the renderer. The user clicks "Restart" → IPC fires
// `update:restart` → we call quitAndInstall(). If they ignore it, the update
// also lands on the next normal app quit via autoInstallOnAppQuit.

let cachedAutoUpdater = null;
function getAutoUpdater() {
  if (cachedAutoUpdater !== null) return cachedAutoUpdater;
  try {
    cachedAutoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    console.warn("electron-updater not bundled:", e.message);
    cachedAutoUpdater = false;
  }
  return cachedAutoUpdater;
}

function broadcastUpdateState(state) {
  for (const w of [mainWindow, miniWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send("update:state", state);
  }
}

function wireAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    broadcastUpdateState({ phase: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    broadcastUpdateState({ phase: "downloading", version: info?.version ?? null, percent: 0 });
  });
  autoUpdater.on("update-not-available", () => {
    broadcastUpdateState({ phase: "idle" });
  });
  autoUpdater.on("download-progress", (p) => {
    broadcastUpdateState({
      phase: "downloading",
      percent: Math.round(p?.percent ?? 0),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    broadcastUpdateState({ phase: "ready", version: info?.version ?? null });
  });
  autoUpdater.on("error", (err) => {
    broadcastUpdateState({ phase: "error", error: err?.message ?? String(err) });
  });

  autoUpdater.checkForUpdates().catch((e) => {
    console.warn("update check failed:", e.message);
  });
}

ipcMain.on("update:check", () => {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch((e) => {
    broadcastUpdateState({ phase: "error", error: e?.message ?? String(e) });
  });
});

ipcMain.on("update:restart", () => {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    console.error("quitAndInstall failed:", e);
  }
});

ipcMain.on("mini:expand-main", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// ─── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await createMainWindow();
  await createMiniWindow();

  if (!isDev) wireAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (nextProcess && !nextProcess.killed) nextProcess.kill();
});
