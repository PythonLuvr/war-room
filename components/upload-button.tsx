"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

// Small "pick a file" button that POSTs to /api/upload and yields
// the saved URL via onUploaded. Used by anywhere in the app that
// lets users attach an image (profile avatar, workspace icon, agent
// profile icon). Image-only by default; pass `accept` to widen.

export function UploadButton({
  onUploaded,
  accept = "image/*",
  label = "Upload",
  disabled,
}: {
  onUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || `upload failed (${r.status})`);
        return;
      }
      const { url } = (await r.json()) as { url: string };
      onUploaded(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Upload className="w-3.5 h-3.5" />
        {busy ? "Uploading..." : label}
      </button>
      {err && <div className="text-[10px] text-red-400">{err}</div>}
    </div>
  );
}
