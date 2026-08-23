# fxinstagram

fxinstagram is a community-built, open-source service that serves Discord-compatible, server-rendered metadata for supported Instagram URLs. It is a URL rewriting service, not a Discord bot.

This project is not endorsed by, sponsored by, or affiliated with Meta Platforms, Inc. or any of its subsidiaries, including Instagram. “Instagram” and related marks belong to their respective owners.

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
bun run start
```

For Alchemy development mode, run `bun run dev` instead. This is separate from the direct local HTTP server and may require Alchemy-specific configuration.

Copy `.env.example` to `.env` when overriding local defaults. Configuration names are `PUBLIC_ORIGIN`, `ALLOWED_MEDIA_HOSTS`, `METADATA_TIMEOUT_MS`, `METADATA_CACHE_TTL_SECONDS`, and optional `METADATA_PROVIDER_TOKEN`. Local defaults use port `8787`, HTTP links with `127.0.0.1`, the `cdn.example` media host, a 1-second metadata timeout, and a 60-second cache TTL. The local provider is deterministic fixture JSON; no live Instagram request is made.

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

Validate the Alchemy stack without Cloudflare credentials:

```sh
bun run alchemy:check
```

`alchemy.run.ts` is the deployment source of truth. The `prod` stage owns the `fxinstagram` Worker at `ig.mynameistito.com`; every `pr-<number>` stage gets an isolated `fxinstagram-pr-<number>` Worker and a `workers.dev` preview URL. `src/runtime/worker.ts` is only the runtime handler bundled by that resource. The Worker receives `PUBLIC_ORIGIN` from its deployed URL and the configured `ALLOWED_MEDIA_HOSTS`, `METADATA_CACHE_TTL_SECONDS`, `METADATA_TIMEOUT_MS`, and optional `METADATA_PROVIDER_TOKEN`. Provider secrets belong in the platform secret mechanism, never tracked files.

The deployed Worker retrieves public Instagram pages and captioned embed documents without credentials, with a five-second budget for the combined operation. It uses Open Graph metadata for posts and posters, and extracts a direct MP4 URL when Instagram publishes one in the embed document. Responses must be HTML and are streamed with a 1 MiB limit; redirects are rejected. Upstream media URLs are normalized to the allowlisted `scontent.cdninstagram.com` CDN hostname. Local and deterministic test runtimes continue to use fixture JSON unless a metadata source is supplied explicitly.

GitHub Actions requires repository secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. CI runs without credentials. After CI succeeds for the exact commit, same-repository pull requests deploy a preview and receive an updated URL comment; closing the PR destroys only its validated `pr-<number>` stage. A successful push to `main` deploys production. Fork pull requests run CI but never receive deployment credentials.

For an operator-driven development deployment, select a Cloudflare profile with `--profile` or `ALCHEMY_PROFILE` and run `bun run alchemy:deploy`. Roll back production by redeploying a previously reviewed commit. `alchemy destroy` is destructive; the automated cleanup workflow refuses every stage that is not shaped like `pr-<number>`.

## Release Risks

Public Instagram HTML and its nested video payload are undocumented and may change or be rate limited. When a direct video is absent or the secondary embed request fails, the service safely falls back to the poster/image card. Upstream volatility, expiring media URLs, provider quotas, distributed rate limiting, production cache limits, and retention remain operational concerns. Shared cache and provider protection are tracked in [issue 12](https://github.com/mynameistito/fxinstagram/issues/12).

## Product Decisions

Telegram support, Discord/Telegram APIs, new acquisition providers, arbitrary proxying, and broad infrastructure refactors are not part of this release.
