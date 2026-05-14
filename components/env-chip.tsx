const PALETTE: Record<string, string> = {
  EJ: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SHARED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CLIENT: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  DEFAULT: "bg-neutral-800 text-neutral-300 border-neutral-700",
};

export function EnvChip({ name }: { name: string }) {
  const prefix = name.split("_")[0]?.toUpperCase() ?? "";
  const cls = PALETTE[prefix] ?? PALETTE.DEFAULT;
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${cls}`}
      title={name}
    >
      {name}
    </span>
  );
}
