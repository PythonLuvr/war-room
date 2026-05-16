// War Room reference sync server.
//
// Minimal implementation of the protocol defined in
// /lib/sync/protocol.ts. Run this on any Node-capable host (VPS,
// home server, local LAN box) and point your War Room clients at it
// via WAR_ROOM_SYNC_URL. The protocol stays the same; this server is
// just one implementation. Anyone can rewrite it in Go, Rust, Bun,
// or whatever, and War Room won't notice as long as the wire frames
// match.
//
// Storage: append-only JSONL log per workspace at <DATA_DIR>/<ws>.log.
// On client connect with lastSeen=N, the server replays every event
// with seq > N. There's no compaction in this reference. For a
// long-running team you'd want to either (a) snapshot + truncate
// periodically or (b) swap to SQLite. Both are straightforward
// follow-ups; the protocol does not require them.
//
// Auth: optional shared token via env WAR_ROOM_SYNC_TOKEN. If set,
// every connecting client must present the same token in the URL
// query (?token=...). Without auth, anyone who can reach the port
// can read/write the workspace, so run behind a real reverse proxy
// with TLS in production.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = parseInt(process.env.PORT ?? "8788", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATA_DIR = process.env.WAR_ROOM_SYNC_DATA ?? path.join(process.cwd(), "data");
const TOKEN = process.env.WAR_ROOM_SYNC_TOKEN ?? "";
const PROTOCOL_VERSION = 1;

fs.mkdirSync(DATA_DIR, { recursive: true });

// In-memory state per workspace: { events: [...], nextSeq: number,
// clients: Set<WebSocket> }. Backed by an append-only JSONL file.
const workspaces = new Map();

function loadWorkspace(id) {
  if (workspaces.has(id)) return workspaces.get(id);
  const file = path.join(DATA_DIR, `${sanitizeWorkspaceId(id)}.log`);
  const events = [];
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // Corrupt line. Skip rather than refuse to boot. A real
        // implementation would log and quarantine; this reference
        // just keeps going.
      }
    }
  }
  const ws = {
    id,
    file,
    events,
    nextSeq: events.length > 0 ? events[events.length - 1].seq + 1 : 1,
    clients: new Set(),
  };
  workspaces.set(id, ws);
  return ws;
}

function sanitizeWorkspaceId(id) {
  // Allow only safe filename chars so a malicious workspace id can't
  // escape DATA_DIR. The client picks workspace, so this is mostly
  // defense-in-depth.
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return safe || "default";
}

function persistEvent(workspace, event) {
  workspace.events.push(event);
  fs.appendFileSync(workspace.file, JSON.stringify(event) + "\n");
}

function broadcast(workspace, frame, exceptSocket = null) {
  const text = JSON.stringify(frame);
  for (const client of workspace.clients) {
    if (client === exceptSocket) continue;
    if (client.readyState === 1) {
      // OPEN
      try {
        client.send(text);
      } catch {}
    }
  }
}

// ─── HTTP server with /healthz + WebSocket upgrade ──────────────

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
        workspaces: workspaces.size,
        uptime: Math.round(process.uptime()),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end("War Room reference sync server. Connect via WebSocket.");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Auth: optional shared token check before completing the upgrade.
  if (TOKEN) {
    const presented = url.searchParams.get("token") ?? bearerToken(req);
    if (presented !== TOKEN) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._url = url;
    wss.emit("connection", ws, req);
  });
});

function bearerToken(req) {
  const h = req.headers["authorization"];
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

wss.on("connection", (socket) => {
  const url = socket._url;
  const workspaceId = sanitizeWorkspaceId(url.searchParams.get("workspace") ?? "default");
  const workspace = loadWorkspace(workspaceId);
  workspace.clients.add(socket);

  let clientId = null;
  let helloSeen = false;

  socket.on("message", (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      sendError(socket, "bad json", true);
      return;
    }

    if (frame.type === "hello") {
      if (frame.protocolVersion !== PROTOCOL_VERSION) {
        sendError(
          socket,
          `protocol version mismatch: server ${PROTOCOL_VERSION}, client ${frame.protocolVersion}`,
          true,
        );
        socket.close();
        return;
      }
      clientId = String(frame.clientId ?? "anon");
      helloSeen = true;
      // Welcome + replay any events the client missed.
      socket.send(
        JSON.stringify({
          type: "welcome",
          protocolVersion: PROTOCOL_VERSION,
          workspaceId: workspace.id,
          currentSeq: workspace.nextSeq - 1,
        }),
      );
      const lastSeen = Number(frame.lastSeen ?? 0);
      for (const e of workspace.events) {
        if (e.seq > lastSeen) {
          socket.send(JSON.stringify({ type: "event", event: e }));
        }
      }
      return;
    }

    if (!helloSeen) {
      sendError(socket, "hello required before events", true);
      socket.close();
      return;
    }

    if (frame.type === "event") {
      const event = {
        seq: workspace.nextSeq++,
        kind: String(frame.kind),
        data: frame.data ?? {},
        ts: Number(frame.ts ?? Date.now()),
        clientId: String(frame.clientId ?? clientId ?? "anon"),
      };
      persistEvent(workspace, event);
      broadcast(workspace, { type: "event", event });
      return;
    }

    sendError(socket, `unknown frame type: ${frame.type}`, false);
  });

  socket.on("close", () => {
    workspace.clients.delete(socket);
  });

  socket.on("error", () => {
    workspace.clients.delete(socket);
  });
});

function sendError(socket, message, fatal) {
  try {
    socket.send(JSON.stringify({ type: "error", message, fatal }));
  } catch {}
}

server.listen(PORT, HOST, () => {
  console.log(
    `[sync] listening on ws://${HOST}:${PORT} (data=${DATA_DIR}, token=${TOKEN ? "yes" : "no"})`,
  );
});
