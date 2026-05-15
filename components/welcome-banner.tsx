"use client";

// Cold-clone "do this first" banner. Shows the full CTA when onboarding
// hasn't been completed yet. Once onboarding is done, downgrades to a
// one-liner reminder that setup is reachable from Settings, with a dismiss
// button. Dismissal persists in localStorage so it doesn't keep coming back.

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Bot, X } from "lucide-react";

type AdapterMeta = { id: string; isConfigured: boolean };

const DISMISS_KEY = "war-room.welcomeBanner.dismissed";

export function WelcomeBanner() {
  const [loaded, setLoaded] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsAgent, setNeedsAgent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    let cancelled = false;
    Promise.all([
      fetch("/api/onboarding").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
    ])
      .then(([ob, agents]) => {
        if (cancelled) return;
        const obDone = ob?.settings?.["onboarding.completed"] === "1";
        const anyAgentReady = (agents?.adapters ?? []).some(
          (a: AdapterMeta) => a.isConfigured,
        );
        setNeedsOnboarding(!obDone);
        setNeedsAgent(!anyAgentReady);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  const launchOnboarding = () => {
    window.dispatchEvent(new CustomEvent("war-room:open-onboarding"));
  };

  const openAgentSettings = () => {
    window.dispatchEvent(new CustomEvent("war-room:open-settings", { detail: { tab: "agent" } }));
  };

  const openGeneralSettings = () => {
    window.dispatchEvent(new CustomEvent("war-room:open-settings", { detail: { tab: "general" } }));
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  // Cold-clone: always show full CTA, no dismiss. The wizard itself has
  // a skip button; the banner sticks around until onboarding is marked done.
  if (needsOnboarding) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-neutral-950 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-neutral-50 mb-1">Welcome to War Room.</h3>
            <p className="text-sm text-neutral-300 leading-relaxed mb-3">
              A shared cockpit for you and your AI agent. The setup wizard takes ~30 seconds.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={launchOnboarding}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run setup wizard
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {needsAgent && (
                <button
                  onClick={openAgentSettings}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
                >
                  <Bot className="w-3.5 h-3.5" />
                  Or jump straight to picking your AI
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mt-3 text-[11px] text-neutral-500">
              Backend options: Claude Code, OpenAI Codex, Gemini CLI, plus BYOK API for any of
              those plus xAI Grok and any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, etc).
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding already done. Surface a one-line reminder unless the user
  // explicitly dismissed it. Don't gate on whether an agent is configured —
  // the wizard already covers that step.
  if (dismissed) return null;

  return (
    <div className="mb-6 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 text-xs text-neutral-400">
      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="flex-1 min-w-0">
        Setup is reachable anytime from{" "}
        <button
          onClick={openGeneralSettings}
          className="text-neutral-200 hover:text-amber-300 underline underline-offset-2"
        >
          Settings → General
        </button>
        .
      </span>
      <button
        onClick={dismiss}
        title="Dismiss"
        className="text-neutral-500 hover:text-neutral-200 p-1 rounded hover:bg-neutral-800"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
