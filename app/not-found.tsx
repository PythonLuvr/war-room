// 404 surface. Fires for any unmatched route. Voice matches OpenWar:
// peer-level, no filler, no "Oh no!" performative copy.

import Link from "next/link";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-200 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/war-bit/confused.png"
          alt="WarBit, looking confused"
          width={256}
          height={256}
          className="w-40 h-40 mx-auto mb-6 [image-rendering:pixelated] opacity-90"
        />
        <h1 className="text-3xl font-semibold mb-2">404</h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          Hit a wall. This page doesn&apos;t exist or got moved.
        </p>
        <Link
          href="/c/home"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
