"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function InviteBlock({ invite }: { invite: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked. Fall back to manual select.
    }
  };

  return (
    <div className="space-y-2">
      <pre className="text-[11px] font-mono bg-neutral-950 border border-neutral-800 rounded-md p-3 text-neutral-300 whitespace-pre-wrap select-all">
        {invite}
      </pre>
      <button
        onClick={copy}
        className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 inline-flex items-center gap-1.5"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied" : "Copy invite block"}
      </button>
    </div>
  );
}
