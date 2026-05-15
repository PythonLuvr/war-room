"use client";

// Cold-clone "do this first" banner. Renders on the home dashboard when the
// user hasn't completed onboarding OR hasn't configured an agent backend.
// Disappears once both are done.

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Bot } from "lucide-react";

type AdapterMeta = { id: string; isConfigured: boolean };

export function WelcomeBanner() {
  const [show, setShow] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsAgent, setNeedsAgent] = useState(false);

  useEffect(() => {
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
        setShow(!obDone || !anyAgentReady);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const launchOnboarding = () => {
    window.dispatchEvent(new CustomEvent("war-room:open-onboarding"));
  };

  const openAgentSettings = () => {
    window.dispatchEvent(new CustomEvent("war-room:open-settings", { detail: { tab: "agent" } }));
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-neutral-950 p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-neutral-50 mb-1">Welcome to War Room.</h3>
          <p className="text-sm text-neutral-300 leading-relaxed mb-3">
            A shared cockpit for you and your AI agent. Two quick steps and you're working.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {needsOnboarding && (
              <button
                onClick={launchOnboarding}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run setup wizard
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {needsAgent && (
              <button
                onClick={openAgentSettings}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30"
              >
                <Bot className="w-3.5 h-3.5" />
                Pick your AI backend
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {!needsOnboarding && !needsAgent && (
              <button
                onClick={() => setShow(false)}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                Dismiss
              </button>
            )}
          </div>
          <div className="mt-3 text-[11px] text-neutral-500">
            {needsAgent && (
              <>
                Backend options: Claude Code, OpenAI Codex, Gemini CLI, or BYOK API for any of
                those plus xAI Grok and any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, etc).
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
