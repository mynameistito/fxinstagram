import { describe, expect, test } from "bun:test";

import { localEnvironment } from "@/runtime/config.ts";

// oxlint-disable vitest/prefer-importing-vitest-globals -- This repository executes its suite with Bun's test runner.
describe("src import alias", () => {
  test("resolves through Bun's test runtime", () => {
    expect(localEnvironment({}).PUBLIC_ORIGIN).toBe("http://127.0.0.1:8787");
  });
});
