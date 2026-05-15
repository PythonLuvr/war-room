"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  X,
  Search,
  Pencil,
  Trash2,
  Tag as TagIcon,
  ArrowLeft,
} from "lucide-react";
import { Markdown } from "@/components/markdown";

type Entry = {
  id: number;
  channel_id: string;
  title: string;
  body: string;
  tags_json: string | null;
  author: string;
  created_at: number;
  updated_at: number;
};

export function KnowledgeChannel({
  channelId,
  channelName,
  description,
}: {
  channelId: string;
  channelName: string;
  description?: string;
}) {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [openEntry, setOpenEntry] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/knowledge?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openId === null) return;
    fetch(`/api/knowledge?id=${openId}`)
      .then((r) => r.json())
      .then((d) => setOpenEntry(d.entry ?? null));
  }, [openId]);

  // Clearing the cached entry when the modal closes is derived state — do
  // it during render instead of in an effect so React doesn't cascade.
  const [prevOpenId, setPrevOpenId] = useState<number | null>(openId);
  if (prevOpenId !== openId) {
    setPrevOpenId(openId);
    if (openId === null && openEntry !== null) setOpenEntry(null);
  }

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      const tags = e.tags_json ? (JSON.parse(e.tags_json) as string[]) : [];
      return (
        e.title.toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, query]);

  const allTags = useMemo(() => {
    if (!items) return [];
    const s = new Set<string>();
    for (const e of items) {
      if (!e.tags_json) continue;
      for (const t of JSON.parse(e.tags_json) as string[]) s.add(t);
    }
    return Array.from(s).sort();
  }, [items]);

  const onSaved = (entry: Entry) => {
    load();
    setCreating(false);
    setOpenId(entry.id);
  };

  const existingTags = allTags;

  const onDelete = async (id: number) => {
    if (!confirm("Delete this entry permanently?")) return;
    await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setOpenId(null);
    load();
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <div>
          <h2 className="text-xl font-semibold capitalize">{channelName}</h2>
          {description && (
            <p className="text-xs text-neutral-500 max-w-2xl">{description}</p>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25"
        >
          <Plus className="w-3.5 h-3.5" />
          New entry
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or tag…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md text-xs pl-7 pr-2 py-1.5 focus:outline-none focus:border-neutral-700 placeholder:text-neutral-600"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-2">
            {allTags.slice(0, 6).map((t) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-emerald-500/40 hover:text-emerald-300"
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto text-xs text-neutral-500">
          {filtered === null ? "…" : `${filtered.length} entries`}
        </div>
      </div>

      {filtered === null ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-neutral-600">
          {items && items.length > 0
            ? "No entries match that search."
            : "No entries yet. Click 'New entry' to add the first one."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl">
          {filtered.map((e) => (
            <EntryCard key={e.id} entry={e} onClick={() => setOpenId(e.id)} />
          ))}
        </div>
      )}

      {creating && (
        <EntryEditor
          channelId={channelId}
          mode="create"
          existingTags={existingTags}
          onClose={() => setCreating(false)}
          onSaved={onSaved}
        />
      )}

      {openId !== null && (
        <EntryViewer
          entry={openEntry}
          loading={!openEntry}
          existingTags={existingTags}
          onClose={() => setOpenId(null)}
          onDelete={() => onDelete(openId)}
          onSaved={(e) => {
            setOpenEntry(e);
            load();
          }}
        />
      )}
    </div>
  );
}

function EntryCard({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const tags: string[] = entry.tags_json ? (JSON.parse(entry.tags_json) as string[]) : [];
  return (
    <button
      onClick={onClick}
      className="text-left border border-neutral-800 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 hover:border-neutral-700 hover:bg-neutral-900 transition-colors min-h-[110px] flex flex-col"
    >
      <h3 className="text-sm font-semibold text-neutral-100 line-clamp-2 mb-1">
        {entry.title}
      </h3>
      <div className="text-[10px] text-neutral-500 mb-2">
        updated {timeAgo(entry.updated_at)} · by {entry.author}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function EntryViewer({
  entry,
  loading,
  existingTags,
  onClose,
  onDelete,
  onSaved,
}: {
  entry: Entry | null;
  loading: boolean;
  existingTags: string[];
  onClose: () => void;
  onDelete: () => void;
  onSaved: (e: Entry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const tags = entry?.tags_json ? (JSON.parse(entry.tags_json) as string[]) : [];

  if (editing && entry) {
    return (
      <EntryEditor
        channelId={entry.channel_id}
        mode="edit"
        initial={entry}
        existingTags={existingTags}
        onClose={() => setEditing(false)}
        onSaved={(e) => {
          onSaved(e);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] drawer-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-2xl h-full shadow-2xl flex flex-col drawer-slide"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to list
          </button>
          {entry && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-neutral-800 text-neutral-300 hover:bg-neutral-900"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-neutral-500 hover:text-neutral-300 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading || !entry ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-8 w-2/3 bg-neutral-800 rounded" />
              <div className="h-4 w-1/3 bg-neutral-900 rounded" />
              <div className="h-4 bg-neutral-900 rounded mt-6" />
              <div className="h-4 w-5/6 bg-neutral-900 rounded" />
              <div className="h-4 w-4/6 bg-neutral-900 rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-2 text-neutral-50">{entry.title}</h1>
              <div className="text-xs text-neutral-500 mb-5 flex items-center gap-3">
                <span>
                  by {entry.author} ·{" "}
                  {new Date(entry.updated_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {tags.length > 0 && (
                  <span className="flex gap-1 items-center">
                    <TagIcon className="w-3 h-3 text-neutral-600" />
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              {entry.body ? (
                <Markdown>{entry.body}</Markdown>
              ) : (
                <div className="text-sm text-neutral-600 italic">No body yet.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryEditor({
  channelId,
  mode,
  initial,
  existingTags,
  onClose,
  onSaved,
}: {
  channelId: string;
  mode: "create" | "edit";
  initial?: Entry;
  existingTags: string[];
  onClose: () => void;
  onSaved: (entry: Entry) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState<string[]>(
    initial?.tags_json ? (JSON.parse(initial.tags_json) as string[]) : [],
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const normalizeTag = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    setTags((cur) => (cur.includes(t) ? cur : [...cur, t]));
    setNewTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((cur) => cur.filter((x) => x !== t));
  };

  const toggleTag = (t: string) => {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  // Existing tags not already on this entry
  const availableExisting = existingTags.filter((t) => !tags.includes(t));

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const cleanTags = tags.map(normalizeTag).filter(Boolean);
      const payload =
        mode === "create"
          ? { channelId, title: title.trim(), body, tags: cleanTags }
          : { id: initial!.id, title: title.trim(), body, tags: cleanTags };
      const r = await fetch("/api/knowledge", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        if (mode === "create") {
          const d = (await r.json()) as { entry: Entry };
          onSaved(d.entry);
        } else {
          onSaved({
            ...initial!,
            title: title.trim(),
            body,
            tags_json: cleanTags.length ? JSON.stringify(cleanTags) : null,
            updated_at: Date.now(),
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] drawer-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-2xl h-full shadow-2xl flex flex-col drawer-slide"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "New entry" : "Edit entry"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Markdown supported in body. Tags are comma-separated.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1">
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
              placeholder="Entry title"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Categories</Label>
              <span className="text-[10px] text-neutral-600">
                {tags.length} selected
              </span>
            </div>

            {/* Selected tags (active on this entry) */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => removeTag(t)}
                    className="group inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25"
                    title="Click to remove"
                  >
                    {t}
                    <X className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* Existing categories from this channel — toggleable */}
            {availableExisting.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                  Pick existing
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableExisting.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-emerald-500/40 hover:text-emerald-300"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* New category input */}
            <div className="flex items-center gap-1.5 mt-2">
              <input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(newTagInput);
                  }
                }}
                placeholder="new category…"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded text-[11px] px-2 py-1 focus:outline-none focus:border-neutral-700 placeholder:text-neutral-600"
              />
              <button
                type="button"
                onClick={() => addTag(newTagInput)}
                disabled={!newTagInput.trim()}
                className="text-[11px] px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-30"
              >
                Add
              </button>
            </div>
            <div className="text-[10px] text-neutral-600 mt-1">
              Lowercased, hyphenated automatically (e.g. &ldquo;AI Gen&rdquo; → &ldquo;ai-gen&rdquo;)
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <Label>Body (markdown)</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="# Heading&#10;&#10;Markdown content..."
              rows={18}
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
            disabled={!title.trim() || saving}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {saving ? "Saving…" : mode === "create" ? "Create entry" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border border-neutral-800 rounded-xl bg-neutral-900/40 p-4 animate-pulse h-28"
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

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dys = Math.floor(h / 24);
  if (dys < 30) return `${dys}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
