import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import net from "net";
import { VPS, VPS_SERVICES, LOCAL_SERVICES, EXTRA_ENV_FILES } from "./config";

const execAsync = promisify(exec);

export type ServiceStatus = {
  name: string;
  status: "online" | "stopped" | "errored" | "unknown";
  cpu?: number;
  mem?: number;
  uptime?: number;
  restarts?: number;
  raw?: unknown;
};

export type LocalProbe = {
  name: string;
  port: number;
  hint?: string;
  reachable: boolean;
};

export type EnvFileStatus = {
  path: string;
  exists: boolean;
  keys: string[];
  size?: number;
};

export type HealthReport = {
  vps: { reachable: boolean; services: ServiceStatus[]; error?: string };
  local: LocalProbe[];
  env: EnvFileStatus[];
  checkedAt: string;
};

async function checkPort(port: number, host = "127.0.0.1", timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function pm2OverSsh(): Promise<{ list: ServiceStatus[]; error?: string }> {
  // VPS not configured → return empty so the UI shows the "configure to enable"
  // placeholder instead of an SSH-failed error.
  if (!VPS.host || VPS_SERVICES.length === 0) {
    return { list: [], error: "VPS not configured (WAR_ROOM_VPS_HOST unset)" };
  }
  try {
    const cmd = `ssh -i "${VPS.keyPath}" -o StrictHostKeyChecking=no -o ConnectTimeout=8 ${VPS.user}@${VPS.host} "pm2 jlist"`;
    const { stdout } = await execAsync(cmd, { timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Array<{
      name: string;
      pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number };
      monit?: { cpu?: number; memory?: number };
    }>;
    const knownLower = new Set(VPS_SERVICES.map((s) => s.toLowerCase()));
    const list: ServiceStatus[] = parsed.map((p) => ({
      name: p.name,
      status: (p.pm2_env?.status as ServiceStatus["status"]) ?? "unknown",
      cpu: p.monit?.cpu,
      mem: p.monit?.memory,
      uptime: p.pm2_env?.pm_uptime,
      restarts: p.pm2_env?.restart_time,
    }));
    for (const expected of VPS_SERVICES) {
      if (!list.find((s) => s.name.toLowerCase() === expected.toLowerCase())) {
        list.push({ name: expected, status: "stopped" });
      }
    }
    list.sort((a, b) => {
      const aKnown = knownLower.has(a.name.toLowerCase()) ? 0 : 1;
      const bKnown = knownLower.has(b.name.toLowerCase()) ? 0 : 1;
      return aKnown - bKnown || a.name.localeCompare(b.name);
    });
    return { list };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { list: [], error: msg };
  }
}

async function readEnv(file: string): Promise<EnvFileStatus> {
  try {
    const stat = await fs.stat(file);
    const text = await fs.readFile(file, "utf8");
    const keys = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0])
      .filter(Boolean);
    return { path: file, exists: true, keys, size: stat.size };
  } catch {
    return { path: file, exists: false, keys: [] };
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  const [vpsResult, envResults, localResults] = await Promise.all([
    pm2OverSsh(),
    Promise.all(EXTRA_ENV_FILES.map(readEnv)),
    Promise.all(
      LOCAL_SERVICES.map(async (s) => ({
        ...s,
        reachable: await checkPort(s.port),
      })),
    ),
  ]);

  return {
    vps: {
      reachable: !vpsResult.error,
      services: vpsResult.list,
      error: vpsResult.error,
    },
    local: localResults,
    env: envResults,
    checkedAt: new Date().toISOString(),
  };
}
