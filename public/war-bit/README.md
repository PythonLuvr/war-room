# WarBit assets

WarBit is the War Room mascot. Pixel-art knight with the shield + crossed-swords brand mark. Each variant in this folder maps to a specific UI mood, so when a new surface needs the mascot you pick by feeling, not by filename roulette.

All variants are 1920x1920 RGBA PNGs. Render them with `image-rendering: pixelated` (Tailwind: `[image-rendering:pixelated]`) so the pixel art stays crisp at any size.

## Mood map

| File | Mood | Use on |
|---|---|---|
| `default.png` | neutral angry stance | generic mascot slot (avatar, header chip) |
| `confused.png` | frowning, "what?" | 404 page doesn't exist or moved |
| `calm.png` | slight smile, relaxed | empty-but-OK states, loading skeletons |
| `focused.png` | scowl, locked in | runtime error boundary, debug surfaces |
| `alert.png` | crosshair eyes | service degraded / approval pending banners |
| `friendly.png` | small smile | onboarding wizard welcome step, OpenWar opt-in card |
| `happy.png` | open smile | demo banner, welcome banner, success toast |
| `angry.png` | full angry stance | global error (layout crash) |
| `sleepy.png` | squinting | "nothing pending" placeholder surfaces |
| `done.png` | smug half-smile | Phase 4 completion state, task-done toast |

## Adding more variants

Drop new PNGs in here with a semantic name (mood, not number). Update the table above so future work knows what's available. Don't rename existing files. The wiring code references these paths directly; renames break surfaces silently.

## Source

Variants authored as part of the OpenWar branding pack. This folder is a curated subset for the War Room app.
