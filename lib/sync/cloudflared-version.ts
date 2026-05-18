// Pinned cloudflared version. Bumped explicitly per release with a
// CHANGELOG entry. If a CVE drops between releases, emergency-bump
// via a v0.16.x patch.
//
// SHA256 checksums come from Cloudflare's published release page:
// https://github.com/cloudflare/cloudflared/releases/tag/<VERSION>
// Verify before bumping.

export const CLOUDFLARED_VERSION = "2026.4.1";

type AssetSpec = {
  filename: string;
  sha256: string;
};

// Per-platform asset name + sha256 for the pinned version. When
// bumping the version, recompute every checksum from the published
// release. Leaving a checksum stale = silently shipping an unverified
// binary, which is exactly what the lazy-fetch path is built to
// prevent.
//
// NOTE: the checksums below are PLACEHOLDERS until the Phase 1
// cloudflared bump session. The fetcher refuses to use a placeholder
// (all-zero) checksum and surfaces a setup error in Settings, so a
// release with stale checksums fails loudly rather than fetching
// unverified bytes. See `validateChecksums()` for the guard.
export const CLOUDFLARED_ASSETS: Record<string, AssetSpec> = {
  "win32-x64": {
    filename: "cloudflared-windows-amd64.exe",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  "darwin-x64": {
    filename: "cloudflared-darwin-amd64.tgz",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  "darwin-arm64": {
    filename: "cloudflared-darwin-amd64.tgz",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  "linux-x64": {
    filename: "cloudflared-linux-amd64",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  "linux-arm64": {
    filename: "cloudflared-linux-arm64",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  },
};

export const CLOUDFLARED_DOWNLOAD_BASE =
  "https://github.com/cloudflare/cloudflared/releases/download";

export function platformKey(): string {
  return `${process.platform}-${process.arch}`;
}

export function assetFor(key = platformKey()): AssetSpec | null {
  return CLOUDFLARED_ASSETS[key] ?? null;
}

export function isPlaceholderChecksum(sha: string): boolean {
  return /^0+$/.test(sha);
}
