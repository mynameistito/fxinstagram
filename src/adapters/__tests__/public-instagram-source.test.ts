// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { parseInstagramUrl } from "../../domain/instagram-url.ts";
import { makePublicInstagramSource } from "../instagram/public-html-source.ts";

const location = Effect.runSync(
  parseInstagramUrl("https://instagram.com/reel/ABC")
);
const html = `<!doctype html><meta property="og:title" content="@alice on Instagram"><meta property="og:description" content="caption"><meta property="og:image" content="https://scontent.cdninstagram.com/image.jpg"><meta property="og:url" content="https://www.instagram.com/alice/reel/ABC/">`;

describe("public Instagram metadata source", () => {
  test("requests the canonical public page and parses its response", async () => {
    const requested: URL[] = [];
    const source = makePublicInstagramSource((input, init) => {
      requested.push(new URL(input.toString()));
      expect(init?.redirect).toBe("manual");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html" } })
      );
    });
    const post = await Effect.runPromise(source.find(location));
    expect(requested.map((url) => url.href)).toEqual([
      "https://www.instagram.com/reel/ABC/",
      "https://www.instagram.com/p/ABC/embed/captioned/",
    ]);
    expect(post.username).toBe("alice");
  });

  test("follows only bounded Instagram HTTPS redirects", async () => {
    const requested: string[] = [];
    const source = makePublicInstagramSource((input) => {
      const url = input.toString();
      requested.push(url);
      if (url === "https://www.instagram.com/reel/ABC/") {
        return Promise.resolve(
          new Response(null, {
            headers: { location: "https://instagram.com/reel/ABC/" },
            status: 302,
          })
        );
      }
      return Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html" } })
      );
    });
    await Effect.runPromise(source.find(location));
    expect(requested.slice(0, 2)).toEqual([
      "https://www.instagram.com/reel/ABC/",
      "https://instagram.com/reel/ABC/",
    ]);

    const unsafe = makePublicInstagramSource(() =>
      Promise.resolve(
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
    const source = makePublicInstagramSource((input) =>
      Promise.resolve(
        new Response(input.toString().includes("/embed/") ? embed : html, {
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
    const notFound = makePublicInstagramSource(() =>
      Promise.resolve(new Response("", { status: 404 }))
    );
    const limited = makePublicInstagramSource(() =>
      Promise.resolve(
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
    const invalid = makePublicInstagramSource(() =>
      Promise.resolve(
        new Response("{}", { headers: { "content-type": "application/json" } })
      )
    );
    const oversized = makePublicInstagramSource(() =>
      Promise.resolve(
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
