import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

/**
 * Pluggable file storage adapter.
 *
 * Today: writes to local filesystem under ~/.war-room/files/<channel-slug>/
 * Tomorrow: swap STORAGE_BACKEND env to "s3" or "shared-vps" and rewire — the API
 * surface stays identical.
 */

const STORAGE_ROOT = path.join(os.homedir(), ".war-room", "files");

function safeChannelDir(channelId: string): string {
  // Slugify channel id so it's safe as a folder name: "user/s6-fanward" → "user_s6-fanward"
  const slug = channelId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STORAGE_ROOT, slug);
}

export async function ensureChannelDir(channelId: string): Promise<string> {
  const dir = safeChannelDir(channelId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeFile(
  channelId: string,
  originalName: string,
  bytes: Buffer | Uint8Array,
): Promise<{ filename: string; size: number; absolutePath: string }> {
  const dir = await ensureChannelDir(channelId);
  // Disambiguate with a short hash prefix so two uploads with the same name don't collide
  const hash = crypto.randomBytes(4).toString("hex");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const filename = `${hash}_${safeName}`;
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, bytes);
  return { filename, size: bytes.length, absolutePath };
}

export async function readFile(
  channelId: string,
  filename: string,
): Promise<Buffer> {
  const absolutePath = path.join(safeChannelDir(channelId), filename);
  return fs.readFile(absolutePath);
}

export async function deleteFile(channelId: string, filename: string): Promise<void> {
  const absolutePath = path.join(safeChannelDir(channelId), filename);
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Already gone or never existed — fine.
  }
}

export function storageBackend(): string {
  return "local-filesystem";
}
