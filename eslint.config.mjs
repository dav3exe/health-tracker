import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ADR-009: MongoDB has no row-level security, so the ONLY thing standing
  // between a user and someone else's health data is the access check in
  // lib/db/. If any other file could import the driver or models, a single
  // forgotten check would leak data. This rule makes that mistake a lint error.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["lib/db/**", "tests/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "mongoose",
              message:
                "Import data functions from '@/lib/db/*' instead. Only lib/db/ may touch MongoDB (ADR-009).",
            },
            {
              name: "mongodb",
              message:
                "Import data functions from '@/lib/db/*' instead. Only lib/db/ may touch MongoDB (ADR-009).",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
