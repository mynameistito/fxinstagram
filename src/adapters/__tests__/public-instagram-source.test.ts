// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { makePublicInstagramSource } from "@/adapters/instagram/public-html-source.ts";
import { parseInstagramUrl } from "@/domain/instagram-url.ts";

const location = Effect.runSync(
  parseInstagramUrl("https://instagram.com/reel/ABC")
);

const inputUrl = (input: Request | URL | string): string =>
  input instanceof Request ? input.url : new URL(input).href;

const html = `<!doctype html><meta property="og:title" content="@alice on Instagram"><meta property="og:description" content="caption"><meta property="og:image" content="https://scontent.cdninstagram.com/image.jpg"><meta property="og:url" content="https://www.instagram.com/alice/reel/ABC/">`;

describe("public Instagram metadata source", () => {
  test("requests the canonical public page and parses its response", async () => {
    const requested: URL[] = [];

    const source = makePublicInstagramSource(async (input, init) => {
      requested.push(new URL(inputUrl(input)));
      expect(init?.redirect).toBe("manual");
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return await Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html" } })
      );
    });

    const post = await Effect.runPromise(source.find(location));
    expect(requested.map((url) => url.href)).toEqual([
      "https://www.instagram.com/reel/ABC/?img_index=1",
      "https://www.instagram.com/p/ABC/embed/captioned/?img_index=1",
    ]);
    expect(post.username).toBe("alice");
  });

  const carouselLocation = Effect.runSync(
    parseInstagramUrl("https://instagram.com/p/ABC?img_index=1")
  );

  test("passes a requested carousel index to upstream page and embed requests", async () => {
    const requested: string[] = [];

    const source = makePublicInstagramSource(async (input) => {
      requested.push(
        input instanceof Request ? input.url : new URL(input).href
      );

      return await Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html" } })
      );
    });

    await Effect.runPromise(source.find(carouselLocation));
    expect(requested.slice(0, 2)).toEqual([
      "https://www.instagram.com/p/ABC/?img_index=1",
      "https://www.instagram.com/p/ABC/embed/captioned/?img_index=1",
    ]);
  });

  test("uses the requested carousel image as a video poster", async () => {
    const requestedLocation = Effect.runSync(
      parseInstagramUrl("https://instagram.com/p/ABC?img_index=2")
    );

    const carouselHtml = `<!doctype html><meta property="og:title" content="@alice on Instagram"><meta property="og:image" content="https://scontent.cdninstagram.com/first.jpg"><meta property="og:image" content="https://scontent.cdninstagram.com/second.jpg"><meta property="og:url" content="https://www.instagram.com/p/ABC/">`;
    const embed = String.raw`<script>"video_url":"https:\\/\\/instagram.example.fbcdn.net\\/video.mp4"</script>`;

    const source = makePublicInstagramSource(
      async (input) =>
        await Promise.resolve(
          new Response(
            inputUrl(input).includes("/embed/") ? embed : carouselHtml,
            {
              headers: { "content-type": "text/html" },
            }
          )
        )
    );

    const post = await Effect.runPromise(source.find(requestedLocation));

    expect(post.media).toEqual([
      {
        posterUrl: new URL("https://scontent.cdninstagram.com/second.jpg"),
        type: "video",
        url: new URL("https://scontent.cdninstagram.com/video.mp4"),
      },
    ]);
  });

  test("follows only bounded Instagram HTTPS redirects", async () => {
    const requested: string[] = [];

    const source = makePublicInstagramSource(async (input) => {
      const url = input instanceof Request ? input.url : new URL(input).href;
      requested.push(url);

      if (url === "https://www.instagram.com/reel/ABC/?img_index=1") {
        return await Promise.resolve(
          new Response(null, {
            headers: {
              location: "https://instagram.com/reel/ABC/?img_index=1",
            },
            status: 302,
          })
        );
      }

      return await Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html" } })
      );
    });

    await Effect.runPromise(source.find(location));
    expect(requested.slice(0, 2)).toEqual([
      "https://www.instagram.com/reel/ABC/?img_index=1",
      "https://instagram.com/reel/ABC/?img_index=1",
    ]);

    const unsafe = makePublicInstagramSource(
      async () =>
        await Promise.resolve(
          new Response(null, {
            headers: { location: "https://example.com/private" },
            status: 302,
          })
        )
    );

    expect(
      await Effect.runPromise(Effect.result(unsafe.find(location)))
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ProviderUnavailable" },
    });
  });

  test("prefers a playable video from the embed document", async () => {
    const embed = String.raw`<script>"video_url":"https:\\/\\/instagram.example.fbcdn.net\\/video.mp4"</script>`;

    const source = makePublicInstagramSource(
      async (input) =>
        await Promise.resolve(
          new Response(inputUrl(input).includes("/embed/") ? embed : html, {
            headers: { "content-type": "text/html" },
          })
        )
    );

    const post = await Effect.runPromise(source.find(location));
    expect(post.media).toEqual([
      {
        posterUrl: new URL("https://scontent.cdninstagram.com/image.jpg"),
        type: "video",
        url: new URL("https://scontent.cdninstagram.com/video.mp4"),
      },
    ]);
  });

  test("maps not found and rate-limited responses", async () => {
    const notFound = makePublicInstagramSource(
      async () => await Promise.resolve(new Response("", { status: 404 }))
    );

    const limited = makePublicInstagramSource(
      async () =>
        await Promise.resolve(
          new Response("", { headers: { "retry-after": "12" }, status: 429 })
        )
    );

    expect(
      await Effect.runPromise(Effect.result(notFound.find(location)))
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "MetadataNotFound", shortcode: "ABC" },
    });
    expect(
      await Effect.runPromise(Effect.result(limited.find(location)))
    ).toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "ProviderRateLimited",
        provider: "instagram-public-html",
        retryAfterMs: 12_000,
      },
    });
  });

  test("rejects non-HTML and oversized responses", async () => {
    const invalid = makePublicInstagramSource(
      async () =>
        await Promise.resolve(
          new Response("{}", {
            headers: { "content-type": "application/json" },
          })
        )
    );

    const oversized = makePublicInstagramSource(
      async () =>
        await Promise.resolve(
          new Response("x".repeat(1_048_577), {
            headers: { "content-type": "text/html" },
          })
        )
    );

    expect(
      await Effect.runPromise(Effect.result(invalid.find(location)))
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ProviderResponseInvalid" },
    });
    expect(
      await Effect.runPromise(Effect.result(oversized.find(location)))
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ProviderUnavailable" },
    });
  });
});
