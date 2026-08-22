import { Effect } from "effect";

import { startServer } from "./src/runtime/bootstrap.ts";
import { localEnvironment, parseAppConfig } from "./src/runtime/config.ts";

const environment = localEnvironment();
const config = await Effect.runPromise(parseAppConfig(environment));
const server = await startServer({
  hostname: process.env.HOSTNAME ?? "127.0.0.1",
  mediaHosts: config.allowedMediaHosts,
  origin: config.publicOrigin,
  port: Number(process.env.PORT ?? "8787"),
});

console.log(`fxinstagram listening on ${server.url}`);
