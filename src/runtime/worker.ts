import { Effect } from "effect";

import { makePublicInstagramSource } from "../adapters/instagram/public-html-source.ts";
import { makeEmbedService } from "../application/embed.ts";
import type { EmbedServiceConfig } from "../application/embed.ts";
import { makeRouter } from "../http/router.ts";
import { parseAppConfig } from "./config.ts";
import { metadataLayer } from "./metadata.ts";

export interface WorkerEnv {
  readonly [key: string]: string | undefined;
  readonly PUBLIC_ORIGIN: string;
  readonly METADATA_TIMEOUT_MS: string;
  readonly METADATA_CACHE_TTL_SECONDS: string;
  readonly ALLOWED_MEDIA_HOSTS: string;
  readonly METADATA_PROVIDER_TOKEN?: string;
}

const configurationResponse = (): Response =>
  new Response("service configuration unavailable", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status: 500,
  });

type Handler = ReturnType<typeof makeRouter>;

const makeHandler = async (env: WorkerEnv): Promise<Handler> => {
  const config = await Effect.runPromise(Effect.result(parseAppConfig(env)));
  if (config._tag === "Failure") {
    throw new Error(`invalid runtime configuration: ${config.failure.field}`);
  }
  const metadata = {
    cacheMaxEntries: 256,
    cacheTtlMs: config.success.metadataCacheTtlSeconds * 1000,
    provider: "instagram-public-html" as const,
    providerUrl: new URL("https://www.instagram.com"),
    requestTimeoutMs: config.success.metadataTimeoutMs,
    retryLimit: 0,
  };
  const metadataConfig =
    config.success.providerCredential === undefined
      ? metadata
      : { ...metadata, credential: config.success.providerCredential };
  const service = await Effect.runPromise(
    makeEmbedService({
      mediaHosts: config.success.allowedMediaHosts,
      origin: config.success.publicOrigin,
    } satisfies EmbedServiceConfig).pipe(
      Effect.provide(
        metadataLayer(metadataConfig, new Map(), {
          source: makePublicInstagramSource(),
        })
      )
    )
  );
  return makeRouter(service, { wellKnownOrigin: config.success.publicOrigin });
};

const handlers = new WeakMap<object, Promise<Handler>>();

const fetch = async (request: Request, env: WorkerEnv): Promise<Response> => {
  let handler = handlers.get(env);
  if (handler === undefined) {
    handler = makeHandler(env);
    handlers.set(env, handler);
  }
  try {
    return await (
      await handler
    )(request);
  } catch {
    return configurationResponse();
  }
};

export default { fetch };
