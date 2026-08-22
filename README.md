# fxinstagram

The service is under construction. This baseline does not need credentials, and deployment and runtime configuration will be added in a later plan.

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
