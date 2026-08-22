import { Data, Effect, Redacted, Schema } from "effect";

export interface AppConfig {
  readonly publicOrigin: URL;
  readonly metadataTimeoutMs: number;
  readonly metadataCacheTtlSeconds: number;
  readonly allowedMediaHosts: ReadonlySet<string>;
  readonly providerCredential?: Redacted.Redacted<string>;
}

export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly field: string;
  readonly reason: "missing" | "invalid";
}> {}

type Environment = Readonly<Record<string, string | undefined>>;

const RawEnvironment = Schema.Struct({
  ALLOWED_MEDIA_HOSTS: Schema.String,
  METADATA_CACHE_TTL_SECONDS: Schema.String,
  METADATA_TIMEOUT_MS: Schema.String,
  PUBLIC_ORIGIN: Schema.String,
});

const positiveInteger = (
  field: string,
  value: string
): Effect.Effect<number, ConfigurationError> => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Effect.succeed(parsed)
    : Effect.fail(new ConfigurationError({ field, reason: "invalid" }));
};

const parseOrigin = (value: string): Effect.Effect<URL, ConfigurationError> => {
  try {
    const origin = new URL(value);
    const hasCredentials = origin.username !== "" || origin.password !== "";
    const hasPathOrQuery =
      origin.pathname !== "/" || origin.search !== "" || origin.hash !== "";
    if (origin.protocol !== "https:" || hasCredentials || hasPathOrQuery) {
      return Effect.fail(
        new ConfigurationError({ field: "PUBLIC_ORIGIN", reason: "invalid" })
      );
    }
    return Effect.succeed(origin);
  } catch {
    return Effect.fail(
      new ConfigurationError({ field: "PUBLIC_ORIGIN", reason: "invalid" })
    );
  }
};

const parseHosts = (
  value: string
): Effect.Effect<ReadonlySet<string>, ConfigurationError> => {
  const hosts = value.split(",").map((host) => host.trim().toLowerCase());
  if (
    hosts.length === 0 ||
    hosts.some(
      (host) => host === "" || host.includes("/") || host.includes(":")
    )
  ) {
    return Effect.fail(
      new ConfigurationError({
        field: "ALLOWED_MEDIA_HOSTS",
        reason: "invalid",
      })
    );
  }
  return Effect.succeed(new Set(hosts));
};

const requiredEnvironment = (input: Environment) => ({
  ALLOWED_MEDIA_HOSTS: input.ALLOWED_MEDIA_HOSTS,
  METADATA_CACHE_TTL_SECONDS: input.METADATA_CACHE_TTL_SECONDS,
  METADATA_TIMEOUT_MS: input.METADATA_TIMEOUT_MS,
  PUBLIC_ORIGIN: input.PUBLIC_ORIGIN,
});

export const parseAppConfig = (
  input: Environment
): Effect.Effect<AppConfig, ConfigurationError> =>
  Effect.gen(function* parseConfig() {
    let raw: Schema.Schema.Type<typeof RawEnvironment>;
    try {
      raw = Schema.decodeUnknownSync(RawEnvironment)(
        requiredEnvironment(input)
      );
    } catch {
      return yield* Effect.fail(
        new ConfigurationError({ field: "environment", reason: "missing" })
      );
    }
    const publicOrigin = yield* parseOrigin(raw.PUBLIC_ORIGIN);
    const metadataTimeoutMs = yield* positiveInteger(
      "METADATA_TIMEOUT_MS",
      raw.METADATA_TIMEOUT_MS
    );
    const metadataCacheTtlSeconds = yield* positiveInteger(
      "METADATA_CACHE_TTL_SECONDS",
      raw.METADATA_CACHE_TTL_SECONDS
    );
    const allowedMediaHosts = yield* parseHosts(raw.ALLOWED_MEDIA_HOSTS);
    const credential = input.METADATA_PROVIDER_TOKEN;
    const result: AppConfig = {
      allowedMediaHosts,
      metadataCacheTtlSeconds,
      metadataTimeoutMs,
      publicOrigin,
    };
    if (credential !== undefined) {
      return { ...result, providerCredential: Redacted.make(credential) };
    }
    return result;
  });

export const localEnvironment = (input: Environment = process.env) => {
  const result = {
    ALLOWED_MEDIA_HOSTS: input.ALLOWED_MEDIA_HOSTS ?? "cdn.example",
    METADATA_CACHE_TTL_SECONDS: input.METADATA_CACHE_TTL_SECONDS ?? "60",
    METADATA_TIMEOUT_MS: input.METADATA_TIMEOUT_MS ?? "1000",
    PUBLIC_ORIGIN:
      input.PUBLIC_ORIGIN ?? `https://127.0.0.1:${input.PORT ?? "8787"}`,
  } satisfies Environment;
  if (input.METADATA_PROVIDER_TOKEN !== undefined) {
    return {
      ...result,
      METADATA_PROVIDER_TOKEN: input.METADATA_PROVIDER_TOKEN,
    };
  }
  return result;
};
