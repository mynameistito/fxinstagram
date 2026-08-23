// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import type { HttpTelemetryEvent } from "@/http/telemetry.ts";

import { withTestServer } from "../test-server.ts";

const fixtures = new Map<string, unknown>([
  [
    "ABC",
    {
      canonicalUrl: "https://instagram.com/p/ABC",
      caption: "post caption",
      media: [{ type: "image", url: "https://cdn.example/image.jpg" }],
      profilePictureUrl: "https://cdn.example/profile.jpg",
      username: "alice",
    },
  ],
  [
    "REEL",
    {
      canonicalUrl: "https://instagram.com/reel/REEL",
      caption: "reel caption",
      media: [{ type: "video", url: "https://cdn.example/video.mp4" }],
      username: "alice",
    },
  ],
  [
    "STORY",
    {
      canonicalUrl: "https://instagram.com/stories/alice/STORY",
      caption: "story caption",
      media: [{ type: "image", url: "https://cdn.example/story.jpg" }],
      username: "alice",
    },
  ],
  [
    "GALLERY",
    {
      canonicalUrl: "https://instagram.com/p/GALLERY",
      caption: "gallery caption",
      media: [
        { type: "image", url: "https://cdn.example/one.jpg" },
        { type: "image", url: "https://cdn.example/two.jpg" },
      ],
      username: "alice",
    },
  ],
]);

const bot = { headers: { "user-agent": "Discordbot/2.0" } };

describe("local real-entrypoint route contracts", () => {
  test("serves post, reel, story, gallery, grid, and oEmbed projections", async () => {
    await withTestServer(
      {
        fixtures,
        origin: new URL("http://127.0.0.1:0"),
      },
      async (server) => {
        const post = await fetch(`${server.url}p/ABC`, bot);
        expect(post.status).toBe(200);
        expect(post.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
        expect(await post.text()).toContain("post caption");

        const reel = await fetch(`${server.url}reel/REEL`, bot);
        expect(reel.status).toBe(200);
        expect(await reel.text()).toContain("video.mp4");

        const story = await fetch(`${server.url}stories/alice/STORY`, bot);
        expect(story.status).toBe(200);

        const gallery = await fetch(`${server.url}p/GALLERY?gallery=1`, bot);
        expect(gallery.status).toBe(200);
        expect(await gallery.text()).toContain("one.jpg");

        const grid = await fetch(`${server.url}grid/GALLERY`, bot);
        expect(grid.status).toBe(200);

        const oembedUrl = encodeURIComponent("https://instagram.com/p/ABC");
        const oembed = await fetch(`${server.url}oembed?url=${oembedUrl}`);
        expect(oembed.status).toBe(200);
        expect(await oembed.json()).toMatchObject({
          author_name: "alice",
          author_url: "https://instagram.com/alice",
          provider_name: "fxinstagram",
        });
      }
    );
  });

  test("supports direct image and video redirects through the safe media route", async () => {
    await withTestServer(
      {
        fixtures,
        origin: new URL("http://127.0.0.1:0"),
      },
      async (server) => {
        const image = await fetch(`${server.url}p/ABC?direct=1`, {
          ...bot,
          redirect: "manual",
        });
        expect(image.status).toBe(302);
        expect(image.headers.get("location")).toContain(`/images/ABC/0`);

        const video = await fetch(`${server.url}videos/REEL/0`, {
          redirect: "manual",
        });
        expect(video.status).toBe(302);
        expect(video.headers.get("location")).toBe(
          "https://cdn.example/video.mp4"
        );
      }
    );
  });

  test("records only correlated, typed request telemetry", async () => {
    const events: HttpTelemetryEvent[] = [];
    await withTestServer(
      {
        fixtures,
        httpTelemetry: {
          record: (event) =>
            Effect.sync(() => {
              events.push(event);
            }),
        },
        origin: new URL("http://127.0.0.1:0"),
      },
      async (server) => {
        const response = await fetch(`${server.url}p/ABC`, bot);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          operation: "content",
          outcome: "success",
          requestId: response.headers.get("x-request-id"),
          status: 200,
        });
        expect(JSON.stringify(events)).not.toContain("ABC");
        expect(JSON.stringify(events)).not.toContain("cdn.example");
      }
    );
  });
});
