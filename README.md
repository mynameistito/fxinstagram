# fxinstagram

fxinstagram serves Discord-compatible, server-rendered metadata for supported Instagram URLs. It is a URL rewriting service, not a Discord bot and not affiliated with Instagram or Meta. “Instagram” and related marks belong to their respective owners.

## Supported URLs

The parser accepts HTTPS `instagram.com` and `www.instagram.com` URLs for:

- Posts: `/p/{shortcode}`
- Reels: `/reel/{shortcode}` and `/reels/{shortcode}`
- IGTV: `/tv/{shortcode}`
- User-scoped forms: `/{username}/p|reel|reels|tv/{shortcode}`
- Stories: `/stories/{username}/{shortcode}`

The service also accepts its own equivalent paths. A crawler user-agent receives HTML metadata; an ordinary browser user-agent receives a 302 redirect to Instagram. Unsupported hosts, paths, credentials, and malformed media indices are rejected.

## Embed Modes

- Standard: `/p/ABC`
- Direct media: `/p/ABC?direct=1`, which redirects to the local `/images/ABC/0` or `/videos/ABC/0` route
- Gallery: `/p/ABC?gallery=1` or `/grid/ABC`
- oEmbed: `/oembed?url=https%3A%2F%2Finstagram.com%2Fp%2FABC`

For a `dd`-style replacement, replace the Instagram hostname with the deployed fxinstagram hostname and retain the supported path. The service does not implement a separate `dd` route.

## Local Setup

```sh
bun install
bun run index.ts
```

Copy `.env.example` to `.env` when overriding local defaults. Configuration names are `PUBLIC_ORIGIN`, `ALLOWED_MEDIA_HOSTS`, `METADATA_TIMEOUT_MS`, `METADATA_CACHE_TTL_SECONDS`, and optional `METADATA_PROVIDER_TOKEN`. Local defaults use port `8787`, HTTPS links with `127.0.0.1`, the `cdn.example` media host, a 1 second metadata timeout, and a 60 second cache TTL. The local provider is deterministic fixture JSON; no live Instagram request is made.

## Verification

```sh
bun run typecheck
bun test
bun run check
bun test __tests__/e2e
```

The e2e suite starts a real Bun HTTP server with local Effect Layers. It never needs Instagram, provider credentials, or network access to an upstream provider.

## Runtime Controls

Requests receive an `X-Request-ID` correlation header. Optional HTTP telemetry records only operation, status, outcome, duration, and that ID. Metadata telemetry records provider-neutral cache outcome and retry count. Neither telemetry path includes captions, media URLs, request URLs, headers, response bodies, credentials, or provider causes.

The router enforces a 2,048-byte request URL limit, a 512-byte path limit, a 64-character shortcode and username limit, a 16 KiB rendered HTML limit, exact HTTPS media-host allowlists, and a per-server fixed-window limiter (120 requests per 60 seconds by default). The limiter is intentionally local process state; it is not a distributed production quota. Cache entries are bounded in memory and expire by TTL. Failed retrievals are never cached.

There is no separate health route. Check a known embed path with a crawler user-agent and inspect its status, `X-Request-ID`, and safe response headers. For deployed Workers, view application diagnostics in Cloudflare Workers Logs. Do not log or paste request URLs containing user data into incident channels.

## Deployment

Preview the Alchemy plan without mutating Cloudflare resources:

```sh
bun run alchemy:check
```

`alchemy.run.ts` is the deployment source of truth: it owns the Worker resource, entrypoint, environment bindings, defaults, and Alchemy state. `src/runtime/worker.ts` is only the runtime handler bundled by that resource. Local `alchemy dev` uses Alchemy's local state store; select the Cloudflare profile with `--profile` or `ALCHEMY_PROFILE` (defaulting to `default`). For example, run `bun run dev --profile mynameistito`. The same profile selection works with `bun run alchemy:check` and `bun run alchemy:deploy`. The Worker receives `PUBLIC_ORIGIN` from its deployed URL and the configured `ALLOWED_MEDIA_HOSTS`, `METADATA_CACHE_TTL_SECONDS`, `METADATA_TIMEOUT_MS`, and optional `METADATA_PROVIDER_TOKEN`. Provider secrets belong in the platform secret mechanism, never tracked files. The deployment does not provision durable cache storage.

After reviewing a clean plan, an operator may explicitly run `bun run alchemy:deploy`. Roll back by deploying the previously reviewed commit. `alchemy destroy` is destructive teardown and is outside the release gate.

## Release Risks

Live-provider behavior is intentionally unverified because this release has no live provider adapter. Upstream volatility, media bandwidth cost, provider quotas, distributed rate limiting, production cache limits, retention, and the production hostname remain operational decisions. Direct media redirects avoid proxy bandwidth but depend on the allowlisted upstream URL remaining available.

## Product Decisions

Open decisions and their current boundaries are tracked in [`plans/README.md`](plans/README.md). Telegram support, Discord/Telegram APIs, new acquisition providers, arbitrary proxying, and broad infrastructure refactors are not part of this release.
