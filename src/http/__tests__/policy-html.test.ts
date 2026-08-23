import { describe, expect, test } from "bun:test";

import type { EmbedService } from "@/application/embed.ts";
import { renderDocument, renderIndexDocument } from "@/http/html.ts";
import { classifyUserAgent, statusForError } from "@/http/policy.ts";
import { makeRouter } from "@/http/router.ts";

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
      authorIconUrl: new URL("https://cdn.example/profile.jpg"),
      authorName: "alice",
      authorUrl: new URL("https://instagram.com/alice"),
      canonicalUrl: new URL("https://instagram.com/p/ABC?a=1&b=2"),
      card: "summary_large_image",
      description: "line <script>alert('x')</script> & \"quoted\"",
      footerText: "fxinstagram",
      imageUrl: new URL("https://cdn.example/image.jpg?a=1&b=2"),
      title: "<unsafe> & title",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('property="og:site_name" content="fxinstagram"');
    expect(html).toContain('name="author" content="alice"');
    expect(html).toContain('property="profile:username" content="alice"');
    expect(html).toContain(
      'property="article:author" content="https://instagram.com/alice"'
    );
    expect(html).toContain(
      'property="profile:image" content="https://cdn.example/profile.jpg"'
    );
  });

  test("renders direct MP4 metadata for playable cards", () => {
    const html = renderDocument({
      canonicalUrl: new URL("https://instagram.com/reel/ABC"),
      card: "player",
      description: "video",
      imageUrl: new URL("https://scontent.cdninstagram.com/poster.jpg"),
      title: "@alice",
      videoUrl: new URL("https://scontent.cdninstagram.com/video.mp4?a=1&b=2"),
    });
    expect(html).toContain('property="og:video:type" content="video/mp4"');
    expect(html).toContain(
      'property="og:image" content="https://scontent.cdninstagram.com/poster.jpg"'
    );
    expect(html).toContain(
      'property="twitter:player:stream" content="https://scontent.cdninstagram.com/video.mp4?a=1&amp;b=2"'
    );
    expect(html).toContain(
      'property="twitter:player:stream:content_type" content="video/mp4"'
    );
  });

  test("renders an accessible public index page with project links", () => {
    const html = renderIndexDocument();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('src="https://cdn.tailwindcss.com/3.4.17"');
    expect(html).toContain("bg-zinc-950");
    expect(html).toContain("FXInstagram");
    expect(html).toContain('href="https://buymeacoffee.com/mynameistito"');
    expect(html).toContain(
      'href="https://github.com/mynameistito/fxinstagram"'
    );
    expect(html).toContain('href="#main-content"');
    expect(html).not.toContain("—");
  });

  test("routes the exact root path to the public index page", async () => {
    // SAFETY: The root route returns before any EmbedService method is accessed.
    const router = makeRouter({} as EmbedService);
    const response = await router(new Request("https://example.com/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "script-src https://cdn.tailwindcss.com"
    );
    expect(await response.text()).toContain("Usage:");
  });
});
