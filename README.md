<p align="center">
  <img src="branding/icon-256.png" alt="War Room" width="160" height="160" />
</p>

<h1 align="center">War Room</h1>

<p align="center"><strong>The cockpit for operators running AI at scale.</strong></p>

War Room is a local-first desktop dashboard for people who run multiple Claude Code sessions across many projects at once. It pulls every active session, every service, every approval request, every client folder, and every generation tool into one Discord-style interface running on your own machine. No cloud. No login. No data leaves your laptop.

Built for the freelancer or small agency operator who has five clients, three agents, and ten browser tabs open at any given moment.

---

## What's inside

- **Channel-based workspace.** Discord-style layout. Each channel is wired to a real thing: a client folder, a Claude Code session, a service, an approval queue.
- **Persistent chat per project.** Open a channel, you're talking to a Claude Code session scoped to that folder. Full harness intact (memory, skills, MCP servers, hooks). Streaming output. Resumes across reloads.
- **System channels per server.** Live activity feed, approvals inbox, PM2 services health, active sessions across every project. Non-deletable, always there.
- **Client switcher.** Anything under `~/clients/` shows up automatically as a channel. Briefs, notes, and recent sessions appear in context.
- **Generation console.** Single UI for image/video/audio/3D APIs you have keys for. Output lands in the channel's file tray.
- **Boardroom voice channel.** Multi-agent voice room backed by self-hosted LiveKit. Optional — gracefully hidden if LiveKit env vars aren't set.
- **Cross-machine config.** Shared env at `~/.war-room/.env`, machine-specific overrides at `.env.local`.

---

## Requirements

- **Node.js 20+**
- **Claude Code CLI** installed and on your PATH (`claude --version` should work)
- **better-sqlite3** native module compiles on your platform (it bundles on first install)
- Linux, macOS, or Windows

## Quick start

```bash
git clone https://github.com/pythonluvr/war-room.git
cd war-room
npm install
cp .env.example .env.local   # optional — defaults run fine empty
npm run dev
```

Open `http://localhost:3000`.

The onboarding wizard will ask where your clients folder lives and which services you want to monitor. You can skip everything and configure later by editing `.env.local`.

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
| `CLAUDE_BIN` | Path to the `claude` CLI binary. Defaults to `claude` on PATH. |

## Team roster

Edit `lib/team.ts` to define the people in your operation. The default ships with one member ("You"). Add more for team mode; the dashboard renders one server per member plus a shared "The War Room" server.

## Optional self-hosted LiveKit

If you want the boardroom voice channel, run `tools/install-livekit.sh` on a Linux VPS as root. It installs LiveKit, generates credentials, sets up an nginx reverse proxy, and prints the env vars to paste into your local `.env.local`.

---

## Architecture

- **Next.js 16 + TypeScript + Tailwind + shadcn-style UI**
- **SQLite (better-sqlite3) for local state** — sessions, channels, activity, approvals, decisions
- **Server-Sent Events** for streaming Claude output into the chat pane
- **Chokidar** watches Claude `.jsonl` session files for live cross-project activity
- **Optional Electron wrapper** for tray-icon desktop install (Next.js localhost works fine in a browser too)

The Next.js server is the only backend. There is no separate API service, no cloud, no auth.

---

## Why does this exist

The market for AI tooling assumes one user, one task. Real operators don't work that way. A working freelancer or small agency runs multiple AI agents in parallel across multiple client engagements, switching contexts every few minutes, losing time to interface fragmentation. War Room is the dense, opinionated, local-first cockpit that resolves that fragmentation.

If you've ever had Claude open in five terminals and a Discord notification you missed because you were checking your Higgsfield render, this app is for you.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issue templates and a PR guide live there.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

[AGPL-3.0-or-later](LICENSE). If you host War Room as a service for others, you must make your modified source available under the same license. Commercial licenses are negotiable — open an issue.
