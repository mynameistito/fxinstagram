import { Effect } from "effect";

import type { MetadataCache } from "@/application/cache.ts";
import type { MetadataConfig } from "@/application/config.ts";
import { makeEmbedService } from "@/application/embed.ts";
import type { EmbedServiceConfig } from "@/application/embed.ts";
import type { MetadataTelemetry } from "@/application/metadata.ts";
import type { InstagramMetadataSource } from "@/domain/media.ts";
import { makeRouter } from "@/http/router.ts";
import type { HttpTelemetry, RateLimitConfig } from "@/http/telemetry.ts";
import { metadataLayer } from "@/runtime/metadata.ts";
import type { MetadataLayerOverrides } from "@/runtime/metadata.ts";

/** Dependencies and network settings for the local server. */
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

interface MutableRouterOptions {
  httpTelemetry?: HttpTelemetry;
  rateLimit?: RateLimitConfig;
}

const defaultConfig: MetadataConfig = {
  cacheMaxEntries: 256,
  cacheTtlMs: 60_000,
  provider: "fixture-json",
  providerUrl: new URL("https://fixtures.invalid"),
  requestTimeoutMs: 1000,
  retryLimit: 0,
};

/**
 * Start the local Bun HTTP server.
 * @param options - Server settings and dependencies.
 * @returns The running server.
 */
export const startServer = async (options: ServerOptions = {}) => {
  const origin =
    options.origin ?? new URL(`http://127.0.0.1:${options.port ?? 0}`);

  const config: EmbedServiceConfig = {
    mediaHosts: options.mediaHosts ?? new Set(["cdn.example"]),
    origin,
  };

  const layerOverrides: {
    -readonly [K in keyof MetadataLayerOverrides]: MetadataLayerOverrides[K];
  } = {};

  if (options.cache !== undefined) {
    layerOverrides.cache = options.cache;
  }

  if (options.source !== undefined) {
    layerOverrides.source = options.source;
  }

  if (options.telemetry !== undefined) {
    layerOverrides.telemetry = options.telemetry;
  }

  const layer = metadataLayer(
    options.metadata ?? defaultConfig,
    options.fixtures ?? new Map(),
    layerOverrides
  );

  const service = await Effect.runPromise(
    makeEmbedService(config).pipe(Effect.provide(layer))
  );

  const routerOptions: MutableRouterOptions = {};

  if (options.httpTelemetry !== undefined) {
    routerOptions.httpTelemetry = options.httpTelemetry;
  }

  if (options.rateLimit !== undefined) {
    routerOptions.rateLimit = options.rateLimit;
  }

  const serverOptions: Bun.Serve.Options<undefined> = {
    fetch: makeRouter(service, routerOptions),
    port: options.port ?? 0,
  };

  if (options.hostname !== undefined) {
    serverOptions.hostname = options.hostname;
  }

  return Bun.serve(serverOptions);
};
