// Round-trip the embedded sync server: start it, connect two ws
// clients, push events through one, watch the other receive them in
// order, restart the server, reconnect, get a replay of everything
// past lastSeen. Same shape as the VPS server's behavior.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { PROTOCOL_VERSION } from "../../lib/sync/protocol";
import {
  startEmbeddedSyncServer,
  startEmbeddedSyncServerInRange,
} from "../../lib/sync/embedded-server";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "war-room-embed-"));
}

// Queueing reader. Attach immediately on socket creation; ask
// nextFrame() for the next undelivered frame. This avoids the
// detach-reattach race where a single-shot listener misses messages
// that arrive between calls.
type FrameReader = {
  next: () => Promise<unknown>;
  close: () => void;
};
function attachReader(ws: WebSocket): FrameReader {
  const queue: unknown[] = [];
  const waiters: Array<(v: unknown) => void> = [];
  const onMsg = (raw: WebSocket.RawData) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (waiters.length > 0) {
      const w = waiters.shift()!;
      w(parsed);
    } else {
      queue.push(parsed);
    }
  };
  ws.on("message", onMsg);
  return {
    next: () =>
      new Promise<unknown>((resolve) => {
        if (queue.length > 0) {
          resolve(queue.shift());
        } else {
          waiters.push(resolve);
        }
      }),
    close: () => ws.off("message", onMsg),
  };
}

function connect(port: number, workspace: string, token: string): WebSocket {
  const url = new URL(`ws://127.0.0.1:${port}/`);
  url.searchParams.set("workspace", workspace);
  if (token) url.searchParams.set("token", token);
  return new WebSocket(url.toString());
}

async function waitOpen(ws: WebSocket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

test("hello -> welcome handshake", async () => {
  const dir = tempDir();
  const srv = await startEmbeddedSyncServer({ port: 0, token: "", dataDir: dir });
  const ws = connect(srv.port, "ws1", "");
  await waitOpen(ws);
  const r = attachReader(ws);
  ws.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: "alice",
      workspaceId: "ws1",
      lastSeen: 0,
    }),
  );
  const frame = (await r.next()) as {
    type: string;
    protocolVersion: number;
    workspaceId: string;
    currentSeq: number;
  };
  assert.equal(frame.type, "welcome");
  assert.equal(frame.protocolVersion, PROTOCOL_VERSION);
  assert.equal(frame.workspaceId, "ws1");
  ws.close();
  await srv.stop();
});

test("event from client A is broadcast to client B at the wire level", async () => {
  const dir = tempDir();
  const srv = await startEmbeddedSyncServer({ port: 0, token: "", dataDir: dir });
  const a = connect(srv.port, "wsA", "");
  const b = connect(srv.port, "wsA", "");
  await Promise.all([waitOpen(a), waitOpen(b)]);
  const ra = attachReader(a);
  const rb = attachReader(b);
  a.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: "alice",
      workspaceId: "wsA",
      lastSeen: 0,
    }),
  );
  await ra.next(); // welcome
  b.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: "bob",
      workspaceId: "wsA",
      lastSeen: 0,
    }),
  );
  await rb.next(); // welcome

  a.send(
    JSON.stringify({
      type: "event",
      kind: "knowledge.created",
      data: { id: 99, channel_id: "x", title: "hi", body: "yo" },
      ts: Date.now(),
      clientId: "alice",
    }),
  );

  const onB = (await rb.next()) as {
    type: string;
    event: { kind: string; seq: number; clientId: string };
  };
  assert.equal(onB.type, "event");
  assert.equal(onB.event.kind, "knowledge.created");
  assert.equal(onB.event.seq, 1);
  assert.equal(onB.event.clientId, "alice");

  // Server also broadcasts to A (the application-layer client filters
  // self-originated events by clientId, but at the wire level every
  // open socket in the workspace receives the broadcast).
  const onA = (await ra.next()) as { type: string; event: { seq: number } };
  assert.equal(onA.type, "event");
  assert.equal(onA.event.seq, 1);

  ra.close();
  rb.close();
  a.close();
  b.close();
  await srv.stop();
});

test("token enforcement: bad token does not open, good token opens", async () => {
  const dir = tempDir();
  const srv = await startEmbeddedSyncServer({ port: 0, token: "secret123", dataDir: dir });

  const bad = connect(srv.port, "wsT", "wrong");
  const badResult = await new Promise<string>((resolve) => {
    let settled = false;
    const done = (v: string) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    bad.once("unexpected-response", () => done("rejected"));
    bad.once("error", () => done("rejected"));
    bad.once("open", () => done("opened"));
    setTimeout(() => done("timeout"), 1000);
  });
  assert.equal(badResult, "rejected");
  try {
    bad.close();
  } catch {}

  const good = connect(srv.port, "wsT", "secret123");
  await waitOpen(good);
  good.close();
  await srv.stop();
});

test("replay after restart: events with seq > lastSeen are re-sent", async () => {
  const dir = tempDir();
  let srv = await startEmbeddedSyncServer({ port: 0, token: "", dataDir: dir });

  // Produce two events and let them persist to JSONL.
  const writer = connect(srv.port, "wsR", "");
  await waitOpen(writer);
  const rw = attachReader(writer);
  writer.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: "w",
      workspaceId: "wsR",
      lastSeen: 0,
    }),
  );
  await rw.next(); // welcome
  for (let i = 0; i < 2; i++) {
    writer.send(
      JSON.stringify({
        type: "event",
        kind: "knowledge.created",
        data: { id: i + 1, channel_id: "x", title: "t", body: "b" },
        ts: Date.now(),
        clientId: "w",
      }),
    );
    await rw.next(); // own broadcast
  }
  rw.close();
  writer.close();
  await new Promise((r) => setTimeout(r, 30));
  await srv.stop();

  // Restart on an ephemeral port (Windows is picky about reusing the
  // same port immediately) but same data dir; events on disk must be
  // replayed when a new client asks for everything past seq=0.
  srv = await startEmbeddedSyncServer({ port: 0, token: "", dataDir: dir });
  const reader = connect(srv.port, "wsR", "");
  await waitOpen(reader);
  const rr = attachReader(reader);
  reader.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: "r",
      workspaceId: "wsR",
      lastSeen: 0,
    }),
  );
  const welcome = (await rr.next()) as { currentSeq: number };
  assert.equal(welcome.currentSeq, 2);
  const e1 = (await rr.next()) as { event: { seq: number } };
  const e2 = (await rr.next()) as { event: { seq: number } };
  assert.equal(e1.event.seq, 1);
  assert.equal(e2.event.seq, 2);

  rr.close();
  reader.close();
  await srv.stop();
});

test("startEmbeddedSyncServerInRange picks a port from the documented range", async () => {
  const dir = tempDir();
  const srv = await startEmbeddedSyncServerInRange({ token: "", dataDir: dir });
  assert.ok(srv.port >= 8788 && srv.port <= 8798, `port ${srv.port} outside range`);
  await srv.stop();
});
