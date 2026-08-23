// oxlint-disable vitest/prefer-importing-vitest-globals, unicorn/consistent-function-scoping
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";
import type { Duration } from "effect";

import type { MetadataCache } from "@/application/cache.ts";
import type { InstagramMetadataSource } from "@/domain/media.ts";
import { startServer } from "@/runtime/server.ts";

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
    const server = await startServer({
      fixtures: new Map([["ABC", { caption: "malformed" }]]),
      origin: new URL("http://127.0.0.1:0"),
      rateLimit: { maxRequests: 1, windowMs: 60_000 },
    });
    try {
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
    } finally {
      server.stop(true);
    }
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
    const run = async (source: InstagramMetadataSource): Promise<number> => {
      const server = await startServer({
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
      });
      try {
        const response = await fetch(`${server.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        return response.status;
      } finally {
        server.stop(true);
      }
    };
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
    const server = await startServer({
      cache,
      fixtures: new Map([["ABC", validPost]]),
      origin: new URL("http://127.0.0.1:0"),
    });
    try {
      const cached = await fetch(`${server.url}p/ABC`, {
        headers: { "user-agent": "Discordbot" },
      });
      expect(cached.status).toBe(503);
      expect(await cached.text()).not.toContain("private cache detail");

      const oversized = await fetch(`${server.url}${"p/"}${"A".repeat(600)}`);
      expect(oversized.status).toBe(422);
      const unsafeServer = await startServer({
        fixtures: new Map([
          [
            "ABC",
            {
              canonicalUrl: "https://instagram.com/p/ABC",
              caption: "unsafe media",
              media: [{ type: "image", url: "https://evil.example/image.jpg" }],
              username: "alice",
            },
          ],
        ]),
        origin: new URL("http://127.0.0.1:0"),
      });
      try {
        const unsafe = await fetch(`${unsafeServer.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        expect(unsafe.status).toBe(422);
      } finally {
        unsafeServer.stop(true);
      }
    } finally {
      server.stop(true);
    }
  });
});
