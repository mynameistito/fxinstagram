# Plan 006: Harden end-to-end behavior, observability, and operator documentation

> **Executor instructions**: Treat this as the release gate. Add confidence through real seams and public entrypoints. Do not expand product scope while closing test or operational gaps.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-instagram-domain.md`, `plans/003-metadata-and-cache.md`, `plans/004-http-embeds.md`, `plans/005-alchemy-deployment.md`
- **Category**: tests
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

The service crosses untrusted URLs, an unstable upstream, HTML rendering, caching, and edge deployment. Unit tests alone can miss mismatched service Layers, route projections, escaping, and configuration behavior. This plan closes the loop with real-entrypoint tests, safe diagnostics, abuse controls, and documentation that an operator can actually use.

## Scope

**In scope**

- Existing source/test files from Plans 002-005
- `__tests__/e2e/*` or the established integration-test location
- `README.md`, `docs/` or `plans/` follow-up notes
- telemetry/rate-limit/cache configuration modules
- CI/check configuration only when needed for the release gates

**Out of scope**

- New Instagram acquisition providers
- Discord bot API integration
- Telegram support
- Large-scale refactors not required by a failing release gate

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | exit 0 |
| Full tests | `bun test` | all pass |
| Lint/format | `bun run check` | exit 0 |
| Local smoke | `bun run index.ts` | starts with documented local config |
| Deployment dry-run | selected Plan 005 non-mutating command | exit 0 |

## Steps

### Step 1: Add real-entrypoint contract tests

Start the local HTTP composition root with deterministic test Layers and exercise representative post, reel, story, direct, gallery, image, video, grid, and oEmbed requests. Assert observable responses, headers, redirects, sanitized metadata, and shutdown. Use a local metadata source and cache Layer, never live Instagram.

**Verify**: `bun test __tests__/e2e` -> all route contract tests pass.

### Step 2: Add failure and resilience coverage

Exercise upstream timeout, rate limit, malformed payload, cache outage, cancellation, and repeated identical requests. Verify status/redirect projections, bounded retry behavior, no raw upstream data in responses/logs, and no stale invalid data being served.

**Verify**: targeted resilience tests pass and do not require network access.

### Step 3: Add abuse and boundary controls

Verify host allowlists, URL size/path limits, response-size limits, request timeout, rate limiting strategy, cache key normalization, and safe media redirect behavior. Add a bounded concurrency policy if the runtime needs one. Do not add a permissive proxy as a workaround.

**Verify**: security-focused tests reject unsafe hosts/redirects/oversized inputs and accept only documented valid inputs.

### Step 4: Make telemetry operationally useful and safe

Add request correlation, route/provider/cache operation names, duration, outcome tag, and upstream status class. Redact credentials and omit captions/media URLs unless a safe hash or count is sufficient. Document where logs/metrics are viewed in local and deployed environments.

**Verify**: telemetry assertions show correlation and typed outcomes while scans of test output contain no configured secret values or raw upstream bodies.

### Step 5: Complete operator and user documentation

Document supported URL forms, `dd`/direct/gallery usage, local setup, environment names, provider limitations, cache behavior, health checks, rollout/rollback, and the open product decisions in `plans/README.md`. Clearly state trademark/non-affiliation language from the reference project without claiming affiliation.

**Verify**: README commands and configuration names match the actual scripts/config parser; run the complete verification matrix.

### Step 6: Run the release gate and record residual risks

Run typecheck, all tests, Ultracite, local smoke, and deployment dry-run. Record any intentionally unverified live-provider behavior, provider volatility, bandwidth cost, and rate-limit assumptions in the release note or README.

**Verify**: every command exits 0, or a concrete blocker with command output and owner is recorded. Do not mark the plan done with a silently skipped gate.

## Test plan

- One real-entrypoint test per public behavior family.
- Failure mapping for every typed error exposed by the application service.
- Parser/property tests from Plan 002 remain green.
- Cache/provider adapter tests from Plan 003 remain green.
- HTML/security tests from Plan 004 remain green.
- Configuration/platform dry-run tests from Plan 005 remain green.

## Done criteria

- [ ] `bun run typecheck`, `bun test`, and `bun run check` pass.
- [ ] Local smoke and platform dry-run pass without production credentials.
- [ ] Every public route has an end-to-end or explicit documented test disposition.
- [ ] Unsafe host/proxy/input cases are rejected.
- [ ] Logs and error responses contain safe summaries only.
- [ ] README and plan index reflect the actual supported behavior and remaining decisions.

## STOP conditions

- A release test requires live Instagram, credentials, or production Cloudflare resources.
- A security control cannot be enforced at the appropriate boundary.
- A test fails because two plans disagree on a public contract; stop and reconcile the contract rather than adding compatibility branches.
- The deployment dry-run mutates resources or requires an unreviewed destructive action.

## Maintenance notes

Run this release gate after provider, URL grammar, HTML template, cache, or deployment changes. Keep live-provider probes separate from deterministic CI. Reviewers should focus on whether new routes reuse existing policy and whether new telemetry remains free of user content and secrets.
