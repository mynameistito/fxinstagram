// oxlint-disable promise/prefer-await-to-callbacks
import { Context, Duration, Effect } from "effect";

import { MetadataCacheService } from "@/application/cache.ts";
import type { CacheError } from "@/application/cache.ts";
import type { MetadataConfig } from "@/application/config.ts";
import { MetadataConfigService } from "@/application/config.ts";
import { metadataCacheKey } from "@/application/metadata-key.ts";
import { MetadataSourceService } from "@/application/metadata-ports.ts";
import { MetadataTelemetryService } from "@/application/telemetry.ts";
import type { InstagramLocation } from "@/domain/instagram-url.ts";
import type {
  InstagramPost,
  MetadataError,
  InstagramMetadataSource,
} from "@/domain/media.ts";

/** A safe, provider-neutral metadata telemetry record. */
export interface MetadataTelemetryEvent {
  readonly operation: "get";
  readonly provider: string;
  readonly cache: "hit" | "miss";
  readonly outcome: "success" | MetadataError["_tag"] | CacheError["_tag"];
  readonly retryCount: number;
  readonly durationMs: number;
}

/** Sink for sanitized metadata operation telemetry. */
export interface MetadataTelemetry {
  readonly record: (event: MetadataTelemetryEvent) => Effect.Effect<void>;
}

/** Effect service that sequences cache lookup, retrieval, and cache fill. */
export interface MetadataService {
  readonly get: (
    location: InstagramLocation
  ) => Effect.Effect<InstagramPost, MetadataError | CacheError>;
}

export class MetadataServiceTag extends Context.Service<
  MetadataServiceTag,
  MetadataService
>()("fxinstagram/MetadataService") {}

const transient = (error: MetadataError): boolean =>
  error._tag === "ProviderUnavailable" || error._tag === "ProviderRateLimited";

const retryDelay = (error: MetadataError): Duration.Duration =>
  error._tag === "ProviderRateLimited" && error.retryAfterMs !== undefined
    ? Duration.millis(error.retryAfterMs)
    : Duration.millis(10);

const getWithRetries = (
  source: InstagramMetadataSource,
  location: InstagramLocation,
  config: MetadataConfig
): Effect.Effect<
  { readonly post: InstagramPost; readonly retryCount: number },
  MetadataError
> => {
  const attempt = source.find(location).pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(config.requestTimeoutMs),
      orElse: () =>
        Effect.fail<MetadataError>({
          _tag: "ProviderUnavailable",
          cause: "provider request timed out",
          provider: config.provider,
        }),
    })
  );
  const run = (
    remaining: number,
    retryCount: number
  ): Effect.Effect<
    { readonly post: InstagramPost; readonly retryCount: number },
    MetadataError
  > =>
    attempt.pipe(
      Effect.map((post) => ({ post, retryCount })),
      Effect.catchIf(transient, (error) =>
        remaining > 0
          ? Effect.sleep(retryDelay(error)).pipe(
              Effect.flatMap(() => run(remaining - 1, retryCount + 1))
            )
          : Effect.fail(error)
      )
    );
  return run(config.retryLimit, 0);
};

/** Build the application metadata service from its ports. */
export const makeMetadataService = Effect.gen(function* makeMetadataService() {
  const cache = yield* MetadataCacheService;
  const source = yield* MetadataSourceService;
  const config = yield* MetadataConfigService;
  const telemetry = yield* MetadataTelemetryService;

  const get = (location: InstagramLocation) => {
    const key = metadataCacheKey(location);
    const started = Date.now();
    return Effect.gen(function* getMetadata() {
      const cached = yield* cache.get(key);
      if (cached !== undefined) {
        yield* telemetry.record({
          cache: "hit",
          durationMs: Date.now() - started,
          operation: "get",
          outcome: "success",
          provider: config.provider,
          retryCount: 0,
        });
        return cached;
      }
      const retrieved = yield* getWithRetries(source, location, config);
      yield* cache.put(key, retrieved.post, Duration.millis(config.cacheTtlMs));
      yield* telemetry.record({
        cache: "miss",
        durationMs: Date.now() - started,
        operation: "get",
        outcome: "success",
        provider: config.provider,
        retryCount: retrieved.retryCount,
      });
      return retrieved.post;
    }).pipe(
      // oxlint-disable-next-line promise/prefer-await-to-callbacks
      Effect.tapError((error) =>
        telemetry.record({
          cache: "miss",
          durationMs: Date.now() - started,
          operation: "get",
          outcome: error._tag,
          provider: config.provider,
          retryCount: 0,
        })
      )
    );
  };

  return MetadataServiceTag.of({ get });
});
