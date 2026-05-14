"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Gavel,
  Plus,
  X,
  Link as LinkIcon,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Trash2,
  Undo2,
  MoreHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { colorForAuthor } from "@/lib/workspace-color";

type Decision = {
  id: number;
  channel_id: string;
  title: string;
  summary: string;
  links_json: string | null;
  author: string;
  status: string;
  created_at: number;
};

export function DecisionsChannel({ channelId }: { channelId: string }) {
  const [items, setItems] = useState<Decision[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/decisions?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: number, status: "open" | "archived" | "reversed") => {
    setItems((cur) => (cur ? cur.map((d) => (d.id === id ? { ...d, status } : d)) : cur));
    await fetch("/api/decisions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const removeDecision = async (id: number) => {
    if (!confirm("Delete this decision permanently?")) return;
    setItems((cur) => (cur ? cur.filter((d) => d.id !== id) : cur));
    await fetch("/api/decisions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const visible = items
    ? items.filter((d) => (showArchived ? true : d.status === "open"))
    : null;
  const archivedCount = items ? items.filter((d) => d.status !== "open").length : 0;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3 mb-6">
        <Gavel className="w-5 h-5 text-violet-400" />
        <div>
          <h2 className="text-xl font-semibold">Decisions</h2>
          <p className="text-xs text-neutral-500">
            Append-only log · "what we agreed on" lives here
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-neutral-800 text-neutral-400 hover:bg-neutral-900"
            >
              {showArchived ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showArchived ? "Hide" : "Show"} archived ({archivedCount})
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-violet-500/15 border border-violet-500/40 text-violet-200 hover:bg-violet-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            Log decision
          </button>
        </div>
      </div>

      {visible === null ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-sm text-neutral-600">
          {items && items.length > 0 && !showArchived
            ? "All decisions archived. Toggle 'Show archived' to view."
            : "No decisions logged yet. The first one is the hardest."}
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-3xl">
          {visible.map((d) => (
            <DecisionCard
              key={d.id}
              d={d}
              onUpdateStatus={(s) => updateStatus(d.id, s)}
              onDelete={() => removeDecision(d.id)}
            />
          ))}
        </div>
      )}

      {creating && (
        <DecisionDialog
          channelId={channelId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function DecisionCard({
  d,
  onUpdateStatus,
  onDelete,
}: {
  d: Decision;
  onUpdateStatus: (s: "open" | "archived" | "reversed") => void;
  onDelete: () => void;
}) {
  const links: string[] = d.links_json ? (JSON.parse(d.links_json) as string[]) : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const archived = d.status !== "open";
  const reversed = d.status === "reversed";
  const author = colorForAuthor(d.author);
  return (
    <div
      className={`relative border rounded-xl bg-gradient-to-br p-5 transition-colors overflow-hidden ${
        reversed
          ? "border-red-900/50 from-red-950/20 to-neutral-950 opacity-70"
          : archived
            ? "border-neutral-800 from-neutral-900/50 to-neutral-950 opacity-60"
            : "border-neutral-800 from-neutral-900 to-neutral-950"
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${author.stripe}`} title={author.label} />
      <div className="flex items-start gap-3 mb-2">
        <div
          className={`text-[10px] uppercase tracking-wider font-semibold mt-1 ${
            reversed
              ? "text-red-400/80 line-through"
              : archived
                ? "text-neutral-500"
                : "text-violet-400/80"
          }`}
        >
          {reversed ? "reversed" : archived ? "archived" : "decision"}
        </div>
        <h3
          className={`text-base font-semibold flex-1 ${
            reversed ? "text-neutral-400 line-through" : "text-neutral-100"
          }`}
        >
          {d.title}
        </h3>
        <div className="text-[10px] text-neutral-600 shrink-0 mt-1">
          {new Date(d.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            title="More"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl py-1 text-sm">
                {d.status !== "open" && (
                  <MenuItem
                    icon={<Undo2 className="w-3.5 h-3.5" />}
                    label="Mark as active"
                    onClick={() => {
                      onUpdateStatus("open");
                      setMenuOpen(false);
                    }}
                  />
                )}
                {d.status !== "archived" && (
                  <MenuItem
                    icon={<Archive className="w-3.5 h-3.5" />}
                    label="Archive"
                    onClick={() => {
                      onUpdateStatus("archived");
                      setMenuOpen(false);
                    }}
                  />
                )}
                {d.status !== "reversed" && (
                  <MenuItem
                    icon={<ArchiveRestore className="w-3.5 h-3.5" />}
                    label="Mark as reversed"
                    onClick={() => {
                      onUpdateStatus("reversed");
                      setMenuOpen(false);
                    }}
                    accent="red"
                  />
                )}
                <div className="my-1 border-t border-neutral-800" />
                <MenuItem
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  label="Delete"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  accent="red"
                />
              </div>
            </>
          )}
        </div>
      </div>
      <p
        className={`text-sm whitespace-pre-wrap ${
          reversed ? "text-neutral-500 line-through" : "text-neutral-300"
        }`}
      >
        {d.summary}
      </p>
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-neutral-800 bg-neutral-900 text-sky-300 hover:border-sky-500/30"
            >
              <LinkIcon className="w-3 h-3" />
              {prettyUrl(url)}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ))}
        </div>
      )}
      <div className="mt-3 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
        <span className="text-neutral-600">—</span>
        <span className={`px-1.5 py-0.5 rounded border ${author.chip}`}>
          {author.label}
        </span>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: "red";
}) {
  const cls =
    accent === "red"
      ? "text-red-400 hover:bg-red-500/10"
      : "text-neutral-300 hover:bg-neutral-800";
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-1.5 ${cls}`}>
      {icon}
      {label}
    </button>
  );
}

function DecisionDialog({
  channelId,
  onClose,
  onSaved,
}: {
  channelId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [linksText, setLinksText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !summary.trim() || saving) return;
    setSaving(true);
    try {
      const links = linksText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, title, summary, links }),
      });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] drawer-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-md h-full shadow-2xl flex flex-col drawer-slide"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold">Log a decision</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Append-only · no edits after save</p>
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
            <Label>Title</Label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="We're going with LiveKit for voice"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <Label>Summary</Label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Self-hosted, no per-minute fees, runs on existing Contabo VPS. Skipping Daily.co + Whereby."
              rows={5}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Links (one per line, optional)</Label>
            </div>
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              placeholder="https://livekit.io"
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700 resize-none"
            />
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
            disabled={!title.trim() || !summary.trim() || saving}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Log decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border border-neutral-800 rounded-xl bg-neutral-900/40 p-5 animate-pulse h-28"
        />
      ))}
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

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}
