import { Context } from "effect";
import type { Duration, Effect } from "effect";

import type { InstagramPost } from "@/domain/media.ts";

/** The canonical identity used by metadata caches. */
/** Failures produced by a metadata cache. */
export interface CacheError {
  readonly _tag: "CacheUnavailable";
  readonly operation: "get" | "put";
  readonly cause: unknown;
}

/** Application-owned metadata cache port. */
export interface MetadataCache {
  readonly get: (
    key: string
  ) => Effect.Effect<InstagramPost | undefined, CacheError>;
  readonly put: (
    key: string,
    value: InstagramPost,
    ttl: Duration.Duration
  ) => Effect.Effect<void, CacheError>;
}

/** Effect service for metadata cache access. */
export class MetadataCacheService extends Context.Service<
  MetadataCacheService,
  MetadataCache
>()("fxinstagram/MetadataCache") {}
