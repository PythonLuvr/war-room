// Lazy-fetch the pinned cloudflared binary for the host's platform.
// Runs on first hosting activation, NOT at install time, so solo
// users who never enable hosting download nothing.
//
// Cache layout:
//   <userData>/cloudflared/<version>/cloudflared[.exe]
//
// Versioned subdirectory means a version bump leaves the old binary
// in place (cheap rollback) and the next call refetches.
//
// Verification: SHA256 against the pinned checksum in
// cloudflared-version.ts. If the checksum is the placeholder
// (all-zeros), the fetcher refuses to proceed and surfaces a setup
// error so a release with stale pin metadata fails loudly.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CLOUDFLARED_VERSION,
  CLOUDFLARED_DOWNLOAD_BASE,
  assetFor,
  isPlaceholderChecksum,
  platformKey,
} from "./cloudflared-version";

export type FetchProgress = {
  phase: "checking" | "downloading" | "verifying" | "extracting" | "done";
  bytesDownloaded?: number;
  bytesTotal?: number | null;
  message?: string;
};

export type FetchResult = {
  binaryPath: string;
  fromCache: boolean;
  version: string;
};

export type FetchOptions = {
  /** Root cache directory (typically <userData>/cloudflared). */
  cacheDir: string;
  /** Progress callback fired on phase transitions and bytes-downloaded ticks. */
  onProgress?: (p: FetchProgress) => void;
  /** Cancellation signal so the Settings UI can abort a stuck download. */
  signal?: AbortSignal;
};

function binaryFilename(): string {
  return process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
}

export function cachedBinaryPath(cacheDir: string): string {
  return path.join(cacheDir, CLOUDFLARED_VERSION, binaryFilename());
}

export async function ensureCloudflared(opts: FetchOptions): Promise<FetchResult> {
  const cached = cachedBinaryPath(opts.cacheDir);
  if (fs.existsSync(cached)) {
    opts.onProgress?.({ phase: "done", message: "cached" });
    return { binaryPath: cached, fromCache: true, version: CLOUDFLARED_VERSION };
  }

  const asset = assetFor();
  if (!asset) {
    throw new Error(`cloudflared: unsupported platform ${platformKey()}`);
  }
  if (isPlaceholderChecksum(asset.sha256)) {
    throw new Error(
      `cloudflared: pinned checksum for ${platformKey()} is a placeholder. The release pin metadata in lib/sync/cloudflared-version.ts must be filled in before hosting can fetch. Bump the version and recompute the SHA256 from Cloudflare's published release page.`,
    );
  }

  fs.mkdirSync(path.dirname(cached), { recursive: true });

  const url = `${CLOUDFLARED_DOWNLOAD_BASE}/${CLOUDFLARED_VERSION}/${asset.filename}`;
  opts.onProgress?.({ phase: "downloading", bytesDownloaded: 0, bytesTotal: null });

  const resp = await fetch(url, { signal: opts.signal });
  if (!resp.ok || !resp.body) {
    throw new Error(`cloudflared: HTTP ${resp.status} fetching ${url}`);
  }

  const total = Number(resp.headers.get("content-length")) || null;
  const tempPath = `${cached}.partial`;
  const sink = fs.createWriteStream(tempPath);
  const hasher = crypto.createHash("sha256");
  let downloaded = 0;
  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      downloaded += value.length;
      await new Promise<void>((resolve, reject) => {
        sink.write(value, (err) => (err ? reject(err) : resolve()));
      });
      opts.onProgress?.({
        phase: "downloading",
        bytesDownloaded: downloaded,
        bytesTotal: total,
      });
    }
  } finally {
    await new Promise<void>((resolve) => sink.end(resolve));
  }

  opts.onProgress?.({ phase: "verifying" });
  const actual = hasher.digest("hex");
  if (actual !== asset.sha256) {
    fs.rmSync(tempPath, { force: true });
    throw new Error(
      `cloudflared: SHA256 mismatch. expected ${asset.sha256}, got ${actual}. Refusing to use unverified binary.`,
    );
  }

  // .tgz handling (macOS) deferred to a follow-up. For now, only the
  // direct-binary platforms (windows, linux) are wired. macOS users
  // see a clear error and can fall back to Tailscale or Manual VPS
  // until the tarball extractor lands.
  if (asset.filename.endsWith(".tgz")) {
    fs.rmSync(tempPath, { force: true });
    throw new Error(
      "cloudflared: macOS tarball extraction is not yet implemented. Use Tailscale or Manual VPS for now.",
    );
  }

  fs.renameSync(tempPath, cached);
  if (process.platform !== "win32") {
    fs.chmodSync(cached, 0o755);
  }

  opts.onProgress?.({ phase: "done" });
  return { binaryPath: cached, fromCache: false, version: CLOUDFLARED_VERSION };
}
