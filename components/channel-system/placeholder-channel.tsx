import { CheckSquare, MessageSquare } from "lucide-react";

const ICONS = {
  approvals: CheckSquare,
  sessions: MessageSquare,
} as const;

export function PlaceholderChannel({
  kind,
  title,
  hint,
}: {
  kind: "approvals" | "sessions";
  title: string;
  hint: string;
}) {
  const Icon = ICONS[kind];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-neutral-500" />
      </div>
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{hint}</p>
    </div>
  );
}
