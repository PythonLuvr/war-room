import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test artifacts.
    "playwright-report/**",
    "test-results/**",
  ]),
  // Plain Node CommonJS scripts — release tooling, electron main/preload,
  // build helpers. They run under node directly, not bundled by Next, so
  // require() is the right module style. Disabling the no-require-imports
  // rule here keeps it active everywhere it actually matters.
  {
    files: ["scripts/**/*.js", "electron/**/*.js", "tools/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
