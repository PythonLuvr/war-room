# Cross-machine sync

War Room is local-first. Without sync, every install talks only to
the agent and SQLite database on its own machine. That's the cold-
clone default and it's fine for solo use.

If you want a shared workspace - the same channels, decisions, and
knowledge entries appearing on every teammate's machine in real
time - you have two options:

1. **Host from your own machine** (v0.16.0+). Settings -> Sync ->
   "Host this workspace from this machine." Pick one of four
   hosting modes (Cloudflare Quick Tunnel, Cloudflare Named Tunnel,
   Tailscale, or Manual VPS), copy the invite, paste it in Slack.
   See `docs/sync-hosting.md` for the walkthrough.
2. **Run the reference server on a VPS** (v0.15.0 path, still
   supported). Detailed below.

War Room never connects to a server the project hosts. Self-hosted
only.

## Architecture

Append-only event log per workspace, brokered by a WebSocket server.

- Each client mutation (create / update / delete on a synced table)
  produces an event.
- The server assigns each event a monotonic `seq` number and
  broadcasts it to every other connected client in the same
  workspace.
- Clients persist the highest `seq` they've applied. On reconnect,
  they tell the server "give me everything after N" and the server
  replays the missing events.
- Conflicts use last-writer-wins at the row level. The kinds we sync
  are surfaces where genuine simultaneous edits are rare.

Protocol details in [`lib/sync/protocol.ts`](lib/sync/protocol.ts).

## What syncs

| Table                | Why                                                       |
|----------------------|-----------------------------------------------------------|
| `decisions`          | Team needs the same history of "what we decided"          |
| `announcements`      | Broadcasts are pointless if only one person sees them     |
| `knowledge_entries`  | Per-channel docs are most useful when shared              |
| `user_servers`       | Workspaces appear on every teammate's rail                |
| `user_groups`        | Sidebar group labels stay aligned across machines         |
| `user_channels`      | Create a channel once, everyone sees it                   |
| `sidebar_roles`      | Role colors / labels apply for everyone                   |
| `sidebar_role_assignments` | Member-to-role mapping stays in sync                |
| `agent_profiles`     | Renamed / re-iconed agents look the same on every machine |

Workspace-structure events use **natural keys** (server name, channel
slug, group label, role name, adapter id) over the wire, not the
local INTEGER primary key. Two clients can both create the "design"
group locally and a sync event will collapse them into one shared
group instead of clobbering each other's autoincrement ids.

## What does NOT sync

| Surface              | Why not                                                    |
|----------------------|------------------------------------------------------------|
| Chat messages        | Per-user Claude history. Large volume. Team-chat needs a different schema (planned). |
| Claude sessions      | Machine-local Claude state. Not portable.                   |
| Activity feed        | Auto-derived from other events. Will rebuild itself.        |
| Settings             | Per-user preferences. Don't bleed across people.            |
| Uploaded files       | File bytes live on the machine that uploaded them. URLs sync via the row they belong to, content does not (yet). |

## Setup

### 1. Stand up a sync server

The reference server is a small Node WebSocket service. Anyone can
re-implement it in any language; the wire protocol is the contract.

```bash
# On your VPS
git clone https://github.com/PythonLuvr/war-room.git
cd war-room/tools/reference-sync-server
npm install
WAR_ROOM_SYNC_TOKEN=pick-a-long-random-string node server.js
```

For production, run under PM2 or systemd and put a TLS-terminating
reverse proxy in front (nginx, Caddy) so clients can use `wss://`.
See [`tools/reference-sync-server/README.md`](tools/reference-sync-server/README.md)
for a PM2 example.

### 2. Point your War Room clients at it

Two ways. Pick one per install.

**Via Settings UI** (easy path): open Settings → Sync, paste the URL,
hit Save. War Room boots the sync client on the next request to
`/api/sync/status` (the Settings panel hits this on mount, so the
dot turns green almost immediately).

**Via env** (portable across reinstalls): add to
`~/.war-room/.env`:

```env
WAR_ROOM_SYNC_URL=wss://your-vps.example/sync
WAR_ROOM_SYNC_WORKSPACE=team-alpha
WAR_ROOM_SYNC_TOKEN=pick-a-long-random-string
```

Env wins over the Settings UI when both are present, so a power
user can override a stale UI value without touching the database.

### 3. Verify

Settings → Sync should show "Connected to wss://..." with a green
dot. Log a decision on one machine and watch it appear on the other
within a few hundred milliseconds.

If the dot is amber (connecting) for more than 5 seconds, check the
server logs. If it's red (error), the most common causes are:

- Wrong token (server logs show "401")
- TLS cert mismatch (use `wss://` to a properly-proxied port)
- Wrong port (default is 8788)

## Auth and trust

The shared token is the only access control in v1. Anyone who holds
the token can read and write every event in every workspace they
connect to. This is intentional: running your own server means you
decide who has the URL.

Multi-user auth, per-workspace permissions, and end-to-end encryption
are explicitly out of scope for v1. If you need them, fork the
reference server or wait for a future protocol version.

## Writing your own server

The protocol is short and stable. Read
[`lib/sync/protocol.ts`](lib/sync/protocol.ts). That file is the
spec. The reference server is ~200 lines of Node; a Go or Rust port
would be similar.

Minimum behavior:

1. Accept WebSocket upgrades. Optionally validate a shared token in
   `?token=` or `Authorization: Bearer`.
2. Read `?workspace=` from the URL.
3. On `hello`: send `welcome` + replay every persisted event with
   `seq > lastSeen`.
4. On `event`: assign next `seq`, persist, broadcast to every other
   client in the same workspace.
5. Persist events durably enough that a server restart doesn't lose
   them (the reference server uses JSONL files; SQLite would work
   too).

Wire-frame schema is in `protocol.ts` and won't change inside a
major version. `PROTOCOL_VERSION` will bump if it does.
