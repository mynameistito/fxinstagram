# Plan 002: Define Instagram URL parsing and embed policy as pure domain modules

> **Executor instructions**: Implement only deterministic domain/application contracts. Do not fetch Instagram, render HTML, access Request/Response, or add Cloudflare bindings.
>
> **Drift check**: Confirm Plan 001 has established the source/test layout and scripts. If it has not, stop and report rather than creating a second layout.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-verification-baseline.md`
- **Category**: tech-debt
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

URL normalization and embed mode selection are the stable product behavior, while Instagram extraction is volatile. Keeping these rules pure makes them easy to test, prevents route handlers from becoming a policy dump, and lets later agents swap retrieval providers without changing Discord-facing behavior.

## Current state and reference behavior

The workspace has no domain code. The reference InstaFix `main.go` routes `/tv`, `/reel`, `/reels`, `/stories/{username}/{postID}`, `/p`, username-prefixed post/reel paths, `/images`, `/videos`, `/grid`, and `/oembed`. Its handler accepts `img_index`, `direct`, `gallery`, and `X-Embed-Type`; non-bot clients are redirected to Instagram. These are reference behaviors, not an instruction to copy Go implementation details.

Use Effect Schema for parsing untrusted strings at the boundary, but keep the resulting domain operations pure. Known invalid inputs must be typed failures, not thrown exceptions.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Domain tests | `bun test src/domain` | all pass |
| Full tests | `bun test` | all pass |
| Lint/format | `bun run check` | exit 0 |

## Scope

**In scope**

- `src/domain/instagram-url.ts`
- `src/domain/embed-request.ts`
- `src/domain/embed-policy.ts`
- `src/domain/media.ts` if required by the policy contract
- colocated tests under `src/domain/__tests__/` or the test layout selected in Plan 001
- application-owned retrieval request/response types needed by Plan 003

**Out of scope**

- Network requests, scraping, cookies, browser automation, or remote scraper calls
- HTTP framework adapters and Response rendering
- Persistent caches
- Alchemy and Cloudflare configuration

## Target contracts

Use precise tagged unions and branded/refined values. The exact Effect Schema syntax must match the installed RC.

```ts
type InstagramPostKind = "post" | "reel" | "tv" | "story";
type EmbedMode = "standard" | "direct" | "gallery";

type InstagramLocation = {
  readonly kind: InstagramPostKind;
  readonly shortcode: string;
  readonly username?: string;
  readonly mediaIndex: number;
};

type EmbedRequest = {
  readonly location: InstagramLocation;
  readonly mode: EmbedMode;
  readonly userAgent: string;
};

type ParseInstagramUrlError =
  | { readonly _tag: "UnsupportedHost"; readonly host: string }
  | { readonly _tag: "UnsupportedPath"; readonly path: string }
  | { readonly _tag: "InvalidShortcode" }
  | { readonly _tag: "InvalidMediaIndex" };
```

Do not represent direct/gallery with multiple booleans. Do not silently clamp invalid indices. Decide and document whether the public index is zero-based or one-based; the reference uses zero as the default and one-based media URLs. Keep conversion in one function.

## Steps

### Step 1: Parse supported Instagram URLs

Implement a pure parser from `URL` or a canonical string into `InstagramLocation`. Support the reference post/reel/tv/story shapes and the `www.instagram.com`/`instagram.com` host variants selected by the product decision. Reject unsupported hosts, paths, empty identifiers, and malformed indices with precise errors. Keep share-link resolution as an explicit future application operation, not a parser side effect.

**Verify**: `bun test src/domain` -> accepted fixtures produce canonical locations; rejected fixtures produce the expected `_tag`.

### Step 2: Parse embed mode and request options

Create a pure parser for query/header inputs that resolves precedence between `direct`, `gallery`, and `X-Embed-Type`. Preserve the reference rule that the explicit embed header can select a mode. Make precedence an explicit table/test, not scattered conditionals.

**Verify**: `bun test src/domain` -> all mode combinations and malformed `img_index` cases pass.

### Step 3: Model media and projection decisions

Define a minimal media union such as `image` and `video`, plus a pure policy function that decides whether a request points at a single image, a single video, or a gallery/grid. It must return a typed `MediaSelectionError` for an out-of-range index or missing media instead of making a network call.

Define the application-owned retrieval port needed by Plan 003:

```ts
interface InstagramMetadataSource {
  readonly find: (location: InstagramLocation) => Effect.Effect<InstagramPost, MetadataError>;
}
```

The port belongs beside the application operation, not in an adapter folder; raw provider payloads must not appear in `InstagramPost`.

**Verify**: `bun run typecheck` -> no diagnostics; domain tests cover empty media, mixed image/video media, gallery, and index boundaries.

### Step 4: Add property-oriented tests where useful

Use `fast-check` only if it is already available or approved by the maintainer. Test parser normalization/idempotence and that valid canonical locations render back to supported route forms. Do not bypass constructors with casts.

**Verify**: `bun test src/domain` -> property tests pass without module mocks.

## Test plan

- Supported `/p/{shortcode}`, `/reel/{shortcode}`, `/tv/{shortcode}`, story, and username-prefixed shapes.
- Host rejection and malformed path/identifier rejection.
- Default, direct, gallery, header precedence, and invalid query combinations.
- Zero/default index, explicit index, negative/non-integer/out-of-range index.
- Pure media selection for image, video, and gallery cases.

## Done criteria

- [ ] Domain modules contain no network, filesystem, runtime, HTTP framework, or environment access.
- [ ] All expected failures are typed values in Effect or the established local result style.
- [ ] `bun run typecheck`, `bun test src/domain`, and `bun run check` pass.
- [ ] No booleans encode mutually exclusive embed modes.
- [ ] Plan 003 can import application-owned types without importing provider types.

## STOP conditions

- A required route shape cannot be distinguished unambiguously from another supported shape; record the examples and stop.
- The product requires following share redirects or authentication to parse a URL; move that behavior to a new application operation and stop this plan.
- The installed Effect Schema API differs from the local skill examples and no project precedent resolves it.

## Maintenance notes

Future Instagram path changes should modify fixtures and this parser only. Keep provider quirks in Plan 003 adapters. Reviewers should scrutinize index semantics and host allowlisting because both affect cache keys and SSRF boundaries downstream.
