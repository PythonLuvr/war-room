"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, Lock, FolderOpen, X, Folder } from "lucide-react";
import { FolderPicker } from "@/components/folder-picker";

export type ChannelDraft = {
  name: string;
  isPrivate: boolean;
  projectPath: string;
  description: string;
};

type Project = { path: string; label: string; group: string };

type Props = {
  mode: "create" | "edit";
  initial?: Partial<ChannelDraft>;
  groupLabel?: string;
  serverName?: string;
  onSave: (draft: ChannelDraft) => Promise<void> | void;
  onClose: () => void;
};

export function ChannelDialog({ mode, initial, groupLabel, serverName, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [isPrivate, setIsPrivate] = useState(!!initial?.isPrivate);
  const [projectPath, setProjectPath] = useState(initial?.projectPath ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [picks, setPicks] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { projects?: Project[] }) => setPicks(d.projects ?? []));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        isPrivate,
        projectPath: projectPath.trim(),
        description: description.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const groupedPicks: Record<string, Project[]> = {};
  for (const p of picks) (groupedPicks[p.group] ??= []).push(p);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] drawer-fade" />
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-md h-full shadow-2xl flex flex-col drawer-slide"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Create channel" : "Edit channel"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {mode === "create" && groupLabel
                ? `In ${serverName ? `${serverName} → ` : ""}${groupLabel}`
                : "Name, working directory, privacy"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <Label>Channel name</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600">
                {isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <Hash className="w-3.5 h-3.5" />}
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="general"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence on what this channel is for."
              rows={2}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Working directory</Label>
              <span className="text-[10px] text-neutral-600">
                Where the agent runs for this channel
              </span>
            </div>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <FolderOpen className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="Absolute path (optional, leave blank for default)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700"
                />
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                title="Browse folders"
                className="px-2.5 rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1 text-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
            {Object.keys(groupedPicks).length > 0 && (
              <div className="mt-2 space-y-2">
                {Object.entries(groupedPicks).map(([grp, list]) => (
                  <div key={grp}>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                      {grp}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((p) => (
                        <button
                          key={p.path}
                          onClick={() => setProjectPath(p.path)}
                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${
                            projectPath === p.path
                              ? "bg-sky-500/15 border-sky-500/40 text-sky-200"
                              : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                          }`}
                          title={p.path}
                        >
                          <Folder className="w-3 h-3" />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Privacy</Label>
            <div className="flex gap-2">
              <PrivacyOption
                active={!isPrivate}
                onClick={() => setIsPrivate(false)}
                icon={<Hash className="w-3.5 h-3.5" />}
                title="Public"
                hint="Everyone in the server"
              />
              <PrivacyOption
                active={isPrivate}
                onClick={() => setIsPrivate(true)}
                icon={<Lock className="w-3.5 h-3.5" />}
                title="Private"
                hint="Only you (for now)"
                amber
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || saving}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
          </button>
        </div>
      </div>
      {pickerOpen && (
        <FolderPicker
          initialPath={projectPath || undefined}
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            setProjectPath(p);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-medium">
      {children}
    </div>
  );
}

function PrivacyOption({
  active,
  onClick,
  icon,
  title,
  hint,
  amber,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
  amber?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-start gap-2 px-3 py-2.5 rounded-md border text-left transition-colors ${
        active
          ? amber
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
            : "border-sky-500/40 bg-sky-500/10 text-sky-200"
          : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
      }`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[10px] text-neutral-500 mt-0.5">{hint}</div>
      </div>
    </button>
  );
}
