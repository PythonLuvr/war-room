# Changelog

All notable changes to War Room are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-05-16

### Added
- **Agent primer system**. Every agent invoked in a War Room chat
  now receives a short MD briefing as the outermost prompt overlay
  that teaches it: what War Room is, the channel/decision/
  announcement/knowledge model, the HTTP endpoints it can call on
  the user's behalf, and the house style for taking actions vs
  asking first. Turns "Claude in a chat box" into "Claude that can
  log decisions, post announcements, and add knowledge entries when
  you ask, and knows when not to ask."
- `presets/agent-primer/war-room.md` is the canonical primer. Same
  bundle path as `presets/frameworks/` so it survives Electron
  packaging via the existing `outputFileTracingIncludes` +
  after-pack rules.
- `GET /api/war-room/context?channelId=...` is the self-location
  endpoint the primer points the agent at. Returns the server name,
  channel name + kind + project path, plus the 10 most recent
  decisions / announcements / knowledge entries scoped to that
  channel. Lets the agent answer "what have we discussed here?"
  without making the user paste anything.
- `GET/POST /api/primer` for reading + writing the per-channel and
  global toggle. `default.primer_enabled = "1"` on fresh installs
  (discoverability over silent feature flag); flip to `"0"` to
  default-off across all channels.
- Per-channel toggle in the channel-header AgentChip popover next
  to the framework picker. Three states: Inherit global default /
  On / Off. Shows "currently on" or "currently off" so the user
  knows what's live without doing math.
- Outermost prompt overlay slot in `lib/agents/index.ts`. Layer
  order is now: agent primer (new) -> framework preamble ->
  cross-agent context -> user prompt. The primer also injects a
  `current_channel_id` live-context line so the agent can call
  `/api/war-room/context` without the user passing it the id.

### Changed
- `channel_overrides` gains a `primer_enabled` column (NULL =
  inherit, 0 = off, 1 = on). Existing installs migrate cleanly with
  default NULL (inherit), so behavior only changes for fresh DBs
  where the global default seeds to on.

## [0.8.0] - 2026-05-16

### Added
- **Cross-machine sync**. Decisions, announcements, and knowledge
  entries now propagate in real time across every War Room install
  pointed at the same sync server. WebSocket transport, append-only
  event log per workspace, last-writer-wins on row conflicts. Server
  is the sequencer; clients pull missed events on reconnect via
  `lastSeen` cursor.
- **Reference sync server** at `tools/reference-sync-server/`. Small
  Node + `ws` service, ~200 lines, AGPL-3.0. Anyone can stand it up
  on a VPS, home server, or LAN box. Optional shared-token auth.
  PM2-ready. War Room never connects to a server the project hosts:
  bring your own.
- Wire-protocol spec at `lib/sync/protocol.ts` is the contract.
  `PROTOCOL_VERSION` constant gates breaking changes; minor changes
  stay compatible.
- `SYNC.md` at the repo root: setup walkthrough, what syncs and what
  doesn't, auth model, how to write your own server.
- `WAR_ROOM_SYNC_URL`, `WAR_ROOM_SYNC_WORKSPACE`, `WAR_ROOM_SYNC_TOKEN`
  env vars. Env wins over the Settings UI when both are present.
- `GET /api/sync/status` returns live connection state. Side-effect:
  hitting this route boots the client. Settings panel polls it every
  5 seconds so the connection dot reflects reality.

### Changed
- Settings → Sync now shows live state (open / connecting / closed /
  error / disabled) with workspace, last seq, and last-event time
  when connected, instead of just "configured / not configured".
- `lib/agents/index.ts` continues to layer prompt overlays the same
  way; sync is orthogonal to the chat path and never blocks writes
  on the socket. If sync is down, mutations land locally and replay
  to other clients the next time they connect.

### What syncs

| Surface             | Reason                                                 |
|---------------------|--------------------------------------------------------|
| `decisions`         | "Why did we go with X?" needs the same history per team |
| `announcements`     | Broadcasts only work if everyone sees them              |
| `knowledge_entries` | Per-channel docs are most useful when shared            |

### What does NOT sync (and won't in v0.8.x)

- Chat messages (per-user, high-volume, low cross-team value)
- Claude sessions (machine-local Claude state)
- Activity feed (auto-derived from other events)
- Channels / servers (migration semantics deferred to v0.8.1+)
- Settings (per-user preferences)

## [0.7.5] - 2026-05-16

### Added
- Shared `<EmptyState>` component (WarBit + one-line explanation) at
  `components/channel-system/empty-state.tsx`. Used by every channel
  surface that can sit empty on cold install. Replaces plain centered
  grey text with mood-mapped mascot + actionable copy.
- First-chat hint above the composer in any chat channel with zero
  messages. Suggests `@<agent-name> what's in <folder>?` and a
  one-click "Use this" button that drops the suggestion into the
  input. Disappears the instant the user sends anything (gated on
  message-list length, not localStorage, so it correctly reappears
  if history is wiped).

### Changed
- `system/activity` empty state: sleepy WarBit + "Quiet so far.
  Agent runs, approvals, and service checks stream here as they
  happen."
- `system/services` panel grows a top-of-page "Nothing wired up yet"
  card (calm WarBit) when no VPS, no local services, and no env
  files are configured. Card lists the three `WAR_ROOM_*` env vars
  to set.
- `decisions` empty state: friendly WarBit + "Nothing logged yet.
  Decisions belong here so you can answer 'why did we go with X?'
  six weeks from now."
- `announcements` empty state: friendly WarBit + "Nothing pinned.
  Announcements are broadcasts the whole team should see on next
  launch."
- `knowledge` empty state: friendly WarBit + "No notes yet.
  Knowledge entries live per-channel."

## [0.7.4] - 2026-05-16

### Fixed
- Cold install on Windows crashed on first launch with a blank "An
  error occurred in the Server Components render" message. Root cause:
  `@electron/rebuild` silently no-opped when its cache thought the
  better-sqlite3 native binary was already built, so the shipped
  installer carried a binary tagged for Node's `NODE_MODULE_VERSION`
  (137) instead of Electron 41's (145). The first DB call from a
  server component then threw `ERR_DLOPEN_FAILED`, which Next.js
  surfaced as the generic Server Components error with only a digest.
- Three new gates make a repeat impossible:
  - `scripts/rebuild-native.js` wipes
    `node_modules/better-sqlite3/build/` before invoking
    `@electron/rebuild`, then parses the produced `.node` file and
    logs its actual `NODE_MODULE_VERSION` tag.
  - `npm run electron:build` and `npm run electron:pack` chain through
    `npm run electron:rebuild-native` before `electron-builder`.
  - `electron/after-pack.js` refuses to ship a binary whose ABI tag
    doesn't match the expected Electron-major mapping
    (41 -> 145, 40 -> 142, 39 -> 138). Add new majors here when
    bumping Electron.

## [0.7.3] - 2026-05-16

### Added
- WarBit gets a curated mood set at `public/war-bit/` (default, confused,
  calm, focused, alert, friendly, happy, angry, sleepy, done). Each maps
  to a specific UI mood per `public/war-bit/README.md`. Drop new variants
  in with a semantic name to extend.
- Mascot wired into warmer surfaces beyond the error pages:
  - **Cold-clone WelcomeBanner**: `happy.png` avatar replaces the
    Sparkles glyph
  - **DemoBanner**: tiny `happy.png` left of the demo notice text
  - **PlaceholderChannel** (system/approvals + system/sessions empty
    states): `sleepy.png` 128px above the "nothing pending" copy
  - **Channel chat Welcome** (empty thread state): `friendly.png` 80px
    next to the channel intro

### Changed
- The three error surfaces now use mood-specific variants:
  - `not-found.tsx` swaps to `confused.png`
  - `error.tsx` swaps to `focused.png`
  - `global-error.tsx` swaps to `angry.png`
- `public/war-bit.png` (the single original) stays available for any
  surface that wants the generic mascot without picking a mood.

## [0.7.2] - 2026-05-16

### Added
- WarBit mascot lands on the error surfaces. The pixel-art knight sits at
  the top of three new pages: `app/not-found.tsx` (404),
  `app/error.tsx` (runtime error boundary), and `app/global-error.tsx`
  (top-level layout-failure fallback). Copy follows OpenWar voice: "Hit
  a wall," not "Oh no!"
- Asset bundled at `public/war-bit.png` (1920x1920 RGBA, served as-is,
  rendered with `image-rendering: pixelated` for crisp upscaling).

## [0.7.1] - 2026-05-16

### Added
- Vendored upstream **OpenWar v0.3.0** (commit `a3dd3ee`) at
  `presets/frameworks/openwar.md` with a vendor-trace header. Replaces the
  earlier v0.1-era draft that shipped in v0.7.0.
- `scripts/update-frameworks.mjs` + `npm run update-frameworks`. Fetches
  pinned tags of registered upstream frameworks, lints fetched content
  for em-dashes + personal-data patterns, writes to `presets/frameworks/`.
  Manual invocation only.
- Mid-conversation framework switch confirmation modal in the channel
  header chip. Explains that the next turn uses the new framework but
  existing context stays as-is. Esc cancels, Enter confirms.
- Inline "framework not found" toast in chat when a channel pins a
  framework whose markdown file isn't bundled. Graceful degrade to no
  framework instead of 500.
- Demo seed now opens the acme-website multi-agent thread with a Phase 0
  brief + Confirmation Summary exchange, demonstrating the OpenWar
  framework's gating behavior before the Phase 1 execution continues.

### Changed
- `lib/frameworks.ts` registry gains a `refresh` flag on `listFrameworks()`
  and an exported `refreshFrameworkCache()` so dev-watcher and test
  scenarios can drop the in-process cache without restarting the process.
- README gains a "Behavioral framework (OpenWar)" section describing the
  framework system, the update workflow, and the graceful-degrade rules.

### Fixed
- Bundled frameworks now ship in the packaged Electron installer.
  `next.config.ts` adds `presets/**/*` to `outputFileTracingIncludes`,
  `electron/after-pack.js` copies `presets/` into the standalone bundle,
  and `lib/frameworks.ts` resolves the dir robustly across cwd and the
  module's `__dirname` ancestors. Fixes the "Page couldn't load" crash on
  v0.7.0's first NSIS install where the embedded Next server crashed
  trying to read missing framework files.

## [0.7.0] - 2026-05-16

### Added
- Framework registry + per-channel framework override + global default
  setting (`channel_overrides.framework_preset`, `default.framework`).
- OpenWar bundled as the default framework, auto-seeded for cold-clone
  installs.
- Per-channel framework picker in the chat-header AI chip (next to the
  context-mode controls).
- Framework picker in the onboarding wizard's Agent step.
- API: `GET /api/frameworks` (list + default), `POST /api/frameworks`
  (set global default or per-channel pin).
- OpenWar logo (`public/openwar-logo.svg`). Heater-shield silhouette
  with a four-bar phase-stack, sibling to the War Room mark.
- Three new CLI adapters: OpenClaw, Hermes (Nous Research), SemaClaw
  (midea-ai). All probe via `where`/`which` so the green-dot signal in
  the UI means "binary genuinely on PATH," not just "setting non-empty."
- Brand-mark SVGs at `public/agent-logos/` for Claude, OpenAI, Gemini,
  Grok, OpenClaw, Hermes, SemaClaw. Adapters carry an `iconUrl` field;
  channel chat bubbles + boardroom seats + right-panel agent rows render
  the matching mark.
- Reusable `<AgentAvatar>` component.

### Changed
- `sendMessage` in `lib/agents/index.ts` now layers prompt overlays in
  three positions: framework preamble (outermost), cross-agent context
  (middle), user prompt (innermost). Each layer is opt-in per channel;
  defaults skip them so the single-agent flow is unchanged.
- Onboarding wizard's Agent step is a multi-adapter setup form instead
  of a single-pick picker. Paste keys / set binary paths for as many
  providers as you want in one pass.

### Fixed
- `isConfigured()` on all CLI adapters now genuinely probes whether the
  binary exists on PATH (`where`/`which` with 30s cache), instead of
  returning true for any non-empty setting. Fixes the v0.6 confusion
  where every CLI showed green-dot regardless of install state.

## [0.6.0] - 2026-05-15

### Added
- Right-click context menu on any rail server icon → edit modal
  (rename, change icon, change color). War Room server stays locked to
  the brand mark + violet palette.
- Personal workspace icon auto-derives from display name (first letter)
  on wizard completion. `ServerProvider` listens for
  `war-room:identity-changed` to refresh in place.
- `useIdentityVersion()` hook + `IdentityHydrator` component so the
  display name + agent label propagate to chat bubbles, boardroom seats,
  team-presence rows on wizard finish without a page reload.
- Customizable agent label (`onboarding.agentName`). Defaults to
  `${displayName}-Agent`; user can rename in the wizard's Identity step
  or under Settings → General.

## [0.5.1] - 2026-05-15

### Added
- Demo polish for screenshot capture: six servers, five seated agents,
  populated dashboard (~250 events / 7 days with realistic curve),
  services panel synthetic-overridden, knowledge + announcements seeded.

## [0.5.0] - 2026-05-15

### Added
- `npm run demo`. Populated demo cockpit on `:3031` with isolated
  `~/.war-room-demo/` data dir, banner, multi-agent chat thread.
- Playwright UI smoke test + node:test migration test, `npm test` runs
  both, GitHub Actions workflow.
- Per-channel agent backend pin + global default. `@mention` an agent
  in any chat to route a single turn to a different adapter.
- Multi-agent thread coherency: `claude_sessions` rebuilt with
  `UNIQUE(project_path, adapter_id)`, `chat_messages.agent_id` column,
  per-bubble agent attribution in the UI.
- Cross-agent context injection per channel with configurable budgets
  (mode toggle + max-messages + max-chars).
- Two-server architecture: shared War Room dashboard server + per-user
  Personal server, both seeded on cold-clone, idempotent migration for
  existing installs.

### Changed
- Auto-updater is opt-in via `WAR_ROOM_UPDATE_URL` env var. Without it
  the updater silently disables instead of pinging a placeholder host.

## [0.4.0] - 2026-05-14

Internal architecture pass. See git history for details.
