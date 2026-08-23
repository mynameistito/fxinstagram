import { Clock, Duration, Effect, Layer } from "effect";

import { MetadataCacheService } from "@/application/cache.ts";
import type { CacheError } from "@/application/cache.ts";
import type { MetadataConfig } from "@/application/config.ts";
import type { InstagramPost } from "@/domain/media.ts";

interface Entry {
  readonly value: InstagramPost;
  readonly expiresAt: number;
}

/** Build a TTL-aware bounded in-memory metadata cache. */
export const layerMemory = (config: MetadataConfig) =>
  Layer.effect(
    MetadataCacheService,
    Effect.gen(function* makeMemoryCache() {
      const clock = yield* Clock.Clock;
      const entries = new Map<string, Entry>();
      const get = (
        key: string
      ): Effect.Effect<InstagramPost | undefined, CacheError> =>
        Effect.gen(function* readMemoryCache() {
          const now = yield* clock.currentTimeMillis;
          const entry = entries.get(key);
          if (entry === undefined || entry.expiresAt <= now) {
            entries.delete(key);
            return;
          }
          return entry.value;
        }).pipe(
          Effect.mapError((cause) => ({
            _tag: "CacheUnavailable",
            cause,
            operation: "get",
          }))
        );
      const put = (
        key: string,
        value: InstagramPost,
        ttl: Duration.Duration
      ): Effect.Effect<void, CacheError> =>
        Effect.gen(function* writeMemoryCache() {
          const now = yield* clock.currentTimeMillis;
          entries.delete(key);
          while (entries.size >= config.cacheMaxEntries) {
            const oldest = entries.keys().next();
            if (oldest.done) {
              break;
            }
            entries.delete(oldest.value);
          }
          entries.set(key, {
            expiresAt: now + Duration.toMillis(ttl),
            value,
          });
        }).pipe(
          Effect.mapError((cause) => ({
            _tag: "CacheUnavailable",
            cause,
            operation: "put",
          }))
        );
      return MetadataCacheService.of({ get, put });
    })
  );
