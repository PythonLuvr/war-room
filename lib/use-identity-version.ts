"use client";

// Client-only re-render trigger for components that read the user's
// display name or agent label from the in-memory TEAM[0] roster. Lives
// in its own file because lib/team.ts is imported by server-side code
// too (api routes, the channel tree resolver) and React hooks can't be
// loaded into a React Server Component.
//
// IdentityHydrator mutates TEAM[0] in place, then dispatches the event
// this hook listens for, forcing every consuming subtree to re-render
// with the new values.

import { useEffect, useState } from "react";

export function useIdentityVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const onChange = () => setV((n) => n + 1);
    window.addEventListener("war-room:identity-changed", onChange);
    return () => window.removeEventListener("war-room:identity-changed", onChange);
  }, []);
  return v;
}
