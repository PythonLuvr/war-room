"use client";

// Settings modal — tabbed surface for everything that doesn't deserve its own
// top-level surface. Triggered by the rail's settings gear (and the cloud
// button, which opens directly on the Sync tab).

import { useEffect, useState } from "react";
import {
  Cloud,
  Info,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  X,
} from "lucide-react";

export type SettingsTab = "general" | "boardroom" | "sync" | "about";

type AboutInfo = { version: string; name: string; repo: string | null };

export function SettingsModal({
  initialTab = "general",
  onClose,
}: {
  initialTab?: SettingsTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [about, setAbout] = useState<AboutInfo | null>(null);

  useEffect(() => {
    fetch("/api/about")
      .then((r) => r.json())
      .then(setAbout)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-neutral-400" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Tab rail */}
          <div className="w-48 shrink-0 border-r border-neutral-800 py-3 flex flex-col">
            <TabButton current={tab} value="general" icon={<SettingsIcon className="w-3.5 h-3.5" />} onSelect={setTab}>
              General
            </TabButton>
            <TabButton current={tab} value="boardroom" icon={<Users className="w-3.5 h-3.5" />} onSelect={setTab}>
              Boardroom
            </TabButton>
            <TabButton current={tab} value="sync" icon={<Cloud className="w-3.5 h-3.5" />} onSelect={setTab}>
              Sync
            </TabButton>
            <TabButton current={tab} value="about" icon={<Info className="w-3.5 h-3.5" />} onSelect={setTab}>
              About
            </TabButton>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === "general" && <GeneralTab onClose={onClose} />}
            {tab === "boardroom" && <BoardroomTab />}
            {tab === "sync" && <SyncTab />}
            {tab === "about" && <AboutTab about={about} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  current,
  value,
  icon,
  onSelect,
  children,
}: {
  current: SettingsTab;
  value: SettingsTab;
  icon: React.ReactNode;
  onSelect: (v: SettingsTab) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
        active ? "bg-neutral-900 text-neutral-100 border-l-2 border-amber-500" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 border-l-2 border-transparent"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function GeneralTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-6">
      <Section title="Setup" description="Re-run the welcome flow to update your identity, Claude CLI path, or workspace root.">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("war-room:open-onboarding"));
            onClose();
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Re-run setup wizard
        </button>
      </Section>

      <Section title="Onboarding state" description="Stored locally in ~/.war-room/app.db. Use the wizard to update.">
        <OnboardingSummary />
      </Section>
    </div>
  );
}

function OnboardingSummary() {
  const [data, setData] = useState<Record<string, string | null> | null>(null);
  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => setData(d.settings))
      .catch(() => {});
  }, []);
  if (!data) return <div className="text-xs text-neutral-600">Loading…</div>;
  return (
    <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono">
      <KV k="Identity" v={data["onboarding.identity"]} />
      <KV k="Display name" v={data["onboarding.displayName"]} />
      <KV k="Claude CLI" v={data["onboarding.claudeBin"]} />
      <KV k="Clients folder" v={data["onboarding.workspaceRoot"]} />
      <KV k="Sync opt-in" v={data["onboarding.syncOptIn"] === "1" ? "yes" : "no"} />
    </dl>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-neutral-300 truncate">{v || <span className="text-neutral-600">— unset —</span>}</dd>
    </>
  );
}

function BoardroomTab() {
  return (
    <div className="space-y-6">
      <Section title="Devices" description="Default camera and microphone for the Boardroom. For now devices are selected on the pre-join screen each time you start a meeting.">
        <div className="text-xs text-neutral-500 italic">
          Persistent device defaults — coming soon.
        </div>
      </Section>
      <Section title="Floating mini" description="The always-on-top bar that appears when you tab away from War Room during a call.">
        <div className="text-xs text-neutral-400">
          Currently enabled. To hide during a meeting, click the × on the strip itself.
          Re-opens automatically the next time you tab away.
        </div>
      </Section>
    </div>
  );
}

function SyncTab() {
  return (
    <div className="space-y-6">
      <Section title="Cross-machine sync" description="Bridges your dashboard with your teammates' dashboards so @-mentions, channels, jobs, and activity stay in sync.">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-neutral-600" />
          <span className="text-neutral-300">Not connected — sync server not deployed yet</span>
        </div>
        <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
          Until the shared sync service is live, every War Room instance runs purely local. Your channels, jobs, and knowledge entries live in
          <code className="mx-1 text-neutral-400">~/.war-room/app.db</code>
          on your machine only. When the sync service ships, you'll see it appear here with a connection toggle.
        </p>
      </Section>
      <Section title="Auto-update" description="The app pulls new versions from a self-hosted update server on launch.">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-neutral-300">Connected — checks for updates on every launch</span>
        </div>
      </Section>
    </div>
  );
}

function AboutTab({ about }: { about: AboutInfo | null }) {
  return (
    <div className="space-y-6">
      <Section title="Build">
        {about ? (
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-neutral-500">Name</dt>
            <dd className="text-neutral-200">{about.name}</dd>
            <dt className="text-neutral-500">Version</dt>
            <dd className="text-neutral-200 font-mono">v{about.version}</dd>
            <dt className="text-neutral-500">Update server</dt>
            <dd className="text-neutral-300 font-mono text-xs break-all">{about.repo ?? "—"}</dd>
          </dl>
        ) : (
          <div className="text-xs text-neutral-600">Loading…</div>
        )}
      </Section>
      <Section title="Credits" description="Built by EJ as a shared cockpit for himself, Kerem, and Wes. Open source dependencies listed in package.json.">
        <div />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-neutral-100 mb-1">{title}</h3>
      {description && <p className="text-xs text-neutral-500 mb-3 leading-relaxed max-w-xl">{description}</p>}
      {children}
    </section>
  );
}
