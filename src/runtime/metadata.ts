import { Effect, Layer } from "effect";

import { layerMemory } from "@/adapters/cache/memory.ts";
import { layerFixtureJson } from "@/adapters/instagram/fixture-json.ts";
import { MetadataCacheService } from "@/application/cache.ts";
import type { MetadataCache } from "@/application/cache.ts";
import { MetadataConfigService } from "@/application/config.ts";
import type { MetadataConfig } from "@/application/config.ts";
import { MetadataSourceService } from "@/application/metadata-ports.ts";
import {
  makeMetadataService,
  MetadataServiceTag,
} from "@/application/metadata.ts";
import type { MetadataTelemetry } from "@/application/metadata.ts";
import { MetadataTelemetryService } from "@/application/telemetry.ts";
import type { InstagramMetadataSource } from "@/domain/media.ts";

/** Optional implementations used to compose metadata services. */
export interface MetadataLayerOverrides {
  readonly cache?: MetadataCache;
  readonly source?: InstagramMetadataSource;
  readonly telemetry?: MetadataTelemetry;
}

/**
 * Build the metadata runtime from already parsed startup configuration.
 * @param config - Parsed metadata configuration.
 * @param fixtures - Fixtures indexed by shortcode.
 * @param overrides - Optional runtime dependencies.
 * @returns The composed metadata service layer.
 */
export const metadataLayer = (
  config: MetadataConfig,
  fixtures: ReadonlyMap<string, unknown>,
  overrides?: MetadataLayerOverrides
) => {
  const telemetry = Layer.succeed(
    MetadataTelemetryService,
    overrides?.telemetry ?? { record: () => Effect.void }
  );

  return Layer.effect(MetadataServiceTag, makeMetadataService).pipe(
    Layer.provide(
      Layer.mergeAll(
        overrides?.cache === undefined
          ? layerMemory(config)
          : Layer.succeed(MetadataCacheService, overrides.cache),
        overrides?.source === undefined
          ? layerFixtureJson(fixtures)
          : Layer.succeed(MetadataSourceService, overrides.source),
        Layer.succeed(MetadataConfigService, config),
        telemetry
      )
    )
  );
};
