import { Effect } from "effect";

import type { MetadataCache } from "../application/cache.ts";
import type { MetadataConfig } from "../application/config.ts";
import { makeEmbedService } from "../application/embed.ts";
import type { EmbedServiceConfig } from "../application/embed.ts";
import type { MetadataTelemetry } from "../application/metadata.ts";
import type { InstagramMetadataSource } from "../domain/media.ts";
import { makeRouter } from "../http/router.ts";
import type { HttpTelemetry, RateLimitConfig } from "../http/telemetry.ts";
import { metadataLayer } from "./metadata.ts";
import type { MetadataLayerOverrides } from "./metadata.ts";

export interface ServerOptions {
  readonly port?: number;
  readonly hostname?: string;
  readonly origin?: URL;
  readonly metadata?: MetadataConfig;
  readonly fixtures?: ReadonlyMap<string, unknown>;
  readonly mediaHosts?: ReadonlySet<string>;
  readonly cache?: MetadataCache;
  readonly source?: InstagramMetadataSource;
  readonly telemetry?: MetadataTelemetry;
  readonly httpTelemetry?: HttpTelemetry;
  readonly rateLimit?: RateLimitConfig;
}

const defaultConfig: MetadataConfig = {
  cacheMaxEntries: 256,
  cacheTtlMs: 60_000,
  provider: "fixture-json",
  providerUrl: new URL("https://fixtures.invalid"),
  requestTimeoutMs: 1000,
  retryLimit: 0,
};

export const startServer = async (options: ServerOptions = {}) => {
  const origin =
    options.origin ?? new URL(`http://127.0.0.1:${options.port ?? 0}`);
  const config: EmbedServiceConfig = {
    mediaHosts: options.mediaHosts ?? new Set(["cdn.example"]),
    origin,
  };
  const layerOverrides: MetadataLayerOverrides = {
    cache: options.cache,
    source: options.source,
    telemetry: options.telemetry,
  };
  const layer = metadataLayer(
    options.metadata ?? defaultConfig,
    options.fixtures ?? new Map(),
    layerOverrides
  );
  const service = await Effect.runPromise(
    makeEmbedService(config).pipe(Effect.provide(layer))
  );
  const serverOptions: Bun.Serve.Options<undefined> = {
    fetch: makeRouter(service, {
      httpTelemetry: options.httpTelemetry,
      rateLimit: options.rateLimit,
      wellKnownOrigin: origin,
    }),
    port: options.port ?? 0,
  };
  if (options.hostname !== undefined) {
    serverOptions.hostname = options.hostname;
  }
  const server = Bun.serve(serverOptions);
  return server;
};
