"use client";

// FolderPicker: a small wrapper that triggers the OS file explorer via the
// server-side /api/fs/native-pick endpoint. Falls back to an in-browser
// directory list if the native dialog isn't available.

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Folder, FolderOpen, Home, Loader2, X } from "lucide-react";

type BrowseResponse = {
  path: string;
  parent: string | null;
  home: string;
  dirs: Array<{ name: string; path: string }>;
  error?: string;
};

export function FolderPicker({
  initialPath,
  description,
  onPick,
  onClose,
}: {
  initialPath?: string;
  description?: string;
  onPick: (absPath: string) => void;
  onClose: () => void;
}) {
  const [waiting, setWaiting] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    (async () => {
      try {
        const r = await fetch("/api/fs/native-pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initialPath, description }),
        });
        if (r.status === 501) {
          setFallback(true);
          setWaiting(false);
          return;
        }
        const d = (await r.json()) as { ok: boolean; path?: string; cancelled?: boolean; error?: string };
        if (d.ok && d.path) {
          onPick(d.path);
          return;
        }
        if (d.cancelled) {
          onClose();
          return;
        }
        setError(d.error ?? "Native picker failed");
        setFallback(true);
        setWaiting(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setFallback(true);
        setWaiting(false);
      }
    })();
  }, [initialPath, description, onPick, onClose]);

  if (waiting) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl px-5 py-4 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
          <div className="text-sm text-neutral-300">
            Opening File Explorer…
            <div className="text-[10px] text-neutral-500 mt-0.5">
              If you don&apos;t see the dialog, check your taskbar.
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-neutral-600 hover:text-neutral-300 px-2 py-1 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (fallback) {
    return <InBrowserPicker initialPath={initialPath} error={error} onPick={onPick} onClose={onClose} />;
  }

  return null;
}

// ---------- Fallback: in-browser folder lister (only used if native fails) ----------

function InBrowserPicker({
  initialPath,
  error,
  onPick,
  onClose,
}: {
  initialPath?: string;
  error: string | null;
  onPick: (p: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [innerError, setInnerError] = useState<string | null>(null);

  const browse = async (p?: string) => {
    setLoading(true);
    setInnerError(null);
    try {
      const url = p ? `/api/fs/browse?path=${encodeURIComponent(p)}` : "/api/fs/browse";
      const r = await fetch(url);
      const d = (await r.json()) as BrowseResponse;
      if (d.error) {
        setInnerError(d.error);
        return;
      }
      setData(d);
    } catch (e) {
      setInnerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // browse() drives setState through fetch callbacks (lint rule does
  // inter-procedural analysis and flags the call site even when setState
  // only happens in the async chain).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void browse(initialPath);
  }, [initialPath]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Pick a folder (fallback)</h3>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="px-4 py-2 text-[11px] text-amber-300 bg-amber-950/30 border-b border-amber-900/30">
            Native dialog unavailable: {error}
          </div>
        )}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-900 bg-neutral-950">
          <button onClick={() => data && browse(data.home)} title="Home" className="p-1.5 rounded hover:bg-neutral-900 text-neutral-400">
            <Home className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => data?.parent && browse(data.parent)} disabled={!data?.parent} title="Up" className="p-1.5 rounded hover:bg-neutral-900 text-neutral-400 disabled:opacity-30">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 px-2 text-xs font-mono text-neutral-300 truncate" title={data?.path}>
            {loading ? "…" : data?.path}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : innerError ? (
            <div className="px-4 py-6 text-xs text-red-300">{innerError}</div>
          ) : data?.dirs.length === 0 ? (
            <div className="px-4 py-6 text-xs text-neutral-500 text-center">
              No subfolders. Pick this one below.
            </div>
          ) : (
            <div className="py-1">
              {data?.dirs.map((d) => (
                <button
                  key={d.path}
                  onClick={() => browse(d.path)}
                  className="w-full px-4 py-1.5 flex items-center gap-2 text-sm text-neutral-300 hover:bg-neutral-900 text-left"
                >
                  <Folder className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span className="truncate">{d.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end px-5 py-3 border-t border-neutral-800 bg-neutral-950">
          <button
            onClick={() => data && onPick(data.path)}
            disabled={!data}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            Use this folder
          </button>
        </div>
      </div>
    </div>
  );
}
