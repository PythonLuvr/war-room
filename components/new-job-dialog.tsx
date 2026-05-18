"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Briefcase } from "lucide-react";
import { TEAM, themeClassesFor } from "@/lib/team";

export function NewJobDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>(
    TEAM[0] ? [TEAM[0].id] : [],
  );
  const [status, setStatus] = useState<"active" | "recurring" | "finished">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const toggleAssignee = (id: string) => {
    setAssignees((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const submit = async () => {
    if (!title.trim() || saving || assignees.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          clientName: clientName.trim() || undefined,
          description: description.trim() || undefined,
          assignees,
          status,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const d = (await r.json()) as { job: { id: number } };
      onCreated();
      router.push(`/j/${d.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] drawer-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-lg h-full shadow-2xl flex flex-col drawer-slide"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-semibold">New job</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Creates a personal channel for each assignee
              </p>
            </div>
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
              placeholder="What's the job?"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <Label>Client (optional)</Label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The brief, the why, links to references…"
              rows={4}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700 resize-none"
            />
          </div>
          <div>
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-2">
              {TEAM.map((m) => {
                const selected = assignees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      selected
                        ? `bg-gradient-to-br ${themeClassesFor(m.id)}`
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold ${
                        selected ? "border-current/50" : "border-neutral-800"
                      }`}
                    >
                      {m.name[0]}
                    </span>
                    <span className="text-sm">{m.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-neutral-600 mt-1.5">
              Each assignee gets a channel under their personal Active projects.
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["active", "recurring", "finished"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm capitalize ${
                    status === s
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 rounded p-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-neutral-800 hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            disabled={!title.trim() || assignees.length === 0 || saving}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {saving ? "Creating…" : "Create job"}
          </button>
        </div>
      </div>
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
