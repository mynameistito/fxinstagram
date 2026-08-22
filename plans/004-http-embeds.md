# Plan 004: Serve Discord-compatible HTML embeds and media routes

> **Executor instructions**: Implement the inbound HTTP adapter and projections against the domain and metadata contracts. Keep HTTP/framework types at the edge and do not add Instagram extraction logic here.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-verification-baseline.md`, `plans/002-instagram-domain.md`, `plans/003-metadata-and-cache.md`
- **Category**: direction
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

Discord consumes Open Graph and Twitter card metadata rather than the source application's page. The HTTP layer must therefore return deterministic, safe HTML for crawlers, redirect normal users to Instagram, and expose only the selected media route. The reference behavior also includes standard, direct-media, and gallery modes, plus image/video/grid/oEmbed routes.

## Current state and reference behavior

The workspace has no HTTP server. The reference `main.go` exposes post/reel/story routes, `/images/{postID}/{mediaNum}`, `/videos/{postID}/{mediaNum}`, `/grid/{postID}`, and `/oembed`. The reference handler uses user-agent bot detection, `direct`, `gallery`, `img_index`, and `X-Embed-Type`, caps descriptions to about 255 characters, and redirects normal users to Instagram.

Treat those as compatibility targets subject to explicit tests. Do not copy unsafe string concatenation, permissive proxying, or ambiguous index behavior.

## Commands you will need

| Purpose     | Command             | Expected on success |
| ----------- | ------------------- | ------------------- |
| Typecheck   | `bun run typecheck` | exit 0              |
| HTTP tests  | `bun test src/http` | all pass            |
| Full tests  | `bun test`          | all pass            |
| Lint/format | `bun run check`     | exit 0              |

## Scope

**In scope**

- `src/http/*`
- `src/application/embed.ts` and typed response projections
- HTML templates/escaping modules under `src/http/`
- media URL policy module if it is a pure domain concern
- HTTP integration tests using the real local server/runtime
- `index.ts` wiring changes required to expose the server

**Out of scope**

- Provider implementation and cache internals
- Cloudflare/Alchemy resource definitions
- Discord bot API or message mutation
- Arbitrary URL proxying or download endpoints

## Target contracts

```ts
type EmbedResponse =
  | { readonly _tag: "Redirect"; readonly location: URL }
  | {
      readonly _tag: "Html";
      readonly status: 200 | 404 | 422 | 429 | 503;
      readonly document: EmbedDocument;
    }
  | { readonly _tag: "MediaRedirect"; readonly location: URL };

type EmbedDocument = {
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl: URL;
  readonly card: "summary_large_image" | "player";
  readonly imageUrl?: URL;
  readonly videoUrl?: URL;
  readonly oEmbedUrl?: URL;
};
```

The application service returns this projection; the inbound adapter serializes it to `Response`. HTML escaping, URL serialization, content type, cache headers, and security headers belong to the adapter.

## Steps

### Step 1: Define bot/redirect and response projection policy

Implement a pure, tested user-agent classification policy with a conservative default. If a request is not a recognized crawler, redirect to the canonical Instagram URL without fetching metadata. If it is a crawler, call the embed application service. Make all status mappings explicit for typed domain/integration errors.

**Verify**: pure policy tests cover empty/unknown user-agent, common crawler markers, and typed error-to-status mapping.

### Step 2: Implement the embed application service

Compose parsed `EmbedRequest`, metadata retrieval, media selection, and canonical URL generation. Support standard, direct, and gallery modes. Standard mode returns OG/Twitter metadata; direct mode redirects to a validated same-service media endpoint; gallery mode omits caption. Do not construct `Request`, `Response`, framework routers, or raw provider objects in the service.

**Verify**: application tests through Effect Layers cover image, video, gallery, out-of-range media, not-found, and provider unavailable behavior.

### Step 3: Implement HTML escaping and safe URL projection

Use a small deep module that escapes every dynamic text value and only emits URLs produced by the media/canonical URL policy. Add restrictive headers such as `Content-Type`, `X-Content-Type-Options`, and an appropriate CSP for a metadata-only document. Do not put raw caption text into HTML attributes without escaping.

**Verify**: rendering tests include quotes, angle brackets, ampersands, newline text, and unsafe URL candidates; output contains escaped text and no untrusted executable markup.

### Step 4: Add the HTTP router and compatibility routes

Use the platform-compatible HTTP adapter selected in Plan 001. Add post/reel/tv/story route forms, media routes, grid, and oEmbed. Parse path/query/header input at the edge and pass only domain types inward. Ensure trailing slash and malformed route behavior is deterministic. Media routes must either redirect to allowlisted upstream media URLs or return a safe error; they must never become an open proxy.

**Verify**: HTTP integration tests exercise the real local server and assert status, `Location`, content type, OG tags, escaped content, and headers for each route.

### Step 5: Wire the server in the composition root

Construct the router and all Effect Layers in `index.ts`/runtime bootstrap. Keep startup config parsing, resource acquisition, and shutdown in the composition root. Do not bind the listener at import time.

**Verify**: start the local server with test configuration, make requests through the actual port, then shut it down cleanly; `bun test` remains deterministic without a long-lived process.

## Test plan

- Non-bot request redirects without metadata lookup.
- Bot request returns image card, video player card, gallery/no-caption card, and grid card.
- Direct mode redirects only to an approved media URL.
- Invalid post/index returns the documented 4xx response.
- Provider failure returns a safe 5xx/redirect outcome without leaking upstream details.
- HTML escaping and URL allowlist regression tests.
- Every compatibility route from the reference is covered through the real router.

## Done criteria

- [ ] HTTP code contains no scraper/provider parsing.
- [ ] Dynamic HTML is escaped and headers are explicit.
- [ ] No route accepts arbitrary proxy targets.
- [ ] `bun run typecheck`, HTTP tests, full tests, and `bun run check` pass.
- [ ] The local server can start and stop through the composition root.

## STOP conditions

- The chosen Bun/Effect HTTP platform cannot expose a clean testable server lifecycle; stop and report the runtime limitation.
- A compatibility route requires ambiguous URL parsing or undocumented authentication behavior.
- Direct media URLs cannot be allowlisted or safely redirected.
- A response must include raw upstream HTML or credentials to match the reference.

## Maintenance notes

Treat the HTML document as a public compatibility API. Discord crawler behavior and Open Graph limits should be verified when changing templates. Any new platform route must call the same application service; do not duplicate metadata policy in a second handler.
