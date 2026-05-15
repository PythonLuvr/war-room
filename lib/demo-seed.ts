// Demo data seeder. Used by `npm run demo` so cold-clone visitors can
// see what a populated War Room actually looks like in the first 5
// seconds. Only ever runs when WAR_ROOM_DEMO=1 — never against a real
// install.
//
// Generic names only. No real client paths, identities, or services.

import {
  createDecision,
  createJob,
  createUserChannel,
  db,
  listUserServers,
  setSetting,
  upsertSession,
  type UserServerRow,
} from "./db";
// Type-only import — used in seedActivity to reuse the logActivity event
// shape without taking the runtime dependency.
import type { logActivity } from "./activity";

const DEMO_PROJECTS = {
  acmeWebsite: "/demo/projects/acme-website",
  sideProjectBeta: "/demo/projects/side-project-beta",
  q3Redesign: "/demo/projects/q3-redesign",
  retainerOps: "/demo/projects/retainer-ops",
  oldDelivery: "/demo/projects/old-delivery",
  homeWorkspace: "/demo/workspaces/home",
  scratchpad: "/demo/workspaces/scratchpad",
};

export function seedDemoData() {
  const d = db();

  // Wipe any previous demo state. The schema migrations have already run
  // by the time this is invoked (db() triggered them on first call), so
  // we only clear data rows.
  d.exec(`
    DELETE FROM chat_messages;
    DELETE FROM claude_sessions;
    DELETE FROM activity;
    DELETE FROM decisions;
    DELETE FROM announcements;
    DELETE FROM job_posts;
    DELETE FROM job_assignees;
    DELETE FROM jobs;
    DELETE FROM user_channels;
    DELETE FROM user_groups;
    DELETE FROM channel_overrides;
    DELETE FROM channel_positions;
    DELETE FROM group_positions;
    DELETE FROM user_servers;
    DELETE FROM settings WHERE key LIKE 'onboarding.%';
  `);

  // Re-seed canonical War Room + Personal. We can't call the migration
  // helpers directly (they're internal), but the same logic lives here
  // in compact form.
  d.prepare(
    `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
     VALUES(?,?,?,1,0,?,?)`,
  ).run("The War Room", "⚔", "violet", -100, Date.now());
  d.prepare(
    `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
     VALUES(?,?,?,0,1,?,?)`,
  ).run("Personal", "M", "amber", 0, Date.now());
  // A sample shared team server so the "multi-server" rail is visually obvious.
  d.prepare(
    `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
     VALUES(?,?,?,0,0,?,?)`,
  ).run("ACME Co", "AC", "sky", 100, Date.now());

  const servers = listUserServers();
  const personal = servers.find((s) => s.is_personal === 1)!;
  const acme = servers.find((s) => s.name === "ACME Co")!;

  seedOnboarding();
  seedAdapterSettings();
  seedChannels(personal, acme);
  seedJobs();
  seedDecisions();
  seedActivity();
  seedMultiAgentChat(personal);
}

function seedOnboarding() {
  setSetting("onboarding.completed", "1");
  setSetting("onboarding.identity", "primary");
  setSetting("onboarding.displayName", "Marcus");
  setSetting("onboarding.workspaceRoot", "/demo/projects");
  setSetting("onboarding.syncOptIn", "0");
}

function seedAdapterSettings() {
  // Three configured adapters so the boardroom shows three seated agents.
  // These values make isConfigured() return true; calls would obviously
  // fail since they're synthetic, but the demo never invokes the network.
  setSetting("agent.backend", "claude-cli");
  setSetting("agent.cli.claude.bin", "claude");
  setSetting("agent.api.openai.key", "demo-openai-key-not-real-do-not-call");
  setSetting("agent.api.openai.model", "gpt-5");
  setSetting("agent.api.gemini.key", "demo-gemini-key-not-real-do-not-call");
  setSetting("agent.api.gemini.model", "gemini-2.5-pro");
}

function seedChannels(personal: UserServerRow, acme: UserServerRow) {
  // Personal — workspaces (Discord category)
  createUserChannel({
    slug: "p-ws-home",
    name: "home",
    groupLabel: "Workspaces",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.homeWorkspace,
  });
  createUserChannel({
    slug: "p-ws-scratchpad",
    name: "scratchpad",
    groupLabel: "Workspaces",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.scratchpad,
  });

  // Personal — active projects
  createUserChannel({
    slug: "p-acme-website",
    name: "acme-website",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.acmeWebsite,
  });
  createUserChannel({
    slug: "p-side-project-beta",
    name: "side-project-beta",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.sideProjectBeta,
  });
  createUserChannel({
    slug: "p-q3-redesign",
    name: "q3-redesign",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.q3Redesign,
  });

  // Personal — finished
  createUserChannel({
    slug: "p-old-delivery",
    name: "old-delivery",
    groupLabel: "Finished projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.oldDelivery,
  });

  // ACME Co server — a couple of team-shared channels
  createUserChannel({
    slug: "acme-general",
    name: "general",
    groupLabel: "Team",
    kind: "chat",
    serverId: acme.id,
    projectPath: DEMO_PROJECTS.acmeWebsite,
  });
  createUserChannel({
    slug: "acme-design-review",
    name: "design-review",
    groupLabel: "Team",
    kind: "decisions",
    serverId: acme.id,
  });
  createUserChannel({
    slug: "acme-launches",
    name: "launches",
    groupLabel: "Team",
    kind: "announcements",
    serverId: acme.id,
  });

  // Pin a primary AI on one channel so the chip's pinned-state is visible
  // at a glance.
  d_setOverrideAgent("user/p-side-project-beta", "openai-api");
}

function d_setOverrideAgent(channelId: string, adapterId: string) {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO channel_overrides(channel_id, agent_backend, created_at, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(channel_id) DO UPDATE SET agent_backend = excluded.agent_backend, updated_at = excluded.updated_at`,
    )
    .run(channelId, adapterId, now, now);
}

function seedJobs() {
  createJob({
    slug: "acme-homepage-rewrite",
    title: "ACME homepage rewrite",
    clientName: "ACME Co",
    status: "active",
    description: "Refresh of the marketing site landing page. Tighter copy, new hero.",
    createdBy: "you",
    assignees: ["you"],
  });
  createJob({
    slug: "side-project-beta-launch",
    title: "Side Project Beta — launch checklist",
    clientName: "Personal",
    status: "active",
    description: "Final pass before opening waitlist signups.",
    createdBy: "you",
    assignees: ["you"],
  });
  createJob({
    slug: "q3-redesign-spike",
    title: "Q3 redesign — discovery spike",
    clientName: "ACME Co",
    status: "active",
    description: "Two-week scoping pass. Looking at navigation IA + dashboard density.",
    createdBy: "you",
    assignees: ["you"],
  });
}

function seedDecisions() {
  createDecision({
    channelId: "user/acme-design-review",
    title: "Adopt the new color tokens",
    summary:
      "Switching from the legacy palette to the OKLCH-based tokens. Migration script lands with the next release; old tokens stay aliased for one cycle.",
    author: "you",
  });
  createDecision({
    channelId: "user/acme-design-review",
    title: "Drop the carousel on the homepage",
    summary:
      "Heatmap data shows nobody scrubs past slide one. Replacing with a static hero + secondary CTA below the fold.",
    author: "you",
  });
}

function seedActivity() {
  // Spread events across the last 24 hours so the activity chart actually
  // has shape instead of clustering at one timestamp.
  const now = Date.now();
  const HOUR = 3600 * 1000;
  const events: Array<{
    at: number;
    kind: Parameters<typeof logActivity>[0];
    title: string;
    detail?: string;
    projectPath?: string;
  }> = [
    { at: now - 22 * HOUR, kind: "chat.user", title: "Message sent to acme-website", detail: "Can you add the contact form schema?", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 22 * HOUR + 60_000, kind: "chat.assistant", title: "Reply from acme-website", detail: "Done. Validates email + phone, hooks into existing /api/contact.", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 22 * HOUR + 90_000, kind: "chat.tool", title: "Tool: write_file", detail: "src/app/contact/schema.ts", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 19 * HOUR, kind: "service.check", title: "Service health check passed", detail: "all 4 services reporting healthy" },
    { at: now - 16 * HOUR, kind: "chat.user", title: "Message sent to side-project-beta", detail: "Draft the waitlist confirmation email copy", projectPath: DEMO_PROJECTS.sideProjectBeta },
    { at: now - 16 * HOUR + 30_000, kind: "chat.assistant", title: "Reply from side-project-beta", detail: "Two variants attached. A leans warmer, B emphasizes the timeline.", projectPath: DEMO_PROJECTS.sideProjectBeta },
    { at: now - 14 * HOUR, kind: "approval.new", title: "Approval requested: deploy to staging", detail: "side-project-beta · waiting on Marcus" },
    { at: now - 12 * HOUR, kind: "chat.user", title: "Message sent to q3-redesign", detail: "What does the data say about the dashboard density change?", projectPath: DEMO_PROJECTS.q3Redesign },
    { at: now - 12 * HOUR + 45_000, kind: "chat.assistant", title: "Reply from q3-redesign", detail: "Net positive on engagement, 8% lift on time-to-first-action.", projectPath: DEMO_PROJECTS.q3Redesign },
    { at: now - 8 * HOUR, kind: "service.down", title: "Service degraded: cache-edge", detail: "p99 latency spiked to 1.8s, recovering" },
    { at: now - 7 * HOUR, kind: "service.check", title: "Service recovered: cache-edge", detail: "back under threshold for 10 min" },
    { at: now - 5 * HOUR, kind: "approval.new", title: "Approval requested: rotate API key", detail: "acme-website · access token expires Friday" },
    { at: now - 4 * HOUR, kind: "chat.user", title: "Message sent to acme-website", detail: "Add Plausible tracking to the contact form submit handler", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 4 * HOUR + 25_000, kind: "chat.assistant", title: "Reply from acme-website", detail: "Wired. Event name is `contact_form.submit` with email-domain prop.", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 3 * HOUR, kind: "system", title: "Channel created: q3-redesign", detail: "Active projects" },
    { at: now - 90 * 60_000, kind: "chat.user", title: "Message sent to home", detail: "Draft a status update for the ACME team", projectPath: DEMO_PROJECTS.homeWorkspace },
    { at: now - 88 * 60_000, kind: "chat.assistant", title: "Reply from home", detail: "Done. Three-bullet summary, no jargon, ready to paste.", projectPath: DEMO_PROJECTS.homeWorkspace },
    { at: now - 30 * 60_000, kind: "chat.user", title: "Message sent to acme-website", detail: "Run the test suite and tell me what's red", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 28 * 60_000, kind: "chat.tool", title: "Tool: bash", detail: "npm test", projectPath: DEMO_PROJECTS.acmeWebsite },
    { at: now - 27 * 60_000, kind: "chat.assistant", title: "Reply from acme-website", detail: "All green. 142 passing, 0 failing, 3 skipped (intentional).", projectPath: DEMO_PROJECTS.acmeWebsite },
  ];

  // Direct inserts so we can preserve the historical timestamps; logActivity
  // would stamp everything at "now".
  const stmt = db().prepare(
    `INSERT INTO activity(kind, title, detail, project_path, created_at)
     VALUES(?, ?, ?, ?, ?)`,
  );
  for (const e of events) {
    stmt.run(e.kind, e.title, e.detail ?? null, e.projectPath ?? null, e.at);
  }
}

function seedMultiAgentChat(personal: UserServerRow) {
  // Multi-agent thread on the acme-website channel. The user pings two
  // different agents in the same conversation so the per-bubble agent
  // attribution + per-(project, adapter) sessions are visible at a glance.
  void personal; // not needed yet, kept for future scoping
  const project = DEMO_PROJECTS.acmeWebsite;
  const claudeSession = upsertSession(project, "claude-cli");
  const openaiSession = upsertSession(project, "openai-api");

  const HOUR = 3600 * 1000;
  const start = Date.now() - 4 * HOUR;
  const turns: Array<{ session: number; agentId: string | null; role: "user" | "assistant"; text: string; offsetMs: number }> = [
    { session: claudeSession.id, agentId: null, role: "user", offsetMs: 0,
      text: "Hey, can you take a look at the /pricing page? The CTA conversion is down ~12% this week." },
    { session: claudeSession.id, agentId: "claude-cli", role: "assistant", offsetMs: 90_000,
      text: "Pulled it up. Three things stand out:\n\n1. The hero CTA copy changed last Tuesday — \"Get started\" → \"Start your free trial\". Longer = lower scan rate.\n2. The plan toggle defaults to \"yearly\" now. New visitors hit a higher number first and bounce.\n3. The trust badges row was removed in the same deploy.\n\nWant me to write a revert PR for #1 and #3, leave #2 for product to call?" },
    { session: claudeSession.id, agentId: null, role: "user", offsetMs: 180_000,
      text: "Yes on #1 and #3, revert. @openai give me three CTA variants we can A/B against the original \"Get started\"." },
    { session: openaiSession.id, agentId: "openai-api", role: "assistant", offsetMs: 200_000,
      text: "Three options, ordered from safest to boldest:\n\n• **\"Try it free\"** — short, action-first, removes friction word \"start\".\n• **\"See it in action\"** — softer, lower commitment, good for cold traffic.\n• **\"Start building today\"** — stays in the \"start\" family but adds a verb-object pair, reads more confident.\n\nI'd run all three against \"Get started\" with even traffic split for a week. Sample size to detect a 5% lift at 95% confidence is ~14k visitors per arm." },
    { session: claudeSession.id, agentId: null, role: "user", offsetMs: 320_000,
      text: "Good. Set up the experiment in our flag service and ship the revert PR." },
    { session: claudeSession.id, agentId: "claude-cli", role: "assistant", offsetMs: 380_000,
      text: "Both done.\n\n- Revert PR: #2147 — restores hero copy + trust badges, ready for review.\n- Experiment: `pricing-cta-2026-q2` in the flag dashboard, all four variants registered, traffic split 25/25/25/25.\n\nRolling out the experiment is gated on the revert landing first, so confirm merge order is revert → experiment-on." },
    { session: claudeSession.id, agentId: null, role: "user", offsetMs: 460_000,
      text: "Confirmed, that order. Thanks." },
  ];

  for (const t of turns) {
    db().prepare(
      `INSERT INTO chat_messages(session_id, role, content, agent_id, created_at, raw_json)
       VALUES(?, ?, ?, ?, ?, NULL)`,
    ).run(t.session, t.role, t.text, t.agentId, start + t.offsetMs);
  }
}
