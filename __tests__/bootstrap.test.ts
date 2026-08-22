import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { bootstrap } from "../src/runtime/bootstrap.ts";

describe("application bootstrap", () => {
  test("returns a healthy baseline result", async () => {
    await expect(Effect.runPromise(bootstrap)).resolves.toEqual({
      service: "fxinstagram",
      status: "ok",
    });
  });
});
