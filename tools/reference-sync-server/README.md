# War Room reference sync server

Minimal Node WebSocket server that implements the War Room sync
protocol. Run this on any host you control so multiple War Room
clients (your laptop, your desktop, a teammate's machine) can share
decisions, announcements, and knowledge entries in a workspace.

The protocol itself lives at [`/lib/sync/protocol.ts`](../../lib/sync/protocol.ts)
in the main War Room repo. Anyone can re-implement this server in any
language as long as the wire frames match; this Node version is the
reference.

## What syncs

- `decisions` rows
- `announcements` rows
- `knowledge_entries` rows

## What does NOT sync

- Chat history, Claude sessions, the activity feed, settings,
  channel/server definitions. These are either per-machine concepts
  or have migration semantics that don't belong in a v1.

## Install

```bash
cd tools/reference-sync-server
npm install
```

## Run

```bash
# Bare minimum. No auth, listens on 0.0.0.0:8788
node server.js

# With a shared token (clients must present matching WAR_ROOM_SYNC_TOKEN)
WAR_ROOM_SYNC_TOKEN=pick-a-long-random-string node server.js

# Custom port / data dir
PORT=9000 WAR_ROOM_SYNC_DATA=/var/lib/war-room-sync node server.js
```

## PM2 deployment (any VPS)

```bash
pm2 start server.js --name war-room-sync --update-env -- \
  --max-old-space-size=256
pm2 save
```

Then point War Room clients at it. In each client's `~/.war-room/.env`:

```env
WAR_ROOM_SYNC_URL=wss://your-vps.example/sync
WAR_ROOM_SYNC_WORKSPACE=team-alpha
WAR_ROOM_SYNC_TOKEN=pick-a-long-random-string
```

(Use `wss://` behind a TLS-terminating reverse proxy like Caddy or
nginx. The server itself is plain `ws://` so the proxy handles certs.)

## Storage

Append-only JSONL per workspace at `<WAR_ROOM_SYNC_DATA>/<workspace>.log`.
On reconnect, clients tell the server the highest `seq` they've seen
and the server replays everything after that. No compaction in this
reference. For a long-running team you'd want to snapshot
periodically or swap the storage layer to SQLite. Neither is required
by the protocol.

## Health check

`GET /healthz` returns JSON with uptime, protocol version, and the
number of in-memory workspaces. Wire it into your monitoring of choice.

## Auth and trust model

The shared token is the only access control. Anyone with the token
can read and write every event in every workspace they connect to.
This is intentional for a v1. Running your own server means you
control who has the URL. Multi-user auth, per-workspace permissions,
and end-to-end encryption are out of scope; if you need them, fork
this and add them, or wait for a future version of the protocol that
codifies them.
