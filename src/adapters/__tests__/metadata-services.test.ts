// oxlint-disable vitest/prefer-importing-vitest-globals, eslint(func-names), promise/prefer-await-to-callbacks, consistent-type-specifier-style
import { describe, expect, test } from "bun:test";

import { Clock, Duration, Effect, Layer } from "effect";

import { MetadataCacheService } from "../../application/cache.ts";
import {
  parseMetadataConfig,
  MetadataConfigService,
} from "../../application/config.ts";
import {
  makeMetadataService,
  MetadataServiceTag,
  type MetadataTelemetryEvent,
} from "../../application/metadata.ts";
import { MetadataTelemetryService } from "../../application/telemetry.ts";
import { parseInstagramUrl } from "../../domain/instagram-url.ts";
import type { InstagramPost } from "../../domain/media.ts";
import { layerMemory } from "../cache/memory.ts";
import { layerFixtureJson } from "../instagram/fixture-json.ts";

const config = Effect.runSync(
  parseMetadataConfig({
    METADATA_CACHE_MAX_ENTRIES: "2",
    METADATA_CACHE_TTL_MS: "1000",
    METADATA_TIMEOUT_MS: "100",
  })
);
const location = Effect.runSync(
  parseInstagramUrl("https://instagram.com/p/ABC")
);
const fixture: InstagramPost = {
  canonicalUrl: new URL("https://instagram.com/p/ABC"),
  caption: "fixture caption",
  media: [{ type: "image", url: new URL("https://cdn.example/image.jpg") }],
  shortcode: "ABC",
  username: "alice",
};
const fixturePayload = {
  canonicalUrl: "https://instagram.com/p/ABC",
  caption: "fixture caption",
  media: [{ type: "image", url: "https://cdn.example/image.jpg" }],
  username: "alice",
};

const telemetry = (events: MetadataTelemetryEvent[]) =>
  Layer.succeed(MetadataTelemetryService, {
    record: (event) =>
      Effect.sync(() => {
        events.push(event);
      }),
  });

const serviceLayer = (events: MetadataTelemetryEvent[]) =>
  Layer.effect(MetadataServiceTag, makeMetadataService).pipe(
    Layer.provide(
      Layer.mergeAll(
        layerMemory(config),
        layerFixtureJson(new Map([["ABC", fixturePayload]])),
        Layer.succeed(MetadataConfigService, config),
        telemetry(events)
      )
    )
  );

describe("Effect metadata and cache services", () => {
  test("fills the cache and returns the cached value on the next read", async () => {
    const events: MetadataTelemetryEvent[] = [];
    const program = Effect.gen(function* program() {
      const service = yield* MetadataServiceTag;
      const first = yield* service.get(location);
      const second = yield* service.get(location);
      return { first, second };
    }).pipe(Effect.provide(serviceLayer(events)));
    const result = await Effect.runPromise(program);
    expect(result.first).toEqual(result.second);
    expect(events.map((event) => event.cache)).toEqual(["miss", "hit"]);
  });

  test("maps invalid provider fixtures without caching the failure", async () => {
    const events: MetadataTelemetryEvent[] = [];
    const invalid = Layer.effect(MetadataServiceTag, makeMetadataService).pipe(
      Layer.provide(
        Layer.mergeAll(
          layerMemory(config),
          layerFixtureJson(new Map([["ABC", { caption: "missing media" }]])),
          Layer.succeed(MetadataConfigService, config),
          telemetry(events)
        )
      )
    );
    const result = await Effect.runPromise(
      Effect.gen(function* result() {
        const service = yield* MetadataServiceTag;
        return yield* Effect.result(service.get(location));
      }).pipe(Effect.provide(invalid))
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ProviderResponseInvalid", provider: "fixture-json" },
    });
    expect(events[0]?.outcome).toBe("ProviderResponseInvalid");
  });

  test("expires entries using the Effect test clock", async () => {
    const cache = layerMemory(config);
    let now = 0;
    const clock: Clock.Clock = {
      currentTimeMillis: Effect.sync(() => now),
      currentTimeMillisUnsafe: () => now,
      currentTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
      currentTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
      monotonicTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
      monotonicTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
      sleep: () => Effect.void,
    };
    const program = Effect.gen(function* program() {
      const cacheService = yield* MetadataCacheService;
      yield* cacheService.put("key", fixture, Duration.seconds(1));
      const before = yield* cacheService.get("key");
      now = 1000;
      const after = yield* cacheService.get("key");
      return { after, before };
    }).pipe(
      Effect.provide(Layer.provide(cache, Layer.succeed(Clock.Clock, clock)))
    );
    const result = await Effect.runPromise(program);
    expect(result.before).toBeDefined();
    expect(result.after).toBeUndefined();
  });
});
