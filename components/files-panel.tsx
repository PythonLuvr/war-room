"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File as FileIcon,
} from "lucide-react";

type FileRow = {
  id: number;
  channel_id: string;
  filename: string;
  original_name: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string;
  uploaded_at: number;
};

export function FilesPanel({
  channelId,
  channelName,
  onClose,
}: {
  channelId: string;
  channelName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<FileRow[] | null>(null);
  const [backend, setBackend] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/files?channelId=${encodeURIComponent(channelId)}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setBackend(d.backend ?? "");
      });
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const upload = async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("channelId", channelId);
        fd.append("file", f);
        const r = await fetch("/api/files", { method: "POST", body: fd });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? `HTTP ${r.status}`);
        }
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setItems((cur) => (cur ? cur.filter((f) => f.id !== id) : cur));
    await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] drawer-fade" />
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative bg-[#0d0d0f] border-l border-neutral-800 w-full max-w-xl h-full shadow-2xl flex flex-col drawer-slide ${
          dragOver ? "ring-2 ring-emerald-500/50" : ""
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold">
              Files in #{channelName}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Storage: {backend} · 100MB cap per file
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 rounded border border-red-900 bg-red-950/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Upload className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <div className="text-sm text-neutral-400 mb-1">
                Drop files here or click upload
              </div>
              <div className="text-xs text-neutral-600">
                Briefs, references, deliverables, raw client material
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onDelete={() => remove(f.id, f.original_name)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-800 flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : "Upload files"}
          </button>
          <span className="ml-auto text-[10px] text-neutral-600 uppercase tracking-wider">
            or drag and drop anywhere in this panel
          </span>
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file,
  onDelete,
}: {
  file: FileRow;
  onDelete: () => void;
}) {
  const Icon = iconForMime(file.mime_type);
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/40 group">
      <Icon className="w-5 h-5 shrink-0 text-neutral-500" />
      <div className="flex-1 min-w-0">
        <a
          href={`/api/files/${file.id}`}
          download={file.original_name}
          className="text-sm text-neutral-100 hover:text-emerald-300 truncate block"
        >
          {file.original_name}
        </a>
        <div className="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
          <span>{formatBytes(file.size_bytes)}</span>
          <span>·</span>
          <span>{file.uploaded_by}</span>
          <span>·</span>
          <span>{timeAgo(file.uploaded_at)}</span>
        </div>
      </div>
      <a
        href={`/api/files/${file.id}`}
        download={file.original_name}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-emerald-300 hover:bg-neutral-900 rounded"
        title="Download"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-3 border-b border-neutral-900 last:border-b-0"
        >
          <div className="w-5 h-5 rounded bg-neutral-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 bg-neutral-800 rounded animate-pulse"
              style={{ width: `${40 + Math.random() * 40}%` }}
            />
            <div
              className="h-2 bg-neutral-900 rounded animate-pulse"
              style={{ width: `${20 + Math.random() * 20}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function iconForMime(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music;
  if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml")) return FileText;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return Archive;
  return FileIcon;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
