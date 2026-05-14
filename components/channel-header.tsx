"use client";

import { useState } from "react";
import { Hash, Pin, Bell, Users, Search, Lock, Paperclip } from "lucide-react";
import type { Channel } from "@/lib/channels";
import { FilesPanel } from "./files-panel";

export function ChannelHeader({
  channel,
  onToggleRight,
}: {
  channel: Channel;
  onToggleRight?: () => void;
}) {
  const [filesOpen, setFilesOpen] = useState(false);
  return (
    <div className="relative h-12 bg-neutral-950 px-5 flex items-center gap-3 sticky top-0 z-10">
      {channel.isPrivate ? (
        <Lock className="w-4 h-4 text-amber-300" />
      ) : (
        <Hash className="w-4 h-4 text-neutral-500" />
      )}
      <div className="text-sm font-medium">{channel.name}</div>
      {channel.isPrivate && (
        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          private
        </span>
      )}
      {channel.description && (
        <div className="text-xs text-neutral-400 truncate hidden md:block max-w-md">
          <span className="text-neutral-700">·</span> {channel.description}
        </div>
      )}
      {!channel.description && channel.projectPath && (
        <div className="text-xs text-neutral-500 truncate hidden md:block">
          <span className="text-neutral-700">·</span>{" "}
          <code className="text-neutral-500">{channel.projectPath}</code>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1 text-neutral-500">
        <IconBtn title="Files" onClick={() => setFilesOpen(true)}>
          <Paperclip className="w-4 h-4" />
        </IconBtn>
        <IconBtn title="Pinned"><Pin className="w-4 h-4" /></IconBtn>
        <IconBtn title="Notifications"><Bell className="w-4 h-4" /></IconBtn>
        <IconBtn title="Members" onClick={onToggleRight}><Users className="w-4 h-4" /></IconBtn>
        <div className="relative ml-2">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            placeholder="Search"
            className="w-44 bg-neutral-900 border border-neutral-800 rounded-md text-xs pl-7 pr-2 py-1 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>
      <span aria-hidden className="hairline-h bottom" />
      {filesOpen && (
        <FilesPanel
          channelId={channel.id}
          channelName={channel.name}
          onClose={() => setFilesOpen(false)}
        />
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-md hover:bg-neutral-900 hover:text-neutral-300 flex items-center justify-center"
    >
      {children}
    </button>
  );
}
