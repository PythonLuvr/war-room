"use client";

// Single source of truth for "what graphic represents this agent in the
// UI." Resolution order (per agent):
//   1. The user's per-agent override (`onboarding.agentIcon`) when it's
//      set to a real URL — wins for the LOCAL agent only.
//   2. The adapter's own iconUrl (Claude / GPT / Gemini brand mark for
//      the matching adapters; null for custom).
//   3. Fallback: a Sparkles glyph or first-letter initial inside a
//      colored circle.
//
// SVGs in /public/agent-logos/ are monochrome and use currentColor, so
// they tint to whatever text color the surrounding bubble carries.

import { Sparkles } from "lucide-react";

type Tone =
  | "amber"
  | "sky"
  | "emerald"
  | "violet"
  | "fuchsia"
  | "rose";

const RING: Record<Tone, string> = {
  amber: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200",
  sky: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200",
  emerald: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40 text-emerald-200",
  violet: "from-violet-500/30 to-violet-700/20 border-violet-500/40 text-violet-200",
  fuchsia: "from-fuchsia-500/30 to-fuchsia-700/20 border-fuchsia-500/40 text-fuchsia-200",
  rose: "from-rose-500/30 to-rose-700/20 border-rose-500/40 text-rose-200",
};

const SIZE: Record<"sm" | "md" | "lg", { box: string; icon: string }> = {
  sm: { box: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { box: "w-9 h-9", icon: "w-4 h-4" },
  lg: { box: "w-11 h-11", icon: "w-5 h-5" },
};

export function AgentAvatar({
  iconUrl,
  fallbackText,
  tone = "amber",
  size = "md",
  alt = "",
}: {
  /** Resolved icon URL — `null` to fall through to the glyph/initial. */
  iconUrl: string | null;
  /** Used when iconUrl is null. First character is rendered as the initial. */
  fallbackText?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  alt?: string;
}) {
  const ring = RING[tone];
  const s = SIZE[size];
  return (
    <div
      className={`${s.box} rounded-full border bg-gradient-to-br flex items-center justify-center shrink-0 ${ring}`}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt={alt} className={s.icon} />
      ) : fallbackText ? (
        <span className="text-xs font-semibold">{fallbackText[0]?.toUpperCase()}</span>
      ) : (
        <Sparkles className={s.icon} />
      )}
    </div>
  );
}
