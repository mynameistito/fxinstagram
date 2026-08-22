// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { selectMedia } from "../embed-policy.ts";
import { parseEmbedRequest } from "../embed-request.ts";
import type { InstagramLocation } from "../instagram-url.ts";
import type { InstagramMedia } from "../media.ts";

const location: InstagramLocation = {
  kind: "post",
  mediaIndex: 1,
  shortcode: "ABC",
};
const media: readonly InstagramMedia[] = [
  { type: "image", url: new URL("https://cdn.example/image.jpg") },
  { type: "video", url: new URL("https://cdn.example/video.mp4") },
];
const request = (input: {
  readonly query?: unknown;
  readonly headers?: unknown;
}) =>
  Effect.runSync(parseEmbedRequest(location, { ...input, userAgent: "test" }));

describe("embed request and media policy", () => {
  test("uses header, gallery, direct, then standard precedence", () => {
    expect(request({ query: { direct: "1" } }).mode).toBe("direct");
    expect(request({ query: { direct: "1", gallery: "1" } }).mode).toBe(
      "gallery"
    );
    expect(
      request({
        headers: { "X-Embed-Type": "standard" },
        query: { direct: "1" },
      }).mode
    ).toBe("standard");
  });

  test("selects mixed media and galleries without network access", () => {
    expect(Effect.runSync(selectMedia(request({}), media))).toMatchObject({
      _tag: "video",
    });
    expect(
      Effect.runSync(selectMedia(request({ query: { gallery: "1" } }), media))
    ).toMatchObject({ _tag: "gallery", items: media });
    expect(
      Effect.runSync(
        Effect.result(
          selectMedia(
            {
              location: { ...location, mediaIndex: 2 },
              mode: "standard",
              userAgent: "test",
            },
            media
          )
        )
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "MediaIndexOutOfRange" },
    });
  });

  test("reports empty media", () => {
    expect(
      Effect.runSync(Effect.result(selectMedia(request({}), [])))
    ).toMatchObject({ _tag: "Failure", failure: { _tag: "MediaMissing" } });
  });
});
