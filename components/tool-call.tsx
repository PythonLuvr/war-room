"use client";

import {
  BookOpen,
  FilePenLine,
  Terminal,
  Search,
  Globe,
  FileText,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Read: BookOpen,
  Edit: FilePenLine,
  Write: FileText,
  Bash: Terminal,
  PowerShell: Terminal,
  Grep: Search,
  Glob: Search,
  WebFetch: Globe,
  WebSearch: Globe,
};

export function ToolCall({ name, input }: { name: string; input: unknown }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[name] ?? Wrench;

  let summary = "";
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    summary =
      (obj.file_path as string) ||
      (obj.command as string) ||
      (obj.pattern as string) ||
      (obj.url as string) ||
      "";
  }

  return (
    <div className="border border-neutral-800/80 rounded-lg bg-neutral-900/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-900/60 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
        )}
        <Icon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="text-xs font-medium text-neutral-300">{name}</span>
        {summary && (
          <span className="text-xs text-neutral-500 truncate font-mono">{summary}</span>
        )}
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10px] text-neutral-500 overflow-x-auto max-h-64 font-mono">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
