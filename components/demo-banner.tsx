"use client";

// Top-of-screen banner that appears only when the server was started with
// WAR_ROOM_DEMO=1 (i.e. via `npm run demo`). Tells visitors the data is
// synthetic and points them at the real cold-clone command. Never shows
// in a normal install, /api/about returns demo:false unless the env is
// set.

import { useEffect, useState } from "react";

export function DemoBanner() {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    fetch("/api/about")
      .then((r) => r.json())
      .then((d: { demo?: boolean }) => setDemo(!!d.demo))
      .catch(() => {});
  }, []);
  if (!demo) return null;
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-[11px] leading-relaxed px-4 py-1.5 flex items-center gap-2 justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/war-bit/happy.png"
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 [image-rendering:pixelated] shrink-0"
      />
      <span>
        <strong className="text-amber-100">Demo data.</strong> Servers, channels, jobs, and chat
        history below are synthetic so you can see the app populated. Run{" "}
        <code className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-100">npm run dev:blank</code>{" "}
        for a clean cold-clone start.
      </span>
    </div>
  );
}
