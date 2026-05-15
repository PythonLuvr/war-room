# Changelog

All notable changes to War Room are tracked here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For full details on any release, see the corresponding entry on [GitHub Releases](https://github.com/pythonluvr/war-room/releases).

---

## [0.5.2] - 2026-05-15

Hotfix. v0.5.1 broke production builds across every OS/Node combo in CI.

### Fixed
- `useIdentityVersion` React hook moved out of `lib/team.ts` (which is imported by server code) into a new `lib/use-identity-version.ts` with the `"use client"` directive. Mixing a hook into a server-imported module is a Next.js boundary violation that crashes Turbopack production builds with "Ecmascript file had an error" across all routes. Dev mode masks this. Production builds and CI did not. The hook is re-exported from `lib/team.ts` so existing import sites work unchanged.

## [0.5.1] - 2026-05-15

Demo polish for first-impression conversion. `npm run demo` was technically working but read as a single-user sandbox; v0.5.1 makes it look like a populated multi-operator cockpit. All changes confined to demo seed + demo-mode dashboard overrides. Real installs unaffected.

### Changed
- **Six servers seeded** (was three): The War Room, Personal, ACME Co, plus three teammate workspaces (Sara, Mike, Studio). Distinct colors and icons. Each new server has 1-2 channels seeded so clicking through never hits empty.
- **Five-plus agent adapters configured** so the boardroom enumerates them as seated agents: `claude-cli`, `codex-cli`, `gemini-cli`, `anthropic-api`, `openai-api`, `gemini-api`. CLI adapters appear green-dot without requiring the binaries to be installed locally.
- **Multi-agent thread extended** from 7 turns / 2 agents to 9 turns / 4 agents (Claude, OpenAI, Gemini, Codex). Per-bubble attribution reads as real cross-agent collaboration.
- **Onboarding seeds `agentName: "Jarvis"`** so right-panel and boardroom labels demonstrate the renameable-agent feature out of the box.
- **War Room dashboard density:** new deterministic 7-day activity generator produces ~250 events with day-of-week weighting (Mon-Thu busier, weekend trickles) and bell-shaped hour-of-day distribution. Project pool of 10 keeps the top-channels leaderboard full. Kind variety populates the by-kind pie. Mulberry32 PRNG seeded with a constant so reseeds look identical across screenshot captures.
- **Demo-mode dashboard overrides** (`isDemo()` helper in `app/api/dashboard/route.ts`): synthetic KPI numbers for active clients, open approvals, VPS health (4 of 5 online for color contrast), team online (3 of 4). Real installs hit the original code paths.

## [0.5.0] - 2026-05-15

Adoption hardening pass plus full lint cleanup. New `npm run demo` lets anyone preview a fully populated cockpit before deciding whether to install.

### Added
- **`npm run demo`** boots a fully populated cockpit on port 3031 with isolated demo data at `~/.war-room-demo/`. Three servers, nine channels, three seated agents, a seven-turn multi-agent thread exercising per-(project, adapter) sessions. Never touches a real install.
- **`components/demo-banner.tsx`** amber top banner only renders when `WAR_ROOM_DEMO=1`, links to `dev:blank` for a clean start.
- **Test scaffold:** `tests/migration.test.ts` (node:test via tsx) exercises legacy-DB upgrade, migration idempotency, and cold-DB seeding. `tests/smoke.spec.ts` (Playwright) walks the rail and the settings modal. Wired into `.github/workflows/test.yml`.
- **Auto-updater opt-in flow.** `electron/main.js` early-returns when `WAR_ROOM_UPDATE_URL` is unset; forkers without their own update host never see a failed update check.
- README sections: "Try it without committing", "Testing", "Auto-updater".

### Fixed
- **Legacy-DB upgrade bug.** `CREATE INDEX idx_user_channels_group ON user_channels(server_id, group_label)` was running before `migrateAddServerId` added the `server_id` column, throwing `SQLITE_ERROR: no such column: server_id` on every legacy upgrade. Index creation now runs after migration.
- **`claude_sessions` table rebuild** now wraps the table swap in `PRAGMA foreign_keys = OFF` plus `BEGIN/COMMIT` plus `PRAGMA foreign_key_check` per SQLite's ALTER recipe. `chat_messages.session_id` foreign keys survive the rebuild.

### Changed
- **Full lint cleanup:** 89 problems (61 errors, 28 warnings) across 23 files → 0 errors, 0 warnings. CI lint is now hard-fail again.
- Replaced `Math.random()` in render with module-scope deterministic width arrays (7 sites).
- Hoisted inline component definitions to module scope (`onboarding-wizard`, `files-panel`).
- Applied React's "adjust state during render" idiom, lazy `useState` initializers, or per-line disables with documented reasons for `set-state-in-effect` (8 sites).
- Escaped JSX entities (`"` → `&ldquo;`/`&rdquo;`, `'` → `&apos;`) across 8 files.
- Deleted unused imports and dead components/constants across ~15 files.
- `eslint.config.mjs` targeted override disables `@typescript-eslint/no-require-imports` for `scripts/**/*.js` and `electron/**/*.js` only.
- `package.json` `build.publish.url` rewritten to `https://example.invalid/UNSET-set-WAR_ROOM_UPDATE_URL-before-release` so the intent is obvious to anyone inspecting the manifest.

## [0.4.0] - 2026-05-15

Schema migrations make this a minor bump. Idempotent on fresh clones and existing installs.

### Added
- **Real multi-agent thread coherency.** Each AI adapter keeps its own session row and resume token per project. Two agents in the same channel no longer poison each other's context.
- **`@mention` routing.** Pin a default agent per channel from the header chip, pull any other configured agent into a thread mid-conversation with `@claude`, `@openai`, `@gemini`, `@grok`. Multi-mention parallel-fires.
- **Two-server seed architecture.** Distinct canonical servers: The War Room (cross-server dashboard) and Personal (System category + workspace auto-discovery).
- **Per-channel agent override** via new `channel_overrides.agent_backend` column and `/api/channel-agent` route.
- **Multi-agent boardroom seats.** Every configured adapter becomes a first-class seat with its own color, dot, and chat bubble identity.
- New stream event `{ type: 'adapter', adapterId }` so the client renders streaming bubbles in the correct agent's color before any text arrives.

### Changed
- `claude_sessions` table: dropped `UNIQUE(project_path)`, added `adapter_id NOT NULL DEFAULT 'claude-cli'`, new `UNIQUE(project_path, adapter_id)`.
- `chat_messages`: new `agent_id` column (NULL for user messages, adapter id for assistant messages).
- Onboarding identity step simplified to two presets (Workspace owner, Teammate) plus free-text display name.
- Agent picker: provider rows with inline `[CLI]` / `[API key]` pills, auto-save on click. "BYOK" wording dropped.
- Welcome banner shrinks to a dismissible one-liner after onboarding completes.
- "Clients folder" renamed "Projects folder" throughout.
- Sidebar War Room icon always renders violet regardless of `server.color`.
- `dev:blank` no longer EBUSYs on Windows; probe-first guard skips rebuild if `better-sqlite3` already loads.

## [0.2.0] - 2026-05-15

### Added
- **Pluggable AI backend system** (`lib/agents/`). One `AgentAdapter` contract, nine implementations.
- **CLI bridges:** `claude-cli`, `codex-cli`, `gemini-cli`, `custom-cli` (full feature set with tools, files, memory).
- **BYOK APIs:** `anthropic-api`, `openai-api`, `gemini-api`, `grok-api`, `openai-compat-api` (OpenRouter, Groq, Together, Mistral, DeepSeek, local Ollama, anything OpenAI Chat-Completions-shaped).
- New Agent tab in the settings modal with backend picker, binary-path overrides, API key inputs (masked on read).
- New onboarding Agent step with inline backend picker.
- `WelcomeBanner` component surfaces a "do this first" CTA when onboarding incomplete or no agent backend configured.
- New `war-room:open-settings` cross-component event for surfacing the settings modal on a specific tab.
- `npm run dev:blank` script: spins up dev on port 3030 with a fresh temp `WAR_ROOM_DATA_DIR` and `.env.local` stashed.

### Changed
- Empty-state pass across approvals, sessions, boardroom, channel chat, right-panel agents.
- Dashboard header branded only on the actual shared War Room server; personal servers get a generic header.
- All hardcoded team-specific strings stripped from JSX, env-chip, boardroom labels, dashboard subtitle, settings credits.

### Fixed
- `home` channel now exists on every server (was War-Room-only). `/c/home` no longer 404s on a fresh boot.
- `activity` table created in `db.ts` migrate(). `/api/dashboard` no longer 500s on a fresh DB.
- `recentActivity()` defensively returns `[]` on query failure.

### Removed
- `lib/claude-session.ts` (logic moved into `lib/agents/claude-cli.ts`).

## [0.1.3] - 2026-05-14

### Fixed
- **`better-sqlite3` native ABI mismatch in packaged Electron app.** The shipped native module was compiled against Node 22's ABI (`NODE_MODULE_VERSION` 137) instead of Electron 41's (ABI 145). Every database call threw `ERR_DLOPEN_FAILED`, every page returned 500, the renderer showed "page couldn't load" (error digest `3366158170`). Fix: `scripts/release.js` now wipes `node_modules/better-sqlite3/build/` before invoking electron-builder, forcing `@electron/rebuild` to actually run. `electron/after-pack.js` copies the rebuilt binary into the standalone bundle's `node_modules`. Dev builds were not affected.

## [0.1.2] - 2026-05-14

### Added
- Single-instance lock in Electron main process: launching twice now focuses the existing window.
- Dynamic port selection across 33773–33799 instead of hardcoding one port (avoids `EADDRINUSE` when a stranded server holds the default).
- F12 / Ctrl+Shift+I opens DevTools in production for self-diagnosis.

### Changed
- Electron build output moved from `dist-electron/` to `build/electron/` (already gitignored; avoids Windows file-lock issues).
- `scripts/release.js` writes the real update server URL only during build, then restores the placeholder. Committed `package.json` never carries a real publish URL.

### Fixed
- Hardened `loadURL` against destroyed-window races.

## [0.1.1] - 2026-05-14

### Added
- `.env.example` is now committed (was silently excluded by `.gitignore` in v0.1.0).

### Fixed
- Crash in the Electron main process on app open.

### Changed
- Hardened release metadata in `package.json`.

## [0.1.0] - 2026-05-14

First public release.

### Added
- Local-first Discord-style dashboard for Claude Code sessions.
- Channel-based workspace with auto-discovered client folders.
- System channels per server: activity, approvals, services, sessions.
- Persistent chat per project with full Claude Code harness intact.
- Optional Electron desktop wrapper.
- Optional self-hosted LiveKit boardroom voice channel.

[0.5.2]: https://github.com/pythonluvr/war-room/releases/tag/v0.5.2
[0.5.1]: https://github.com/pythonluvr/war-room/releases/tag/v0.5.1
[0.5.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.5.0
[0.4.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.4.0
[0.2.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.2.0
[0.1.3]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.3
[0.1.2]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.2
[0.1.1]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.1
[0.1.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.0
