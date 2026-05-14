"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, Trash2, Copy, Hash, Settings2 } from "lucide-react";
import type { Channel } from "@/lib/channels";

type Props = {
  channel: Channel;
  anchor: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onTogglePrivacy: () => void;
  onDelete?: () => void;
};

export function ChannelMenu({
  channel,
  anchor,
  onClose,
  onEdit,
  onTogglePrivacy,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const x = Math.min(anchor.x, typeof window !== "undefined" ? window.innerWidth - 240 : anchor.x);
  const y = Math.min(anchor.y, typeof window !== "undefined" ? window.innerHeight - 200 : anchor.y);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 min-w-[220px] bg-[#0d0d0f] border border-neutral-800 rounded-lg shadow-2xl py-1 text-sm"
    >
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        {channel.isPrivate ? (
          <Lock className="w-3.5 h-3.5 text-amber-300" />
        ) : (
          <Hash className="w-3.5 h-3.5 text-neutral-500" />
        )}
        <span className="font-medium truncate">{channel.name}</span>
      </div>

      <MenuItem
        icon={<Settings2 className="w-3.5 h-3.5" />}
        label="Edit channel…"
        onClick={() => {
          onEdit();
        }}
        accent="neutral"
      />

      <MenuItem
        icon={
          channel.isPrivate ? (
            <LockOpen className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )
        }
        label={channel.isPrivate ? "Make public" : "Make private"}
        onClick={() => {
          onTogglePrivacy();
          onClose();
        }}
        accent={channel.isPrivate ? "neutral" : "amber"}
      />

      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Copy channel link"
        onClick={() => {
          navigator.clipboard.writeText(`${location.origin}/c/${channel.id}`);
          onClose();
        }}
        accent="neutral"
      />

      {onDelete && (
        <>
          <div className="my-1 border-t border-neutral-800" />
          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label={`Delete #${channel.name}`}
            onClick={() => {
              if (confirm(`Delete #${channel.name}?`)) {
                onDelete();
              }
              onClose();
            }}
            accent="red"
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent: "neutral" | "amber" | "red";
}) {
  const text =
    accent === "amber" ? "text-amber-300" : accent === "red" ? "text-red-400" : "text-neutral-300";
  const hover =
    accent === "amber" ? "hover:bg-amber-500/10" : accent === "red" ? "hover:bg-red-500/10" : "hover:bg-neutral-800";
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 ${text} ${hover}`}
    >
      {icon}
      {label}
    </button>
  );
}
