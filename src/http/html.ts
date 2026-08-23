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
    <a class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-lime-300 focus:px-4 focus:py-2 focus:font-semibold focus:text-zinc-950" href="#main-content">Skip to content</a>
    <div class="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
      <header class="flex items-center justify-between border-b border-zinc-800 pb-4">
        <a class="font-mono text-sm font-bold tracking-tight text-white" href="/" aria-label="FX Instagram home"><span class="text-lime-300">./</span>fxinstagram</a>
        <nav class="flex items-center gap-4 text-xs font-medium text-zinc-400" aria-label="Primary navigation">
          <a class="transition-colors hover:text-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300" href="https://github.com/mynameistito/fxinstagram">Source</a>
          <a class="rounded-full border border-zinc-700 px-3 py-1.5 text-zinc-200 transition-colors hover:border-lime-300 hover:text-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300" href="https://buymeacoffee.com/mynameistito">Support</a>
        </nav>
      </header>
      <main id="main-content" class="flex flex-1 items-center py-8 lg:py-10">
        <div class="grid w-full gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-14">
          <section aria-labelledby="hero-title">
            <p class="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">Open source link utility</p>
            <h1 id="hero-title" class="max-w-3xl text-5xl font-black tracking-[-0.07em] text-white sm:text-7xl lg:text-[5.75rem] lg:leading-[0.9]">Better previews for Instagram links.</h1>
            <p class="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">FX Instagram turns supported Instagram URLs into server-rendered metadata that Discord and other chat clients can understand.</p>
            <div class="mt-7 flex flex-wrap gap-3">
              <a class="rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300" href="https://github.com/mynameistito/fxinstagram">View source code</a>
              <a class="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-lime-300 hover:text-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300" href="https://buymeacoffee.com/mynameistito">Buy me a coffee</a>
            </div>
          </section>
          <section class="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/20" aria-labelledby="usage-title">
            <div class="mb-5 flex items-center justify-between">
              <h2 id="usage-title" class="text-sm font-bold text-white">How to use it</h2>
              <span class="rounded-full bg-lime-300/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-300">3 steps</span>
            </div>
            <ol class="space-y-4">
              <li class="flex gap-3">
                <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs text-lime-300">1</span>
                <div><h3 class="text-sm font-semibold text-zinc-100">Copy an Instagram URL</h3><p class="mt-1 text-xs leading-5 text-zinc-500">Posts, reels, IGTV, user-scoped posts, and stories are supported.</p></div>
              </li>
              <li class="flex gap-3">
                <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs text-lime-300">2</span>
                <div><h3 class="text-sm font-semibold text-zinc-100">Replace the hostname</h3><p class="mt-1 text-xs leading-5 text-zinc-500">Keep the path and query string. Change only the hostname.</p></div>
              </li>
              <li class="flex gap-3">
                <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs text-lime-300">3</span>
                <div><h3 class="text-sm font-semibold text-zinc-100">Share the result</h3><p class="mt-1 text-xs leading-5 text-zinc-500">Chat clients can now build a richer preview.</p></div>
              </li>
            </ol>
            <div class="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-6">
              <div class="text-zinc-600"># replace only the host</div>
              <div><span class="text-zinc-500">instagram.com</span><span class="px-2 text-zinc-700">→</span><span class="text-lime-300">ig.mynameistito.com</span><span class="text-zinc-400">/p/ABC</span></div>
            </div>
          </section>
        </div>
      </main>
      <footer class="grid gap-4 border-t border-zinc-800 pt-4 text-xs text-zinc-500 sm:grid-cols-3">
        <div><span class="font-semibold text-zinc-300">What it does</span><p class="mt-1">Useful previews, minimal machinery.</p></div>
        <div><span class="font-semibold text-zinc-300">Independent project</span><p class="mt-1">Not endorsed by Meta or Instagram.</p></div>
        <div class="sm:text-right"><span class="font-semibold text-zinc-300">Built in the open</span><p class="mt-1"><a class="text-lime-300 hover:text-lime-200" href="https://github.com/mynameistito/fxinstagram">github.com/mynameistito/fxinstagram</a></p></div>
      </footer>
    </div>
  </body>
</html>`;

export const renderDocument = (document: EmbedDocument): string => {
  const tags = [
    meta("og:title", document.title),
    meta("og:description", document.description),
    meta("og:url", document.canonicalUrl.toString()),
    meta(
      "og:type",
      document.videoUrl === undefined ? "website" : "video.other"
    ),
    meta("twitter:card", document.card),
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
