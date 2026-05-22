"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Trash2, Users } from "lucide-react";
import { Markdown } from "@/components/markdown";

// A saved meeting transcript row. Mirrors MeetingTranscriptRow from
// lib/db.ts, minus the body unless the row has been expanded.
type Transcript = {
  id: number;
  room: string;
  title: string;
  body: string;
  participants_json: string | null;
  started_at: number | null;
  ended_at: number | null;
  duration_seconds: number | null;
  created_at: number;
};

function fmtDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function participantsOf(t: Transcript): string[] {
  if (!t.participants_json) return [];
  try {
    const v = JSON.parse(t.participants_json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// MeetingTranscripts: the saved-record surface for the optional WhisperX
// worker. On a fresh install the worker isn't running, so this just
// shows a one-line empty state pointing at the setup doc. Once a
// boardroom call ends, the worker POSTs a transcript and it appears here.
export function MeetingTranscripts() {
  const [list, setList] = useState<Transcript[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [bodies, setBodies] = useState<Map<number, string>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/livekit/transcript")
      .then((r) => r.json())
      .then((d: { transcripts?: Transcript[] }) => setList(d.transcripts ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (id: number) => {
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      if (!bodies.has(id)) {
        try {
          const r = await fetch(`/api/livekit/transcript?id=${id}`);
          const d = (await r.json()) as { transcript?: Transcript };
          if (d.transcript) {
            setBodies((cur) => new Map(cur).set(id, d.transcript!.body));
          }
        } catch {}
      }
    },
    [openId, bodies],
  );

  const remove = useCallback(
    async (id: number) => {
      await fetch(`/api/livekit/transcript?id=${id}`, { method: "DELETE" }).catch(() => {});
      setList((cur) => cur.filter((t) => t.id !== id));
      if (openId === id) setOpenId(null);
    },
    [openId],
  );

  if (loaded && list.length === 0) {
    return (
      <div className="px-4 py-2 border-b border-neutral-900/60 text-[11px] text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="w-3 h-3" />
          No saved meeting transcripts yet.
        </span>{" "}
        Voice transcription is opt-in, see{" "}
        <code className="text-neutral-500">docs/voice-setup.md</code>.
      </div>
    );
  }

  if (list.length === 0) return null;

  return (
    <div className="border-b border-neutral-900/60">
      <div className="px-4 py-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
        <FileText className="w-3 h-3" />
        Meeting transcripts
        <span className="text-neutral-700">·</span>
        <span className="text-neutral-600 normal-case tracking-normal">
          {list.length} saved
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
        {list.map((t) => {
          const open = openId === t.id;
          const people = participantsOf(t);
          const dur = fmtDuration(t.duration_seconds);
          return (
            <div
              key={t.id}
              className="rounded-md border border-neutral-900 bg-neutral-950/60"
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  onClick={() => toggle(t.id)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                >
                  {open ? (
                    <ChevronDown className="w-3 h-3 shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0 text-neutral-500" />
                  )}
                  <span className="text-xs text-neutral-200 truncate">{t.title}</span>
                </button>
                <button
                  onClick={() => remove(t.id)}
                  title="Delete transcript"
                  className="shrink-0 text-neutral-600 hover:text-rose-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {(people.length > 0 || dur) && (
                <div className="px-2 pb-1.5 flex items-center gap-2 text-[10px] text-neutral-600">
                  {people.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" />
                      {people.join(", ")}
                    </span>
                  )}
                  {dur && <span>· {dur}</span>}
                </div>
              )}
              {open && (
                <div className="px-3 pb-2 pt-1 border-t border-neutral-900 text-sm text-neutral-300">
                  {bodies.has(t.id) ? (
                    <Markdown>{bodies.get(t.id)!}</Markdown>
                  ) : (
                    <span className="text-xs text-neutral-600">Loading…</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
