"use client";

// Floating toast in the bottom-right that surfaces auto-update state.
// Receives lifecycle events from the Electron main process over IPC:
//   checking → downloading (with percent) → ready (Restart button) → idle
//
// If electron-updater isn't bundled (i.e. running in dev / browser), this
// component never renders.

import { useEffect, useState } from "react";
import { Cloud, CloudDownload, Loader2, RotateCw, X } from "lucide-react";

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "downloading"; percent?: number; version?: string | null }
  | { phase: "ready"; version?: string | null }
  | { phase: "error"; error?: string };

type IPCBridge = {
  send(channel: string, payload?: unknown): void;
  on(channel: string, listener: (payload: unknown) => void): () => void;
};

declare global {
  interface Window {
    warRoom?: { ipc: IPCBridge };
  }
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.warRoom) return;
    return window.warRoom.ipc.on("update:state", (payload) => {
      setState(payload as UpdateState);
      // Reset dismissal each time a new lifecycle begins so users see the
      // restart prompt for new downloads.
      const phase = (payload as UpdateState).phase;
      if (phase === "downloading" || phase === "ready") setDismissed(false);
    });
  }, []);

  if (dismissed) return null;
  if (state.phase === "idle" || state.phase === "checking") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm">
      {state.phase === "downloading" && <DownloadingCard percent={state.percent ?? 0} version={state.version} onDismiss={() => setDismissed(true)} />}
      {state.phase === "ready" && <ReadyCard version={state.version} onDismiss={() => setDismissed(true)} />}
      {state.phase === "error" && <ErrorCard message={state.error ?? "Unknown error"} onDismiss={() => setDismissed(true)} />}
    </div>
  );
}

function DownloadingCard({ percent, version, onDismiss }: { percent: number; version?: string | null; onDismiss: () => void }) {
  return (
    <div className="bg-[#0d0d0f] border border-neutral-800 rounded-xl shadow-2xl p-4 flex gap-3 items-start">
      <CloudDownload className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-100">Downloading update</div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {version ? `v${version} · ` : ""}War Room will let you know when it&apos;s ready.
        </div>
        <div className="mt-2 h-1 bg-neutral-900 rounded overflow-hidden">
          <div className="h-full bg-sky-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="text-[10px] text-neutral-600 mt-1">{percent}%</div>
      </div>
      <button onClick={onDismiss} title="Dismiss" className="text-neutral-600 hover:text-neutral-300 p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ReadyCard({ version, onDismiss }: { version?: string | null; onDismiss: () => void }) {
  const [restarting, setRestarting] = useState(false);
  const onRestart = () => {
    setRestarting(true);
    window.warRoom?.ipc.send("update:restart");
  };
  return (
    <div className="bg-[#0d0d0f] border border-emerald-500/40 rounded-xl shadow-2xl p-4 flex gap-3 items-start">
      <Cloud className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-100">
          Update ready{version ? ` · v${version}` : ""}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          Restart War Room to apply. Your work is saved locally, no data will be lost.
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={onRestart}
            disabled={restarting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {restarting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
            {restarting ? "Restarting…" : "Restart now"}
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-neutral-400 hover:text-neutral-200 px-2"
          >
            Later
          </button>
        </div>
      </div>
      <button onClick={onDismiss} title="Dismiss" className="text-neutral-600 hover:text-neutral-300 p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ErrorCard({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-[#0d0d0f] border border-red-500/40 rounded-xl shadow-2xl p-4 flex gap-3 items-start">
      <Cloud className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-100">Update failed</div>
        <div className="text-xs text-neutral-500 mt-0.5 break-all">{message}</div>
      </div>
      <button onClick={onDismiss} title="Dismiss" className="text-neutral-600 hover:text-neutral-300 p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
