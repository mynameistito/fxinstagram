import { Effect, Layer } from "effect";

export { startServer } from "./server.ts";

/** The observable result returned by the baseline application bootstrap. */
export interface BootstrapResult {
  readonly service: "fxinstagram";
  readonly status: "ok";
}

const runtimeLayer = Layer.empty;

/**
 * Build the application runtime and perform the baseline health operation.
 *
 * The layer is intentionally empty until later plans add concrete services.
 */
export const bootstrap = Effect.succeed<BootstrapResult>({
  service: "fxinstagram",
  status: "ok",
}).pipe(Effect.provide(runtimeLayer));
