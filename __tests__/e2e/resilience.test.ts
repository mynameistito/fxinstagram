// oxlint-disable vitest/prefer-importing-vitest-globals, unicorn/consistent-function-scoping
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";
import type { Duration } from "effect";

import type { MetadataCache } from "../../src/application/cache.ts";
import type { InstagramMetadataSource } from "../../src/domain/media.ts";
import { withTestServer } from "../test-server.ts";

const validPost = {
  canonicalUrl: new URL("https://instagram.com/p/ABC"),
  caption: "safe",
  media: [
    { type: "image" as const, url: new URL("https://cdn.example/image.jpg") },
  ],
  shortcode: "ABC",
  username: "alice",
};

describe("local resilience and abuse controls", () => {
  test("maps rate limits, malformed fixtures, and unsafe media without raw data", async () => {
    await withTestServer(
      {
        fixtures: new Map([["ABC", { caption: "malformed" }]]),
        origin: new URL("http://127.0.0.1:0"),
        rateLimit: { maxRequests: 1, windowMs: 60_000 },
      },
      async (server) => {
        const first = await fetch(`${server.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        expect(first.status).toBe(422);
        const limited = await fetch(`${server.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        expect(limited.status).toBe(429);
        expect(await limited.text()).not.toContain("malformed");
        expect(limited.headers.get("retry-after")).toBe("60");
      }
    );
  });

  test("maps upstream rate limiting and timeout failures", async () => {
    const rateLimited: InstagramMetadataSource = {
      find: () =>
        Effect.fail({
          _tag: "ProviderRateLimited",
          provider: "local",
          retryAfterMs: 1,
        }),
    };
    const timeout: InstagramMetadataSource = {
      find: () => Effect.never,
    };
    const run = (source: InstagramMetadataSource): Promise<number> =>
      withTestServer(
        {
          metadata: {
            cacheMaxEntries: 2,
            cacheTtlMs: 1000,
            provider: "fixture-json",
            providerUrl: new URL("https://fixtures.invalid"),
            requestTimeoutMs: 10,
            retryLimit: 0,
          },
          origin: new URL("http://127.0.0.1:0"),
          source,
        },
        async (server) => {
          const response = await fetch(`${server.url}p/ABC`, {
            headers: { "user-agent": "Discordbot" },
          });
          return response.status;
        }
      );
    const statuses = await Promise.all([run(rateLimited), run(timeout)]);
    expect(statuses).toEqual([429, 503]);
  });

  test("maps cache outages and rejects oversized or unsafe inputs", async () => {
    const cache: MetadataCache = {
      get: () =>
        Effect.fail({
          _tag: "CacheUnavailable",
          cause: "private cache detail",
          operation: "get",
        }),
      put: (_key, _value, _ttl: Duration.Duration) => Effect.void,
    };
    await withTestServer(
      {
        cache,
        fixtures: new Map([["ABC", validPost]]),
        origin: new URL("http://127.0.0.1:0"),
      },
      async (server) => {
        const cached = await fetch(`${server.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        expect(cached.status).toBe(503);
        expect(await cached.text()).not.toContain("private cache detail");

        const oversized = await fetch(`${server.url}${"p/"}${"A".repeat(600)}`);
        expect(oversized.status).toBe(422);
        await withTestServer(
          {
            fixtures: new Map([
              [
                "ABC",
                {
                  canonicalUrl: "https://instagram.com/p/ABC",
                  caption: "unsafe media",
                  media: [
                    { type: "image", url: "https://evil.example/image.jpg" },
                  ],
                  username: "alice",
                },
              ],
            ]),
            origin: new URL("http://127.0.0.1:0"),
          },
          async (unsafeServer) => {
            const unsafe = await fetch(`${unsafeServer.url}p/ABC`, {
              headers: { "user-agent": "Discordbot" },
            });
            expect(unsafe.status).toBe(422);
          }
        );
      }
    );
  });
});
