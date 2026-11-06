import { startServer } from "@/runtime/server.ts";
import type { ServerOptions } from "@/runtime/server.ts";

type TestServer = Awaited<ReturnType<typeof startServer>>;

/**
 * Run a test against a server that is stopped afterward.
 * @typeParam Result - The callback result type.
 * @param options - Server configuration.
 * @param run - Test callback receiving the running server.
 * @returns The callback result.
 */
export const withTestServer = async <Result>(
  options: ServerOptions,
  run: (server: TestServer) => Promise<Result>
): Promise<Result> => {
  const server = await startServer(options);

  try {
    return await run(server);
  } finally {
    await server.stop(true);
  }
};
