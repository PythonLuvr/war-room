"use client";

// Invite-teammates surface. War Room is local-first today; "inviting"
// genuinely means giving someone the install instructions + (when
// configured) the sync server URL so their install can talk to yours.
//
// This modal is honest about that: it shows different copy depending on
// whether you've configured a sync server yet, and gives copy-paste
// payloads for both cases. No fake "send invite link" button that
// doesn't actually do anything.

import { useEffect, useState } from "react";
import {
  X,
  UserPlus,
  Download,
  Cloud,
  Copy,
  Check as CheckIcon,
  Sparkles,
  ExternalLink,
} from "lucide-react";

type OnboardingShape = {
  settings?: Record<string, string | null>;
};

const REPO_URL = "https://github.com/pythonluvr/war-room";

export function InviteModal({ onClose }: { onClose: () => void }) {
  const [syncUrl, setSyncUrl] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: OnboardingShape) => {
        setSyncUrl(d.settings?.["onboarding.syncUrl"] ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  };

  const hasSync = !!syncUrl.trim();

  const installSnippet = [
    `git clone ${REPO_URL}.git`,
    "cd war-room",
    "npm install",
    "npm run dev",
  ].join("\n");

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-semibold">Invite teammates</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-sm text-neutral-300 leading-relaxed">
            War Room is <strong className="text-neutral-100">local-first</strong>. Each teammate
            runs their own copy of the app on their own machine. Inviting someone is two steps:
            (1) they install War Room, and (2) once you have a sync server running, you give them
            the URL so the installs can see each other.
          </div>

          <Section
            icon={<Download className="w-4 h-4 text-neutral-300" />}
            title="1. Send them the install"
            subtitle="Anything that runs Node 20+ will do, Mac, Linux, Windows."
          >
            <pre className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre">
{installSnippet}
            </pre>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => copy("install", installSnippet)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
              >
                {copied === "install" ? (
                  <>
                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-amber-300"
              >
                Repo
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </Section>

          <Section
            icon={<Cloud className="w-4 h-4 text-sky-300" />}
            title="2. Connect the installs"
            subtitle={
              hasSync
                ? "Sync is configured, share the URL below and your installs see each other."
                : "Sync isn't set up yet, without it, each install only knows about itself."
            }
          >
            {!loaded ? (
              <div className="text-xs text-neutral-600">Loading…</div>
            ) : hasSync ? (
              <>
                <pre className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap break-all">
                  {syncUrl}
                </pre>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => copy("sync", syncUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
                  >
                    {copied === "sync" ? (
                      <>
                        <CheckIcon className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy URL
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-neutral-600">
                    They paste it under <strong className="text-neutral-500">Settings → Sync</strong> on
                    their install.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-neutral-400 leading-relaxed mb-2">
                  No sync URL set yet. Until you stand up a sync relay, teammate installs run in
                  isolation, local-only is a real mode, not a bug, but cross-machine mentions /
                  shared activity / presence don&apos;t work.
                </div>
                <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal pl-5 mb-3">
                  <li>
                    Stand up a sync relay on a host you control. The reference implementation
                    will land in <code className="text-neutral-500">tools/</code> in the repo
                    (tracked alongside <code className="text-neutral-500">install-livekit.sh</code>).
                  </li>
                  <li>
                    Open <strong className="text-neutral-300">Settings → Sync</strong> and paste
                    the relay URL.
                  </li>
                  <li>Come back here and grab the share-ready URL.</li>
                </ol>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("war-room:open-settings", { detail: { tab: "sync" } }),
                    );
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25"
                >
                  <Cloud className="w-3 h-3" />
                  Open Sync settings
                </button>
              </>
            )}
          </Section>

          <Section
            icon={<Sparkles className="w-4 h-4 text-amber-300" />}
            title="What works without sync"
            subtitle="Local-only mode is the default ship state."
          >
            <ul className="text-xs text-neutral-400 space-y-1 list-disc pl-5 leading-relaxed">
              <li>Their own AI agent in chat + the boardroom</li>
              <li>Their own jobs, decisions, knowledge entries, files</li>
              <li>LiveKit voice, if they point at the same LiveKit URL you do</li>
            </ul>
            <div className="text-[10px] text-neutral-600 mt-2 leading-snug">
              The thing sync unlocks is{" "}
              <strong className="text-neutral-500">cross-install visibility</strong>, teammates
              showing up in your sidebar, mentions reaching their machine, shared activity feed.
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      </div>
      {subtitle && (
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{subtitle}</p>
      )}
      <div>{children}</div>
    </section>
  );
}
