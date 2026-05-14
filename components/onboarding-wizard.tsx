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
  Cloud,
  Users,
  X,
} from "lucide-react";
import { FolderPicker } from "@/components/folder-picker";

type Identity = "ej" | "kerem" | "wes" | "custom";

type WizardData = {
  identity: Identity;
  displayName: string;
  claudeBin: string;
  workspaceRoot: string;
  syncOptIn: boolean;
};

type CheckResult = {
  claude?: { ok: boolean; version?: string; error?: string };
  workspace?: { ok: boolean; error?: string };
};

const PRESETS: Array<{ id: Identity; name: string; color: string }> = [
  { id: "ej", name: "EJ", color: "from-amber-500/30 to-amber-700/20 border-amber-500/40 text-amber-200" },
  { id: "kerem", name: "Kerem", color: "from-sky-500/30 to-sky-700/20 border-sky-500/40 text-sky-200" },
  { id: "wes", name: "Wes", color: "from-emerald-500/30 to-emerald-700/20 border-emerald-500/40 text-emerald-200" },
  { id: "custom", name: "Someone else", color: "from-neutral-700 to-neutral-900 border-neutral-700 text-neutral-300" },
];

export function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    identity: "ej",
    displayName: "EJ",
    claudeBin: "claude",
    workspaceRoot: "",
    syncOptIn: false,
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
          identity: (d.settings["onboarding.identity"] as Identity) || cur.identity,
          displayName: d.settings["onboarding.displayName"] || cur.displayName,
          claudeBin: d.settings["onboarding.claudeBin"] || d.defaults.claudeBin,
          workspaceRoot: d.settings["onboarding.workspaceRoot"] || d.defaults.workspaceRoot,
          syncOptIn: d.settings["onboarding.syncOptIn"] === "1",
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
    const preset = PRESETS.find((p) => p.id === id);
    setData((cur) => ({
      ...cur,
      identity: id,
      displayName: id === "custom" ? cur.displayName : (preset?.name ?? ""),
    }));
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

  const steps = ["Welcome", "Identity", "Claude CLI", "Clients folder", "Bridge"];

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
              <h3 className="text-2xl font-semibold">Welcome to The War Room.</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                This dashboard wires your local Claude Code agent into a shared cockpit alongside
                EJ, Kerem, and Wes. Each of you runs your own copy. Your agent works on your
                machine, with your files, your memory, your skills.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Hint icon={<Users className="w-4 h-4 text-amber-300" />} title="Identity">
                  Tell us who you are.
                </Hint>
                <Hint icon={<Terminal className="w-4 h-4 text-sky-300" />} title="Claude CLI">
                  We spawn the local <code className="text-neutral-300">claude</code> binary.
                </Hint>
                <Hint icon={<FolderOpen className="w-4 h-4 text-emerald-300" />} title="Clients">
                  Where your client folders live.
                </Hint>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Takes ~30 seconds. You can change any of this later in settings.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Who's running this dashboard?</h3>
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
                        {p.id === "custom" ? "set name below" : `agent: ${p.id}-brain`}
                      </div>
                    </button>
                  );
                })}
              </div>
              {data.identity === "custom" && (
                <div>
                  <Label>Display name</Label>
                  <input
                    value={data.displayName}
                    onChange={(e) => setData((c) => ({ ...c, displayName: e.target.value }))}
                    placeholder="What should we call you?"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Where's your Claude CLI?</h3>
              <p className="text-sm text-neutral-400">
                Path to the <code className="text-neutral-300">claude</code> binary on your machine.
                Most people just have <code className="text-neutral-300">claude</code> on their PATH —
                leave the default if you can run it from any terminal.
              </p>
              <div>
                <Label>Binary path or command</Label>
                <input
                  value={data.claudeBin}
                  onChange={(e) => {
                    setData((c) => ({ ...c, claudeBin: e.target.value }));
                    setCheck((c) => ({ ...c, claude: undefined }));
                  }}
                  placeholder="claude"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-700"
                />
              </div>
              <button
                onClick={runCheck}
                disabled={checking || !data.claudeBin.trim()}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                Test
              </button>
              {check.claude && (
                <CheckLine ok={check.claude.ok} okText={`Found: ${check.claude.version}`} errText={check.claude.error ?? "not found"} />
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Where do your client folders live?</h3>
              <p className="text-sm text-neutral-400">
                The dashboard scans this folder and lists each subdirectory as a client channel in your sidebar. Default is{" "}
                <code className="text-neutral-300">~/clients</code>. Your agent root (where Claude itself lives) is a separate thing — set per-channel later when you create channels.
              </p>
              <div>
                <Label>Clients folder (absolute path)</Label>
                <div className="flex items-stretch gap-2">
                  <input
                    value={data.workspaceRoot}
                    onChange={(e) => {
                      setData((c) => ({ ...c, workspaceRoot: e.target.value }));
                      setCheck((c) => ({ ...c, workspace: undefined }));
                    }}
                    placeholder="C:\Users\you\clients"
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
              <h3 className="text-xl font-semibold">Bridge to the team</h3>
              <p className="text-sm text-neutral-400">
                Today, each teammate's dashboard runs locally and only talks to their own agent.
                A shared sync server is on
                the roadmap. When it ships, flipping this on will let@-mentions in the boardroom
                actually reach your teammates' agents.
              </p>
              <button
                onClick={() => setData((c) => ({ ...c, syncOptIn: !c.syncOptIn }))}
                className={`w-full px-4 py-3 rounded-lg border text-left flex items-start gap-3 ${
                  data.syncOptIn
                    ? "bg-violet-500/10 border-violet-500/40"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                    data.syncOptIn ? "bg-violet-500/30 border-violet-400" : "border-neutral-700"
                  }`}
                >
                  {data.syncOptIn && <Check className="w-3.5 h-3.5 text-violet-200" />}
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-violet-300" />
                    Opt in to the sync bridge when it lands
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    We'll prompt you with the connection details when the service goes live.
                    Until then, nothing leaves your machine.
                  </div>
                </div>
              </button>
              <div className="text-[11px] text-neutral-500 leading-relaxed border-t border-neutral-900 pt-3 mt-2">
                <strong className="text-neutral-400">What works locally today:</strong> your own
                agent in the boardroom and dedicated channels, your own jobs/decisions/knowledge,
                LiveKit voice (if configured) for live meetings.
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
