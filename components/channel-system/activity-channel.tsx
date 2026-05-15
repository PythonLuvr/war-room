"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { colorForPath } from "@/lib/workspace-color";

type ActivityRow = {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  project_path: string | null;
  created_at: number;
};

const KIND_META: Record<string, { dot: string; label: string }> = {
  "chat.user": { dot: "bg-sky-500", label: "you" },
  "chat.assistant": { dot: "bg-emerald-500", label: "claude" },
  "chat.tool": { dot: "bg-amber-500", label: "tool" },
  "service.check": { dot: "bg-neutral-500", label: "check" },
  "service.down": { dot: "bg-red-500", label: "down" },
  "approval.new": { dot: "bg-violet-500", label: "approval" },
  system: { dot: "bg-neutral-600", label: "system" },
};

export function ActivityChannel() {
  const [items, setItems] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/activity")
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []));
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="overflow-y-auto px-6 py-5 flex-1">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-sky-400" />
        <h2 className="text-xl font-semibold">Activity feed</h2>
        <span className="ml-auto text-xs text-neutral-500">
          {items === null ? "…" : `${items.length} events`}
        </span>
      </div>

      {items === null ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-neutral-600">
          No activity yet. Send a chat message or refresh services.
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((row) => {
            const m = KIND_META[row.kind] ?? { dot: "bg-neutral-600", label: row.kind };
            const ws = colorForPath(row.project_path);
            return (
              <div
                key={row.id}
                className="relative flex items-start gap-3 py-2.5 pl-5 border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/30 -mx-2 px-2 rounded"
              >
                <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-sm ${ws.stripe}`} title={ws.label} />
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-neutral-200 truncate">{row.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${ws.chip}`}>
                        {ws.label}
                      </span>
                      <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        {m.label}
                      </span>
                    </div>
                  </div>
                  {row.detail && (
                    <div className="text-xs text-neutral-500 truncate mt-0.5">{row.detail}</div>
                  )}
                </div>
                <div className="text-[10px] text-neutral-600 shrink-0 mt-1">
                  {new Date(row.created_at).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Static widths — Math.random in render breaks React purity. Repeating the
// pattern looks identical to the eye while keeping reconciliation stable.
const SKELETON_TOP = [62, 48, 70, 55, 44, 68];
const SKELETON_BOTTOM = [38, 52, 33, 47, 41, 35];

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {SKELETON_TOP.map((top, i) => (
        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-neutral-900">
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 bg-neutral-800/80 rounded animate-pulse"
              style={{ width: `${top}%` }}
            />
            <div
              className="h-2.5 bg-neutral-900 rounded animate-pulse"
              style={{ width: `${SKELETON_BOTTOM[i]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
