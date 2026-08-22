# Plan 005: Deploy the service with Alchemy and production-safe configuration

> **Executor instructions**: Own infrastructure and configuration only. Do not move business policy into Alchemy files or add provider behavior to deployment code.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/001-verification-baseline.md`, `plans/004-http-embeds.md`
- **Category**: migration
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

Alchemy and Cloudflare dependencies are already present, but there is no deployment definition or typed environment contract. A deployment plan must make resource ownership, secrets, cache binding, preview behavior, and teardown explicit before production use. The application should remain runnable locally without Cloudflare credentials.

## Current state

- `package.json` includes `alchemy` `2.0.0-beta.74`, `@effect/platform-bun`, and `@effect/platform-node` `4.0.0-rc.111`.
- `alchemy.run.ts` is the deployment source of truth. It defines the native Worker, its `src/runtime/worker.ts` bundle entrypoint, environment bindings, defaults, and Alchemy state.
- `index.ts` is a one-line Bun program; Plan 004 will define the local HTTP composition root.

Alchemy beta APIs and Effect RC APIs are version-sensitive. Read the installed package examples and current Alchemy documentation before choosing resource constructors. Do not rely on remembered API names.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | exit 0 |
| Local runtime | `bun run index.ts` | documented startup behavior |
| Infrastructure preview | `bun run alchemy:check` or the repository's chosen dry-run command | no resource mutation |
| Deployment | only with explicit operator credentials/approval | expected resources converge |
| Lint/format | `bun run check` | exit 0 |

Never run a real deploy, destroy, or secret mutation as part of plan execution without explicit operator approval.

## Scope

**In scope**

- `alchemy.run.ts` or the chosen Alchemy entrypoint
- `src/runtime/config.ts`
- worker/platform entrypoint files needed by the deployment
- `package.json` deployment scripts
- `.env.example` with names only, never values
- `README.md` deployment instructions
- infrastructure tests or dry-run checks

**Out of scope**

- Domain parsing, metadata policy, templates, or route behavior except wiring exports
- Committing secrets or real account IDs
- Production deployment execution
- Adding a database without evidence from cache/latency measurements

## Target contracts

```ts
type AppConfig = {
  readonly publicOrigin: URL;
  readonly metadataTimeoutMs: number;
  readonly metadataCacheTtlSeconds: number;
  readonly allowedMediaHosts: ReadonlySet<string>;
  readonly providerCredential?: Redacted<string>;
};
```

Parse environment at startup and fail safely with a tagged configuration error. The application sees `AppConfig`, not `process.env` or Cloudflare binding objects. Secrets are stored through the platform secret mechanism and exposed only to the owning adapter.

## Steps

### Step 1: Inventory installed Alchemy APIs and deployment target

Read the installed Alchemy package docs/examples and identify whether the desired target is a Cloudflare Worker, Pages function, or another resource. Record the exact resource model, local preview command, state/stack naming, and cleanup behavior in an ADR or deployment note. If Alchemy beta cannot support the chosen HTTP runtime cleanly, stop and report an alternative rather than mixing deployment frameworks.

**Verify**: dry-run/validation command exits 0 without contacting or mutating production resources.

### Step 2: Add typed runtime configuration

Implement `src/runtime/config.ts` using Effect Config/Schema. Validate origin, numeric bounds, URL schemes, host allowlist, and optional redacted credentials. Provide a local test configuration Layer. Ensure config errors do not reveal secret values.

**Verify**: config tests pass for valid local config, missing required values, invalid URL/scheme, invalid numeric bounds, and secret redaction.

### Step 3: Bind the HTTP application to the platform

Expose the Plan 004 application through the selected Cloudflare runtime adapter. Keep the same application/service Layers as local execution; only the inbound platform adapter and resource bindings vary. Bind cache storage only when its observable semantics match Plan 003. Keep resource acquisition and cleanup in Layers/bootstrap.

**Verify**: local platform emulation or dry-run invokes a health/request fixture and returns the same projection as the local server tests.

### Step 4: Define deployment resources and scripts

Add typed Alchemy resources, stack/environment naming, preview/check scripts, and operator-safe deployment commands. Configure custom domain/routing only through explicit config. Add `.env.example` containing variable names and safe descriptions, not values.

**Verify**: `bun run alchemy:check` or the selected non-mutating command exits 0; no secret values or production identifiers are present in tracked files.

### Step 5: Document rollout and rollback

Document local development, preview, deploy approval, secret setup, cache invalidation, rollback, and teardown. State that `destroy` is destructive and must be operator-invoked. Include expected health endpoint behavior and how to inspect safe logs.

**Verify**: a clean checkout can follow README setup with local-only values through typecheck/tests and a dry-run.

## Test plan

- Config parsing and redaction tests through the public runtime config seam.
- Infrastructure validation/dry-run fixture.
- Local-vs-platform adapter contract test for one health request and one embed request.
- No tests require production account access.

## Done criteria

- [ ] Application code has no direct environment reads outside the composition root/config adapter.
- [ ] Alchemy APIs are verified against the installed beta package.
- [ ] Dry-run passes without mutation.
- [ ] Secrets are absent from source, docs, logs, and test snapshots.
- [ ] `bun run typecheck`, tests, and `bun run check` pass.

## STOP conditions

- Alchemy resource APIs or the target platform do not match the installed versions.
- Deployment requires committing a credential or hardcoded account/resource identifier.
- The platform adapter changes application behavior rather than only translating runtime requests/bindings.
- A durable database is proposed without a measured requirement and explicit operator decision.

## Maintenance notes

Pin and periodically review Alchemy and Effect RC versions together. Infrastructure changes should be previewed before deploy, and resource names must remain stable to avoid accidental replacement. Review secret handling and public-origin/host allowlists on every deployment change.
