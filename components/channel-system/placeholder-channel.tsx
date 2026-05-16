// Placeholder surface for System channels that don't have real content
// yet (approvals queue when nothing is pending, sessions list before
// any chat has run). WarBit's "sleepy" variant communicates "feature
// exists, nothing to show right now" instead of broken-empty.

export function PlaceholderChannel({
  kind,
  title,
  hint,
}: {
  kind: "approvals" | "sessions";
  title: string;
  hint: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/war-bit/sleepy.png"
        alt=""
        width={128}
        height={128}
        className="w-28 h-28 mb-4 [image-rendering:pixelated] opacity-80"
      />
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{hint}</p>
      <p className="text-[10px] text-neutral-600 mt-3 uppercase tracking-wider">
        {kind}
      </p>
    </div>
  );
}
