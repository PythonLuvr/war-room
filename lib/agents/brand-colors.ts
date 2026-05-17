// Canonical accent color per adapter, matched to each provider's
// brand palette as closely as the bundled 6-color palette allows.
// The user can override per-adapter via Settings -> Agents; this
// is just the default that ships out of the box so brand identity
// is preserved without configuration.
//
// Palette options (matching the rest of the app): amber, sky,
// emerald, violet, fuchsia, rose. Custom adapters fall through
// to a neutral.

export type BrandAccent = "amber" | "sky" | "emerald" | "violet" | "fuchsia" | "rose";

const BRAND_BY_ADAPTER: Record<string, BrandAccent> = {
  // Anthropic family - coral / amber maps closest to Claude's brand
  "claude-cli": "amber",
  "anthropic-api": "amber",

  // OpenAI family - emerald maps to OpenAI's classic green
  "codex-cli": "emerald",
  "openai-api": "emerald",

  // Google family - sky for Gemini's blue
  "gemini-cli": "sky",
  "gemini-api": "sky",

  // xAI - rose for the closest available to xAI's dark/red branding
  "grok-api": "rose",

  // Nous Research - violet for Hermes's purple branding
  "hermes-cli": "violet",

  // OpenClaw + SemaClaw - fuchsia keeps them visually distinct from
  // the big-vendor families above
  "openclaw-cli": "fuchsia",
  "semaclaw-cli": "fuchsia",
};

export function brandAccentFor(adapterId: string): BrandAccent | null {
  return BRAND_BY_ADAPTER[adapterId] ?? null;
}
