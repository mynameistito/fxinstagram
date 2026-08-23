// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { parseInstagramUrl } from "../../domain/instagram-url.ts";
import {
  parsePublicInstagramHtml,
  parsePublicInstagramVideo,
} from "../instagram/public-html.ts";

const location = Effect.runSync(
  parseInstagramUrl("https://instagram.com/reel/ABC")
);

describe("public Instagram HTML parser", () => {
  test("normalizes public Open Graph metadata", () => {
    const html = `<!doctype html><meta content="summary_large_image" name="twitter:card"><meta property="og:title" content="&#064;alice on Instagram"><meta content="A &amp; B" property="og:description"><meta property="og:image" content="https://scontent.fakl1-4.fna.fbcdn.net/image.jpg?a=1&amp;b=2"><meta property="og:url" content="https://www.instagram.com/alice/reel/ABC/"><script>"profile_pic_url_hd":"https:\\/\\/scontent.fakl1-4.fna.fbcdn.net\\/profile.jpg"</script>`;
    const post = Effect.runSync(parsePublicInstagramHtml(html, location));
    expect(post).toEqual({
      canonicalUrl: new URL("https://www.instagram.com/alice/reel/ABC/"),
      caption: "A & B",
      media: [
        {
          type: "image",
          url: new URL("https://scontent.cdninstagram.com/image.jpg?a=1&b=2"),
        },
      ],
      profilePictureUrl: new URL(
        "https://scontent.cdninstagram.com/profile.jpg"
      ),
      shortcode: "ABC",
      username: "alice",
    });
  });

  test("rejects documents without canonical media metadata", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        parsePublicInstagramHtml(
          '<meta property="og:title" content="Login">',
          location
        )
      )
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "ProviderResponseInvalid",
        provider: "instagram-public-html",
      },
    });
  });

  test("rejects image URLs outside Instagram's CDN", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        parsePublicInstagramHtml(
          '<meta property="og:title" content="@alice"><meta property="og:image" content="https://example.com/image.jpg"><meta property="og:url" content="https://instagram.com/reel/ABC/">',
          location
        )
      )
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "ProviderResponseInvalid" },
    });
  });

  test("extracts and normalizes nested embed video URLs", () => {
    const embed = String.raw`<script>"video_url":"https:\\/\\/instagram.fakl1-3.fna.fbcdn.net\\/video.mp4?x=1\u002526y\u00253D2"</script>`;
    expect(parsePublicInstagramVideo(embed)?.href).toBe(
      "https://scontent.cdninstagram.com/video.mp4?x=1%26y%3D2"
    );
    expect(parsePublicInstagramVideo("<html></html>")).toBeUndefined();
  });

  test("extracts canonical video version URLs", () => {
    const html = String.raw`<script>"video_versions":[{"type":101,"url":"https:\\/\\/instagram.fakl1-4.fna.fbcdn.net\\/o1\\/v\\/t2\\/video.mp4?x=1\u002526y\u00253D2"}]</script>`;
    expect(parsePublicInstagramVideo(html)?.href).toBe(
      "https://scontent.cdninstagram.com/o1/v/t2/video.mp4?x=1%26y%3D2"
    );
  });
});
