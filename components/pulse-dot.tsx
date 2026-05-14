type Tone = "ok" | "warn" | "bad" | "idle";

const TONES: Record<Tone, { dot: string; ring: string }> = {
  ok: { dot: "bg-emerald-500", ring: "bg-emerald-500/30" },
  warn: { dot: "bg-amber-500", ring: "bg-amber-500/30" },
  bad: { dot: "bg-red-500", ring: "bg-red-500/30" },
  idle: { dot: "bg-neutral-600", ring: "bg-neutral-600/20" },
};

export function PulseDot({ tone = "ok", size = 8 }: { tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className={`absolute inset-0 rounded-full ${t.ring} ${tone !== "idle" ? "animate-ping" : ""}`}
      />
      <span className={`relative rounded-full ${t.dot}`} style={{ width: size, height: size }} />
    </span>
  );
}
