"use client";

// On mount (and whenever onboarding closes), pull the user's display name
// from the wizard's saved settings and patch it onto the in-memory TEAM[0]
// roster entry. Components that read `localMember().name` then re-render
// with the right name on their next React update.
//
// The static "You" string in lib/team.ts stays as the cold-clone fallback
// for the SSR pass and the very first paint before this fetch resolves.

import { useEffect, useState } from "react";
import { TEAM } from "@/lib/team";

export function IdentityHydrator() {
  // Local state exists only to force a re-render once we patch TEAM. The
  // value isn't used; updating it nudges React to re-render any subtree
  // that consumed `localMember().name`.
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hydrate = () => {
      fetch("/api/onboarding")
        .then((r) => r.json())
        .then((d: { settings: Record<string, string | null> }) => {
          if (cancelled) return;
          const name = d.settings?.["onboarding.displayName"]?.trim();
          const agentName = d.settings?.["onboarding.agentName"]?.trim() || undefined;
          let changed = false;
          if (name && TEAM[0] && TEAM[0].name !== name) {
            // Mutate in place — many components capture `LOCAL = localMember()`
            // at module load. Replacing the object reference would leave them
            // pointing at the old one; mutating the object's `name` property
            // means every render that reads `LOCAL.name` picks up the new
            // value.
            TEAM[0].name = name;
            changed = true;
          }
          // Same in-place pattern for the per-user agent label.
          if (TEAM[0] && TEAM[0].agentName !== agentName) {
            TEAM[0].agentName = agentName;
            changed = true;
          }
          if (changed) {
            force((n) => n + 1);
            // Notify other subtrees so they re-render and pick up the new
            // values (the in-place mutation alone doesn't trigger React).
            window.dispatchEvent(new CustomEvent("war-room:identity-changed"));
          }
        })
        .catch(() => {});
    };
    hydrate();
    // Re-hydrate when the wizard finishes — dispatched by the wizard's
    // skip/finish handlers via the existing "war-room:open-onboarding"
    // listener pattern. We use a fresh event so a hydrate doesn't
    // re-trigger the wizard.
    const onChange = () => hydrate();
    window.addEventListener("war-room:identity-changed", onChange);
    // The wizard fires no "completed" event today — listen for storage
    // changes (other tabs) and refetch on focus as a cheap fallback.
    window.addEventListener("focus", hydrate);
    return () => {
      cancelled = true;
      window.removeEventListener("war-room:identity-changed", onChange);
      window.removeEventListener("focus", hydrate);
    };
  }, []);

  return null;
}
