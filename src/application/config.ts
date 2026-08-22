// oxlint-disable sonarjs/expression-complexity
import { Context, Effect, Redacted } from "effect";

/** Typed startup configuration for metadata retrieval and caching. */
export interface MetadataConfig {
  readonly provider: "fixture-json";
  readonly providerUrl: URL;
  readonly requestTimeoutMs: number;
  readonly cacheTtlMs: number;
  readonly cacheMaxEntries: number;
  readonly retryLimit: number;
  readonly credential?: Redacted.Redacted<string>;
}

/** Configuration parsing failures. */
export type ConfigError =
  | { readonly _tag: "InvalidConfigValue"; readonly name: string }
  | { readonly _tag: "UnsafeProviderEndpoint"; readonly value: string };

const positive = (name: string, value: string | undefined) => {
  const number = Number(value ?? "");
  if (Number.isSafeInteger(number) && number > 0) {
    return Effect.succeed(number);
  }
  return Effect.fail<ConfigError>({ _tag: "InvalidConfigValue", name });
};

const nonNegative = (name: string, value: string | undefined) => {
  const number = Number(value ?? "");
  if (Number.isSafeInteger(number) && number >= 0) {
    return Effect.succeed(number);
  }
  return Effect.fail<ConfigError>({ _tag: "InvalidConfigValue", name });
};

const parseEndpoint = (value: string): Effect.Effect<URL, ConfigError> => {
  try {
    const url = new URL(value);
    // oxlint-disable-next-line sonarjs/expression-complexity
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return Effect.fail({ _tag: "UnsafeProviderEndpoint", value });
    }
    return Effect.succeed(url);
  } catch {
    return Effect.fail({ _tag: "UnsafeProviderEndpoint", value });
  }
};

/** Parse metadata settings once at the composition boundary. */
export const parseMetadataConfig = (
  input: Readonly<Record<string, string | undefined>>
): Effect.Effect<MetadataConfig, ConfigError> =>
  Effect.gen(function* parseConfig() {
    const providerUrl = yield* parseEndpoint(
      input.METADATA_PROVIDER_URL ?? "https://fixtures.invalid"
    );
    const requestTimeoutMs = yield* positive(
      "METADATA_TIMEOUT_MS",
      input.METADATA_TIMEOUT_MS ?? "1000"
    );
    const cacheTtlMs = yield* positive(
      "METADATA_CACHE_TTL_MS",
      input.METADATA_CACHE_TTL_MS ?? "60000"
    );
    const cacheMaxEntries = yield* positive(
      "METADATA_CACHE_MAX_ENTRIES",
      input.METADATA_CACHE_MAX_ENTRIES ?? "256"
    );
    const retryLimit = yield* nonNegative(
      "METADATA_RETRY_LIMIT",
      input.METADATA_RETRY_LIMIT ?? "1"
    );
    const credential = input.METADATA_PROVIDER_TOKEN;
    const result: MetadataConfig = {
      cacheMaxEntries,
      cacheTtlMs,
      provider: "fixture-json",
      providerUrl,
      requestTimeoutMs,
      retryLimit,
    };
    return credential === undefined
      ? result
      : { ...result, credential: Redacted.make(credential) };
  });

/** Effect service exposing parsed metadata configuration. */
export class MetadataConfigService extends Context.Service<
  MetadataConfigService,
  MetadataConfig
>()("fxinstagram/MetadataConfig") {}
