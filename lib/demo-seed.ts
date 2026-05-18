// Demo data seeder. Used by `npm run demo` so cold-clone visitors can
// see what a populated War Room actually looks like in the first 5
// seconds. Only ever runs when WAR_ROOM_DEMO=1, never against a real
// install.
//
// Generic names only. No real client paths, identities, or services.

import {
  createAnnouncement,
  createDecision,
  createJob,
  createKnowledge,
  createUserChannel,
  db,
  listUserServers,
  setSetting,
  upsertSession,
  type UserServerRow,
} from "./db";
// Type-only import, used in seedActivity to reuse the logActivity event
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
  studioMotion: "/demo/projects/studio-motion-pack",
  studioBrand: "/demo/projects/studio-brand-system",
  saraOnboardingFlow: "/demo/projects/sara-onboarding-redesign",
  mikePlatformMigration: "/demo/projects/mike-platform-migration",
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

  // Re-seed canonical War Room + Personal + a populated team rail. The
  // extra non-personal servers make the sidebar read as "team app",
  // matching what a real operator sees.
  const stamp = Date.now();
  const insertServer = d.prepare(
    `INSERT INTO user_servers(name, icon, color, is_default, is_personal, position, created_at)
     VALUES(?,?,?,?,?,?,?)`,
  );
  insertServer.run("The War Room", "⚔", "violet", 1, 0, -100, stamp);
  insertServer.run("Personal", "M", "amber", 0, 1, 0, stamp);
  insertServer.run("ACME Co", "AC", "sky", 0, 0, 100, stamp);
  insertServer.run("Sara", "S", "emerald", 0, 0, 110, stamp);
  insertServer.run("Mike", "MK", "rose", 0, 0, 120, stamp);
  insertServer.run("Studio", "ST", "fuchsia", 0, 0, 130, stamp);

  const servers = listUserServers();
  const personal = servers.find((s) => s.is_personal === 1)!;
  const acme = servers.find((s) => s.name === "ACME Co")!;
  const sara = servers.find((s) => s.name === "Sara")!;
  const mike = servers.find((s) => s.name === "Mike")!;
  const studio = servers.find((s) => s.name === "Studio")!;

  seedOnboarding();
  seedAdapterSettings();
  seedChannels(personal, acme, sara, mike, studio);
  seedJobs();
  seedDecisions();
  seedKnowledge();
  seedAnnouncements();
  seedActivity();
  seedMultiAgentChat();
}

function seedKnowledge() {
  createKnowledge({
    channelId: "user/acme-knowledge",
    title: "Brand voice cheatsheet",
    body:
      "## Voice\n\nConfident, direct, occasionally dry. Avoid superlatives. Always lead with the outcome.\n\n## Banned phrases\n\n- \"world-class\"\n- \"cutting-edge\"\n- \"in today's fast-paced world\"\n- \"unlock\" (unless literal)\n",
    tags: ["copy", "brand"],
    author: "you",
  });
  createKnowledge({
    channelId: "user/acme-knowledge",
    title: "Deployment runbook",
    body:
      "1. Open the change in staging.\n2. Run smoke tests against the staging URL.\n3. Tag a release candidate.\n4. Promote to production via the deploy dashboard.\n5. Watch the cache-edge p99 for 10 minutes.\n6. Post a one-liner in #launches.",
    tags: ["ops", "deploy"],
    author: "you",
  });
  createKnowledge({
    channelId: "user/sara-notes",
    title: "Onboarding research, week 2 themes",
    body:
      "Three themes surfaced from the second batch of interviews:\n\n- Users want a tour they can dismiss permanently after the first run.\n- The empty state of the first canvas is the highest-friction surface.\n- Most participants tried to drag-and-drop on day one and were surprised it didn't work.",
    tags: ["research", "onboarding"],
    author: "you",
  });
  createKnowledge({
    channelId: "user/mike-runbooks",
    title: "Production cutover checklist",
    body:
      "T-24h: freeze writes on legacy.\nT-2h: dual-write enabled, verify lag < 200ms.\nT-0: flip primary, monitor error budget for 30m.\nT+30m: revoke legacy write credentials.\nRollback path documented at the top of this doc.",
    tags: ["ops", "migration"],
    author: "you",
  });
}

function seedAnnouncements() {
  createAnnouncement({
    channelId: "user/acme-launches",
    title: "ACME homepage refresh, shipping Friday",
    body:
      "New hero, restored trust badges, A/B on the CTA copy. Comms in #general, status updates in this channel. React with the eye to ack.",
    author: "you",
  });
  createAnnouncement({
    channelId: "user/acme-launches",
    title: "Q3 redesign discovery, kickoff Monday",
    body:
      "Two-week scoping pass. We'll be touching navigation IA + dashboard density. Ping the channel if any of your screens are in scope.",
    author: "you",
  });
  createAnnouncement({
    channelId: "user/studio-announcements",
    title: "Render box online, please retire local renders",
    body:
      "The shared render box is live on the VPS. Hand off long renders via the queue script in the runbooks channel. Local renders should now be the exception.",
    author: "you",
  });
}

function seedOnboarding() {
  setSetting("onboarding.completed", "1");
  setSetting("onboarding.identity", "primary");
  setSetting("onboarding.displayName", "Marcus");
  setSetting("onboarding.agentName", "Jarvis");
  setSetting("onboarding.workspaceRoot", "/demo/projects");
  setSetting("onboarding.syncOptIn", "0");
}

function seedAdapterSettings() {
  // Five configured adapters so the boardroom shows five seated agents:
  // Claude + OpenAI + Gemini + Codex + Gemini-CLI. These values make
  // isConfigured() return true; the demo never actually invokes any of
  // them, so the synthetic credentials are harmless.
  setSetting("agent.backend", "claude-cli");
  setSetting("agent.cli.claude.bin", "claude");
  setSetting("agent.cli.codex.bin", "codex");
  setSetting("agent.cli.gemini.bin", "gemini");
  setSetting("agent.api.openai.key", "demo-openai-key-not-real-do-not-call");
  setSetting("agent.api.openai.model", "gpt-5");
  setSetting("agent.api.gemini.key", "demo-gemini-key-not-real-do-not-call");
  setSetting("agent.api.gemini.model", "gemini-2.5-pro");
  setSetting("agent.api.anthropic.key", "demo-anthropic-key-not-real-do-not-call");
  setSetting("agent.api.anthropic.model", "claude-sonnet-4-6");
}

function seedChannels(
  personal: UserServerRow,
  acme: UserServerRow,
  sara: UserServerRow,
  mike: UserServerRow,
  studio: UserServerRow,
) {
  // Personal, workspaces (Discord category)
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

  // Personal, active projects
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
  createUserChannel({
    slug: "p-retainer-ops",
    name: "retainer-ops",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.retainerOps,
  });

  // Personal, finished
  createUserChannel({
    slug: "p-old-delivery",
    name: "old-delivery",
    groupLabel: "Finished projects",
    kind: "chat",
    serverId: personal.id,
    projectPath: DEMO_PROJECTS.oldDelivery,
  });

  // ACME Co server, a few team-shared channels
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
  createUserChannel({
    slug: "acme-knowledge",
    name: "knowledge",
    groupLabel: "Team",
    kind: "knowledge",
    serverId: acme.id,
  });

  // Sara's personal workspace (visible because cross-server browse is the
  // spec). One project + a notes channel.
  createUserChannel({
    slug: "sara-onboarding",
    name: "onboarding-redesign",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: sara.id,
    projectPath: DEMO_PROJECTS.saraOnboardingFlow,
  });
  createUserChannel({
    slug: "sara-notes",
    name: "research-notes",
    groupLabel: "Workspaces",
    kind: "knowledge",
    serverId: sara.id,
  });

  // Mike's workspace, one platform migration project + an approvals
  // queue placeholder so the channel reads "ops engineer".
  createUserChannel({
    slug: "mike-platform",
    name: "platform-migration",
    groupLabel: "Active projects",
    kind: "chat",
    serverId: mike.id,
    projectPath: DEMO_PROJECTS.mikePlatformMigration,
  });
  createUserChannel({
    slug: "mike-runbooks",
    name: "runbooks",
    groupLabel: "Workspaces",
    kind: "knowledge",
    serverId: mike.id,
  });

  // Studio, cross-functional team space.
  createUserChannel({
    slug: "studio-motion",
    name: "motion-pack",
    groupLabel: "Production",
    kind: "chat",
    serverId: studio.id,
    projectPath: DEMO_PROJECTS.studioMotion,
  });
  createUserChannel({
    slug: "studio-brand",
    name: "brand-system",
    groupLabel: "Production",
    kind: "chat",
    serverId: studio.id,
    projectPath: DEMO_PROJECTS.studioBrand,
  });
  createUserChannel({
    slug: "studio-decisions",
    name: "decisions",
    groupLabel: "Operations",
    kind: "decisions",
    serverId: studio.id,
  });
  createUserChannel({
    slug: "studio-announcements",
    name: "all-hands",
    groupLabel: "Operations",
    kind: "announcements",
    serverId: studio.id,
  });

  // Pin a primary AI on one channel so the chip's pinned-state is visible
  // at a glance.
  d_setOverrideAgent("user/p-side-project-beta", "openai-api");
  d_setOverrideAgent("user/studio-motion", "gemini-cli");
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
    title: "Side Project Beta, launch checklist",
    clientName: "Personal",
    status: "active",
    description: "Final pass before opening waitlist signups.",
    createdBy: "you",
    assignees: ["you"],
  });
  createJob({
    slug: "q3-redesign-spike",
    title: "Q3 redesign, discovery spike",
    clientName: "ACME Co",
    status: "active",
    description: "Two-week scoping pass. Looking at navigation IA + dashboard density.",
    createdBy: "you",
    assignees: ["you"],
  });
  createJob({
    slug: "studio-motion-pack",
    title: "Studio motion pack, Q2 deliverable",
    clientName: "Studio",
    status: "active",
    description: "Six 4-second loops for the marketing site hero.",
    createdBy: "you",
    assignees: ["you"],
  });
  createJob({
    slug: "platform-migration-cutover",
    title: "Platform migration, production cutover",
    clientName: "Mike",
    status: "active",
    description: "Final cutover window. Rollback plan attached.",
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
  createDecision({
    channelId: "user/studio-decisions",
    title: "Move motion renders off the studio workstation",
    summary:
      "Bursty render queue keeps blocking design work. Standing up a small render box on the VPS, sized to peak load + 20%.",
    author: "you",
  });
}

// ─── Activity seeding ──────────────────────────────────────────────────────
//
// Generates ~250 events across the past 7 days with realistic shape:
//   • Mon-Thu busier than Fri-Sun
//   • Most activity during work hours (9am-7pm), trickle outside
//   • Spread across every demo project so topChannels has variety
//   • All seven activity kinds represented so the by-kind pie reads full
//
// Deterministic via a seeded PRNG so reseeds look identical across runs
// (matters for screenshots, no surprise spikes between captures).

function makeRng(seed: number) {
  // Mulberry32, small, fast, good enough for fixture generation.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const ACTIVITY_PROJECTS: Array<{ path: string; label: string; weight: number }> = [
  { path: DEMO_PROJECTS.acmeWebsite, label: "acme-website", weight: 5 },
  { path: DEMO_PROJECTS.q3Redesign, label: "q3-redesign", weight: 4 },
  { path: DEMO_PROJECTS.sideProjectBeta, label: "side-project-beta", weight: 3 },
  { path: DEMO_PROJECTS.studioMotion, label: "motion-pack", weight: 3 },
  { path: DEMO_PROJECTS.studioBrand, label: "brand-system", weight: 2 },
  { path: DEMO_PROJECTS.mikePlatformMigration, label: "platform-migration", weight: 3 },
  { path: DEMO_PROJECTS.saraOnboardingFlow, label: "onboarding-redesign", weight: 2 },
  { path: DEMO_PROJECTS.retainerOps, label: "retainer-ops", weight: 2 },
  { path: DEMO_PROJECTS.homeWorkspace, label: "home", weight: 2 },
  { path: DEMO_PROJECTS.scratchpad, label: "scratchpad", weight: 1 },
];

const PROMPT_SAMPLES = [
  "Add the contact form schema",
  "Draft the waitlist confirmation email",
  "What does the data say about the dashboard density change?",
  "Run the test suite and tell me what's red",
  "Add Plausible tracking to the contact form submit handler",
  "Write a status update for the team",
  "Refactor the auth middleware to use the new session shape",
  "Generate the Q3 board deck outline",
  "Spin up a render preview on staging",
  "Diff the latest brand guidelines vs what's shipped",
  "Walk through the cutover checklist and flag anything risky",
  "Draft three subject lines for tomorrow's send",
  "Why is the p99 spiking on cache-edge?",
  "Pull the last seven days of conversion data",
  "Write the migration script for the new color tokens",
];

const REPLY_SAMPLES = [
  "Done. Validates email + phone, hooks into existing /api/contact.",
  "Two variants attached. A leans warmer, B emphasizes the timeline.",
  "Net positive on engagement, 8% lift on time-to-first-action.",
  "All green. 142 passing, 0 failing, 3 skipped (intentional).",
  "Wired. Event name is `contact_form.submit` with email-domain prop.",
  "Three-bullet summary, no jargon, ready to paste.",
  "Refactored. Eliminated the cookie-shape mismatch + added a regression test.",
  "Outline drafted. Five sections, ~12 slides, leaves room for a live demo.",
  "Render preview is up at preview-staging:3030.",
  "Two structural drifts found, three minor color-token gaps. PR opened.",
  "Walked it. One blocker (DNS propagation), two soft warnings, rollback plan attached.",
  "Three: 'See the live site', 'New numbers inside', 'You asked, we shipped'.",
  "Slow query in `event_aggregations`, added the missing composite index.",
  "Pulled. CSV in the channel. Conversion is up 3.1% week-over-week.",
  "Migration script in branch `tokens-oklch`. Idempotent, dry-run flag included.",
];

const TOOL_SAMPLES = [
  { name: "write_file", detail: "src/app/contact/schema.ts" },
  { name: "bash", detail: "npm test" },
  { name: "bash", detail: "git status" },
  { name: "read_file", detail: "src/lib/auth/middleware.ts" },
  { name: "edit_file", detail: "tailwind.config.ts (color token map)" },
  { name: "bash", detail: "node scripts/render-preview.js" },
  { name: "search", detail: "grep -r 'session.token' src/" },
  { name: "bash", detail: "npx playwright test --grep checkout" },
];

const SERVICE_CHECK_SAMPLES = [
  "all 4 services reporting healthy",
  "VPS PM2 OK · all 5 processes online",
  "local services reachable on :3030, :7880",
  "edge cache p99 back under 250ms",
];

const SERVICE_DOWN_SAMPLES = [
  { title: "Service degraded: cache-edge", detail: "p99 latency spiked to 1.8s, recovering" },
  { title: "Service stopped: render-worker", detail: "OOM kill, auto-restart attempted" },
  { title: "Service flapping: ingest-api", detail: "3 restarts in 90s, investigating" },
];

const APPROVAL_SAMPLES = [
  { title: "Approval requested: deploy to staging", detail: "side-project-beta · waiting on Marcus" },
  { title: "Approval requested: rotate API key", detail: "acme-website · access token expires Friday" },
  { title: "Approval requested: merge to main", detail: "platform-migration · cutover PR" },
  { title: "Approval requested: $30 spend", detail: "studio-motion · upscale on render queue" },
];

const SYSTEM_SAMPLES = [
  { title: "Channel created", detail: "q3-redesign · Active projects" },
  { title: "Server settings updated", detail: "Studio · color recolored to fuchsia" },
  { title: "Sync relay reconnected", detail: "WebSocket OK after 12s outage" },
  { title: "Backup snapshot complete", detail: "~/.war-room/app.db · 2.4 MB" },
];

function seedActivity() {
  const now = Date.now();
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const rng = makeRng(0xC0DEBABE);

  // Day-of-week multiplier, Mon-Thu carry the workload, Friday tapers,
  // weekend is a trickle. Sunday=0 in JS.
  const DOW_WEIGHT = [0.3, 1.0, 1.1, 1.0, 0.95, 0.7, 0.35]; // Sun..Sat
  // Hour-of-day multiplier, bell-shaped around 10am-4pm.
  const HOUR_WEIGHT = (h: number) => {
    if (h < 6) return 0.05;
    if (h < 9) return 0.2;
    if (h < 12) return 1.0;
    if (h < 14) return 0.7; // lunch dip
    if (h < 18) return 1.0;
    if (h < 21) return 0.5;
    return 0.15;
  };

  const events: Array<{
    at: number;
    kind: Parameters<typeof logActivity>[0];
    title: string;
    detail?: string;
    projectPath?: string;
  }> = [];

  // Generate per day: hit a target count weighted by DOW + spread events
  // across hours via HOUR_WEIGHT. Bias kinds so chat dominates with a
  // realistic minority of tools, services, approvals, and system events.
  const KIND_POOL: Array<Parameters<typeof logActivity>[0]> = [
    "chat.user", "chat.user", "chat.user",
    "chat.assistant", "chat.assistant", "chat.assistant",
    "chat.tool", "chat.tool",
    "service.check",
    "service.down",
    "approval.new",
    "system",
  ];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayMid = new Date(now - dayOffset * DAY);
    dayMid.setHours(0, 0, 0, 0);
    const dow = dayMid.getDay();
    const target = Math.round(40 * DOW_WEIGHT[dow]); // 12-44 per day
    let placed = 0;
    let attempts = 0;
    while (placed < target && attempts < target * 4) {
      attempts++;
      const hour = Math.floor(rng() * 24);
      // Reject this hour with probability 1 - HOUR_WEIGHT to shape the
      // hourly distribution.
      if (rng() > HOUR_WEIGHT(hour)) continue;
      const minute = Math.floor(rng() * 60);
      const second = Math.floor(rng() * 60);
      const at = dayMid.getTime() + hour * HOUR + minute * 60_000 + second * 1000;
      if (at > now) continue;
      const kind = pick(rng, KIND_POOL);
      const project = pickWeighted(rng, ACTIVITY_PROJECTS);
      events.push(buildEvent(rng, at, kind, project));
      placed++;
    }
  }

  // Direct inserts so we can preserve historical timestamps; logActivity
  // would stamp everything at "now".
  const stmt = db().prepare(
    `INSERT INTO activity(kind, title, detail, project_path, created_at)
     VALUES(?, ?, ?, ?, ?)`,
  );
  for (const e of events) {
    stmt.run(e.kind, e.title, e.detail ?? null, e.projectPath ?? null, e.at);
  }
}

function pickWeighted(
  rng: () => number,
  pool: Array<{ path: string; label: string; weight: number }>,
): { path: string; label: string } {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  const target = rng() * total;
  let acc = 0;
  for (const p of pool) {
    acc += p.weight;
    if (target <= acc) return p;
  }
  return pool[pool.length - 1];
}

function buildEvent(
  rng: () => number,
  at: number,
  kind: Parameters<typeof logActivity>[0],
  project: { path: string; label: string },
): {
  at: number;
  kind: Parameters<typeof logActivity>[0];
  title: string;
  detail?: string;
  projectPath?: string;
} {
  switch (kind) {
    case "chat.user":
      return {
        at,
        kind,
        title: `Message sent to ${project.label}`,
        detail: pick(rng, PROMPT_SAMPLES),
        projectPath: project.path,
      };
    case "chat.assistant":
      return {
        at,
        kind,
        title: `Reply from ${project.label}`,
        detail: pick(rng, REPLY_SAMPLES),
        projectPath: project.path,
      };
    case "chat.tool": {
      const tool = pick(rng, TOOL_SAMPLES);
      return {
        at,
        kind,
        title: `Tool: ${tool.name}`,
        detail: tool.detail,
        projectPath: project.path,
      };
    }
    case "service.check":
      return {
        at,
        kind,
        title: "Service health check passed",
        detail: pick(rng, SERVICE_CHECK_SAMPLES),
      };
    case "service.down": {
      const s = pick(rng, SERVICE_DOWN_SAMPLES);
      return { at, kind, title: s.title, detail: s.detail };
    }
    case "approval.new": {
      const a = pick(rng, APPROVAL_SAMPLES);
      return { at, kind, title: a.title, detail: a.detail };
    }
    case "system":
    default: {
      const s = pick(rng, SYSTEM_SAMPLES);
      return { at, kind, title: s.title, detail: s.detail };
    }
  }
}

function seedMultiAgentChat() {
  // Multi-agent thread on the acme-website channel. The user pings four
  // different agents in the same conversation so the per-bubble agent
  // attribution + per-(project, adapter) sessions are visible at a glance,
  // and so the boardroom seats all have at least one bubble of history
  // each.
  const project = DEMO_PROJECTS.acmeWebsite;
  const claudeSession = upsertSession(project, "claude-cli");
  const openaiSession = upsertSession(project, "openai-api");
  const geminiSession = upsertSession(project, "gemini-cli");
  const codexSession = upsertSession(project, "codex-cli");

  const HOUR = 3600 * 1000;
  // Backdated so the Phase 0 brief + confirmation summary land before
  // the ~4h-old execution thread. Total span: ~5h of history.
  const start = Date.now() - 5 * HOUR;
  const turns: Array<{
    session: number;
    agentId: string | null;
    role: "user" | "assistant";
    text: string;
    offsetMs: number;
  }> = [
    // Phase 0: operator drops a brief. Claude (running under OpenWar)
    // produces a Confirmation Summary instead of jumping in. Showcases
    // the framework wrapping the agent's behavior.
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 0,
      text:
        "Brief:\n\nObjective: figure out why /pricing CTA conversion dropped ~12% week-over-week.\n" +
        "Deliverables: a root cause and a revert PR if it's a regression.\n" +
        "Constraints: no production changes without me confirming first.\n" +
        "Mode: per-step gating.",
    },
    {
      session: claudeSession.id,
      agentId: "claude-cli",
      role: "assistant",
      offsetMs: 60_000,
      text:
        "**Confirmation Summary**\n\n" +
        "- **Objective**: diagnose the 12% drop in /pricing CTA conversion week-over-week.\n" +
        "- **Deliverables**: (1) root cause, (2) revert PR if it's a regression.\n" +
        "- **Constraints**: no production changes without explicit approval.\n" +
        "- **Tools required**: read access to the marketing site repo + analytics dashboard. Both should be wired already.\n" +
        "- **Unknowns**: which dashboard you're pulling the 12% number from (Plausible, GA4, or internal), and whether the comparison window controls for traffic-source mix. Flag if you want me to verify before assuming.\n\n" +
        "**Mode**: per-step gating, confirmed. I'll surface the next step and wait for your ok.\n\n" +
        "Phase 1 step 1: pull the last 7 days of /pricing engagement from analytics, segmented by traffic source. Sound right?",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 120_000,
      text: "Yes, run it. The number is from Plausible.",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 240_000,
      text: "Hey, can you take a look at the /pricing page? The CTA conversion is down ~12% this week.",
    },
    {
      session: claudeSession.id,
      agentId: "claude-cli",
      role: "assistant",
      offsetMs: 390000,
      text:
        "Pulled it up. Three things stand out:\n\n" +
        "1. The hero CTA copy changed last Tuesday, \"Get started\" → \"Start your free trial\". Longer = lower scan rate.\n" +
        "2. The plan toggle defaults to \"yearly\" now. New visitors hit a higher number first and bounce.\n" +
        "3. The trust badges row was removed in the same deploy.\n\n" +
        "Want me to write a revert PR for #1 and #3, leave #2 for product to call?",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 480000,
      text: "Yes on #1 and #3, revert. @openai give me three CTA variants we can A/B against the original \"Get started\".",
    },
    {
      session: openaiSession.id,
      agentId: "openai-api",
      role: "assistant",
      offsetMs: 500000,
      text:
        "Three options, ordered from safest to boldest:\n\n" +
        "• **\"Try it free\"**, short, action-first, removes friction word \"start\".\n" +
        "• **\"See it in action\"**, softer, lower commitment, good for cold traffic.\n" +
        "• **\"Start building today\"**, stays in the \"start\" family but adds a verb-object pair, reads more confident.\n\n" +
        "I'd run all three against \"Get started\" with even traffic split for a week. Sample size to detect a 5% lift at 95% confidence is ~14k visitors per arm.",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 620000,
      text: "@gemini eyeball the screenshots in #design-review and tell me if the badge row was removed intentionally or by accident.",
    },
    {
      session: geminiSession.id,
      agentId: "gemini-cli",
      role: "assistant",
      offsetMs: 660000,
      text:
        "Compared the before/after captures. The trust badges row was replaced by a single \"500+ teams\" line in 60% smaller type. " +
        "Reads like a conscious simplification, not a regression, but the line lost the logos that did the actual social-proof work. " +
        "Suggest restoring the logo row above the line.",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 760000,
      text: "Good. @codex set up the experiment in our flag service and ship the revert PR with the logo row restored.",
    },
    {
      session: codexSession.id,
      agentId: "codex-cli",
      role: "assistant",
      offsetMs: 840000,
      text:
        "Both done.\n\n" +
        "- Revert PR: #2147, restores hero copy + trust badges + logo row, ready for review.\n" +
        "- Experiment: `pricing-cta-2026-q2` in the flag dashboard, all four variants registered, traffic split 25/25/25/25.\n\n" +
        "Rolling out the experiment is gated on the revert landing first, so confirm merge order is revert → experiment-on.",
    },
    {
      session: claudeSession.id,
      agentId: null,
      role: "user",
      offsetMs: 920000,
      text: "Confirmed, that order. Thanks all.",
    },
  ];

  for (const t of turns) {
    db()
      .prepare(
        `INSERT INTO chat_messages(session_id, role, content, agent_id, created_at, raw_json)
         VALUES(?, ?, ?, ?, ?, NULL)`,
      )
      .run(t.session, t.role, t.text, t.agentId, start + t.offsetMs);
  }
}
