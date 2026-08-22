import { Effect, Layer } from "effect";

import { layerMemory } from "../adapters/cache/memory.ts";
import { layerFixtureJson } from "../adapters/instagram/fixture-json.ts";
import { MetadataConfigService } from "../application/config.ts";
import type { MetadataConfig } from "../application/config.ts";
import {
  makeMetadataService,
  MetadataServiceTag,
} from "../application/metadata.ts";
import { MetadataTelemetryService } from "../application/telemetry.ts";

/** Build the metadata runtime from already parsed startup configuration. */
export const metadataLayer = (
  config: MetadataConfig,
  fixtures: ReadonlyMap<string, unknown>
) => {
  const telemetry = Layer.succeed(MetadataTelemetryService, {
    record: () => Effect.void,
  });
  return Layer.effect(MetadataServiceTag, makeMetadataService).pipe(
    Layer.provide(
      Layer.mergeAll(
        layerMemory(config),
        layerFixtureJson(fixtures),
        Layer.succeed(MetadataConfigService, config),
        telemetry
      )
    )
  );
};
