import { startServer } from "@/runtime/server.ts";
import type { ServerOptions } from "@/runtime/server.ts";

type TestServer = Awaited<ReturnType<typeof startServer>>;

export const withTestServer = async <Result>(
  options: ServerOptions,
  run: (server: TestServer) => Promise<Result>
): Promise<Result> => {
  const server = await startServer(options);
  try {
    return await run(server);
  } finally {
    server.stop(true);
  }
};
