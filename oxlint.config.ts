import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { selectJsPlugins } from "ultracite/oxlint/js-plugins";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, vitest, antiSlop, selectJsPlugins(["github", "sonarjs"])],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      files: ["src/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                message: "Use the @/* alias for imports between src modules.",
                regex: "^\\.{1,2}/",
              },
            ],
          },
        ],
      },
    },
  ],
});
