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

type CheckResult = {
  claude?: { ok: boolean; version?: string; error?: string };
  workspace?: { ok: boolean; error?: string };
};

const PRESETS: Array<{ id: Identity; name: string; hint: string; color: string }> = [
  {
    id: "primary",
    name: "Workspace owner",
    hint: "I'm the main user of this install",
    color: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200",
  },
  {
    id: "teammate",
    name: "Teammate",
    hint: "I'm joining someone else's setup",
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
  const [check, setCheck] = useState<CheckResult>({});
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/onboarding/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claudeBin: data.claudeBin, workspaceRoot: data.workspaceRoot }),
      });
      setCheck(await r.json());
    } catch (e) {
      setCheck({ claude: { ok: false, error: e instanceof Error ? e.message : String(e) } });
    } finally {
      setChecking(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, completed: true }),
      });
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

  const steps = ["Welcome", "Identity", "Agent", "Projects folder", "Sync"];

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-[#0d0d0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">War Room setup</h2>
          </div>
          <button onClick={skip} title="Skip — finish later" className="text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-4 h-4" />
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
        <div className="px-6 pt-2 text-[10px] uppercase tracking-wider text-neutral-500">
          step {step + 1} of {steps.length} · {steps[step]}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">Welcome to War Room.</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                This dashboard wires your local AI agent into a shared cockpit. Each
                teammate runs their own copy. Your agent works on your machine, with
                your files, your memory, your tools.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Hint icon={<Users className="w-4 h-4 text-amber-300" />} title="Identity">
                  Tell us who you are.
                </Hint>
                <Hint icon={<Terminal className="w-4 h-4 text-sky-300" />} title="Agent">
                  Pick from Claude, GPT, Gemini, Grok, or any OpenAI-compatible endpoint.
                </Hint>
                <Hint icon={<FolderOpen className="w-4 h-4 text-emerald-300" />} title="Projects">
                  Where your project folders live.
                </Hint>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Takes ~30 seconds. You can change any of this later in settings.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Who&apos;s running this dashboard?</h3>
              <p className="text-sm text-neutral-400">
                Pick yourself. This is how your messages get attributed in the boardroom.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((p) => {
                  const selected = data.identity === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickIdentity(p.id)}
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
                <Label>Display name</Label>
                <input
                  value={data.displayName}
                  onChange={(e) => setData((c) => ({ ...c, displayName: e.target.value }))}
                  placeholder="What should we call you?"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
                />
              </div>
              <div>
                <Label>Your agent&apos;s name</Label>
                <input
                  value={data.agentName}
                  onChange={(e) => setData((c) => ({ ...c, agentName: e.target.value }))}
                  placeholder={
                    data.displayName.trim()
                      ? `${data.displayName.trim()}-Agent`
                      : "e.g. Jarvis, Friday, Computer"
                  }
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
                />
                <div className="text-[10px] text-neutral-600 mt-1">
                  Header label for your AI in chat + the boardroom. The
                  underlying provider (Claude, GPT, etc.) is shown separately.
                  Leave blank to use{" "}
                  <code className="text-neutral-500">
                    {data.displayName.trim() || "Your"}-Agent
                  </code>
                  .
                </div>
              </div>
            </div>
          )}

          {step === 2 && <AgentPickStep />}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Where do your project folders live?</h3>
              <p className="text-sm text-neutral-400">
                War Room scans this folder and lists each subdirectory as a channel in your
                sidebar. Doesn&apos;t matter if those are clients, personal builds, side projects,
                or something else. Anything in here becomes a channel your agent can work in.
              </p>
              <p className="text-xs text-neutral-500">
                Default is <code className="text-neutral-300">~/clients</code> — change it to
                whatever fits your setup. You can always add more roots later under{" "}
                <strong className="text-neutral-400">Settings</strong>.
              </p>
              <div>
                <Label>Projects folder (absolute path)</Label>
                <div className="flex items-stretch gap-2">
                  <input
                    value={data.workspaceRoot}
                    onChange={(e) => {
                      setData((c) => ({ ...c, workspaceRoot: e.target.value }));
                      setCheck((c) => ({ ...c, workspace: undefined }));
                    }}
                    placeholder="C:\Users\you\projects"
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-700"
                  />
                  <button
                    onClick={() => setPickerOpen(true)}
                    title="Browse folders"
                    className="px-3 rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1.5 text-sm"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
              </div>
              <button
                onClick={runCheck}
                disabled={checking || !data.workspaceRoot.trim()}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                Verify folder
              </button>
              {check.workspace && (
                <CheckLine ok={check.workspace.ok} okText="Folder exists" errText={check.workspace.error ?? "missing"} />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Sync (optional)</h3>
              <p className="text-sm text-neutral-400">
                War Room runs <strong>fully local by default</strong>. Your channels, jobs, knowledge,
                and chats live in <code className="text-neutral-300">~/.war-room/app.db</code> on
                your machine. Nothing leaves it.
              </p>
              <p className="text-sm text-neutral-400">
                If you want your install to talk to teammates&apos; installs in real time
                (cross-machine @-mentions, shared activity feed, presence), <strong>you</strong> run
                a small relay server on a host you control. Drop the URL in below if you have one,
                or leave blank and stay local.
              </p>
              <div>
                <Label>Your sync server URL (optional)</Label>
                <input
                  value={data.syncUrl ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, syncUrl: e.target.value, syncOptIn: !!e.target.value.trim() }))
                  }
                  placeholder="wss://war-room.your-domain.com  or  http://192.168.1.50:7880"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-700"
                />
                <div className="text-[10px] text-neutral-600 mt-1.5">
                  Self-host whatever sync service this version of War Room expects. Reference
                  implementation will live in the <code className="text-neutral-500">tools/</code>{" "}
                  directory of the repo. We don&apos;t host one for you — your data, your server.
                </div>
              </div>
              <div className="text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-900 pt-3 mt-2">
                <strong className="text-neutral-400">What works locally with no sync:</strong> your
                own agent in the boardroom and dedicated channels, your own jobs / decisions /
                knowledge, your own files, LiveKit voice (if you point at any LiveKit server you
                trust). Everything except cross-machine teammate visibility.
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
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="text-[10px] text-neutral-600">
            esc to skip · settings remembered
          </div>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Enter the War Room
            </button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <FolderPicker
          initialPath={data.workspaceRoot || undefined}
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            setData((c) => ({ ...c, workspaceRoot: p }));
            setCheck((c) => ({ ...c, workspace: undefined }));
            setPickerOpen(false);
          }}
        />
      )}
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

function AgentPickStep() {
  const [adapters, setAdapters] = useState<AgentMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [frameworkList, setFrameworkList] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [defaultFramework, setDefaultFramework] = useState<string>("openwar");

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
    // refresh() drives setState through fetch callbacks; the rule's
    // inter-procedural analysis flags the call site even though setState
    // only happens inside the async chain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then((d: { frameworks: Array<{ id: string; name: string; description: string }>; defaultId: string | null }) => {
        setFrameworkList(d.frameworks ?? []);
        // Default OpenWar as the new-install default if nothing else is set
        // server-side. Server returns null when unset; user can opt out via
        // the picker without leaving the wizard.
        if (d.defaultId) setDefaultFramework(d.defaultId);
      })
      .catch(() => {});
  }, []);

  const persistDefaultFramework = async (id: string) => {
    setDefaultFramework(id);
    try {
      await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultId: id }),
      });
    } catch {}
  };

  const saveField = async (key: string, value: string) => {
    setSettings((cur) => ({ ...cur, [key]: value }));
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      // Refresh so isConfigured + activeId reflect the new state.
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

  const byId = new Map(adapters.map((a) => [a.id, a] as const));
  const configured = adapters.filter((a) => a.isConfigured);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Set up your AI agents</h3>
      <p className="text-sm text-neutral-400">
        Configure as many providers as you want — paste API keys, set binary paths, all in one
        place. Each filled-in adapter becomes a seated agent in the boardroom and is reachable
        via <code className="text-neutral-300">@mention</code> in any chat. The{" "}
        <strong className="text-neutral-300">Default backend</strong> selector at the bottom
        picks which one handles unaddressed messages.
      </p>

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

      <div className="pt-2 border-t border-neutral-900 space-y-3">
        <div>
          <Label>Agent framework (recommended)</Label>
          <select
            value={defaultFramework}
            onChange={(e) => persistDefaultFramework(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
          >
            {frameworkList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.description.split(".")[0]}
              </option>
            ))}
            <option value="none">None — raw model behavior</option>
          </select>
          <div className="text-[10px] text-neutral-600 mt-1">
            A system preamble that wraps every agent reply: confirms briefs before acting, breaks
            work into phases, asks before destructive actions, talks like a senior peer. New users
            should keep <strong>OpenWar</strong> on. Power users with their own framework should
            pick <strong>None</strong>.
          </div>
        </div>

        <div>
        <Label>Default backend</Label>
        {configured.length === 0 ? (
          <div className="text-xs text-neutral-600 italic mt-1">
            Configure at least one provider above to pick a default. Until then, mentions in chat
            still work — there&apos;s just no fallback for unaddressed messages.
          </div>
        ) : (
          <select
            value={activeId}
            onChange={(e) => pickPrimary(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
          >
            {configured.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.kind === "cli" ? "(CLI)" : "(API)"}
              </option>
            ))}
          </select>
        )}
        <div className="text-[10px] text-neutral-600 mt-1.5">
          You can change any of this later in <strong>Settings → Agent</strong>, or per-channel
          via the AI chip in any chat header.
        </div>
        </div>
      </div>
    </div>
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
            ready
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
            install CLI
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {card.cliFields.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              CLI bridge
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
              <Terminal className="w-3 h-3" />
              CLI bridge
            </div>
            <div className="text-[10px] text-neutral-600 italic px-1">
              No official CLI from this provider yet — API only.
            </div>
          </div>
        )}
        {card.apiFields.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" />
              Direct API
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
        placeholder={isMaskedPlaceholder ? "(saved — type to replace)" : field.ph}
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

function CheckLine({ ok, okText, errText }: { ok: boolean; okText: string; errText: string }) {
  return (
    <div
      className={`text-xs flex items-start gap-2 px-3 py-2 rounded border ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-200"
      }`}
    >
      {ok ? <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
      <span className="break-all">{ok ? okText : errText}</span>
    </div>
  );
}
