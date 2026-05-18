// Embedded sync server. Same wire protocol as
// `tools/reference-sync-server/server.js` (PROTOCOL_VERSION=2). Runs
// in-process inside the host teammate's Next server so the desktop app
// can offer "Host this workspace from this machine" without anyone
// deploying a VPS.
//
// Teammates connect to it identically to the VPS reference server:
//   ws://<reachable-host>:<port>/?workspace=<id>&token=<t>
// where the reachable URL is provided by whichever tunnel adapter the
// host picked (Cloudflare Quick / Named, Tailscale, or "Manual" if
// they are exposing it themselves).
//
// Storage: append-only JSONL log per workspace at
//   <dataDir>/<sanitized-workspace>.log
// matching the VPS server's shape so an event log can be moved
// between embedded and VPS without conversion.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { PROTOCOL_VERSION } from "./protocol";

type Workspace = {
  id: string;
  file: string;
  events: SyncEventOnDisk[];
  nextSeq: number;
  clients: Set<WebSocket>;
};

type SyncEventOnDisk = {
  seq: number;
  kind: string;
  data: Record<string, unknown>;
  ts: number;
  clientId: string;
};

export type EmbeddedServer = {
  port: number;
  stop: () => Promise<void>;
};

export type EmbeddedServerOptions = {
  /** Bind port. Pass 0 to let the kernel pick a free one. */
  port: number;
  /** Optional shared secret. Empty string = no auth (don't do this on a public tunnel). */
  token: string;
  /** Directory to persist the JSONL workspace logs. Created if missing. */
  dataDir: string;
  /** Bind host. Defaults to 127.0.0.1; tunnel adapters expect loopback. */
  host?: string;
};

const DEFAULT_HOST = "127.0.0.1";

function sanitizeWorkspaceId(id: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return safe || "default";
}

function bearerToken(req: http.IncomingMessage): string | null {
  const h = req.headers["authorization"];
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function startEmbeddedSyncServer(
  opts: EmbeddedServerOptions,
): Promise<EmbeddedServer> {
  const host = opts.host ?? DEFAULT_HOST;
  const token = opts.token ?? "";
  const dataDir = opts.dataDir;
  fs.mkdirSync(dataDir, { recursive: true });

  const workspaces = new Map<string, Workspace>();

  function loadWorkspace(id: string): Workspace {
    const cached = workspaces.get(id);
    if (cached) return cached;
    const file = path.join(dataDir, `${sanitizeWorkspaceId(id)}.log`);
    const events: SyncEventOnDisk[] = [];
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line) as SyncEventOnDisk);
        } catch {
          // Skip corrupt line. Same forgiving stance as the VPS server.
        }
      }
    }
    const ws: Workspace = {
      id,
      file,
      events,
      nextSeq: events.length > 0 ? events[events.length - 1].seq + 1 : 1,
      clients: new Set(),
    };
    workspaces.set(id, ws);
    return ws;
  }

  function persistEvent(workspace: Workspace, event: SyncEventOnDisk): void {
    workspace.events.push(event);
    fs.appendFileSync(workspace.file, JSON.stringify(event) + "\n");
  }

  function broadcast(
    workspace: Workspace,
    frame: Record<string, unknown>,
    exceptSocket: WebSocket | null = null,
  ): void {
    const text = JSON.stringify(frame);
    for (const client of workspace.clients) {
      if (client === exceptSocket) continue;
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(text);
        } catch {
          // Drop the frame for this client. The dead-socket cleanup
          // happens in the 'close' / 'error' handlers below.
        }
      }
    }
  }

  function sendError(socket: WebSocket, message: string, fatal: boolean): void {
    try {
      socket.send(JSON.stringify({ type: "error", message, fatal }));
    } catch {
      // Best-effort. The socket may already be tearing down.
    }
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          protocolVersion: PROTOCOL_VERSION,
          workspaces: workspaces.size,
          uptime: Math.round(process.uptime()),
          embedded: true,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end("War Room embedded sync server. Connect via WebSocket.");
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (token) {
      const presented = url.searchParams.get("token") ?? bearerToken(req);
      if (presented !== token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      (ws as WebSocket & { _url?: URL })._url = url;
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: WebSocket) => {
    const url = (socket as WebSocket & { _url?: URL })._url;
    const workspaceId = sanitizeWorkspaceId(
      url?.searchParams.get("workspace") ?? "default",
    );
    const workspace = loadWorkspace(workspaceId);
    workspace.clients.add(socket);

    let clientId: string | null = null;
    let helloSeen = false;

    socket.on("message", (raw) => {
      let frame: Record<string, unknown>;
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
            `protocol version mismatch: server ${PROTOCOL_VERSION}, client ${String(frame.protocolVersion)}`,
            true,
          );
          socket.close();
          return;
        }
        clientId = String(frame.clientId ?? "anon");
        helloSeen = true;
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
        const event: SyncEventOnDisk = {
          seq: workspace.nextSeq++,
          kind: String(frame.kind),
          data: (frame.data as Record<string, unknown>) ?? {},
          ts: Number(frame.ts ?? Date.now()),
          clientId: String(frame.clientId ?? clientId ?? "anon"),
        };
        persistEvent(workspace, event);
        broadcast(workspace, { type: "event", event });
        return;
      }

      sendError(socket, `unknown frame type: ${String(frame.type)}`, false);
    });

    socket.on("close", () => {
      workspace.clients.delete(socket);
    });

    socket.on("error", () => {
      workspace.clients.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : opts.port;

  return {
    port: actualPort,
    stop: () =>
      new Promise<void>((resolve) => {
        for (const ws of workspaces.values()) {
          for (const client of ws.clients) {
            try {
              client.close();
            } catch {
              // Best-effort.
            }
          }
        }
        wss.close(() => {
          server.close(() => resolve());
        });
      }),
  };
}

const PORT_RANGE_START = 8788;
const PORT_RANGE_END = 8798;

// Walk the documented embedded-server port range until one binds.
// Returns the running server. If every port in the range is taken the
// caller is expected to surface the "configurable port field" path in
// Settings (see brief, "What if a port in the 8788-8798 range
// conflicts?"). This helper never silently falls through to 0; ports
// stay in the documented range so the host knows what to expect.
export async function startEmbeddedSyncServerInRange(
  base: Omit<EmbeddedServerOptions, "port">,
): Promise<EmbeddedServer> {
  let lastErr: unknown = null;
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    try {
      return await startEmbeddedSyncServer({ ...base, port: p });
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `no free port in ${PORT_RANGE_START}-${PORT_RANGE_END} (${(lastErr as Error)?.message ?? "unknown"})`,
  );
}
