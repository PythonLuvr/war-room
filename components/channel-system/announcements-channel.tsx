"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Plus,
  X,
  CheckCircle2,
  Circle,
  Archive,
  Undo2,
  Trash2,
  MoreHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { colorForAuthor } from "@/lib/workspace-color";
import { EmptyState } from "./empty-state";

type Announcement = {
  id: number;
  channel_id: string;
  title: string;
  body: string;
  author: string;
  status: string;
  created_at: number;
  ack_count: number;
  acked_by_me: number;
};

export function AnnouncementsChannel({ channelId }: { channelId: string }) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/announcements?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: "open" | "archived") => {
    setItems((cur) => (cur ? cur.map((a) => (a.id === id ? { ...a, status } : a)) : cur));
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const removeAnnouncement = async (id: number) => {
    if (!confirm("Delete this announcement permanently?")) return;
    setItems((cur) => (cur ? cur.filter((a) => a.id !== id) : cur));
    await fetch("/api/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const toggleAck = async (a: Announcement) => {
    // Optimistic
    setItems((cur) =>
      cur
        ? cur.map((x) =>
            x.id === a.id
              ? {
                  ...x,
                  acked_by_me: x.acked_by_me ? 0 : 1,
                  ack_count: x.ack_count + (x.acked_by_me ? -1 : 1),
                }
              : x,
          )
        : cur,
    );
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, ack: !a.acked_by_me }),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3 mb-6">
        <Megaphone className="w-5 h-5 text-amber-400" />
        <div>
          <h2 className="text-xl font-semibold">Announcements</h2>
          <p className="text-xs text-neutral-500">
            Broadcasts · acknowledge so the team knows you saw it
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {items && items.filter((a) => a.status !== "open").length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-neutral-800 text-neutral-400 hover:bg-neutral-900"
            >
              {showArchived ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showArchived ? "Hide" : "Show"} archived (
              {items.filter((a) => a.status !== "open").length})
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            New announcement
          </button>
        </div>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : (() => {
          const visible = items.filter((a) =>
            showArchived ? true : a.status === "open",
          );
          if (visible.length === 0) {
            return items.length > 0 && !showArchived ? (
              <div className="text-center py-16 text-sm text-neutral-600">
                All announcements archived. Toggle &lsquo;Show archived&rsquo; to view.
              </div>
            ) : (
              <EmptyState
                mood="friendly"
                title="Nothing pinned."
                body="Announcements are broadcasts the whole team should see on next launch. Click 'New announcement' to post one."
              />
            );
          }
          return (
            <div className="flex flex-col gap-4 max-w-3xl">
              {visible.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  a={a}
                  onToggleAck={() => toggleAck(a)}
                  onSetStatus={(s) => setStatus(a.id, s)}
                  onDelete={() => removeAnnouncement(a.id)}
                />
              ))}
            </div>
          );
        })()}

      {creating && (
        <NewAnnouncementDialog
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

function AnnouncementCard({
  a,
  onToggleAck,
  onSetStatus,
  onDelete,
}: {
  a: Announcement;
  onToggleAck: () => void;
  onSetStatus: (s: "open" | "archived") => void;
  onDelete: () => void;
}) {
  const acked = !!a.acked_by_me;
  const archived = a.status !== "open";
  const [menuOpen, setMenuOpen] = useState(false);
  const author = colorForAuthor(a.author);
  return (
    <div
      className={`relative border rounded-2xl p-6 transition-colors overflow-hidden ${
        archived
          ? "border-neutral-800/60 bg-neutral-900/30 opacity-60"
          : acked
            ? "border-neutral-800 bg-neutral-900/40"
            : "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] to-neutral-950"
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${author.stripe}`} title={author.label} />
      <div className="flex items-start gap-3 mb-3">
        <Megaphone
          className={`w-4 h-4 shrink-0 mt-1 ${archived ? "text-neutral-500" : "text-amber-400"}`}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-neutral-50 leading-tight">{a.title}</h3>
          <div className="text-[10px] uppercase tracking-wider mt-1 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded border ${author.chip}`}>
              {author.label}
            </span>
            <span className="text-neutral-500">
              {new Date(a.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {archived && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                archived
              </span>
            )}
          </div>
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
                {archived ? (
                  <button
                    onClick={() => {
                      onSetStatus("open");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Mark as active
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onSetStatus("archived");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
                <div className="my-1 border-t border-neutral-800" />
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="text-sm text-neutral-200">
        <Markdown>{a.body}</Markdown>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-800/60">
        <button
          onClick={onToggleAck}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border transition-colors ${
            acked
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
          }`}
        >
          {acked ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Acknowledged
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5" />
              Mark as seen
            </>
          )}
        </button>
        <span className="text-[11px] text-neutral-500">
          {a.ack_count} {a.ack_count === 1 ? "person has" : "people have"} acknowledged
        </span>
      </div>
    </div>
  );
}

function NewAnnouncementDialog({
  channelId,
  onClose,
  onSaved,
}: {
  channelId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, title, body }),
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
            <h2 className="text-lg font-semibold">New announcement</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Team-wide broadcast · everyone sees it pinned
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
            <Label>Title</Label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Holiday schedule, EOY freeze, etc."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <Label>Body (markdown supported)</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Full details here. Use **bold**, lists, links."
              rows={10}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 resize-none font-mono"
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
            disabled={!title.trim() || !body.trim() || saving}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {saving ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="border border-neutral-800 rounded-2xl bg-neutral-900/40 p-6 animate-pulse h-44"
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
