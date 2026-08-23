import type { EmbedDocument } from "../application/embed.ts";

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
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  </head>
  <body class="min-h-[100dvh] bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-lime-300 selection:text-zinc-950">
    <a class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-lime-300 focus:px-4 focus:py-2 focus:font-semibold focus:text-zinc-950" href="#main-content">Skip to content</a>
    <main id="main-content" class="mx-0 max-w-5xl px-7 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
      <header>
        <h1 class="text-5xl font-black tracking-[-0.07em] text-white sm:text-6xl lg:text-7xl">FXInstagram</h1>
        <p class="mt-5 text-lg font-bold leading-7 text-zinc-100 sm:text-xl">Server-rendered Instagram previews for Discord and other chat clients.</p>
      </header>
      <section class="mt-7" aria-labelledby="features-title">
        <h2 id="features-title" class="text-2xl font-bold tracking-tight text-white">Features <span aria-hidden="true">🌟</span></h2>
        <ul class="mt-3 list-disc space-y-0.5 pl-7 text-base leading-6 text-zinc-300">
          <li>Embeds images and videos</li>
        </ul>
      </section>
      <section class="mt-7" aria-labelledby="usage-title">
        <h2 id="usage-title" class="text-2xl font-bold tracking-tight text-white">Usage:</h2>
        <div class="mt-3 space-y-0.5 text-base leading-6 text-zinc-300">
          <p>Replace <code class="font-mono text-sm text-zinc-100">https://instagram.com</code> with <code class="font-mono text-sm text-lime-300">https://ig.mynameistito.com</code> and keep the path.</p>
          <p>FXInstagram is a free project that provides server-rendered previews for Discord and other chat clients.</p>
          <p>Built by the community. You can support the project at <a class="text-lime-300 underline decoration-lime-300/50 underline-offset-2 hover:text-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300" href="https://buymeacoffee.com/mynameistito">Buy Me a Coffee</a>.</p>
        </div>
      </section>
      <section class="mt-7" aria-labelledby="links-title">
        <h2 id="links-title" class="text-2xl font-bold tracking-tight text-white">Learn more:</h2>
        <ul class="mt-3 list-disc space-y-0.5 pl-7 text-base leading-6 text-zinc-300">
          <li><a class="text-lime-300 underline decoration-lime-300/50 underline-offset-2 hover:text-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300" href="https://github.com/mynameistito/fxinstagram">Source code</a></li>
          <li><a class="text-lime-300 underline decoration-lime-300/50 underline-offset-2 hover:text-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300" href="https://github.com/mynameistito/fxinstagram/blob/main/README.md">Documentation</a></li>
        </ul>
      </section>
      <footer class="mt-8 border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">
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
        "default-src 'none'; script-src https://cdn.tailwindcss.com; style-src 'unsafe-inline'; base-uri 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });
