"use client";

import type { Channel } from "@/lib/channels";
import { PulseDot } from "./pulse-dot";
import { useEffect, useState } from "react";
import { Calendar, FileText, FolderOpen, Bot } from "lucide-react";
import { localMember } from "@/lib/team";
import { useIdentityVersion } from "@/lib/use-identity-version";

const LOCAL = localMember();

type AdapterMeta = {
  id: string;
  name: string;
  defaultName?: string;
  isConfigured: boolean;
  iconUrl: string | null;
};

type SidebarRole = { id: number; name: string; color: string | null; position: number };
type SidebarAssignment = { role_id: number; member_kind: string; member_id: string };

const ROLE_DOT_COLOR: Record<string, string> = {
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  rose: "bg-rose-500",
  neutral: "bg-neutral-500",
};

export function RightPanel({ channel }: { channel: Channel | null }) {
  const [adapters, setAdapters] = useState<AdapterMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [myIconUrl, setMyIconUrl] = useState<string>("");
  const [roles, setRoles] = useState<SidebarRole[]>([]);
  const [assignments, setAssignments] = useState<SidebarAssignment[]>([]);
  // Re-render when the user updates their display name via the wizard so
  // the rows pick up the new label.
  const identityVersion = useIdentityVersion();

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AdapterMeta[] }) => {
        setAdapters(d.adapters ?? []);
        setActiveId(d.activeId ?? "");
      })
      .catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: { iconUrl: string }) => setMyIconUrl(d.iconUrl ?? ""))
      .catch(() => {});
    fetch("/api/sidebar-roles")
      .then((r) => r.json())
      .then((d: { roles: SidebarRole[]; assignments: SidebarAssignment[] }) => {
        setRoles(d.roles ?? []);
        setAssignments(d.assignments ?? []);
      })
      .catch(() => {});
  }, [identityVersion]);

  const configured = adapters.filter((a) => a.isConfigured);

  type Member = {
    kind: "agent" | "human";
    id: string;
    name: string;
    role: string;
    iconUrl: string | null;
    tag?: string;
  };

  const allMembers: Member[] = [
    {
      kind: "human",
      id: "local",
      name: LOCAL.name,
      role: "you",
      iconUrl: myIconUrl || null,
    },
    ...configured.map<Member>((a) => ({
      kind: "agent",
      id: a.id,
      name: a.name,
      role: a.defaultName?.toLowerCase() ?? a.name.toLowerCase(),
      iconUrl: a.iconUrl,
      tag: a.id === activeId ? "primary" : undefined,
    })),
  ];

  const roleByMember = (m: Member): number | null => {
    return assignments.find((x) => x.member_kind === m.kind && x.member_id === m.id)?.role_id ?? null;
  };

  // Group: each role section gets its members, plus a final "Members"
  // catch-all for anything unassigned. Roles with zero members are
  // hidden so empty role names don't visually litter the sidebar.
  const grouped: Array<{ key: string; label: string; color: string | null; members: Member[] }> = [];
  for (const r of roles) {
    const members = allMembers.filter((m) => roleByMember(m) === r.id);
    if (members.length > 0) {
      grouped.push({ key: `role-${r.id}`, label: r.name, color: r.color, members });
    }
  }
  const unassigned = allMembers.filter((m) => roleByMember(m) === null);
  if (unassigned.length > 0) {
    grouped.push({
      key: "unassigned",
      label: roles.length > 0 ? "Members" : `Members - ${unassigned.length}`,
      color: null,
      members: unassigned,
    });
  }

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

      {configured.length === 0 && (
        <Section title="Agents" icon={<Bot className="w-3 h-3" />}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("war-room:open-settings", { detail: { tab: "agent" } }))}
            className="text-xs text-neutral-500 italic hover:text-neutral-300 text-left flex items-center gap-1.5 w-full"
          >
            <Bot className="w-3 h-3" />
            <span>No agents in roster. Click to set up.</span>
          </button>
        </Section>
      )}

      {grouped.map((g) => (
        <Section
          key={g.key}
          title={`${g.label} - ${g.members.length}`}
          icon={
            g.color ? (
              <span className={`w-2 h-2 rounded-full ${ROLE_DOT_COLOR[g.color] ?? "bg-neutral-500"}`} />
            ) : undefined
          }
        >
          {g.members.map((m) => (
            <MemberRow
              key={`${m.kind}-${m.id}`}
              name={m.name}
              role={m.role}
              tone="ok"
              kind={m.kind}
              iconUrl={m.iconUrl}
              tag={m.tag}
            />
          ))}
        </Section>
      ))}
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
  const hasImage = !!iconUrl;
  const nameClass = kind === "agent" ? "text-amber-200" : "text-neutral-100";
  return (
    <div className="flex items-center gap-2 hover:bg-neutral-900/40 rounded-md px-2 py-1.5 -mx-2">
      {hasImage ? (
        <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl!} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        // Neutral grey + first letter when there's no image. Distinguishable
        // across people / agents without rainbow gradients.
        <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] uppercase font-semibold text-neutral-300 shrink-0">
          {kind === "agent" ? "✦" : name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
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
