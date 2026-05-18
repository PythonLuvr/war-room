"use client";

// Persistent chrome indicator visible from every screen while this
// machine is hosting a War Room workspace. Click jumps to Settings ->
// Sync. Doubles as the educational guardrail for single-host
// discipline: at a glance you know whether YOU are the one running
// the tunnel, so the answer to "who's the source of truth?" is
// always visible.

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

type Status = {
  enabled: boolean;
  workspace: string;
  adapter: { state: string; message?: string };
  urlChanged: boolean;
};

export function HostingIndicator() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/sync/hosting")
        .then((r) => r.json())
        .then((d: Status) => setStatus(d))
        .catch(() => {});
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, []);

  if (!status?.enabled) return null;

  const dotClass =
    status.adapter.state === "running"
      ? "bg-emerald-400 animate-pulse"
      : status.adapter.state === "starting"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500";

  const tooltip =
    status.adapter.state === "running"
      ? `Hosting ${status.workspace}`
      : status.adapter.state === "starting"
        ? (status.adapter.message ?? "Starting tunnel...")
        : `Error: ${status.adapter.message ?? "unknown"}`;

  return (
    <button
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("war-room:open-settings", { detail: { tab: "sync" } }),
        )
      }
      title={tooltip}
      className="fixed top-2 left-2 z-40 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-900/90 border border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-300 hover:border-neutral-700 backdrop-blur"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <Radio className="w-3 h-3" />
      <span>Hosting {status.workspace}</span>
      {status.urlChanged && (
        <span className="ml-1 px-1 rounded bg-amber-500/30 text-amber-100">URL changed</span>
      )}
    </button>
  );
}
