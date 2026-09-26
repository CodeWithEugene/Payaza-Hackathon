import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      // Unit tests exercise pure logic; `server-only` is a Next bundler guard.
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      // Force Demo Mode: no keys → deterministic rule-based paths under test.
      NEXT_PUBLIC_DEMO_MODE: "true",
      TYPESAFE_API_KEY: "",
      PAYAZA_PUBLIC_KEY: "",
      PAYAZA_SECRET_KEY: "test-secret-key-for-hmac-512",
      BETTER_AUTH_SECRET: "vitest-secret-key-0123456789abcdefghijklmnop",
    },
  },
});
