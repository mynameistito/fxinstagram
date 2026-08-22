# fxinstagram

The service serves Discord-compatible Instagram embed metadata. Local development uses the existing Bun HTTP adapter and an in-memory cache. Cloudflare deployment uses the Alchemy-managed native Worker in `alchemy.run.ts`; it does not provision durable storage.

`bun run check` currently reports a pre-existing compatibility limitation: the configured `eslint-plugin-github` cannot load with the repository's TypeScript 7 toolchain. Formatting still runs and passes; this baseline does not modify `.agents/` or the lint configuration to work around it.

Install dependencies:

```sh
bun install
```

Run the verification gates:

```sh
bun run check
bun run typecheck
bun test
```

Run the application:

```sh
bun run index.ts
```

Copy `.env.example` to `.env` and use local-only values before starting the server. `PUBLIC_ORIGIN` must be an HTTPS origin; `ALLOWED_MEDIA_HOSTS` is a comma-separated hostname allowlist.

Preview infrastructure without mutating Cloudflare:

```sh
bun run alchemy:check
```

The preview uses stage `dev_fxinstagram` and profile `default`. It may require an authenticated Alchemy profile even though it does not deploy resources. Do not use deployment credentials in local `.env` files.

After reviewing a clean preview, an operator may explicitly run `bun run alchemy:deploy`. Configure provider secrets through the platform secret mechanism, not tracked files. The deployment currently uses only the Worker and Alchemy state resources; cache remains in memory until measured evidence justifies a binding.

Rollback by deploying the previously reviewed commit. `alchemy destroy` is destructive teardown and must be invoked separately by an operator after confirming the stage and profile. Inspect safe Worker logs through Cloudflare's Workers Logs; application responses never include configuration secret values.

The application has no separate health route in Plan 004. Verify the deployment with a known embed route and a crawler user-agent; ordinary user-agents should receive the existing Instagram redirect behavior.
