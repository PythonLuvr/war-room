#!/usr/bin/env node
// update-frameworks.mjs
//
// Pulls the latest stable version of each upstream agent framework into
// presets/frameworks/<id>.md, with a traceability header noting upstream
// tag + commit SHA. Runs em-dash + sanity-regex lint against the fetched
// content; exits non-zero if either gate fires so a bad upstream change
// can't sneak in unnoticed.
//
// Manual invocation only:
//   npm run update-frameworks
//
// Add a framework: append an entry to SOURCES below with the GitHub
// org/repo + a tag-resolver. Anything that drops a markdown file into
// presets/frameworks/ is automatically picked up by the registry, no
// other wiring needed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PRESETS_DIR = path.join(REPO_ROOT, "presets", "frameworks");

const SOURCES = [
  {
    id: "openwar",
    repo: "pythonluvr/openwar",
    file: "openwar.md",
    // Pin to a tag. Bump deliberately, not "main", so updates are auditable.
    tag: "v0.3.0",
  },
];

// ─── Lint gates ────────────────────────────────────────────────────────────
// Sanity regex pulls hits for personal-data leaks. Em-dash gate is a
// global ban in this codebase (per the project rules), bundled framework
// files included.
//
// Default patterns are generic shapes. Forkers should add their own
// project-specific patterns here (personal handles, internal hostnames,
// employee names) so an upstream framework can't smuggle them into your
// bundle. Use the WAR_ROOM_FRAMEWORK_SANITY_PATTERNS env var to add
// patterns at runtime as a JSON array of regex source strings.

const DEFAULT_SANITY_PATTERNS = [
  // Internal-IP-leak shapes (192.168.x.x is fine, public IPs are not)
  /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/,
];

function loadExtraSanityPatterns() {
  const raw = process.env.WAR_ROOM_FRAMEWORK_SANITY_PATTERNS;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => new RegExp(s, "i"));
  } catch {
    return [];
  }
}

const SANITY_PATTERNS = [...DEFAULT_SANITY_PATTERNS, ...loadExtraSanityPatterns()];

function lintBody(text, id) {
  const issues = [];
  if (text.includes("—")) issues.push(`${id}: contains em dash (banned)`);
  for (const re of SANITY_PATTERNS) {
    const m = text.match(re);
    if (m) issues.push(`${id}: sanity-regex hit (${re.source} -> "${m[0]}")`);
  }
  return issues;
}

async function fetchUpstream(repo, tag, file) {
  // Raw content URL: https://raw.githubusercontent.com/<repo>/<tag>/<file>
  const rawUrl = `https://raw.githubusercontent.com/${repo}/${tag}/${file}`;
  const res = await fetch(rawUrl);
  if (!res.ok) {
    throw new Error(`GET ${rawUrl} -> ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  // Resolve the tag to a commit SHA via the GitHub API so the vendor
  // header records exactly what we pulled. Unauthenticated requests are
  // fine here (60/hr rate limit, plenty for a manual script).
  const refUrl = `https://api.github.com/repos/${repo}/git/refs/tags/${tag}`;
  const refRes = await fetch(refUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });
  let sha = "unknown";
  if (refRes.ok) {
    const refJson = await refRes.json();
    sha = (refJson?.object?.sha ?? "unknown").slice(0, 7);
  }
  return { body, sha };
}

function withVendorHeader({ id, repo, tag, sha, body }) {
  const header =
    `<!-- vendored from ${id} ${tag} @ ${sha} (https://github.com/${repo}). ` +
    `do not edit. update via 'npm run update-frameworks'. -->\n\n`;
  return header + body.replace(/^<!--[^>]*-->\n*/, "");
}

async function main() {
  await fs.mkdir(PRESETS_DIR, { recursive: true });
  let failed = false;
  for (const src of SOURCES) {
    process.stdout.write(`▸ ${src.id} (${src.repo} @ ${src.tag}) ... `);
    try {
      const { body, sha } = await fetchUpstream(src.repo, src.tag, src.file);
      const issues = lintBody(body, src.id);
      if (issues.length > 0) {
        console.log("LINT FAIL");
        for (const i of issues) console.error(`  ${i}`);
        failed = true;
        continue;
      }
      const out = withVendorHeader({ ...src, sha, body });
      const dest = path.join(PRESETS_DIR, `${src.id}.md`);
      await fs.writeFile(dest, out, "utf8");
      console.log(`ok (${(out.length / 1024).toFixed(1)} KB, sha ${sha})`);
    } catch (e) {
      console.log("ERROR");
      console.error(`  ${e instanceof Error ? e.message : String(e)}`);
      failed = true;
    }
  }
  if (failed) {
    console.error("\n✗ one or more frameworks failed to update.");
    process.exit(1);
  }
  console.log("\n✓ all frameworks current.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
