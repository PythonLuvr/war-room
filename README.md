<p align="center">
  <img src="branding/icon-256.png" alt="War Room" width="160" height="160" />
</p>

<h1 align="center">War Room</h1>

<p align="center"><strong>The cockpit for operators running AI at scale.</strong></p>

War Room is a local-first desktop dashboard for people who run AI agents as a primary part of their work. Plug in any backend (Claude Code, Codex, Gemini, Grok, OpenAI, OpenRouter, Ollama, anything OpenAI-Chat-Completions-compatible), drive them all from one Discord-style interface, and keep every session, service, approval, client folder, and generation tool on one screen. No cloud. No login. No data leaves your laptop.

Built for the freelancer or small agency operator who has five clients, three agents, and ten browser tabs open at any given moment.

---

## What's inside

- **Pluggable AI backend.** Pick how War Room talks to AI: a local CLI (Claude Code, Codex, Gemini, or any custom command for full tool/memory/MCP support) or a direct API (Anthropic, OpenAI, Gemini, Grok, OpenRouter, Groq, Together, Mistral, DeepSeek, local Ollama. Anything OpenAI-Chat-Completions-shaped). Switch any time from the settings modal.
- **Channel-based workspace.** Discord-style layout. Each channel is wired to a real thing: a client folder, an AI session, a service, an approval queue.
- **Persistent chat per project.** Open a channel, you're talking to an agent scoped to that folder. CLI backends get the full harness (memory, skills, MCP servers, hooks); API backends are stateless chat. Streaming output. Resumes across reloads.
- **Multi-agent threads with `@mention` routing.** Pin a primary agent per channel from the header chip. Pull any other configured agent into a thread mid-conversation by `@claude`, `@openai`, `@gemini`, `@grok`. Each agent keeps its own private session and history; the UI merges them into one timeline. The boardroom seats every configured adapter as a first-class participant.
- **System channels per server.** Live activity feed, approvals inbox, services health, active sessions across every project. Non-deletable, always there.
- **Project switcher.** Anything under `~/clients/` (or any folder you configure) shows up automatically as a channel. Briefs, notes, and recent sessions appear in context.
- **Boardroom voice channel.** Multi-agent voice room backed by self-hosted LiveKit. Optional, gracefully hidden when not configured.
- **Cross-machine config.** Shared env at `~/.war-room/.env`, machine-specific overrides at `.env.local`. API keys live in your local config, never in the repo.

---

## Requirements

- **Node.js 20+**
- **At least one AI backend** (either a CLI on your PATH (e.g. `claude`, `codex`, `gemini`) or an API key for one of the supported providers)
- **better-sqlite3** native module compiles on your platform (it bundles on first install)
- Linux, macOS, or Windows

## Quick start

```bash
git clone https://github.com/pythonluvr/war-room.git
cd war-room
npm install
npm run dev
```

Open `http://localhost:3000`. The onboarding wizard walks you through picking an AI backend, naming yourself, and optionally wiring up extras (clients folder, VPS monitoring, LiveKit). You can skip everything and configure later from the settings modal.

To preview what a brand-new user sees with zero config:

```bash
npm run dev:blank
```

Spins up dev on port 3030 with a fresh temp database and your real `.env.local` stashed out of the way. Ctrl+C restores everything.

## Production build

```bash
npm run build
npm start
```

This serves on `http://localhost:3000`. Run behind a process manager like PM2 if you want it always-on.

---

## Configuration

War Room runs end-to-end with zero configuration. Every integration is opt-in. Panels that depend on a specific env var show a "configure to enable" placeholder when it's missing.

See `.env.example` for the full list of supported variables. The important ones:

| Variable | Purpose |
|---|---|
| `WAR_ROOM_CLIENTS_ROOT` | Folder War Room scans for client channels. Defaults to `~/clients`. |
| `WAR_ROOM_CLAUDE_PROJECTS` | Where Claude Code stores session files. Defaults to `~/.claude/projects`. |
| `WAR_ROOM_WORKSPACES` | JSON array of `{path, name}` for static workspace shortcuts. |
| `WAR_ROOM_VPS_HOST` | Optional remote VPS to monitor PM2 services on. |
| `LIVEKIT_URL` etc. | Enables the boardroom voice channel. See `tools/install-livekit.sh`. |

AI backend credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) and CLI binary paths (`CLAUDE_BIN`, `CODEX_BIN`, etc.) can be set via env vars or directly in the in-app settings modal. The settings UI masks existing values on read so re-saving doesn't overwrite them.

## Team roster

Edit `lib/team.ts` to define the people in your operation. The default ships with one member ("You"). Add more for team mode; the dashboard renders one server per member plus a shared "The War Room" server.

## Optional self-hosted LiveKit

If you want the boardroom voice channel, run `tools/install-livekit.sh` on a Linux VPS as root. It installs LiveKit, generates credentials, sets up an nginx reverse proxy, and prints the env vars to paste into your local `.env.local`.

---

## Architecture

- **Next.js 16 + TypeScript + Tailwind + shadcn-style UI**
- **SQLite (better-sqlite3) for local state** for sessions, channels, activity, approvals, decisions, agent backend config
- **`lib/agents/` adapter layer** with one `AgentAdapter` contract, nine implementations (CLI and API)
- **Server-Sent Events** for streaming agent output into the chat pane
- **Chokidar** watches `.jsonl` session files for live cross-project activity (CLI backends)
- **Optional Electron wrapper** for tray-icon desktop install (Next.js localhost works fine in a browser too)

The Next.js server is the only backend. There is no separate API service, no cloud, no auth.

---

## Why does this exist

The market for AI tooling assumes one user, one task, one model. Real operators don't work that way. A working freelancer or small agency runs multiple AI agents in parallel across multiple client engagements, switches contexts every few minutes, and loses time to interface fragmentation. War Room is the dense, opinionated, local-first cockpit that resolves it, and it doesn't care which model or vendor you're using underneath.

If you've ever had Claude open in five terminals, GPT in three browser tabs, and a Slack notification you missed because you were checking your Higgsfield render, this app is for you.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

[AGPL-3.0-or-later](LICENSE). If you host War Room as a service for others, you must make your modified source available under the same license. Commercial licenses are negotiable. Open an issue.
