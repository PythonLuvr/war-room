# Contributing to War Room

Thanks for the interest. War Room is built and maintained by a single operator, so contribution flow is light.

Talk to me or other contributors in the [Discord](https://discord.gg/ku6GJS92V2) before sinking serious time into anything.

## Before opening a PR

- **Open an issue first** for anything bigger than a typo, a one-line fix, or a clear bug. Saves both sides time if the change isn't a fit.
- **No new dependencies** without discussion. War Room is intentionally light on packages.
- **No personal data in commits.** Don't hardcode paths, names, IPs, or service identifiers. All such values read from env vars in `lib/config.ts`. If you need a new one, add it to `.env.example` with a comment.
- **Match the existing style.** TypeScript, functional React components, Tailwind for styling, no class components, no CSS modules.

## Local dev

```bash
git clone https://github.com/pythonluvr/war-room.git
cd war-room
npm install
npm run dev
```

The app boots at `http://localhost:3000` with the onboarding wizard.

## Architecture pointers

- `app/`: Next.js App Router pages and API routes
- `components/`: React components (most of the UI lives here)
- `components/channel-system/`: Discord-style channel/server UI
- `lib/`: server-side helpers, DB access, config, activity, services check
- `lib/config.ts`: **the only place that reads `process.env.*` for app config**
- `lib/team.ts`: team roster (single source of truth for member identities)
- `lib/db.ts`: SQLite schema and migrations
- `electron/`: desktop wrapper (optional, not needed for development)

## What's in scope

- Bug fixes
- Performance improvements
- New panels and integrations that fit the "one screen for AI ops" thesis
- Documentation improvements
- Accessibility and keyboard-navigation work

## What's out of scope

- Cloud sync / multi-user backend (planned for a separate hosted product)
- Replacing core tech choices (Next.js, SQLite, Tailwind)
- Adding auth / login flows (this is single-user, localhost)
- AI providers other than Anthropic Claude (for now)

## Commit / PR style

- Conventional commits welcome but not required
- Squash on merge
- Keep PRs focused. One feature or fix per PR.
- Include a short description and screenshots/GIFs for UI changes

## License agreement

By contributing you agree your contributions are licensed under AGPL-3.0-or-later, the same license as the rest of the project.
