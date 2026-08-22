// oxlint-disable vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { parseAppConfig } from "../config.ts";

const valid = {
  ALLOWED_MEDIA_HOSTS: "cdn.example,media.example",
  METADATA_CACHE_TTL_SECONDS: "60",
  METADATA_TIMEOUT_MS: "1000",
  PUBLIC_ORIGIN: "https://fxinstagram.example/",
};

describe("runtime configuration", () => {
  test("parses valid values and redacts credentials", () => {
    const config = Effect.runSync(
      parseAppConfig({ ...valid, METADATA_PROVIDER_TOKEN: "secret-token" })
    );
    expect(config.publicOrigin.href).toBe("https://fxinstagram.example/");
    expect(config.allowedMediaHosts).toEqual(
      new Set(["cdn.example", "media.example"])
    );
    expect(String(config.providerCredential)).not.toContain("secret-token");
  });

  test("rejects missing values, unsafe origins, and invalid bounds", () => {
    expect(Effect.runSync(Effect.result(parseAppConfig({})))).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ConfigurationError", reason: "missing" },
    });
    expect(
      Effect.runSync(
        Effect.result(
          parseAppConfig({ ...valid, PUBLIC_ORIGIN: "https://bad/path" })
        )
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { field: "PUBLIC_ORIGIN", reason: "invalid" },
    });
    expect(
      Effect.runSync(
        Effect.result(parseAppConfig({ ...valid, METADATA_TIMEOUT_MS: "0" }))
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { field: "METADATA_TIMEOUT_MS", reason: "invalid" },
    });
    expect(
      Effect.runSync(
        Effect.result(
          parseAppConfig({
            ...valid,
            ALLOWED_MEDIA_HOSTS: "https://evil.example",
          })
        )
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { field: "ALLOWED_MEDIA_HOSTS", reason: "invalid" },
    });
  });
});
