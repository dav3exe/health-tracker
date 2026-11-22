import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" path alias from tsconfig so tests import like app code.
      "@": import.meta.dirname,
      // "server-only" throws when imported outside a React Server Component
      // build. Tests run lib/db/ directly in Node, which is the server, so the
      // guard is replaced with an empty module here (and only here).
      "server-only": `${import.meta.dirname}/tests/stubs/empty.ts`,
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
    // The in-memory MongoDB binary is downloaded on first run.
    hookTimeout: 120_000,
  },
});
