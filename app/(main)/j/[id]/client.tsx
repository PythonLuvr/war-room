"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Send,
  CheckCircle2,
  RotateCcw,
  Repeat,
  Calendar,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Paperclip,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { TEAM, themeClassesFor, serverSlotFor } from "@/lib/team";

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
};
type Assignee = { user_id: string; role: string };
type Post = {
  id: number;
  job_id: number;
  author: string;
  kind: string;
  body: string;
  created_at: number;
};

const KIND_META: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  comment: { Icon: MessageSquare, tone: "text-neutral-400" },
  "status-update": { Icon: Sparkles, tone: "text-sky-300" },
  blocker: { Icon: AlertTriangle, tone: "text-amber-300" },
  completion: { Icon: CheckCircle2, tone: "text-emerald-300" },
  "file-share": { Icon: Paperclip, tone: "text-violet-300" },
};

export function JobPageClient({
  initialJob,
  initialAssignees,
  initialPosts,
}: {
  initialJob: Job;
  initialAssignees: Assignee[];
  initialPosts: Post[];
}) {
  const [job, setJob] = useState(initialJob);
  const [assignees] = useState(initialAssignees);
  const [posts, setPosts] = useState(initialPosts);
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [posts]);

  const refresh = useCallback(() => {
    fetch(`/api/jobs/${job.id}`)
      .then((r) => r.json())
      .then((d) => {
        setJob(d.job);
        setPosts(d.posts);
      });
  }, [job.id]);

  const post = async () => {
    if (!composer.trim() || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/jobs/${job.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: composer.trim(), kind: "comment" }),
      });
      if (r.ok) {
        setComposer("");
        refresh();
      }
    } finally {
      setPosting(false);
    }
  };

  const setStatus = async (status: "active" | "recurring" | "finished") => {
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setJob((j) => ({ ...j, status }));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-900 px-8 py-6">
        <Link
          href="/c/home?panel=active-jobs"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Active jobs
        </Link>
        <div className="flex items-start gap-3 mb-2">
          <Briefcase className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-neutral-50">{job.title}</h1>
            {job.client_name && (
              <div className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">
                {job.client_name}
              </div>
            )}
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
              job.status === "active"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                : job.status === "recurring"
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/40"
                  : "bg-neutral-800 text-neutral-500 border border-neutral-700"
            }`}
          >
            {job.status}
          </span>
        </div>
        {job.description && (
          <div className="text-sm text-neutral-300 max-w-3xl mt-3 mb-4">
            <Markdown>{job.description}</Markdown>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-600 uppercase tracking-wider">Assignees</span>
            <div className="flex -space-x-1.5">
              {assignees.map((a) => {
                const member = TEAM.find((m) => m.id === a.user_id);
                return (
                  <Link
                    key={a.user_id}
                    href={`/c/user/s${serverSlotFor(a.user_id)}-job-${job.slug}`}
                    title={`Open ${member?.name ?? a.user_id}'s execution channel`}
                    className={`w-7 h-7 rounded-full border-2 border-neutral-950 bg-gradient-to-br flex items-center justify-center text-xs font-semibold ${themeClassesFor(a.user_id)} hover:ring-2 hover:ring-current/40`}
                  >
                    {(member?.name ?? a.user_id)[0].toUpperCase()}
                  </Link>
                );
              })}
            </div>
          </div>
          {job.due_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-600" />
              {job.due_date}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {job.status !== "active" && (
              <button
                onClick={() => setStatus("active")}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-neutral-800 hover:bg-neutral-900"
              >
                <RotateCcw className="w-3 h-3" />
                Reactivate
              </button>
            )}
            {job.status === "active" && (
              <>
                <button
                  onClick={() => setStatus("recurring")}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-neutral-800 hover:bg-neutral-900"
                >
                  <Repeat className="w-3 h-3" />
                  Recurring
                </button>
                <button
                  onClick={() => setStatus("finished")}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Mark finished
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-8 py-5">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-600">
            No activity yet. Post a comment, or wait for an agent update.
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-3xl">
            {posts.map((p) => {
              const meta = KIND_META[p.kind] ?? KIND_META.comment;
              const Icon = meta.Icon;
              const member = TEAM.find((m) => m.id === p.author);
              return (
                <div key={p.id} className="flex gap-3">
                  <div
                    className={`w-8 h-8 rounded-full border bg-gradient-to-br flex items-center justify-center text-xs font-semibold shrink-0 ${themeClassesFor(p.author)}`}
                  >
                    {(member?.name ?? p.author)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-neutral-200">
                        {member?.name ?? p.author}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${meta.tone}`}>
                        <Icon className="w-3 h-3" />
                        {p.kind}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {timeAgo(p.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-neutral-300 mt-0.5">
                      <Markdown>{p.body}</Markdown>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-900 px-8 py-4 bg-neutral-950">
        <div className="flex items-end gap-2 max-w-3xl">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                post();
              }
            }}
            placeholder="Comment on this job…"
            rows={2}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-neutral-700"
          />
          <button
            onClick={post}
            disabled={!composer.trim() || posting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
        <div className="text-[10px] text-neutral-600 mt-2 max-w-3xl">
          Agent posts come in via API · Enter to send · Shift+Enter for newline
        </div>
      </div>
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
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
