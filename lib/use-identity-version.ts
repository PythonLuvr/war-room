"use client";

// Re-render trigger for components that display the local user's name.
//
// TEAM in lib/team.ts is mutated in place by IdentityHydrator when the user
// finishes the onboarding wizard. Mutating an object property doesn't notify
// React on its own, so any subtree that displays the local human's name
// should call useIdentityVersion(). It's a no-op state hook that re-renders
// the caller on every `war-room:identity-changed` event.
//
// Lives in its own file (separate from lib/team.ts) because lib/team.ts is
// imported by server code as well, and a React hook in a server-imported
// module is a Next.js boundary violation.

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
