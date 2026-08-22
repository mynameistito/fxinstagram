# fxinstagram Implementation Plans

These plans describe a greenfield TypeScript/Bun service for fixing Instagram embeds in Discord, using Effect for capability boundaries and Alchemy for Cloudflare deployment. They are based on the current workspace at the time of planning and on the public behavior of the archived `Wikidepia/InstaFix` project.

The workspace is a Git repository. Release work is performed from a dedicated worktree and must report its branch and commit SHA. Executors must compare stated current-state facts with live files before editing and report any mismatch.

## Execution Order and Parallel Work

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | Establish the verification baseline and application skeleton | P1 | M | none | DONE |
| 002 | Define Instagram URL parsing and embed policy as pure domain modules | P1 | M | 001 | DONE |
| 003 | Build Effect-backed metadata retrieval and cache services | P1 | L | 001, 002 | DONE |
| 004 | Serve Discord-compatible HTML embeds and media routes | P1 | L | 001, 002, 003 | DONE |
| 005 | Deploy the service with Alchemy and production-safe configuration | P1 | M | 001, 004 | DONE |
| 006 | Harden end-to-end behavior, observability, and operator documentation | P2 | M | 002, 003, 004, 005 | BLOCKED: auth |

Plans 002 and the non-runtime portions of 003 can be developed by separate agents after 001. Plans 003 and 004 should not be merged independently until their typed contracts agree. Plan 005 can begin its Alchemy investigation after 001, but deployment wiring depends on the handler contract from 004. Plan 006 is the release gate.

## Agent Groups

### Group A: Foundation

- Execute `001-verification-baseline.md`.
- Establish scripts, test layout, Effect runtime conventions, and the composition-root location.

### Group B: Functional Core

- Execute `002-instagram-domain.md`.
- Work only on pure parsing, normalized routes, embed modes, and typed domain errors.

### Group C: Integrations

- Execute `003-metadata-and-cache.md`.
- Implement retrieval as ports and adapters. Do not put Instagram SDK or HTML extraction types in application modules.

### Group D: HTTP and Rendering

- Execute `004-http-embeds.md`.
- Implement the inbound HTTP adapter and HTML/media projection against the contracts from Plans 002 and 003.

### Group E: Infrastructure

- Execute `005-alchemy-deployment.md`.
- Own only Alchemy, Cloudflare bindings, configuration, and deployment documentation. Do not duplicate HTTP policy.

### Group F: Release

- Execute `006-release-hardening.md`.
- Add real-entrypoint tests, safe diagnostics, rate/cache controls, documentation, and final verification.

## Shared Non-Negotiable Rules

- Use Bun commands, not npm, yarn, or pnpm.
- Use Effect for expected failures, dependency injection, resource lifetimes, retries, and cancellation. Keep deterministic parsing and projections as pure modules.
- Use Effect Schema at boundaries. Parse unknown input before it enters application or domain code.
- Use narrow application-owned ports. Raw Instagram responses, Cloudflare bindings, Request/Response values, and cache records stop at adapters.
- Do not use `any`, non-null assertions, unqualified casts, module mocks, or spy-only tests. If a cast is unavoidable at a third-party boundary, add the required safety comment and isolate it there.
- Export only intentional APIs and add JSDoc to exported symbols.
- Never log URLs containing credentials, cookies, full request headers, response bodies, or raw Instagram payloads.
- Do not scrape or proxy arbitrary hosts. Any remote URL used for media must be parsed and constrained by an explicit allowlist/policy.
- Do not add Discord bot credentials or a Discord API integration unless a later product decision explicitly requires it. The initial behavior is URL rewriting plus server-rendered embeds.

## Open Product Decisions

- Whether the first release supports only Instagram or also the Telegram behavior mentioned by InstaFix.
- Which Instagram acquisition strategy is acceptable: public HTML extraction, a maintained remote scraper, or another provider. Plan 003 keeps this replaceable.
- Whether media should be proxied through this service or referenced directly. Direct URLs are simpler; proxying improves stability but increases bandwidth and abuse risk.
- The production hostname, Cloudflare account/resource names, cache limits, rate limits, and retention values.
- Whether a database is needed in the first deployment. The initial plan assumes edge cache plus optional durable cache only if measurement justifies it.

## Plan 006 Release Note

The release gate uses deterministic local fixture Layers and a real Bun HTTP entrypoint. It verifies route families, direct media redirects, oEmbed, typed upstream failures, bounded timeout behavior, cache outage mapping, input and response bounds, exact media allowlists, local fixed-window rate limiting, safe correlation IDs, and telemetry redaction. No live provider, credential, Cloudflare resource mutation, Discord API, or Telegram behavior is verified by this release.
