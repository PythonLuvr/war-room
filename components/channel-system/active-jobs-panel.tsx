"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, ArrowRight, Calendar } from "lucide-react";
import { NewJobDialog } from "@/components/new-job-dialog";
import { themeClassesFor } from "@/lib/team";

type Assignee = { user_id: string; role: string };
type Job = {
  id: number;
  slug: string;
  title: string;
  client_name: string | null;
  status: string;
  description: string | null;
  due_date: string | null;
  created_at: number;
  updated_at: number;
  assignees: Assignee[];
};

export function ActiveJobsPanel() {
  const [items, setItems] = useState<Job[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"active" | "recurring" | "finished" | "all">(
    "active",
  );

  const load = useCallback(() => {
    const q = filter === "all" ? "" : `?status=${filter}`;
    fetch(`/api/jobs${q}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {(["active", "recurring", "finished", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                filter === f
                  ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-200"
                  : "border border-neutral-800 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25"
        >
          <Plus className="w-3.5 h-3.5" />
          New job
        </button>
      </div>

      {items === null ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-600">
          No {filter !== "all" ? filter : ""} jobs.{" "}
          <button
            onClick={() => setCreating(true)}
            className="text-emerald-300 hover:underline"
          >
            Create one
          </button>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {creating && (
        <NewJobDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/j/${job.id}`}
      className="block border border-neutral-800 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 hover:border-neutral-700 hover:bg-neutral-900 transition-colors"
    >
      <div className="flex items-start gap-2 mb-2">
        <Briefcase className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-neutral-100 truncate">
            {job.title}
          </div>
          {job.client_name && (
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
              {job.client_name}
            </div>
          )}
        </div>
        <span
          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
            job.status === "active"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : job.status === "recurring"
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                : "bg-neutral-800 text-neutral-500 border border-neutral-700"
          }`}
        >
          {job.status}
        </span>
      </div>
      {job.description && (
        <div className="text-xs text-neutral-400 line-clamp-2 mb-3">
          {job.description}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex -space-x-1.5">
          {job.assignees.map((a) => (
            <div
              key={a.user_id}
              className={`w-6 h-6 rounded-full border-2 border-neutral-950 bg-gradient-to-br flex items-center justify-center text-[10px] font-semibold ${themeClassesFor(a.user_id)}`}
              title={a.user_id}
            >
              {a.user_id[0].toUpperCase()}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
          {job.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {job.due_date}
            </span>
          )}
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-28 rounded-xl border border-neutral-800 bg-neutral-900/40 animate-pulse"
        />
      ))}
    </div>
  );
}
