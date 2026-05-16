// Server-side sync client. One WebSocket per Next process, held as a
// module-level singleton so every API route sees the same connection
// and the same applied-events log. Runs inside the Next server (not
// the browser) because that's where the SQLite access lives. The
// applier needs to call db() and that only works server-side.
//
// Lifecycle: lazy-initialized on the first call to ensureSyncClient().
// API routes that mutate sync-able tables call emit() to broadcast
// their changes. Inbound events run through applier.applyEvent().
//
// Connection state: the client auto-reconnects on close with an
// exponential backoff, capped. Caller doesn't have to think about it.
//
// Disabled when SYNC_URL is empty (the cold-clone default). Every
// method is a no-op that returns falsy, so unwiring is just blanking
// the env var.

import { randomUUID } from "crypto";
import { applyEvent } from "./applier";
import {
  PROTOCOL_VERSION,
  type ClientFrame,
  type EventKind,
  type ServerFrame,
} from "./protocol";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30_000;

type ConnState = "disabled" | "connecting" | "open" | "closed" | "error";

type Status = {
  state: ConnState;
  url: string;
  workspaceId: string;
  lastSeen: number;
  lastEventAt: number | null;
  lastError: string | null;
  clientId: string;
};

let _ws: WebSocket | null = null;
let _state: ConnState = "disabled";
let _url = "";
let _workspaceId = "";
let _token = "";
let _lastSeen = 0;
let _lastEventAt: number | null = null;
let _lastError: string | null = null;
let _clientId = "";
let _reconnectAttempt = 0;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export type SyncConfig = {
  url: string;
  workspaceId: string;
  token: string;
};

// Env-only fallback used when the caller doesn't pass explicit config.
// Wizard-driven config (stored in the settings table) is layered on
// by ensureSyncClient's caller. See /api/sync/status/route.ts for
// the canonical assembly of env + DB.
function envOnly(): SyncConfig {
  return {
    url: process.env.WAR_ROOM_SYNC_URL ?? "",
    workspaceId: process.env.WAR_ROOM_SYNC_WORKSPACE ?? "default",
    token: process.env.WAR_ROOM_SYNC_TOKEN ?? "",
  };
}

export function ensureSyncClient(override?: Partial<SyncConfig>): void {
  const base = envOnly();
  const env: SyncConfig = {
    url: override?.url ?? base.url,
    workspaceId: override?.workspaceId ?? base.workspaceId,
    token: override?.token ?? base.token,
  };
  if (!env.url) {
    _state = "disabled";
    return;
  }
  // Re-init if config changed
  if (env.url !== _url || env.workspaceId !== _workspaceId || env.token !== _token) {
    _url = env.url;
    _workspaceId = env.workspaceId;
    _token = env.token;
    if (!_clientId) _clientId = randomUUID();
    closeSocket();
    connect();
    return;
  }
  if (!_ws && _state !== "connecting") connect();
}

function connect(): void {
  _state = "connecting";
  const url = new URL(_url);
  if (_token) url.searchParams.set("token", _token);
  url.searchParams.set("workspace", _workspaceId);
  try {
    _ws = new WebSocket(url.toString());
  } catch (e) {
    _state = "error";
    _lastError = (e as Error).message;
    scheduleReconnect();
    return;
  }
  _ws.addEventListener("open", onOpen);
  _ws.addEventListener("message", onMessage);
  _ws.addEventListener("close", onClose);
  _ws.addEventListener("error", onError);
}

function onOpen(): void {
  _state = "open";
  _reconnectAttempt = 0;
  _lastError = null;
  sendFrame({
    type: "hello",
    protocolVersion: PROTOCOL_VERSION,
    clientId: _clientId,
    workspaceId: _workspaceId,
    lastSeen: _lastSeen,
  });
}

function onMessage(ev: MessageEvent): void {
  let frame: ServerFrame;
  try {
    frame = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString()) as ServerFrame;
  } catch {
    return;
  }
  if (frame.type === "welcome") {
    return;
  }
  if (frame.type === "error") {
    _lastError = frame.message;
    return;
  }
  if (frame.type === "event") {
    const evt = frame.event;
    // Skip events we originated. Already applied locally.
    if (evt.clientId === _clientId) {
      _lastSeen = Math.max(_lastSeen, evt.seq);
      return;
    }
    try {
      applyEvent(evt);
      _lastSeen = Math.max(_lastSeen, evt.seq);
      _lastEventAt = Date.now();
    } catch (e) {
      _lastError = `apply failed: ${(e as Error).message}`;
    }
  }
}

function onClose(): void {
  _state = "closed";
  _ws = null;
  scheduleReconnect();
}

function onError(): void {
  _lastError = "socket error";
}

function closeSocket(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_ws) {
    try {
      _ws.close();
    } catch {}
    _ws = null;
  }
}

function scheduleReconnect(): void {
  if (_reconnectTimer || !_url) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** _reconnectAttempt, RECONNECT_CAP_MS);
  _reconnectAttempt += 1;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    connect();
  }, delay);
}

function sendFrame(frame: ClientFrame): boolean {
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return false;
  try {
    _ws.send(JSON.stringify(frame));
    return true;
  } catch {
    return false;
  }
}

// Called from API routes after a sync-able mutation. Best-effort -
// if the socket is down, the event is dropped (the next client to
// connect will pull state via API normally and rebuild from there).
// This keeps the mutation path simple: don't block writes on sync.
export function emitEvent(kind: EventKind, data: Record<string, unknown>): boolean {
  ensureSyncClient();
  if (_state !== "open") return false;
  return sendFrame({
    type: "event",
    kind,
    data,
    ts: Date.now(),
    clientId: _clientId,
  });
}

export function getSyncStatus(): Status {
  return {
    state: _state,
    url: _url,
    workspaceId: _workspaceId,
    lastSeen: _lastSeen,
    lastEventAt: _lastEventAt,
    lastError: _lastError,
    clientId: _clientId,
  };
}
