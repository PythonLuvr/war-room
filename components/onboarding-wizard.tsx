"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Terminal,
  FolderOpen,
  Users,
  X,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { FolderPicker } from "@/components/folder-picker";
import { modalProps } from "@/lib/a11y";
import { t } from "@/lib/i18n/es";

type Identity = "primary" | "teammate";

type WizardData = {
  identity: Identity;
  displayName: string;
  agentName: string;
  claudeBin: string;
  workspaceRoot: string;
  syncOptIn: boolean;
  syncUrl: string;
};

const PRESETS: Array<{ id: Identity; name: string; hint: string; color: string }> = [
  {
    id: "primary",
    name: t.onboarding.identityOwner,
    hint: t.onboarding.identityOwnerHint,
    color: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200",
  },
  {
    id: "teammate",
    name: t.onboarding.identityTeammate,
    hint: t.onboarding.identityTeammateHint,
    color: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200",
  },
];

export function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    identity: "primary",
    displayName: "",
    agentName: "",
    claudeBin: "claude",
    workspaceRoot: "",
    syncOptIn: false,
    syncUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rosterCount, setRosterCount] = useState(0);
  const [pickedProjects, setPickedProjects] = useState<Array<{ path: string; name: string }>>([]);

  const load = (force: boolean) => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: { settings: Record<string, string | null>; defaults: { claudeBin: string; workspaceRoot: string } }) => {
        if (!force && d.settings["onboarding.completed"] === "1") return;
        setStep(0);
        setShow(true);
        setData((cur) => ({
          ...cur,
          identity:
            d.settings["onboarding.identity"] === "teammate" ? "teammate" : "primary",
          displayName: d.settings["onboarding.displayName"] || cur.displayName,
          agentName: d.settings["onboarding.agentName"] || cur.agentName,
          claudeBin: d.settings["onboarding.claudeBin"] || d.defaults.claudeBin,
          workspaceRoot: d.settings["onboarding.workspaceRoot"] || d.defaults.workspaceRoot,
          syncOptIn: d.settings["onboarding.syncOptIn"] === "1",
          syncUrl: d.settings["onboarding.syncUrl"] ?? "",
        }));
      })
      .catch(() => {});
  };

  useEffect(() => {
    load(false);
    const handler = () => load(true);
    window.addEventListener("war-room:open-onboarding", handler);
    return () => window.removeEventListener("war-room:open-onboarding", handler);
  }, []);

  const pickIdentity = (id: Identity) => {
    setData((cur) => ({ ...cur, identity: id }));
  };

  const finish = async () => {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, completed: true }),
      });
      // Create one channel per picked project under the personal server.
      // Best-effort: a duplicate-slug error gets surfaced as a 409 by the
      // endpoint and silently skipped so the wizard finish never fails on
      // a re-run of the wizard where the user re-picks the same folder.
      for (const p of pickedProjects) {
        try {
          await fetch("/api/channels/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target: "channel",
              name: p.name,
              groupLabel: "Projects",
              projectPath: p.path,
            }),
          });
        } catch {}
      }
      setShow(false);
      // Tell the rest of the app the local identity may have changed so
      // chat/boardroom/team-presence subtrees re-render with the new name.
      window.dispatchEvent(new CustomEvent("war-room:identity-changed"));
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    setShow(false);
  };

  if (!show) return null;

  const steps = t.onboarding.stepNames;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div
        {...modalProps(t.onboarding.setupTitle)}
        className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{t.onboarding.setupTitle}</h2>
          </div>
          <button
            onClick={skip}
            aria-label={t.onboarding.skipLabel}
            title={t.onboarding.skipLabel}
            className="text-neutral-500 hover:text-neutral-300 p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 pt-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`h-1 flex-1 rounded ${
                  i <= step ? "bg-amber-500/70" : "bg-neutral-800"
                }`}
              />
            </div>
          ))}
        </div>
        <div
          className="px-6 pt-2 text-[10px] uppercase tracking-wider text-neutral-500"
          aria-live="polite"
          aria-atomic="true"
        >
          {t.onboarding.stepLabel(step + 1, steps.length, steps[step])}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">{t.onboarding.welcomeTitle}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {t.onboarding.welcomeBody}
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Hint icon={<Users className="w-4 h-4 text-amber-300" aria-hidden="true" />} title={t.onboarding.welcomeHintIdentityTitle}>
                  {t.onboarding.welcomeHintIdentityBody}
                </Hint>
                <Hint icon={<Terminal className="w-4 h-4 text-sky-300" aria-hidden="true" />} title={t.onboarding.welcomeHintAgentTitle}>
                  {t.onboarding.welcomeHintAgentBody}
                </Hint>
                <Hint icon={<FolderOpen className="w-4 h-4 text-emerald-300" aria-hidden="true" />} title={t.onboarding.welcomeHintProjectsTitle}>
                  {t.onboarding.welcomeHintProjectsBody}
                </Hint>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {t.onboarding.welcomeTime}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t.onboarding.identityTitle}</h3>
              <p className="text-sm text-neutral-400">
                {t.onboarding.identityBody}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((p) => {
                  const selected = data.identity === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickIdentity(p.id)}
                      aria-pressed={selected}
                      className={`px-4 py-3 rounded-lg border text-left transition-all ${
                        selected
                          ? `bg-gradient-to-br ${p.color}`
                          : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">
                        {p.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div>
                <Label>{t.onboarding.displayNameLabel}</Label>
                <input
                  value={data.displayName}
                  onChange={(e) => setData((c) => ({ ...c, displayName: e.target.value }))}
                  placeholder={t.onboarding.displayNamePlaceholder}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
                />
              </div>
              <div>
                <Label>{t.onboarding.agentNameLabel}</Label>
                <input
                  value={data.agentName}
                  onChange={(e) => setData((c) => ({ ...c, agentName: e.target.value }))}
                  placeholder={
                    data.displayName.trim()
                      ? `${data.displayName.trim()}-Agente`
                      : "Jarvis, Viernes, Ordenador..."
                  }
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
                />
                <div className="text-[10px] text-neutral-600 mt-1">
                  {t.onboarding.agentNameHint(data.displayName.trim() || "Tu")}
                </div>
              </div>
            </div>
          )}

          {step === 2 && <AgentPickStep onRosterChange={setRosterCount} />}

          {step === 3 && (
            <ProjectsStep
              picked={pickedProjects}
              onChange={setPickedProjects}
              onPickAnother={() => setPickerOpen(true)}
            />
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t.onboarding.syncTitle}</h3>
              <p className="text-sm text-neutral-400">
                {t.onboarding.syncBody1}
              </p>
              <p className="text-sm text-neutral-400">
                {t.onboarding.syncBody2}
              </p>
              <div>
                <Label>{t.onboarding.syncUrlLabel}</Label>
                <input
                  value={data.syncUrl ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, syncUrl: e.target.value, syncOptIn: !!e.target.value.trim() }))
                  }
                  placeholder="wss://war-room.tu-dominio.com  o  http://192.168.1.50:7880"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-700"
                />
                <div className="text-[10px] text-neutral-600 mt-1.5">
                  {t.onboarding.syncUrlHint}
                </div>
              </div>
              <div className="text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-900 pt-3 mt-2">
                <strong className="text-neutral-400">{t.onboarding.syncLocalWorksTitle}</strong>{" "}
                {t.onboarding.syncLocalWorksBody}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {t.onboarding.back}
          </button>
          <div className="text-[10px] text-neutral-600">
            {t.onboarding.escHint}
          </div>
          {step < steps.length - 1 ? (
            (() => {
              // Step 2 (agent setup) requires at least one agent in the
              // roster. Other steps have no hard gate. Disabled state
              // shows a tooltip via the title attr so the user knows
              // exactly what they need to do.
              const gated = step === 2 && rosterCount === 0;
              return (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={gated}
                  title={gated ? t.onboarding.continueDisabledHint : undefined}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t.onboarding.next}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              );
            })()
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{t.onboarding.saving}</>
              ) : (
                <><Check className="w-3.5 h-3.5" aria-hidden="true" />{t.onboarding.finish}</>
              )}
            </button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <FolderPicker
          initialPath={undefined}
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            const name = p.split(/[\\/]+/).filter(Boolean).pop() ?? p;
            setPickedProjects((cur) =>
              cur.some((x) => x.path === p) ? cur : [...cur, { path: p, name }],
            );
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Projects step ────────────────────────────────────────────────────────
//
// Replaces the old "pick one root folder" step. The previous design
// assumed every user had a clean container like ~/clients with only
// project folders in it; in practice most users have projects
// scattered across Desktop, Documents, D:\, etc., and pointing at
// ~/ would create one channel per home-dir folder (Pictures, etc.).
//
// New model: auto-detect project-shaped folders in common locations,
// pre-check them, let the user uncheck or add more, persist as N
// user_channels rows on wizard finish.

type DetectedProject = {
  name: string;
  path: string;
  markers: string[];
};

function ProjectsStep({
  picked,
  onChange,
  onPickAnother,
}: {
  picked: Array<{ path: string; name: string }>;
  onChange: (next: Array<{ path: string; name: string }>) => void;
  onPickAnother: () => void;
}) {
  const [detected, setDetected] = useState<DetectedProject[] | null>(null);

  // One-shot detect on mount. The probe is cheap (one readdir per
  // common root) so we don't bother caching across step revisits.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/detect-projects")
      .then((r) => r.json())
      .then((d: { detected: DetectedProject[] }) => {
        if (cancelled) return;
        setDetected(d.detected ?? []);
        // Pre-check every detected project the first time we see them
        // (only if picked is empty so revisiting doesn't clobber the
        // user's manual changes).
        if (picked.length === 0 && d.detected?.length > 0) {
          onChange(d.detected.map((x) => ({ path: x.path, name: x.name })));
        }
      })
      .catch(() => {
        if (!cancelled) setDetected([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPicked = (p: string) => picked.some((x) => x.path === p);

  const toggle = (proj: { path: string; name: string }) => {
    if (isPicked(proj.path)) {
      onChange(picked.filter((x) => x.path !== proj.path));
    } else {
      onChange([...picked, proj]);
    }
  };

  const removeManual = (p: string) => onChange(picked.filter((x) => x.path !== p));

  // Manual adds = picked items whose path doesn't appear in detected.
  const detectedPaths = new Set((detected ?? []).map((d) => d.path));
  const manualPicks = picked.filter((p) => !detectedPaths.has(p.path));

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{t.onboarding.projectsTitle}</h3>
      <p className="text-sm text-neutral-400">
        {t.onboarding.projectsBody}
      </p>

      <div>
        <Label>{t.onboarding.detectedLabel(detected ? detected.length : null)}</Label>
        {detected === null ? (
          <div className="text-xs text-neutral-600 italic px-1 py-3">
            {t.onboarding.scanningLabel}
          </div>
        ) : detected.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/20 p-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/war-bit/friendly.png"
              alt=""
              width={48}
              height={48}
              className="w-10 h-10 [image-rendering:pixelated] shrink-0 opacity-80"
            />
            <div className="text-xs text-neutral-400">
              {t.onboarding.noProjectsFound}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 divide-y divide-neutral-900">
            {detected.map((proj) => {
              const on = isPicked(proj.path);
              return (
                <label
                  key={proj.path}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-900/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle({ path: proj.path, name: proj.name })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-100 truncate">
                      {proj.name}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono truncate">
                      {proj.path}
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-600 shrink-0 flex flex-wrap gap-1">
                    {proj.markers.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {manualPicks.length > 0 && (
        <div>
          <Label>{t.onboarding.manualLabel(manualPicks.length)}</Label>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 divide-y divide-neutral-900">
            {manualPicks.map((p) => (
              <div
                key={p.path}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-100 truncate">{p.name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono truncate">{p.path}</div>
                </div>
                <button
                  onClick={() => removeManual(p.path)}
                  aria-label={`${t.onboarding.removeProject} ${p.name}`}
                  title={t.onboarding.removeProject}
                  className="text-neutral-500 hover:text-red-300 p-1"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={onPickAnother}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 text-neutral-300"
        >
          <FolderOpen className="w-4 h-4" aria-hidden="true" />
          {t.onboarding.addFolder}
        </button>
        <div className="text-[10px] text-neutral-600 mt-1 leading-snug">
          {t.onboarding.addFolderHint}
        </div>
      </div>

      <div className="border-t border-neutral-900 pt-3 text-[11px] text-neutral-500">
        {picked.length === 0 ? (
          <span>{t.onboarding.noProjectsAdded}</span>
        ) : (
          <span>{t.onboarding.projectsAdded(picked.length)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Agent setup step ──────────────────────────────────────────────────────
//
// Multi-provider setup: forkers paste keys / set binary paths for as many
// adapters as they want during onboarding. Each provider card has all
// relevant inputs visible at once. Saves happen on blur via /api/agents
// POST so nothing is lost between fields. The "Default backend" picker
// at the bottom lists every adapter that became configured + lets the
// user mark one as primary.

type AgentMeta = {
  id: string;
  name: string;
  kind: "cli" | "api";
  capabilities: { toolUse: boolean; memory: boolean; fileAccess: boolean; notes?: string };
  isConfigured: boolean;
};

type FieldSpec = {
  /** Settings key. */
  k: string;
  /** Field label shown in the form. */
  label: string;
  /** Placeholder example. */
  ph?: string;
  /** Render as a password input (mask + don't trip browser autofill). */
  secret?: boolean;
  /** Width hint within the card grid. */
  span?: 1 | 2;
};

type ProviderCard = {
  label: string;
  /** Optional install link surfaced when the CLI isn't configured. */
  installUrl?: string;
  installNote?: string;
  /** Adapter ids that get marked configured when their fields are filled. */
  cliAdapterId?: string;
  apiAdapterId?: string;
  cliFields: FieldSpec[];
  apiFields: FieldSpec[];
};

const PROVIDER_CARDS: ProviderCard[] = [
  {
    label: "Claude",
    installUrl: "https://docs.claude.com/en/docs/claude-code/setup",
    installNote: "npm i -g @anthropic-ai/claude-code",
    cliAdapterId: "claude-cli",
    apiAdapterId: "anthropic-api",
    cliFields: [
      { k: "agent.cli.claude.bin", label: "Claude Code binary", ph: "claude" },
    ],
    apiFields: [
      { k: "agent.api.anthropic.key", label: "Anthropic API key", ph: "sk-ant-…", secret: true },
      { k: "agent.api.anthropic.model", label: "Model", ph: "claude-sonnet-4-6" },
    ],
  },
  {
    label: "OpenAI",
    installUrl: "https://github.com/openai/codex",
    installNote: "Codex CLI",
    cliAdapterId: "codex-cli",
    apiAdapterId: "openai-api",
    cliFields: [{ k: "agent.cli.codex.bin", label: "Codex binary", ph: "codex" }],
    apiFields: [
      { k: "agent.api.openai.key", label: "OpenAI API key", ph: "sk-…", secret: true },
      { k: "agent.api.openai.model", label: "Model", ph: "gpt-5" },
    ],
  },
  {
    label: "Google Gemini",
    installUrl: "https://github.com/google-gemini/gemini-cli",
    installNote: "npm i -g @google/gemini-cli",
    cliAdapterId: "gemini-cli",
    apiAdapterId: "gemini-api",
    cliFields: [{ k: "agent.cli.gemini.bin", label: "Gemini CLI binary", ph: "gemini" }],
    apiFields: [
      { k: "agent.api.gemini.key", label: "Gemini API key", ph: "AIza…", secret: true },
      { k: "agent.api.gemini.model", label: "Model", ph: "gemini-2.5-pro" },
    ],
  },
  {
    label: "xAI Grok",
    apiAdapterId: "grok-api",
    cliFields: [],
    apiFields: [
      { k: "agent.api.grok.key", label: "xAI API key", ph: "xai-…", secret: true },
      { k: "agent.api.grok.model", label: "Model", ph: "grok-3" },
    ],
  },
  {
    label: "OpenClaw",
    installUrl: "https://openclaw.ai/",
    installNote: "openclaw.ai",
    cliAdapterId: "openclaw-cli",
    cliFields: [
      { k: "agent.cli.openclaw.bin", label: "OpenClaw binary", ph: "openclaw" },
    ],
    apiFields: [],
  },
  {
    label: "Hermes (Nous Research)",
    installUrl: "https://github.com/nousresearch/hermes-agent",
    installNote: "Hermes agent CLI",
    cliAdapterId: "hermes-cli",
    cliFields: [
      { k: "agent.cli.hermes.bin", label: "Hermes binary", ph: "hermes" },
    ],
    apiFields: [],
  },
  {
    label: "SemaClaw",
    cliAdapterId: "semaclaw-cli",
    cliFields: [
      { k: "agent.cli.semaclaw.bin", label: "SemaClaw binary", ph: "semaclaw" },
    ],
    apiFields: [],
  },
];

const CUSTOM_CARD: ProviderCard = {
  label: "Custom (any CLI / OpenAI-compatible endpoint)",
  cliAdapterId: "custom-cli",
  apiAdapterId: "openai-compat-api",
  cliFields: [
    { k: "agent.cli.custom.bin", label: "Binary path", ph: "/path/to/your-cli", span: 2 },
    { k: "agent.cli.custom.template", label: "Args template", ph: '--prompt "{{prompt}}" --cwd "{{cwd}}"', span: 2 },
  ],
  apiFields: [
    { k: "agent.api.openai-compat.baseUrl", label: "Base URL", ph: "https://openrouter.ai/api/v1", span: 2 },
    { k: "agent.api.openai-compat.key", label: "API key", ph: "sk-or-…", secret: true },
    { k: "agent.api.openai-compat.model", label: "Model", ph: "anthropic/claude-3.5-sonnet" },
  ],
};

function AgentPickStep({ onRosterChange }: { onRosterChange: (count: number) => void }) {
  const [adapters, setAdapters] = useState<AgentMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [frameworkEnabled, setFrameworkEnabled] = useState<boolean>(false);
  const [primerEnabled, setPrimerEnabled] = useState<boolean>(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/agents");
      const d = (await r.json()) as {
        activeId: string;
        adapters: AgentMeta[];
        settings: Record<string, string | null>;
      };
      setAdapters(d.adapters);
      setActiveId(d.activeId);
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.settings ?? {})) seed[k] = v ?? "";
      setSettings(seed);
    } catch {}
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Read current framework + primer state. Wizard defaults both to OFF
    // for new installs (respecting users who already have their own
    // system prompt / framework); the checkboxes are opt-in.
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then((d: { defaultId: string | null }) => {
        setFrameworkEnabled(!!d.defaultId && d.defaultId !== "none");
      })
      .catch(() => {});
    fetch("/api/primer")
      .then((r) => r.json())
      .then((d: { defaultEnabled: boolean }) => {
        setPrimerEnabled(!!d.defaultEnabled);
      })
      .catch(() => {});
  }, []);

  const configured = adapters.filter((a) => a.isConfigured);

  // Report roster size up so the wizard can gate Continue on >= 1.
  useEffect(() => {
    onRosterChange(configured.length);
  }, [configured.length, onRosterChange]);

  const saveField = async (key: string, value: string) => {
    setSettings((cur) => ({ ...cur, [key]: value }));
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      await refresh();
    } catch {}
  };

  const pickPrimary = async (id: string) => {
    setActiveId(id);
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "agent.backend": id }),
      });
    } catch {}
  };

  const setFrameworkOpt = async (on: boolean) => {
    setFrameworkEnabled(on);
    try {
      await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultId: on ? "openwar" : "none" }),
      });
    } catch {}
  };

  const setPrimerOpt = async (on: boolean) => {
    setPrimerEnabled(on);
    try {
      await fetch("/api/primer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultEnabled: on }),
      });
    } catch {}
  };

  const byId = new Map(adapters.map((a) => [a.id, a] as const));

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{t.onboarding.agentTitle}</h3>
      <p className="text-sm text-neutral-400">
        {t.onboarding.agentBody}
      </p>

      <Roster
        configured={configured}
        activeId={activeId}
        onPickPrimary={pickPrimary}
      />

      <div className="space-y-3">
        {PROVIDER_CARDS.map((card) => (
          <ProviderSetupCard
            key={card.label}
            card={card}
            byId={byId}
            settings={settings}
            saveField={saveField}
          />
        ))}
        <ProviderSetupCard
          card={CUSTOM_CARD}
          byId={byId}
          settings={settings}
          saveField={saveField}
        />
      </div>

      <BehaviorOptIns
        frameworkEnabled={frameworkEnabled}
        primerEnabled={primerEnabled}
        onFramework={setFrameworkOpt}
        onPrimer={setPrimerOpt}
      />
    </div>
  );
}

// Roster zone at the top of the agent step. Empty until the user fills
// in at least one adapter's fields, then fills with chips. The
// "Default" radio only appears when 2+ agents are wired so the
// choice is meaningful.
function Roster({
  configured,
  activeId,
  onPickPrimary,
}: {
  configured: AgentMeta[];
  activeId: string;
  onPickPrimary: (id: string) => void;
}) {
  if (configured.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20 p-4 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/war-bit/friendly.png"
          alt=""
          width={64}
          height={64}
          className="w-12 h-12 [image-rendering:pixelated] shrink-0 opacity-80"
        />
        <div className="text-sm text-neutral-400">
          <div className="font-semibold text-neutral-200 mb-0.5">{t.onboarding.rosterEmpty}</div>
          {t.onboarding.rosterEmptyHint}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold mb-2">
        {t.onboarding.rosterLabel(configured.length)}
      </div>
      <div className="flex flex-wrap gap-2">
        {configured.map((a) => {
          const isDefault = a.id === activeId;
          return (
            <div
              key={a.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${
                isDefault
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                  : "border-neutral-800 bg-neutral-900/60 text-neutral-300"
              }`}
            >
              <span className="font-semibold">{a.name}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-60">{a.kind}</span>
              {configured.length >= 2 && (
                <label className="flex items-center gap-1 ml-1 cursor-pointer">
                  <input
                    type="radio"
                    name="default-agent"
                    checked={isDefault}
                    onChange={() => onPickPrimary(a.id)}
                    className="w-3 h-3 accent-emerald-500"
                  />
                  <span className="text-[10px] opacity-80">{t.onboarding.rosterDefaultLabel}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
      {configured.length === 1 && (
        <div className="text-[10px] text-neutral-500 mt-2">
          {t.onboarding.rosterSingle}
        </div>
      )}
    </div>
  );
}

// The two opt-in behavioral overlays. Both default OFF on new installs
// because they're opinionated layers some users would rather write
// themselves. OpenWar is a starter framework for people who don't
// already have their own system prompt. The primer teaches the agent
// about War Room's surfaces so it can log decisions / post
// announcements / etc. on the user's behalf.
function BehaviorOptIns({
  frameworkEnabled,
  primerEnabled,
  onFramework,
  onPrimer,
}: {
  frameworkEnabled: boolean;
  primerEnabled: boolean;
  onFramework: (on: boolean) => void;
  onPrimer: (on: boolean) => void;
}) {
  return (
    <div className="pt-2 border-t border-neutral-900 space-y-3">
      <Label>{t.onboarding.behaviorTitle}</Label>
      <CheckboxOption
        checked={frameworkEnabled}
        onChange={onFramework}
        title={t.onboarding.openWarTitle}
        body={t.onboarding.openWarBody}
      />
      <CheckboxOption
        checked={primerEnabled}
        onChange={onPrimer}
        title={t.onboarding.primerTitle}
        body={t.onboarding.primerBody}
      />
      <div className="text-[10px] text-neutral-600 leading-snug">
        {t.onboarding.behaviorFooter}
      </div>
    </div>
  );
}

function CheckboxOption({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-md border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-amber-500 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-neutral-100 mb-0.5">{title}</div>
        <div className="text-[11px] text-neutral-500 leading-relaxed">{body}</div>
      </div>
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 font-medium">
      {children}
    </div>
  );
}

function Hint({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold text-neutral-200">{title}</span>
      </div>
      <div className="text-[11px] text-neutral-500 leading-snug">{children}</div>
    </div>
  );
}

// Hoisted to module scope so React's reconciler keeps the same component
// identity across renders (defining a component inside another component's
// body resets state on every parent render).
function ProviderSetupCard({
  card,
  byId,
  settings,
  saveField,
}: {
  card: ProviderCard;
  byId: Map<string, AgentMeta>;
  settings: Record<string, string>;
  saveField: (key: string, value: string) => void;
}) {
  const cliReady = card.cliAdapterId ? byId.get(card.cliAdapterId)?.isConfigured : false;
  const apiReady = card.apiAdapterId ? byId.get(card.apiAdapterId)?.isConfigured : false;
  const anyReady = cliReady || apiReady;
  const dot = anyReady ? "bg-emerald-500" : "bg-neutral-700";

  return (
    <div className="border border-neutral-800 rounded-lg bg-neutral-900/30 p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-neutral-100">{card.label}</span>
        {anyReady && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {t.onboarding.agentReady}
          </span>
        )}
        {card.installUrl && !cliReady && (
          <a
            href={card.installUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[10px] text-neutral-500 hover:text-amber-300 inline-flex items-center gap-1"
            title={card.installNote ?? "install instructions"}
          >
            {t.onboarding.installCli}
            <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {card.cliFields.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" aria-hidden="true" />
              {t.onboarding.cliLabel}
            </div>
            {card.cliFields.map((f) => (
              <ProviderField
                key={f.k}
                field={f}
                value={settings[f.k] ?? ""}
                onCommit={(v) => saveField(f.k, v)}
              />
            ))}
          </div>
        )}
        {card.cliFields.length === 0 && (
          <div className="space-y-2 opacity-50">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" aria-hidden="true" />
              {t.onboarding.cliLabel}
            </div>
            <div className="text-[10px] text-neutral-600 italic px-1">
              {t.onboarding.noCliYet}
            </div>
          </div>
        )}
        {card.apiFields.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" aria-hidden="true" />
              {t.onboarding.apiLabel}
            </div>
            {card.apiFields.map((f) => (
              <ProviderField
                key={f.k}
                field={f}
                value={settings[f.k] ?? ""}
                onCommit={(v) => saveField(f.k, v)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderField({
  field,
  value,
  onCommit,
}: {
  field: FieldSpec;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Reset draft when the parent value changes (e.g. after refresh()).
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  // Detect masked-secret placeholder ("ab••••cd") and treat it as
  // "field already filled, don't show as empty"; clearing requires the
  // user to actually type.
  const isMaskedPlaceholder = field.secret && /^[\w-]{0,4}•+[\w-]{0,4}$/.test(value);
  return (
    <label className="block">
      <span className="text-[10px] text-neutral-500 mb-0.5 block">{field.label}</span>
      <input
        type={field.secret ? "password" : "text"}
        value={draft}
        placeholder={isMaskedPlaceholder ? "(saved, type to replace)" : field.ph}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-neutral-700"
      />
    </label>
  );
}

