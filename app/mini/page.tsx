"use client";

// Renders inside the always-on-top mini Electron window. Doesn't connect to
// LiveKit itself, it receives state pushed over IPC from the main window's
// MeetingProvider and sends actions back the same way.

import { useEffect, useState } from "react";
import { Maximize2, Mic, MicOff, PhoneOff, X } from "lucide-react";

type MiniState = {
  inMeeting: boolean;
  muted: boolean;
  cameraOn: boolean;
  sharing: boolean;
  activeSpeaker: string | null;
  participantCount: number;
};

const DEFAULT_STATE: MiniState = {
  inMeeting: false,
  muted: false,
  cameraOn: false,
  sharing: false,
  activeSpeaker: null,
  participantCount: 0,
};

type IPCBridge = {
  send(channel: string, payload?: unknown): void;
  on(channel: string, listener: (payload: unknown) => void): () => void;
};

declare global {
  interface Window {
    warRoom?: { ipc: IPCBridge };
  }
}

export default function MiniPage() {
  const [state, setState] = useState<MiniState>(DEFAULT_STATE);

  useEffect(() => {
    if (!window.warRoom) return;
    return window.warRoom.ipc.on("meeting:state", (payload) => {
      setState((cur) => ({ ...cur, ...(payload as Partial<MiniState>) }));
    });
  }, []);

  const send = (action: string) => {
    window.warRoom?.ipc.send("meeting:action", { action });
  };

  const expand = () => {
    window.warRoom?.ipc.send("mini:expand-main");
  };

  const close = () => {
    window.warRoom?.ipc.send("mini:hide");
  };

  return (
    <div
      className="h-screen w-screen bg-neutral-950/95 backdrop-blur-md border border-neutral-700 rounded-xl shadow-2xl flex items-center px-3 gap-2 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            state.inMeeting ? "bg-emerald-500 animate-pulse" : "bg-neutral-600"
          }`}
        />
        <div className="flex flex-col min-w-0">
          <div className="text-[11px] font-semibold text-neutral-100 truncate leading-tight">
            {state.activeSpeaker ?? (state.inMeeting ? "In meeting" : "Idle")}
          </div>
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">
            {state.sharing
              ? "sharing screen"
              : state.inMeeting
                ? `${state.participantCount} on call`
                : "boardroom"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <MiniButton
          title={state.muted ? "Unmute" : "Mute"}
          danger={state.muted}
          onClick={() => send("toggle-mute")}
        >
          {state.muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </MiniButton>
        <MiniButton title="Leave" danger onClick={() => send("leave")}>
          <PhoneOff className="w-3.5 h-3.5" />
        </MiniButton>
        <div className="w-px h-5 bg-neutral-800 mx-0.5" />
        <MiniButton title="Open War Room" onClick={expand}>
          <Maximize2 className="w-3.5 h-3.5" />
        </MiniButton>
        <MiniButton title="Hide" onClick={close}>
          <X className="w-3.5 h-3.5" />
        </MiniButton>
      </div>
    </div>
  );
}

function MiniButton({
  title,
  children,
  danger,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  const base = "h-7 w-7 rounded-md flex items-center justify-center border transition-colors";
  const look = danger
    ? "bg-red-500/15 border-red-500/40 text-red-200 hover:bg-red-500/25"
    : "bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700";
  return (
    <button title={title} onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  );
}
