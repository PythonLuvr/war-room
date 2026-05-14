// Preload runs before the renderer JS in both the main War Room window and
// the floating mini window. Exposes a minimal IPC surface to the page via
// window.warRoom so the React app can broadcast meeting state to / receive
// actions from / control the visibility of the mini window.

const { contextBridge, ipcRenderer } = require("electron");

const SAFE_CHANNELS = new Set([
  "meeting:state",
  "meeting:action",
  "mini:show",
  "mini:hide",
  "mini:expand-main",
  "main:set-in-meeting",
  "update:state",
  "update:restart",
  "update:check",
]);

contextBridge.exposeInMainWorld("warRoom", {
  ipc: {
    send(channel, payload) {
      if (!SAFE_CHANNELS.has(channel)) return;
      ipcRenderer.send(channel, payload);
    },
    on(channel, listener) {
      if (!SAFE_CHANNELS.has(channel)) return () => {};
      const wrapper = (_evt, payload) => listener(payload);
      ipcRenderer.on(channel, wrapper);
      return () => ipcRenderer.removeListener(channel, wrapper);
    },
  },
});
