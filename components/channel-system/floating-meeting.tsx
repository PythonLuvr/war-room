"use client";

// Floating mini-window for an active meeting. Renders at the root layout level
// whenever the user is in a meeting AND has navigated away from /c/home.
// Shows the most-relevant video stream (screen share > active speaker > self
// camera > fallback pill) and a minimal control bar. Drag the header to
// reposition. Click "expand" to route back to /c/home and re-enter the full
// Boardroom panel.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
} from "lucide-react";
import { useMeeting } from "@/lib/meeting-context";
import type { LocalTrack, RemoteTrack } from "livekit-client";

const WIDTH = 320;
const HEIGHT = 200;
const MARGIN = 16;

export function FloatingMeeting() {
  const meeting = useMeeting();
  const pathname = usePathname();
  const visible = meeting.phase === "in-meeting" && pathname !== "/c/home";

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Default position: bottom-right
  useEffect(() => {
    if (pos === null && typeof window !== "undefined") {
      setPos({
        x: window.innerWidth - WIDTH - MARGIN,
        y: window.innerHeight - HEIGHT - MARGIN,
      });
    }
  }, [pos]);

  // Pick the most-relevant video to show in the mini.
  const featuredTrack = useMemo<RemoteTrack | LocalTrack | undefined>(() => {
    if (meeting.screenShare) return meeting.screenShare.track;
    for (const id of meeting.activeSpeakers) {
      const t = meeting.videoTracks.get(id);
      if (t) return t;
    }
    if (meeting.cameraOn) return meeting.videoTracks.get(meeting.localIdentity);
    return undefined;
  }, [meeting.screenShare, meeting.activeSpeakers, meeting.videoTracks, meeting.cameraOn, meeting.localIdentity]);

  const videoHostRef = useRef<HTMLDivElement>(null);
  const isLocalFeatured = !meeting.screenShare && !meeting.activeSpeakers.size && meeting.cameraOn;

  useEffect(() => {
    const host = videoHostRef.current;
    if (!host || !featuredTrack) return;
    const el = featuredTrack.attach() as HTMLVideoElement;
    el.muted = true;
    el.playsInline = true;
    if (isLocalFeatured) el.style.transform = "scaleX(-1)";
    host.innerHTML = "";
    host.appendChild(el);
    return () => {
      featuredTrack.detach().forEach((e) => e.remove());
    };
  }, [featuredTrack, isLocalFeatured]);

  // Drag handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    },
    [pos],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const x = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, d.origX + (e.clientX - d.startX)));
      const y = Math.max(MARGIN, Math.min(window.innerHeight - HEIGHT - MARGIN, d.origY + (e.clientY - d.startY)));
      setPos({ x, y });
    },
    [],
  );
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

  if (!visible || !pos) return null;

  return (
    <div
      className="fixed z-[80] bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col select-none"
      style={{ left: pos.x, top: pos.y, width: WIDTH, height: HEIGHT }}
    >
      {/* Drag header */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="px-2 py-1 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 flex items-center gap-2 cursor-grab active:cursor-grabbing"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-medium text-neutral-300 flex-1">Boardroom · in meeting</span>
        <Link
          href="/c/home?panel=boardroom"
          title="Expand"
          className="text-neutral-400 hover:text-neutral-100 p-1 rounded hover:bg-neutral-800"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 relative bg-black">
        {featuredTrack ? (
          <div
            ref={videoHostRef}
            className="absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-neutral-400 text-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
              In meeting · no video
            </div>
          </div>
        )}
      </div>

      {/* Mini control bar */}
      <div className="px-2 py-1.5 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-center gap-2">
        <MiniButton
          title={meeting.muted ? "Unmute" : "Mute"}
          danger={meeting.muted}
          onClick={meeting.toggleMute}
        >
          {meeting.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </MiniButton>
        <MiniButton title="Leave" danger onClick={meeting.leave}>
          <PhoneOff className="w-4 h-4" />
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
  const base = "h-8 w-8 rounded-full flex items-center justify-center border transition-colors";
  const look = danger
    ? "bg-red-500/20 border-red-500/40 text-red-200 hover:bg-red-500/30"
    : "bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700";
  return (
    <button title={title} onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  );
}
