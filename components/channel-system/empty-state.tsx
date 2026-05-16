// Shared empty-state card. One WarBit mood + a single line of
// explanation. Used by channel surfaces that may be empty on cold
// install so users see "feature exists, nothing to show yet" instead
// of a broken-looking blank panel.

type Mood = "sleepy" | "friendly" | "calm" | "happy" | "confused" | "alert" | "default";

export function EmptyState({
  mood,
  title,
  body,
}: {
  mood: Mood;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/war-bit/${mood}.png`}
        alt=""
        width={128}
        height={128}
        className="w-28 h-28 mb-4 [image-rendering:pixelated] opacity-80"
      />
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 max-w-md leading-relaxed">{body}</p>
    </div>
  );
}
