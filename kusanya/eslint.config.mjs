import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pin the React version instead of "detect". eslint-config-next defaults to
  // settings.react.version="detect", which makes eslint-plugin-react@7.37.5
  // call context.getFilename() — an API removed in ESLint 10 (we run ^10), so
  // detection crashes. A literal version skips detection entirely (this is the
  // plugin's own documented recommendation). Keep in sync with package.json.
  { settings: { react: { version: "19.2.8" } } },
  // eslint-plugin-react-hooks@7 (bundled with Next 16) ships React-Compiler
  // PREVIEW rules. Two of them flag legitimate patterns we rely on:
  //   • react-hooks/purity — Server Components reading the clock (Date.now()/
  //     new Date()) for relative-time and due-date math. RSC render once on the
  //     server; reading the current time is correct, not a memoization hazard.
  //   • react-hooks/set-state-in-effect — syncing UI to an external store
  //     (react-query poll results) from an effect, and shadcn's own scaffolds.
  // Keep both as WARNINGS: visible, but not build-gating false positives.
  {
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
