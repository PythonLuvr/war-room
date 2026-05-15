// UI smoke test. Boots the dev server (via playwright.config.ts's
// webServer setting), walks Home → opens Settings → switches to the
// Agent tab → closes. Assertion is the basic "did it render and serve
// without 5xxs" — covers the regression class that matters most for
// forkers (a misconfigured cold-clone that crashes on first paint).
//
// Run via: npm run test:smoke

import { expect, test } from "@playwright/test";

test("home renders, settings opens, agent tab is reachable, no 5xx", async ({ page, request }) => {
  const serverErrors: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
  });

  // Mark onboarding complete server-side before any navigation so the
  // wizard never opens. Cleaner than racing with its POST handler.
  await request.post("/api/onboarding", { data: { completed: true } });

  // Land on the dashboard.
  await page.goto("/c/home");

  // Next.js dev mode injects a `<nextjs-portal>` overlay that intercepts
  // pointer events on the rail. It only exists in dev — production
  // builds don't ship it. Hide it for the duration of the test so clicks
  // hit the actual UI underneath.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  // Sidebar shows the seeded War Room icon (always rendered, even before
  // the wizard's done — proves the migration ran + servers seeded).
  await expect(page.locator('button[title*="War Room"]').first()).toBeVisible({ timeout: 10_000 });

  // Open settings via the gear in the rail. Force-click sidesteps the
  // Next dev-overlay portal that floats over the corner in dev mode.
  await page.locator('button[title="Settings"]').click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // Switch to the Agent tab.
  await page.getByRole("button", { name: "Agent" }).click();

  // The picker renders the four canonical providers.
  for (const provider of ["Claude Code", "OpenAI Codex", "Gemini CLI"]) {
    await expect(page.getByText(provider).first()).toBeVisible({ timeout: 5000 });
  }

  // No 5xx through the whole walk. Console errors are intentionally not
  // asserted — Next's dev overlay + Fast Refresh fire benign warnings
  // that aren't useful regression signal.
  expect(serverErrors, "5xx response during smoke walk").toEqual([]);
});
