"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Bot,
  TrendingUp,
  Activity as ActivityIcon,
  FileText,
  LayoutDashboard,
  Home as HomeIcon,
  Gavel,
  Megaphone,
  BookOpen,
  Wrench,
  Folder,
  Briefcase,
} from "lucide-react";
import { useState } from "react";

export type WidgetId =
  | "home"
  | "boardroom"
  | "agent-flow"
  | "active-jobs"
  | "activity"
  | "activity-mix"
  | "recent-activity"
  | "leaderboard"
  | "recent-files";

type Widget = {
  id: WidgetId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

type LinkRow = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

// Sidebar widgets scroll the dashboard to that section. Order matches dashboard layout.
const WIDGETS: Widget[] = [
  { id: "home", label: "Home", Icon: HomeIcon, accent: "text-amber-300" },
  { id: "active-jobs", label: "Active jobs", Icon: Briefcase, accent: "text-emerald-300" },
  { id: "boardroom", label: "Boardroom", Icon: Users, accent: "text-violet-300" },
  { id: "activity", label: "Activity chart", Icon: TrendingUp, accent: "text-violet-300" },
  { id: "recent-activity", label: "Recent activity", Icon: ActivityIcon, accent: "text-sky-300" },
  { id: "recent-files", label: "Recent files", Icon: FileText, accent: "text-neutral-300" },
  { id: "agent-flow", label: "Agent flow", Icon: Bot, accent: "text-amber-300" },
];

// Surfaces that route to existing channel pages (decisions, knowledge libraries, etc.)
const LINKS: LinkRow[] = [
  { href: "/c/user/s6-decisions", label: "Decisions", Icon: Gavel, accent: "text-violet-300" },
  { href: "/c/user/s6-announcements", label: "Announcements", Icon: Megaphone, accent: "text-amber-300" },
  { href: "/c/user/s6-playbook", label: "Playbook", Icon: BookOpen, accent: "text-emerald-300" },
  { href: "/c/user/s6-tools", label: "Tools", Icon: Wrench, accent: "text-emerald-300" },
  { href: "/c/user/s6-references", label: "References", Icon: Folder, accent: "text-emerald-300" },
  { href: "/c/user/s6-clients-vault", label: "Clients vault", Icon: Folder, accent: "text-emerald-300" },
];

export function DashboardWidgets() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  // search?.get("panel") is reserved for future "highlight active panel"
  // wiring; keeping the import here so the eventual addition is one-line.
  void search;
  const onHome = pathname === "/c/home";

  return (
    <div className="mb-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1 px-3 py-1 text-xs uppercase tracking-wider font-semibold text-neutral-500 hover:text-neutral-300"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <LayoutDashboard className="w-3 h-3 text-neutral-600" />
        <span>Dashboard</span>
        <span className="ml-auto text-neutral-700">{WIDGETS.length}</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col">
          {WIDGETS.map((w) => {
            const isHome = w.id === "home";
            const href = isHome ? "/c/home" : `/c/home#${w.id}`;
            const Icon = w.Icon;
            const onClick = (e: React.MouseEvent) => {
              if (!onHome) return; // off /c/home — let the link navigate normally
              const targetId = isHome ? "overview" : w.id;
              const el = document.getElementById(targetId);
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            };
            return (
              <Link
                key={w.id}
                href={href}
                onClick={onClick}
                className="mx-2 px-2 py-1 rounded-md flex items-center gap-2 text-sm transition-colors text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${w.accent}`} />
                <span className="truncate flex-1">{w.label}</span>
              </Link>
            );
          })}

          {/* Routes to existing channel-page surfaces (decisions, knowledge wikis, etc.) */}
          <div className="my-2 border-t border-neutral-900/80" />
          {LINKS.map((l) => {
            const isActive = pathname === l.href;
            const Icon = l.Icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`mx-2 px-2 py-1 rounded-md flex items-center gap-2 text-sm transition-colors ${
                  isActive
                    ? "bg-white/[0.08] text-neutral-50"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${l.accent}`} />
                <span className="truncate flex-1">{l.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
