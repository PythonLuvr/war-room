# Contributing to War Room

## How to contribute

War Room is solo-maintained right now. That means a few things:

1. **Open an issue first for anything bigger than a typo or one-liner.** Saves
   us both from a long review on a PR that doesn't fit the direction. For
   typos and obvious bugs, a PR is fine without a prior issue.
2. **One thing per PR.** A PR that bundles five unrelated changes is harder
   to review and harder to roll back. Split your work into separate PRs.
3. **Reviews happen weekly.** Reviews are batched, usually on weekends.
   Expect a response within seven days. If something is urgent (security,
   critical bug), say so and it will be prioritized.
4. **The license is MIT.** By opening a PR you agree your contribution is
   licensed under MIT.
5. **Look for `good-first-issue` labels** if you want to help but don't have
   a specific itch. Those are pre-scoped and reviewer-ready.

Questions, framework discussion, multiplayer setup help: [Discord](https://discord.gg/ku6GJS92V2).

## Local development

```bash
git clone https://github.com/pythonluvr/war-room
cd war-room
npm install
npm run dev          # http://localhost:3000, uses your real ~/.war-room/
npm run dev:blank    # http://localhost:3030, isolated empty SQLite
npm run demo         # http://localhost:3031, populated demo cockpit
```

Cold-clone discipline: every feature must ship working defaults with no
config required. If `npm run dev:blank` doesn't produce a usable cockpit
on a brand-new clone, the feature isn't done.

## Tests

```bash
npm test                # everything
npm run test:migration  # tsx + node:test, no browser
npm run test:smoke      # Playwright against dev:blank
```

CI runs both on every push and PR via `.github/workflows/test.yml`.

## Agent frameworks

War Room ships bundled agent frameworks at `presets/frameworks/*.md`. Each
is a plain markdown file the chat runtime prepends to every adapter call
as a system preamble.

Add a framework by dropping a markdown file in. The registry auto-detects
it; no manifest, no registration code. Wizard picker + per-channel chip
update on next reload.

Update bundled frameworks from upstream:

```bash
npm run update-frameworks
```

This script lives at `scripts/update-frameworks.mjs`. Each registered
source declares an upstream repo + tag + filename. The script fetches the
pinned tag, resolves the commit SHA via the GitHub API, lints the
content for em-dashes + personal-data patterns, and writes to
`presets/frameworks/<id>.md` with a vendor-trace header noting the
upstream tag + SHA. Exits non-zero if any lint gate fires.

Bump the pinned tag in the SOURCES array when upstream cuts a new
release. Never point at `main`. Pinned tags only, so vendor updates are
intentional and auditable.

## Lint gates

- **No em dashes** in any markdown or TypeScript that ships. Use periods,
  commas, parens, or restructure. The CI lint job + the framework
  fetcher both enforce this.
- **Sanity regex** at zero hits. The grep patterns catch personal-data
  shapes (specific names, emails, IPs). Run `npm run lint` locally
  before pushing if you've added any new strings.

## Commit messages

One-line summary, optional body. Reference issue numbers if applicable.
No "WIP" commits on `main`.

## Pull requests

- One feature per PR.
- Tests for new behavior.
- CHANGELOG entry under the next-version heading.
- README update if user-visible behavior changed.
