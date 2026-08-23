import type { EmbedDocument } from "@/application/embed.ts";

const escapeHtml = (value: string): string =>
  value.replaceAll(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&": {
        return "&amp;";
      }
      case "<": {
        return "&lt;";
      }
      case ">": {
        return "&gt;";
      }
      case '"': {
        return "&quot;";
      }
      case "'": {
        return "&#39;";
      }
      default: {
        return character;
      }
    }
  });

const meta = (name: string, content: string): string =>
  `<meta property="${escapeHtml(name)}" content="${escapeHtml(content)}">`;

const namedMeta = (name: string, content: string): string =>
  `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;

export const renderIndexDocument = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#09090b">
    <title>FX Instagram | Better link previews</title>
    ${namedMeta("description", "FX Instagram turns supported Instagram URLs into useful previews for Discord and other chat clients.")}
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100dvh; background: #09090b; color: #f4f4f5; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; left: -9999px; top: 1rem; background: #bef264; color: #09090b; padding: .5rem 1rem; font-weight: 600; }
      .skip-link:focus { left: 1rem; z-index: 1; }
      main { max-width: 64rem; margin: 0; padding: 2rem 1.75rem; }
      h1 { margin: 0; color: #fff; font-size: 3rem; font-weight: 900; letter-spacing: -.07em; line-height: 1; }
      h2 { margin: 0; color: #fff; font-size: 1.5rem; font-weight: 700; letter-spacing: -.025em; }
      .intro { margin: 1.25rem 0 0; color: #f4f4f5; font-size: 1.125rem; font-weight: 700; line-height: 1.75rem; }
      section { margin-top: 1.75rem; }
      ul { margin: .75rem 0 0; padding-left: 1.75rem; color: #d4d4d8; font-size: 1rem; line-height: 1.5rem; }
      li + li { margin-top: .125rem; }
      .copy { margin-top: .75rem; color: #d4d4d8; font-size: 1rem; line-height: 1.5rem; }
      .copy p { margin: .125rem 0; }
      code { color: #f4f4f5; font-family: ui-monospace, monospace; font-size: .875rem; }
      a { color: #bef264; text-decoration: underline; text-decoration-color: rgb(190 242 100 / 50%); text-underline-offset: 2px; }
      a:hover { color: #d9f99d; }
      a:focus-visible { outline: 2px solid #bef264; outline-offset: 2px; }
      footer { margin-top: 2rem; border-top: 1px solid #27272a; padding-top: 1rem; color: #a1a1aa; font-size: .875rem; line-height: 1.5rem; }
      @media (min-width: 640px) {
        main { padding: 2.5rem 2.5rem; }
        h1 { font-size: 3.75rem; }
        .intro { font-size: 1.25rem; }
      }
      @media (min-width: 1024px) {
        main { padding: 3rem 3.5rem; }
        h1 { font-size: 4.5rem; }
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <main id="main-content">
      <header>
        <h1>FXInstagram</h1>
        <p class="intro">A better way to embed Instagram posts on Discord, Telegram, and more.</p>
      </header>
      <section aria-labelledby="features-title">
        <h2 id="features-title">Features <span aria-hidden="true">🌟</span></h2>
        <ul>
          <li>Displays likes and comments count</li>
          <li>Natively embeds images and videos</li>
          <li>Removes tracking on redirects</li>
          <li>Displays user verification status</li>
        </ul>
      </section>
      <section aria-labelledby="usage-title">
        <h2 id="usage-title">Usage:</h2>
        <div class="copy">
          <p>Replace <code>https://instagram.com</code> with <code>https://ig.mynameistito.com</code> and keep the path.</p>
          <p>FXInstagram is a free project that provides a better way to embed Instagram posts on Discord, Telegram, and more.</p>
          <p>Built by the community. You can support the project at <a href="https://buymeacoffee.com/mynameistito">Buy Me a Coffee</a>.</p>
        </div>
      </section>
      <section aria-labelledby="links-title">
        <h2 id="links-title">Learn more:</h2>
        <ul>
          <li><a href="https://github.com/mynameistito/fxinstagram">Source code</a></li>
          <li><a href="https://github.com/mynameistito/fxinstagram/blob/main/README.md">Documentation</a></li>
        </ul>
      </section>
      <footer>
        <p>This is a community-built open-source project. It is not endorsed by, sponsored by, or affiliated with Meta or its subsidiaries, including Instagram.</p>
      </footer>
    </main>
  </body>
</html>`;

export const renderDocument = (document: EmbedDocument): string => {
  const tags = [
    meta("og:title", document.title),
    meta("og:description", document.description),
    meta("og:url", document.canonicalUrl.toString()),
    meta("og:site_name", document.footerText ?? "fxinstagram"),
    meta(
      "og:type",
      document.videoUrl === undefined ? "website" : "video.other"
    ),
    meta("twitter:card", document.card),
    document.authorName === undefined
      ? ""
      : namedMeta("author", document.authorName),
    document.authorName === undefined
      ? ""
      : meta("profile:username", document.authorName),
    document.authorUrl === undefined
      ? ""
      : meta("article:author", document.authorUrl.toString()),
    document.authorName === undefined
      ? ""
      : meta("twitter:creator", `@${document.authorName}`),
    document.authorIconUrl === undefined
      ? ""
      : meta("profile:image", document.authorIconUrl.toString()),
    document.imageUrl === undefined
      ? ""
      : meta("og:image", document.imageUrl.toString()),
    document.videoUrl === undefined
      ? ""
      : [
          meta("og:video", document.videoUrl.toString()),
          meta("og:video:secure_url", document.videoUrl.toString()),
          meta("og:video:type", "video/mp4"),
          meta("twitter:player:stream", document.videoUrl.toString()),
          meta("twitter:player:stream:content_type", "video/mp4"),
        ].join(""),
    document.oEmbedUrl === undefined
      ? ""
      : `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(document.oEmbedUrl.toString())}">`,
  ].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title>${tags}</head><body></body></html>`;
};

export const htmlResponse = (
  document: EmbedDocument,
  // oxlint-disable-next-line sonarjs/max-union-size -- HTTP status is intentionally explicit.
  status: 200 | 404 | 422 | 429 | 503
): Response => {
  const body = renderDocument(document);
  if (body.length > 16_384) {
    return new Response("embed response too large", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 422,
    });
  }
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
};

export const indexResponse = (): Response =>
  new Response(renderIndexDocument(), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });
