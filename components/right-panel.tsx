"use client";

import type { Channel } from "@/lib/channels";
import { PulseDot } from "./pulse-dot";
import { useEffect, useState } from "react";
import { Calendar, FileText, FolderOpen, Bot, User } from "lucide-react";
import { agentLabelFor, localMember } from "@/lib/team";
import { useIdentityVersion } from "@/lib/use-identity-version";

const LOCAL = localMember();

type AdapterMeta = {
  id: string;
  name: string;
  isConfigured: boolean;
  iconUrl: string | null;
};

export function RightPanel({ channel }: { channel: Channel | null }) {
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  // Re-render when the user updates their display name via the wizard so
  // the Agents + Humans rows pick up the new label.
  useIdentityVersion();

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AdapterMeta[] }) => {
        setAdapters(d.adapters ?? []);
        setActiveId(d.activeId ?? "");
      })
      .catch(() => {});
  }, []);

  const configured = adapters.filter((a) => a.isConfigured);

  if (!channel) return null;
  return (
    <aside className="w-60 shrink-0 border-l border-neutral-900 bg-neutral-950 px-4 py-5 overflow-y-auto hidden xl:block">
      <Section title="Properties">
        {channel.projectPath ? (
          <>
            <Prop icon={<FolderOpen className="w-3.5 h-3.5" />} label="cwd">
              <code
                className="text-[11px] text-neutral-400 truncate block"
                title={channel.projectPath}
              >
                {channel.projectPath}
              </code>
            </Prop>
            <Prop icon={<FileText className="w-3.5 h-3.5" />} label="brief">
              <span className="text-xs text-neutral-500">brief.md</span>
            </Prop>
            <Prop icon={<Calendar className="w-3.5 h-3.5" />} label="status">
              <span className="text-xs text-neutral-300">
                {channel.archived ? "finished" : "active"}
              </span>
            </Prop>
          </>
        ) : (
          <div className="text-xs text-neutral-600">System channel</div>
        )}
      </Section>

      <Section title={`Humans - ${1}`} icon={<User className="w-3 h-3" />}>
        <MemberRow name={LOCAL.name} role="you" tone="ok" kind="human" />
      </Section>

      <Section
        title={configured.length > 0 ? `Agents - ${configured.length}` : "Agents"}
        icon={<Bot className="w-3 h-3" />}
      >
        {configured.length === 0 ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("war-room:open-settings", { detail: { tab: "agent" } }))}
            className="text-xs text-neutral-500 italic hover:text-neutral-300 text-left flex items-center gap-1.5 w-full"
          >
            <Bot className="w-3 h-3" />
            <span>No agents in roster. Click to set up.</span>
          </button>
        ) : (
          configured.map((a) => (
            <MemberRow
              key={a.id}
              name={a.id === activeId ? agentLabelFor(LOCAL) : a.name}
              role={a.name.toLowerCase()}
              tone="ok"
              kind="agent"
              iconUrl={a.iconUrl}
              tag={a.id === activeId ? "primary" : undefined}
            />
          ))
        )}
      </Section>
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2 font-medium flex items-center gap-1.5">
        {icon && <span className="text-neutral-600">{icon}</span>}
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Prop({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 hover:bg-neutral-900/40 rounded-md px-2 py-1.5 -mx-2">
      <div className="text-neutral-600 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function MemberRow({
  name,
  role,
  tone,
  kind,
  iconUrl,
  tag,
}: {
  name: string;
  role: string;
  tone: "ok" | "warn" | "idle";
  kind: "agent" | "human";
  iconUrl?: string | null;
  /** Optional small marker shown to the right of the name, e.g. "primary". */
  tag?: string;
}) {
  const avatarClass =
    kind === "agent"
      ? "bg-gradient-to-br from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200"
      : "bg-gradient-to-br from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200";
  const nameClass = kind === "agent" ? "text-amber-200" : "text-sky-200";
  return (
    <div className="flex items-center gap-2 hover:bg-neutral-900/40 rounded-md px-2 py-1.5 -mx-2">
      <div
        className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] uppercase font-semibold ${avatarClass}`}
      >
        {kind === "agent" && iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="w-3.5 h-3.5" />
        ) : kind === "agent" ? (
          "✦"
        ) : (
          name[0]
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm truncate ${nameClass}`}>{name}</div>
        <div className="text-[10px] text-neutral-600 uppercase tracking-wider">{role}</div>
      </div>
      {tag && (
        <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mr-1">
          {tag}
        </span>
      )}
      <PulseDot tone={tone} size={6} />
    </div>
  );
}
