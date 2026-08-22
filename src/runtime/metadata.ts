import { Effect, Layer } from "effect";

import { layerMemory } from "../adapters/cache/memory.ts";
import { layerFixtureJson } from "../adapters/instagram/fixture-json.ts";
import { MetadataCacheService } from "../application/cache.ts";
import type { MetadataCache } from "../application/cache.ts";
import { MetadataConfigService } from "../application/config.ts";
import type { MetadataConfig } from "../application/config.ts";
import { MetadataSourceService } from "../application/metadata-ports.ts";
import {
  makeMetadataService,
  MetadataServiceTag,
} from "../application/metadata.ts";
import type { MetadataTelemetry } from "../application/metadata.ts";
import { MetadataTelemetryService } from "../application/telemetry.ts";
import type { InstagramMetadataSource } from "../domain/media.ts";

export interface MetadataLayerOverrides {
  readonly cache?: MetadataCache | undefined;
  readonly source?: InstagramMetadataSource | undefined;
  readonly telemetry?: MetadataTelemetry | undefined;
}

/** Build the metadata runtime from already parsed startup configuration. */
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
