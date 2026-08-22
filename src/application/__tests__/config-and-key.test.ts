// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { parseMetadataConfig } from "../config.ts";
import { metadataCacheKey } from "../metadata-key.ts";

describe("metadata configuration and cache identity", () => {
  test("parses safe typed configuration and redacts credentials", () => {
    const config = Effect.runSync(
      parseMetadataConfig({
        METADATA_PROVIDER_TOKEN: "secret-token",
        METADATA_PROVIDER_URL: "https://provider.example/metadata",
      })
    );
    expect(config.provider).toBe("fixture-json");
    expect(config.providerUrl.href).toBe("https://provider.example/metadata");
    expect(String(config.credential)).not.toContain("secret-token");
  });

  test("rejects unsafe endpoints and non-positive values", () => {
    expect(
      Effect.runSync(
        Effect.result(
          parseMetadataConfig({
            METADATA_PROVIDER_URL: "http://localhost:8787",
          })
        )
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "UnsafeProviderEndpoint" },
    });
    expect(
      Effect.runSync(
        Effect.result(parseMetadataConfig({ METADATA_CACHE_TTL_MS: "0" }))
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "InvalidConfigValue" },
    });
  });

  test("uses parsed location identity and excludes query mode", () => {
    const base = { kind: "post" as const, mediaIndex: 0, shortcode: "ABC" };
    expect(metadataCacheKey(base)).toBe(metadataCacheKey({ ...base }));
    expect(metadataCacheKey(base)).not.toBe(
      metadataCacheKey({ ...base, mediaIndex: 1 })
    );
  });
});
