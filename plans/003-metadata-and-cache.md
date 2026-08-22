# Plan 003: Build Effect-backed metadata retrieval and cache services

> **Executor instructions**: Build the volatile integration behind Effect services and application-owned ports. Do not leak raw Instagram payloads or cache-provider types into domain/application modules.
>
> **Drift check**: Confirm Plans 001 and 002 are complete and that the domain contracts still match. If a contract changed, update this plan's integration mapping only after reporting the mismatch.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-verification-baseline.md`, `plans/002-instagram-domain.md`
- **Category**: security
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

Instagram is an unstable external boundary and the reference service uses a scraper, cache, optional remote scraper, and optional video proxy. A single Effect service would make provider churn, retries, cache behavior, and test setup inseparable. This plan puts narrow authority seams around metadata retrieval and caching, with typed errors and explicit cancellation/retry policy.

## Current state and reference behavior

The workspace contains no integration code. The reference `main.go` configures an optional remote scraper, a video proxy address, and a bounded cache with periodic eviction. The reference handler redirects non-bot requests and only scrapes for bots. These observations guide contracts; provider choice remains an open decision.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | exit 0 |
| Service tests | `bun test src/application src/adapters` | all pass |
| Full tests | `bun test` | all pass |
| Lint/format | `bun run check` | exit 0 |

## Scope

**In scope**

- `src/application/metadata.ts`
- `src/application/cache.ts` if cache policy is application-owned
- `src/adapters/instagram/*`
- `src/adapters/cache/*`
- configuration modules under `src/runtime/`
- integration tests using real Effect Layers and deterministic local substitutes

**Out of scope**

- HTML rendering and HTTP status decisions
- Arbitrary media proxying
- Discord API clients
- Durable workflows or background queues
- Production Cloudflare resource definitions from Plan 005

## Target contracts

```ts
type InstagramPost = {
  readonly shortcode: string;
  readonly username: string;
  readonly caption: string;
  readonly media: ReadonlyArray<InstagramMedia>;
  readonly canonicalUrl: URL;
};

type MetadataError =
  | { readonly _tag: "MetadataNotFound"; readonly shortcode: string }
  | {
      readonly _tag: "ProviderUnavailable";
      readonly provider: string;
      readonly cause: unknown;
    }
  | { readonly _tag: "ProviderResponseInvalid"; readonly provider: string }
  | {
      readonly _tag: "ProviderRateLimited";
      readonly provider: string;
      readonly retryAfterMs?: number;
    };

interface MetadataSource {
  readonly find: (
    location: InstagramLocation
  ) => Effect.Effect<InstagramPost, MetadataError>;
}

interface MetadataCache {
  readonly get: (
    key: MetadataCacheKey
  ) => Effect.Effect<InstagramPost | undefined, CacheError>;
  readonly put: (
    key: MetadataCacheKey,
    value: InstagramPost,
    ttl: Duration
  ) => Effect.Effect<void, CacheError>;
}
```

Use a canonical cache key derived from the parsed location, not the original URL or user-controlled query ordering. Never cache provider errors as successful metadata. Redact credentials and cookies with Effect `Redacted` at the adapter boundary.

## Steps

### Step 1: Define configuration and cache-key policy

Parse provider URLs, timeouts, cache TTL/max entries, and optional credentials at startup using Effect Config/Schema or the project-equivalent. Reject invalid schemes, non-positive TTLs, and unsafe provider endpoints. Generate canonical keys from `InstagramLocation` and keep query mode out of metadata cache identity.

**Verify**: `bun test src/application` -> config and key fixtures pass; `bun run typecheck` -> no diagnostics.

### Step 2: Implement the application metadata service

Create an Effect `Context.Service` with a narrow `get` operation. Sequence cache read, source lookup on miss, and cache write. Preserve source failures, do not cache them as data, and use bounded retries only for classified transient failures. Use `Effect.timeout`, cancellation propagation, and a single-flight strategy only if the chosen cache/service runtime can support it without hidden global state.

**Verify**: service tests using `Layer.succeed`/`Layer.effect` substitutes show cache hit, miss, successful fill, not-found, invalid-provider-response, timeout, and cancellation outcomes.

### Step 3: Implement one provider adapter behind the port

Choose the provider only after recording the decision in an ADR or the plan index. Parse the provider response into `InstagramPost` at the adapter boundary. If extraction requires HTML parsing, keep selectors and raw response types inside this adapter. Set strict request timeouts, response-size limits, redirect policy, and allowed hosts. Do not follow arbitrary URLs from a fetched payload.

If a remote scraper is selected, its URL and authentication are configuration values and its response schema is independently parsed. Do not silently add browser automation or Instagram login.

**Verify**: adapter integration tests use a local HTTP test server or Effect HTTP test seam; no live Instagram credentials or network are required. Invalid fixture responses yield `ProviderResponseInvalid`.

### Step 4: Implement a local cache substitute and production adapter seam

Provide a faithful `layerMemory` only if it preserves TTL, key, overwrite, and miss semantics. If persistence/serialization matters, prefer a local durable test substitute rather than a fake. Keep production cache selection in the composition root so Plan 005 can bind Cloudflare Cache/KV/D1 without changing the application service.

**Verify**: cache integration tests cover expiry, overwrite, bounded eviction if applicable, and concurrent same-key reads through the public service interface.

### Step 5: Add safe telemetry

Instrument metadata attempts with operation, provider, cache hit/miss, error tag, duration, and retry count. Never include captions, media URLs, cookies, tokens, or raw upstream bodies. Ensure errors preserve a safe cause summary while retaining the original cause only inside the effect/logging boundary.

**Verify**: tests assert a sanitized event record through a real telemetry Layer; no secret-like or raw-content fields appear.

## Test plan

- Cache hit avoids source access as an observable result, not a spy assertion.
- Cache miss stores valid metadata and returns the same canonical value.
- Provider not found, invalid response, rate limit, timeout, and cancellation map to typed errors.
- Retry occurs only for classified transient failures and stops at the configured bound.
- Cache keys are stable across equivalent URLs and distinct across post/media identities.
- Adapter rejects unsafe endpoint configuration and unexpected redirects/payload sizes.

## Done criteria

- [ ] All raw provider and cache types stop at adapter boundaries.
- [ ] Expected failures are typed and no ordinary failure is thrown from application code.
- [ ] Credentials/config are parsed once and redacted in telemetry.
- [ ] `bun run typecheck`, targeted tests, full tests, and `bun run check` pass.
- [ ] A provider choice and its limitations are documented; unknown extraction behavior remains an open question rather than hidden fallback logic.

## STOP conditions

- The chosen provider requires credentials, cookies, or bypassing access controls not already approved; stop and report.
- A provider response contains direct media URLs whose host/redirect behavior cannot be constrained.
- Cache correctness requires a transaction or persistence feature unavailable in the selected runtime; stop before weakening semantics.
- A test needs live Instagram or production Cloudflare access.

## Maintenance notes

Provider adapters will need updates when Instagram changes markup or API behavior. Keep fixtures versioned and small, add a provider health metric, and review retries for amplification during upstream outages. Any new cache backend must implement the existing application port rather than becoming visible in route code.
