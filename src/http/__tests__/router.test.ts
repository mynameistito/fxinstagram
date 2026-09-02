import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import type { HttpTelemetryEvent } from "@/http/telemetry.ts";

import { withTestServer } from "../../../__tests__/test-server.ts";

const fixture = {
  canonicalUrl: "https://instagram.com/p/ABC",
  caption: "caption <unsafe> & quoted",
  media: [
    {
      height: 1350,
      type: "image",
      url: "https://cdn.example/image.jpg",
      width: 1080,
    },
  ],
  username: "alice",
};

// oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
describe("real Bun HTTP router", () => {
  // oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
  test("redirects humans before metadata lookup", async () => {
    await withTestServer(
      {
        fixtures: new Map(),
        origin: new URL("http://127.0.0.1:0"),
        port: 0,
      },
      async (server) => {
        const response = await fetch(`${server.url}p/ABC`, {
          redirect: "manual",
        });
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(
          "https://instagram.com/p/ABC"
        );
      }
    );
  });

  test("serves escaped bot metadata and approved media redirects", async () => {
    await withTestServer(
      {
        fixtures: new Map([["ABC", fixture]]),
        origin: new URL("http://127.0.0.1:0"),
        port: 0,
      },
      async (server) => {
        const page = await fetch(`${server.url}p/ABC`, {
          headers: { "user-agent": "Discordbot" },
        });
        const body = await page.text();
        expect(page.status).toBe(200);
        expect(page.headers.get("content-type")).toContain("text/html");
        expect(page.headers.get("x-content-type-options")).toBe("nosniff");
        expect(body).toContain("&lt;unsafe&gt;");
        expect(body).not.toContain("<unsafe>");
        expect(body).toContain("alice on instagram");
        expect(body).toContain('property="og:image:width" content="1080"');
        expect(body).toContain('property="og:image:height" content="1350"');

        const oembed = await fetch(
          `${server.url}oembed?url=https%3A%2F%2Finstagram.com%2Fp%2FABC`,
          { headers: { "user-agent": "Discordbot" } }
        );
        // SAFETY: The test server returns the fixed oEmbed shape for this request.
        const oembedBody = (await oembed.json()) as {
          provider_name: string;
          title: string;
        };
        expect(oembedBody.provider_name).toBe("fxinstagram");
        expect(oembedBody.title).toBe("fxinstagram embed");

        const media = await fetch(`${server.url}images/ABC/0`, {
          redirect: "manual",
        });
        expect(media.status).toBe(302);
        expect(media.headers.get("location")).toBe(
          "https://cdn.example/image.jpg"
        );
      }
    );
  });

  test("serves security and Do Not Track well-known resources", async () => {
    const events: HttpTelemetryEvent[] = [];
    await withTestServer(
      {
        httpTelemetry: {
          record: (event) =>
            Effect.sync(() => {
              events.push(event);
            }),
        },
        origin: new URL("https://ig.mynameistito.com"),
      },
      async (server) => {
        const security = await fetch(`${server.url}.well-known/security.txt`);
        expect(security.status).toBe(200);
        expect(security.headers.get("content-type")).toContain("text/plain");
        expect(await security.text()).toBe(
          [
            "Contact: mailto:contact@mynameistito.com",
            "Canonical: https://mynameistito.com/.well-known/security.txt",
            "Policy: https://mynameistito.com/terms-of-service",
            "Encryption: https://mynameistito.com/.well-known/pgp.txt",
            "Acknowledgments: https://mynameistito.com/security-acknowledgments.txt",
            "Expires: 2027-01-01T00:00:00.000Z",
          ].join("\n")
        );

        const policy = await fetch(`${server.url}.well-known/dnt-policy.txt`);
        expect(policy.status).toBe(200);
        expect(policy.headers.get("content-type")).toContain("text/plain");
        expect(await policy.text()).toBe(
          [
            "# Do Not Track Policy for mynameistito.com",
            "# Last Updated: 2026-08-23",
            "",
            "This website, mynameistito.com, does not currently respond to Do Not Track (DNT) signals transmitted by web browsers.",
            "",
            "Our data collection and usage practices are governed by our main Privacy Policy, available at https://mynameistito.com/privacy-policy. We encourage you to review our Privacy Policy to understand how we handle user data.",
            "",
            "For questions regarding our privacy practices, please contact contact@mynameistito.com.",
          ].join("\n")
        );

        const dnt = await fetch(`${server.url}.well-known/dnt`);
        expect(dnt.status).toBe(200);
        expect(dnt.headers.get("content-type")).toContain(
          "application/tracking-status+json"
        );
        expect(await dnt.text()).toBe(
          '{"policy": "/.well-known/dnt-policy.txt"}'
        );
        expect(events).toHaveLength(3);
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              operation: "content",
              outcome: "success",
              requestId: security.headers.get("x-request-id"),
              status: 200,
            }),
            expect.objectContaining({
              operation: "content",
              outcome: "success",
              requestId: policy.headers.get("x-request-id"),
              status: 200,
            }),
            expect.objectContaining({
              operation: "content",
              outcome: "success",
              requestId: dnt.headers.get("x-request-id"),
              status: 200,
            }),
          ])
        );
      }
    );
  });
});
