import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import AlchemyStack, {
  makeWorker,
  resolveWorkerIdentity,
} from "../alchemy.run.ts";

// oxlint-disable vitest/prefer-importing-vitest-globals -- This repository executes its suite with Bun's test runner.
describe("alchemy stack", () => {
  test("exports a stack and declares stage workers", () => {
    expect(Effect.isEffect(AlchemyStack)).toBeTruthy();
    expect(Effect.isEffect(makeWorker("prod"))).toBeTruthy();
    expect(Effect.isEffect(makeWorker("pr-7"))).toBeTruthy();
  });
});

describe(resolveWorkerIdentity, () => {
  test("pins the production name and custom domain only in prod", () => {
    expect(resolveWorkerIdentity("prod")).toStrictEqual({
      domain: "ig.mynameistito.com",
      name: "fxinstagram",
      workersDev: false,
    });
  });

  test("isolates PR and local stages", () => {
    expect(resolveWorkerIdentity("pr-7")).toStrictEqual({
      name: "fxinstagram-pr-7",
      workersDev: true,
    });
    expect(resolveWorkerIdentity("dev_mynameistito")).toStrictEqual({
      name: "fxinstagram-dev_mynameistito",
      workersDev: true,
    });
  });
});
