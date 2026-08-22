import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { bootstrap } from "../src/runtime/bootstrap.ts";

// oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
describe("application bootstrap", () => {
  // oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
  test("returns a healthy baseline result", async () => {
    await expect(Effect.runPromise(bootstrap)).resolves.toEqual({
      service: "fxinstagram",
      status: "ok",
    });
  });
});
