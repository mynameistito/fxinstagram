import { describe, expect, test } from "bun:test";

import { renderDocument } from "../html.ts";
import { classifyUserAgent, statusForError } from "../policy.ts";

// oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
describe("HTTP policies and projection", () => {
  // oxlint-disable-next-line vitest/prefer-importing-vitest-globals -- Bun is the configured test runner.
  test("defaults unknown and empty agents to humans", () => {
    expect(classifyUserAgent("")).toBe("human");
    expect(classifyUserAgent("Mozilla/5.0")).toBe("human");
    expect(classifyUserAgent("Discordbot/2.0")).toBe("bot");
    expect(classifyUserAgent("Twitterbot")).toBe("bot");
  });

  test("maps typed failures without exposing causes", () => {
    expect(statusForError({ _tag: "MetadataNotFound", shortcode: "ABC" })).toBe(
      404
    );
    expect(
      statusForError({ _tag: "ProviderRateLimited", provider: "fixture-json" })
    ).toBe(429);
    expect(
      statusForError({
        _tag: "ProviderUnavailable",
        cause: "secret",
        provider: "fixture-json",
      })
    ).toBe(503);
  });

  test("escapes dynamic text and URL attributes", () => {
    const html = renderDocument({
      canonicalUrl: new URL("https://instagram.com/p/ABC?a=1&b=2"),
      card: "summary_large_image",
      description: "line <script>alert('x')</script> & \"quoted\"",
      imageUrl: new URL("https://cdn.example/image.jpg?a=1&b=2"),
      title: "<unsafe> & title",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).not.toContain("<script>");
  });
});
