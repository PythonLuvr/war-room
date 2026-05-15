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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// ─── Agent picker step ──────────────────────────────────────────────────────
//
// Layout B: one row per provider. Each row shows the provider name + two
// buttons inline: [CLI] and [API key]. Clicking either picks that adapter
// as the active backend. Configured adapters get a green dot; unconfigured
// CLI buttons surface a small "install →" link to the official docs.

type AgentMeta = {
  id: string;
  name: string;
  kind: "cli" | "api";
  capabilities: { toolUse: boolean; memory: boolean; fileAccess: boolean; notes?: string };
  isConfigured: boolean;
};

type ProviderRow = {
  label: string;
  cliId: string | null;
  apiId: string | null;
  installUrl?: string;
  installNote?: string;
};

const PROVIDER_ROWS: ProviderRow[] = [
  {
    label: "Claude",
    cliId: "claude-cli",
    apiId: "anthropic-api",
    installUrl: "https://docs.claude.com/en/docs/claude-code/setup",
    installNote: "npm i -g @anthropic-ai/claude-code",
  },
  {
    label: "OpenAI",
    cliId: "codex-cli",
    apiId: "openai-api",
    installUrl: "https://github.com/openai/codex",
    installNote: "Codex CLI",
  },
  {
    label: "Google Gemini",
    cliId: "gemini-cli",
    apiId: "gemini-api",
    installUrl: "https://github.com/google-gemini/gemini-cli",
    installNote: "npm i -g @google/gemini-cli",
  },
  {
    label: "xAI Grok",
    cliId: null,
    apiId: "grok-api",
  },
];

const CUSTOM_ROW: ProviderRow = {
  label: "Custom",
  cliId: "custom-cli",
  apiId: "openai-compat-api",
};

function AgentPickStep() {
  const [adapters, setAdapters] = useState<AgentMeta[]>([]);
  const [activeId, setActiveId] = useState<string>("claude-cli");

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { activeId: string; adapters: AgentMeta[] }) => {
        setAdapters(d.adapters);
        setActiveId(d.activeId);
      })
      .catch(() => {});
  }, []);

  const pick = async (id: string) => {
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

  const Pill = ({
    adapterId,
    icon,
    label,
  }: {
    adapterId: string | null;
    icon: React.ReactNode;
    label: string;
  }) => {
    if (!adapterId) {
      return (
        <span className="px-2.5 py-1.5 text-[11px] rounded border border-neutral-900 bg-neutral-950 text-neutral-700 italic">
          n/a
        </span>
      );
    }
    const a = byId.get(adapterId);
    const isActive = activeId === adapterId;
    const ready = a?.isConfigured ?? false;
    return (
      <button
        onClick={() => pick(adapterId)}
        className={`group flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded border transition-colors ${
          isActive
            ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
            : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
        }`}
        title={ready ? "Configured · click to use" : "Click to use · still needs setup in Settings → Agent"}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${ready ? "bg-emerald-500" : "bg-neutral-700"}`}
        />
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  const Row = ({ p }: { p: ProviderRow }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-neutral-900 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-100">{p.label}</div>
        {p.cliId && p.installUrl && !byId.get(p.cliId)?.isConfigured && (
          <a
            href={p.installUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-neutral-500 hover:text-amber-300 inline-flex items-center gap-1 mt-0.5"
          >
            don&apos;t have the CLI? install
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <Pill adapterId={p.cliId} icon={<Terminal className="w-3 h-3" />} label="CLI" />
      <Pill adapterId={p.apiId} icon={<KeyRound className="w-3 h-3" />} label="API key" />
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Pick your AI backend</h3>
      <p className="text-sm text-neutral-400">
        Which AI should War Room talk to? Each provider has two options:
        <span className="text-neutral-300"> CLI</span> runs the official command-line tool against
        your project folder (full feature set — tools, memory, file access).{" "}
        <span className="text-neutral-300">API key</span> hits the provider directly using a key
        you paste (chat only, no project files). Click any one to pick it. Green dot means it&apos;s
        configured and ready; grey means you still need to set the binary path or paste a key
        under <strong>Settings → Agent</strong>.
      </p>

      <div className="border border-neutral-800 rounded-lg bg-neutral-900/30 px-4">
        {PROVIDER_ROWS.map((p) => (
          <Row key={p.label} p={p} />
        ))}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
          Anything else
        </div>
        <div className="border border-neutral-800 rounded-lg bg-neutral-900/30 px-4">
          <Row p={CUSTOM_ROW} />
        </div>
        <div className="text-[10px] text-neutral-600 mt-1.5 leading-snug">
          <strong className="text-neutral-500">Custom CLI</strong>: run any command-line agent
          via a template (point at the binary + args under Settings).{" "}
          <strong className="text-neutral-500">Custom API</strong>: any OpenAI-compatible
          endpoint — OpenRouter, Groq, Together, Mistral, DeepSeek, Ollama, etc.
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
