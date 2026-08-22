# Plan 001: Establish the verification baseline and application skeleton

> **Executor instructions**: Follow this plan step by step. Run every verification command before moving on. This plan is the foundation for the other plans; do not implement Instagram scraping, HTTP routes, or deployment here.
>
> **Drift check**: This workspace has no Git metadata. Confirm that `README.md`, `package.json`, `tsconfig.json`, and `index.ts` still match the current-state facts below. If not, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: no Git repository, 2026-08-23

## Why this matters

The repository is currently a Bun-generated scaffold with a one-line `index.ts`, no test script, and no typecheck script. The downstream agents need a stable composition root, predictable source/test layout, and machine-checkable gates before they add Effect services and Cloudflare deployment. This plan establishes only that foundation and preserves a runnable program at every step.

## Current state

- `package.json` declares Bun/TypeScript, `effect` `4.0.0-rc.111`, `@effect/platform-bun` `4.0.0-rc.111`, and `alchemy` `2.0.0-beta.74`; scripts are only `check`, `fix`, and `prepare`.
- `tsconfig.json` already enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and bundler resolution, but not `exactOptionalPropertyTypes`.
- `index.ts:1` only logs `Hello via Bun!`.
- `README.md:3-13` documents `bun install` and `bun run index.ts`, but not tests, typechecking, configuration, or deployment.
- `oxlint.config.ts` enables Ultracite core, Vitest, anti-slop, GitHub, and SonarJS rules.

Follow the local `Effect` service shape from `.agents/skills/effect-service-design/SKILL.md`: a `Context.Service` contract, `make`, dependency-preserving layer, production layer, and honest test layer only where justified. Follow `.agents/skills/coding-standards/SKILL.md`: pure functional core, typed expected failures, boundary parsing, narrow ports, no `any`, no `!`, no module mocks.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Format/lint check | `bun run check` | exit 0 |
| Typecheck | `bun run typecheck` | exit 0, no diagnostics |
| Tests | `bun test` | exit 0 |
| Single test file | `bun test path/to/file.test.ts` | selected tests pass |
| Run application | `bun run index.ts` | starts or exits cleanly according to the chosen bootstrap behavior |

If `bun run check` fails on pre-existing skill files, do not reformat `.agents/`; configure the check scope or document the limitation. Do not run the formatter as a substitute for understanding the failure.

## Scope

**In scope**

- `package.json`
- `tsconfig.json`
- `README.md`
- `index.ts`
- `src/` and `__tests__/` directories/files needed for the empty composition root and a smoke test
- `vitest.config.ts` only if Bun test discovery requires it

**Out of scope**

- Instagram URL semantics and scraping
- HTTP response routes and HTML templates
- Alchemy resource definitions
- New runtime dependencies unless an existing dependency cannot provide the required capability
- Changes under `.agents/` or `node_modules/`

## Steps

### Step 1: Define the source and test layout

Create a discoverable layout, keeping the application entrypoint thin:

```txt
src/
  application/
  domain/
  adapters/
  runtime/
  http/
__tests__/
index.ts
```

Do not create empty placeholder modules solely to populate folders. Add only a minimal `src/runtime/bootstrap.ts` or equivalent if it is needed to keep `index.ts` a composition root.

**Verify**: `bun run typecheck` -> exit 0 after the empty modules/entrypoint compile.

### Step 2: Add explicit verification scripts and strictness

Add `typecheck` using `tsc --noEmit` or the repository-compatible TypeScript binary, and add a test script that runs the chosen Bun/Vitest runner. Enable `exactOptionalPropertyTypes` unless a concrete dependency incompatibility is found. Keep `check` as the Ultracite gate. Do not add a fake test command that passes without discovering tests.

**Verify**: `bun run typecheck` -> exit 0; `bun test` -> exit 0 and reports at least one discovered smoke test.

### Step 3: Establish the Effect runtime composition root

Replace the greeting in `index.ts` with a thin bootstrap that constructs the runtime Layer and executes a small health/smoke Effect, or starts the eventual HTTP runtime only if the chosen platform requires it now. Configuration must be read and parsed once at the root; inner modules must not read `process.env`. Keep the app importable without opening sockets as a module side effect.

Add one smoke test through the public bootstrap/service seam. It must assert an observable value, not a spy call.

**Verify**: `bun run index.ts` -> exits 0 or reports the documented intentional server-start behavior; `bun test` -> all tests pass.

### Step 4: Update onboarding documentation

Update `README.md` with the exact install, check, typecheck, test, and run commands. State that the service is under construction, that credentials are not needed for the baseline, and that deployment/configuration comes in a later plan.

**Verify**: `bun run check` -> exit 0; README commands are present via a read-only search.

## Test plan

- Add one smoke test under `__tests__/` that exercises the public bootstrap or a minimal runtime service through a real Effect Layer.
- Assert the returned success/error value and cleanup behavior where a resource is acquired.
- Do not use `vi.mock`, `jest.mock`, or call-count assertions.

**Verification**: `bun test` -> all tests pass and at least one test is discovered.

## Done criteria

- [ ] `bun run typecheck` exits 0.
- [ ] `bun test` exits 0 with a discovered smoke test.
- [ ] `bun run check` exits 0, or a pre-existing scope limitation is recorded in the README.
- [ ] `package.json` has exact `typecheck` and test scripts.
- [ ] `index.ts` is only composition/bootstrap wiring.
- [ ] No Instagram, Discord, scraper, or Cloudflare behavior was added.
- [ ] Only files in Scope are modified.

## STOP conditions

- The installed Effect RC does not support the service/layer API documented in the local skill; stop and report the actual API mismatch.
- A test runner cannot discover a real test without adding an unapproved dependency.
- Starting the program requires binding a port at import time.
- A verification command needs network credentials or mutates a production resource.

## Maintenance notes

Keep the composition root as the only place that selects concrete adapters and runtime layers. Later plans should add services behind this root rather than making route files construct providers. Reviewers should reject environment reads, socket creation, or logging setup at module import time.
