# Changelog

All notable changes to War Room are tracked here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For full details on any release, see the corresponding entry on [GitHub Releases](https://github.com/pythonluvr/war-room/releases).

---

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

[0.4.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.4.0
[0.2.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.2.0
[0.1.3]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.3
[0.1.2]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.2
[0.1.1]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.1
[0.1.0]: https://github.com/pythonluvr/war-room/releases/tag/v0.1.0
