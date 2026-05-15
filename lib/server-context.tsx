"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export type ServerRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_default: number;
  position: number;
};

type Ctx = {
  servers: ServerRow[];
  currentId: number;
  setCurrentId: (id: number) => void;
  refresh: () => Promise<void>;
};

const ServerContext = createContext<Ctx | null>(null);

const LS_KEY = "war-room.currentServer";

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [currentId, setCurrentIdState] = useState<number>(1);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const r = await fetch("/api/servers");
    if (r.ok) {
      const d = (await r.json()) as { servers: ServerRow[] };
      setServers(d.servers);
    }
  }, []);

  useEffect(() => {
    refresh();
    const saved = Number(localStorage.getItem(LS_KEY));
    if (saved && !Number.isNaN(saved)) setCurrentIdState(saved);
  }, [refresh]);

  // Keep currentId in sync with the URL so the sidebar can't drift to the wrong
  // server on first load (e.g. landing on /c/home with a stale localStorage
  // currentId pointing at a personal server). We read currentId via ref so
  // clicking a server icon (which sets currentId directly) doesn't trigger
  // this effect and immediately revert based on a still-stale pathname.
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  useEffect(() => {
    if (!pathname || servers.length === 0) return;
    let targetId: number | null = null;

    if (pathname === "/c/home") {
      const warRoom = servers.find((s) => /war.?room/i.test(s.name));
      if (warRoom) targetId = warRoom.id;
    } else {
      const m = pathname.match(/^\/c\/user\/s(\d+)-/);
      if (m) {
        const id = Number(m[1]);
        if (servers.some((s) => s.id === id)) targetId = id;
      }
    }

    if (targetId !== null && targetId !== currentIdRef.current) {
      setCurrentIdState(targetId);
      localStorage.setItem(LS_KEY, String(targetId));
    }
  }, [pathname, servers]);

  const setCurrentId = (id: number) => {
    setCurrentIdState(id);
    localStorage.setItem(LS_KEY, String(id));
  };

  return (
    <ServerContext.Provider value={{ servers, currentId, setCurrentId, refresh }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServers(): Ctx {
  const v = useContext(ServerContext);
  if (!v) throw new Error("useServers must be inside ServerProvider");
  return v;
}

export function serverLandingPath(server: { name: string }): string {
  // The shared War Room server lands on its dashboard. Personal + custom
  // servers land on system/activity (their first system surface).
  if (/war.?room/i.test(server.name)) return "/c/home";
  return "/c/system/activity";
}
