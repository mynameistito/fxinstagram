import { Stack } from "alchemy";
import {
  Worker as CloudflareWorker,
  providers,
  state,
} from "alchemy/Cloudflare";
import { Config, Effect } from "effect";

const workerEnvironment = {
  ALLOWED_MEDIA_HOSTS: Config.string("ALLOWED_MEDIA_HOSTS").pipe(
    Config.withDefault("cdn.example")
  ),
  METADATA_CACHE_TTL_SECONDS: Config.string("METADATA_CACHE_TTL_SECONDS").pipe(
    Config.withDefault("60")
  ),
  METADATA_PROVIDER_TOKEN: Config.string("METADATA_PROVIDER_TOKEN").pipe(
    Config.withDefault("")
  ),
  METADATA_TIMEOUT_MS: Config.string("METADATA_TIMEOUT_MS").pipe(
    Config.withDefault("1000")
  ),
  PUBLIC_ORIGIN: CloudflareWorker.URL,
};

export const Worker = CloudflareWorker("FxinstagramWorker", {
  env: workerEnvironment,
  main: "./src/runtime/worker.ts",
  workersDev: true,
});

export default Stack(
  "fxinstagram",
  { providers: providers(), state: state() },
  Effect.gen(function* defineStack() {
    const worker = yield* Worker;
    return { url: worker.url };
  })
);
