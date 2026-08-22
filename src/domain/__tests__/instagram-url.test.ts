// oxlint-disable vitest/prefer-importing-vitest-globals
import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { instagramLocationPath, parseInstagramUrl } from "../instagram-url.ts";

const parse = (value: string) => Effect.runSync(parseInstagramUrl(value));

describe("Instagram URL parsing", () => {
  test("normalizes supported route shapes", () => {
    expect(parse("https://www.instagram.com/p/ABC_123/")).toEqual({
      kind: "post",
      mediaIndex: 0,
      shortcode: "ABC_123",
    });
    expect(parse("https://instagram.com/alice/reels/ABC")).toEqual({
      kind: "reel",
      mediaIndex: 0,
      shortcode: "ABC",
      username: "alice",
    });
    expect(
      parse("https://instagram.com/stories/alice/123?img_index=2")
    ).toEqual({
      kind: "story",
      mediaIndex: 2,
      shortcode: "123",
      username: "alice",
    });
  });

  test("rejects hosts, paths, and indices with typed errors", () => {
    expect(
      Effect.runSync(
        Effect.result(parseInstagramUrl("https://example.com/p/ABC"))
      )
    ).toMatchObject({ _tag: "Failure", failure: { _tag: "UnsupportedHost" } });
    expect(
      Effect.runSync(
        Effect.result(parseInstagramUrl("https://instagram.com/images/ABC"))
      )
    ).toMatchObject({ _tag: "Failure", failure: { _tag: "UnsupportedPath" } });
    expect(
      Effect.runSync(
        Effect.result(
          parseInstagramUrl("https://instagram.com/p/ABC?img_index=-1")
        )
      )
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "InvalidMediaIndex" },
    });
  });

  test("renders canonical paths", () => {
    expect(
      instagramLocationPath(parse("https://instagram.com/alice/p/ABC"))
    ).toBe("/alice/p/ABC");
  });
});
