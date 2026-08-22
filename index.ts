import { startServer } from "./src/runtime/bootstrap.ts";

const server = await startServer({
  hostname: process.env.HOSTNAME ?? "127.0.0.1",
  port: Number(process.env.PORT ?? "8787"),
});

console.log(`fxinstagram listening on ${server.url}`);
