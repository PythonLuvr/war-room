"use client";

// Settings -> Sync -> Hosting panel. Lets a teammate host the
// workspace from their machine via one of four modes:
//
//   "Share over the internet (instant)"       cloudflare-quick (default)
//   "Share over the internet (permanent URL)" cloudflare-named
//   "Share over private network"              tailscale
//   "Connect to my own server"                manual
//
// All four use the embedded sync server on 127.0.0.1; only the tunnel
// surface in front changes.

import { useEffect, useState } from "react";
import { Globe, ShieldCheck, Network, Server, RefreshCw, AlertTriangle } from "lucide-react";
import { InviteBlock } from "./settings-hosting-invite-block";

type HostingMode = "cloudflare-quick" | "cloudflare-named" | "tailscale" | "manual";

type HostingStatus = {
  enabled: boolean;
  mode: HostingMode;
  workspace: string;
  url: string | null;
  port: number | null;
  adapter: { state: string; message?: string; url?: string };
  lastSharedUrl: string | null;
  urlChanged: boolean;
  fetch:
    | {
        phase: string;
        bytesDownloaded?: number;
        bytesTotal?: number | null;
        message?: string;
      }
    | null;
  token: string;
  namedTunnelToken: string | null;
  invite: string | null;
};

const MODE_OPTIONS: Array<{
  value: HostingMode;
  outcome: string;
  brand: string;
  icon: React.ReactNode;
}> = [
  {
    value: "cloudflare-quick",
    outcome: "Share over the internet (instant)",
    brand: "Cloudflare Quick Tunnel  -  Free. URL changes on restart.",
    icon: <Globe className="w-4 h-4" />,
  },
  {
    value: "cloudflare-named",
    outcome: "Share over the internet (permanent URL)",
    brand: "Cloudflare Named Tunnel  -  Needs a Cloudflare account and a domain.",
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    value: "tailscale",
    outcome: "Share over private network",
    brand: "Tailscale  -  Every teammate installs Tailscale and joins your tailnet.",
    icon: <Network className="w-4 h-4" />,
  },
  {
    value: "manual",
    outcome: "Connect to my own server",
    brand: "Manual VPS  -  You ran tools/reference-sync-server/ somewhere.",
    icon: <Server className="w-4 h-4" />,
  },
];

export function HostingPanel() {
  const [status, setStatus] = useState<HostingStatus | null>(null);
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [namedTokenDraft, setNamedTokenDraft] = useState("");
  const [namedUrlDraft, setNamedUrlDraft] = useState("");
  const [manualUrlDraft, setManualUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/sync/hosting");
      const d: HostingStatus = await r.json();
      setStatus(d);
      if (!workspaceDraft) setWorkspaceDraft(d.workspace);
      if (!namedTokenDraft && d.namedTunnelToken) setNamedTokenDraft(d.namedTunnelToken);
      if (!namedUrlDraft && d.lastSharedUrl && d.mode === "cloudflare-named") {
        setNamedUrlDraft(d.lastSharedUrl);
      }
      if (!manualUrlDraft && d.lastSharedUrl && d.mode === "manual") {
        setManualUrlDraft(d.lastSharedUrl);
      }
    } catch {
      // Network error; leave previous status visible.
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/sync/hosting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d: HostingStatus = await r.json();
      setStatus(d);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <div className="text-xs text-neutral-500">Loading hosting status...</div>;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-neutral-400 leading-relaxed">
        Host the workspace from this machine. Teammates paste your invite into
        their own War Room. Only one teammate hosts at a time per workspace.
      </p>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-neutral-500">
          Sync workspace
        </label>
        <input
          value={workspaceDraft}
          onChange={(e) => setWorkspaceDraft(e.target.value)}
          onBlur={() => {
            if (workspaceDraft.trim() && workspaceDraft.trim() !== status.workspace) {
              void post({ action: "set-workspace", workspace: workspaceDraft.trim() });
            }
          }}
          placeholder="my-team"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-700"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-neutral-500">
          Hosting mode
        </label>
        <div className="space-y-1.5">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => post({ action: "set-mode", mode: opt.value })}
              className={`w-full text-left flex items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
                status.mode === opt.value
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
              }`}
            >
              <span className="text-neutral-400 mt-0.5">{opt.icon}</span>
              <span className="flex-1">
                <span className="text-sm text-neutral-200 block">{opt.outcome}</span>
                <span className="text-[11px] text-neutral-500">{opt.brand}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {status.mode === "tailscale" && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-200">
          Free for up to 3 teammates (including you). Larger teams pay
          Tailscale&apos;s subscription.
        </div>
      )}

      {status.mode === "cloudflare-named" && (
        <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500">
            Cloudflare Named Tunnel config
          </div>
          <input
            value={namedTokenDraft}
            onChange={(e) => setNamedTokenDraft(e.target.value)}
            placeholder="Tunnel token from your Cloudflare dashboard"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-xs font-mono"
          />
          <input
            value={namedUrlDraft}
            onChange={(e) => setNamedUrlDraft(e.target.value)}
            placeholder="https://war-room.your-domain.com"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-xs font-mono"
          />
          <button
            onClick={() =>
              post({
                action: "set-named-config",
                tunnelToken: namedTokenDraft.trim(),
                publicUrl: namedUrlDraft.trim(),
              })
            }
            disabled={busy || !namedTokenDraft.trim() || !namedUrlDraft.trim()}
            className="text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 px-3 py-1.5 disabled:opacity-40"
          >
            Save tunnel config
          </button>
        </div>
      )}

      {status.mode === "manual" && (
        <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500">
            Your server URL
          </div>
          <input
            value={manualUrlDraft}
            onChange={(e) => setManualUrlDraft(e.target.value)}
            placeholder="ws://your-vps:8788/war-room-sync"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2 py-1.5 text-xs font-mono"
          />
          <button
            onClick={() => post({ action: "set-manual-url", url: manualUrlDraft.trim() })}
            disabled={busy || !manualUrlDraft.trim()}
            className="text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 px-3 py-1.5 disabled:opacity-40"
          >
            Save URL
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {status.enabled ? (
          <button
            onClick={() => post({ action: "stop" })}
            disabled={busy}
            className="text-xs rounded-md bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 px-3 py-1.5 disabled:opacity-40"
          >
            Stop hosting
          </button>
        ) : (
          <button
            onClick={() => post({ action: "start" })}
            disabled={busy}
            className="text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 px-3 py-1.5 disabled:opacity-40"
          >
            Host this workspace from this machine
          </button>
        )}
        {status.enabled && (
          <button
            onClick={() => post({ action: "rotate-token" })}
            disabled={busy}
            className="text-xs rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 px-3 py-1.5 inline-flex items-center gap-1.5"
            title="Generate a new token and restart. Teammates will need the new invite."
          >
            <RefreshCw className="w-3 h-3" />
            Rotate token
          </button>
        )}
      </div>

      {status.urlChanged && status.url && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1 text-[12px] text-amber-100">
            <strong>Your tunnel URL changed.</strong> The old invite no longer
            works. Copy the new invite below and re-share with your teammates.
          </div>
        </div>
      )}

      {status.fetch && status.fetch.phase !== "done" && (
        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
          {status.fetch.phase === "downloading"
            ? `Downloading tunnel software... ${formatBytes(status.fetch.bytesDownloaded ?? 0)}${status.fetch.bytesTotal ? ` / ${formatBytes(status.fetch.bytesTotal)}` : ""}`
            : `Setting up tunnel software (${status.fetch.phase})...`}
        </div>
      )}

      {status.invite && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500">
            Invite block
          </div>
          <InviteBlock invite={status.invite} />
          <p className="text-[11px] text-neutral-500">
            Paste this into Slack, Discord, email, or SMS. Teammates open
            Settings -&gt; Sync, paste it into the Join field.
          </p>
        </div>
      )}

      <div className="text-[11px] text-neutral-500 leading-relaxed">
        Status:{" "}
        <span className="text-neutral-300">{adapterLabel(status)}</span>
      </div>
    </div>
  );
}

function adapterLabel(s: HostingStatus): string {
  if (!s.enabled) return "Not hosting";
  if (s.adapter.state === "running") return `Running on port ${s.port}`;
  if (s.adapter.state === "starting") return s.adapter.message ?? "Starting...";
  if (s.adapter.state === "error") return `Error: ${s.adapter.message ?? "unknown"}`;
  return s.adapter.state;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
