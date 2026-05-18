"use client";

// Join form for teammates connecting to someone else's hosted
// workspace. Smart-paste: if the host pastes the full multi-line
// invite block, the three fields auto-populate instead of forcing a
// manual cut + paste per field.

import { useState } from "react";
import { parseInvite, looksLikeInvite } from "@/lib/sync/invite-format";

export function JoinForm({
  initialUrl,
  initialWorkspace,
  initialToken,
  onSave,
}: {
  initialUrl: string;
  initialWorkspace: string;
  initialToken: string;
  onSave: (payload: { url: string; workspace: string; token: string }) => Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [token, setToken] = useState(initialToken);
  const [saving, setSaving] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const onUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (looksLikeInvite(text)) {
      const parsed = parseInvite(text);
      if (parsed) {
        e.preventDefault();
        setUrl(parsed.url);
        setWorkspace(parsed.workspace);
        setToken(parsed.token);
        setAutoFilled(true);
        setTimeout(() => setAutoFilled(false), 2000);
      }
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ url: url.trim(), workspace: workspace.trim(), token: token.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onPaste={onUrlPaste}
        placeholder="Paste the URL  -  or paste the whole invite block here"
        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700"
      />
      <input
        value={workspace}
        onChange={(e) => setWorkspace(e.target.value)}
        placeholder="Workspace"
        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700"
      />
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Token"
        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-700"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-emerald-300">
          {autoFilled ? "Invite parsed - all three fields filled in" : " "}
        </span>
        <button
          onClick={submit}
          disabled={saving || !url.trim() || !workspace.trim()}
          className="text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 px-3 py-1.5 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Connect"}
        </button>
      </div>
    </div>
  );
}
