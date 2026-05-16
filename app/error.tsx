"use client";

// Runtime error boundary for the app shell. Catches React render errors,
// server-action errors, and unhandled promise rejections that bubble to
// the root segment.
//
// Per OpenWar voice rules: report what broke + what's possible next,
// no "oops!" filler. Errors are explanations, not apologies.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for forkers running dev tools open. Production
    // builds also surface this to electron-log via the IPC bridge.
    console.error("[war-room] error boundary tripped:", error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-200 flex items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/war-bit/focused.png"
          alt="WarBit, focused on the problem"
          width={256}
          height={256}
          className="w-40 h-40 mx-auto mb-6 [image-rendering:pixelated] opacity-90"
        />
        <h1 className="text-3xl font-semibold mb-2">Something broke.</h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          An unhandled error reached the render boundary. Hit retry to
          re-render this surface; if it keeps happening, the error
          message below is the place to start.
        </p>
        {error.message && (
          <pre className="text-left text-[11px] font-mono bg-neutral-900 border border-neutral-800 rounded-md p-3 overflow-x-auto mb-2 text-red-300/90">
{error.message}
          </pre>
        )}
        {error.digest && (
          <p className="text-[10px] text-neutral-600 mb-6">
            digest: <code className="text-neutral-500">{error.digest}</code>
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
          >
            Retry
          </button>
          <Link
            href="/c/home"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900 text-neutral-300"
          >
            Back to the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
