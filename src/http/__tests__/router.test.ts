import { describe, expect, test } from "bun:test";

import { startServer } from "../../runtime/server.ts";

const fixture = {
  canonicalUrl: "https://instagram.com/p/ABC",
  caption: "caption <unsafe> & quoted",
  media: [{ type: "image", url: "https://cdn.example/image.jpg" }],
  username: "alice",
};

// oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
describe("real Bun HTTP router", () => {
  // oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
  test("redirects humans before metadata lookup", async () => {
    const server = await startServer({
      fixtures: new Map(),
      origin: new URL("http://127.0.0.1:18991"),
      port: 18_991,
    });
    try {
      const response = await fetch(`${server.url}p/ABC`, {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://instagram.com/p/ABC"
      );
    } finally {
      server.stop(true);
    }
  });

  test("serves escaped bot metadata and approved media redirects", async () => {
    const server = await startServer({
      fixtures: new Map([["ABC", fixture]]),
      origin: new URL("http://127.0.0.1:18992"),
      port: 18_992,
    });
    try {
      const page = await fetch(`${server.url}p/ABC`, {
        headers: { "user-agent": "Discordbot" },
      });
      const body = await page.text();
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
      expect(page.headers.get("x-content-type-options")).toBe("nosniff");
      expect(body).toContain("&lt;unsafe&gt;");
      expect(body).not.toContain("<unsafe>");

      const media = await fetch(`${server.url}images/ABC/0`, {
        redirect: "manual",
      });
      expect(media.status).toBe(302);
      expect(media.headers.get("location")).toBe(
        "https://cdn.example/image.jpg"
      );
    } finally {
      server.stop(true);
    }
  });
});
