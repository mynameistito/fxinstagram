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

const indexStyles = `
  :root {
    color-scheme: light;
    --ink: #17201f;
    --muted: #53615e;
    --line: #d8e1de;
    --paper: #f7faf8;
    --surface: #ffffff;
    --accent: #007f72;
    --accent-dark: #005d54;
    --max-width: 1100px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
  }
  a { color: var(--accent-dark); }
  a:focus-visible, .button:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
  }
  .skip-link {
    position: absolute;
    left: 1rem;
    top: -5rem;
    z-index: 2;
    padding: .65rem .9rem;
    border-radius: .5rem;
    background: var(--ink);
    color: #fff;
  }
  .skip-link:focus { top: 1rem; }
  .shell { width: min(calc(100% - 2rem), var(--max-width)); margin: 0 auto; }
  header { border-bottom: 1px solid var(--line); background: var(--surface); }
  .nav { display: flex; align-items: center; justify-content: space-between; min-height: 4.5rem; gap: 1rem; }
  .brand { color: var(--ink); font-size: 1.05rem; font-weight: 750; letter-spacing: -.02em; text-decoration: none; }
  nav { display: flex; gap: 1.2rem; font-size: .92rem; }
  nav a { color: var(--muted); text-decoration: none; }
  nav a:hover { color: var(--accent-dark); text-decoration: underline; text-underline-offset: .2em; }
  main { overflow: hidden; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(15rem, .75fr); gap: clamp(2rem, 7vw, 6rem); align-items: end; padding: clamp(4rem, 10vw, 8rem) 0 clamp(4.5rem, 10vw, 8rem); }
  .eyebrow { margin: 0 0 1rem; color: var(--accent-dark); font-size: .78rem; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  h1, h2, p { margin-top: 0; }
  h1 { max-width: 10ch; margin-bottom: 1.5rem; font-size: clamp(3.2rem, 8vw, 6.7rem); letter-spacing: -.075em; line-height: .95; }
  .lede { max-width: 38rem; margin-bottom: 2rem; color: var(--muted); font-size: clamp(1.08rem, 2vw, 1.32rem); line-height: 1.55; }
  .actions { display: flex; flex-wrap: wrap; gap: .8rem; align-items: center; }
  .button { display: inline-flex; align-items: center; justify-content: center; min-height: 2.8rem; padding: .65rem 1rem; border: 1px solid var(--accent-dark); border-radius: .5rem; font-weight: 700; text-decoration: none; }
  .button.primary { background: var(--accent-dark); color: #fff; }
  .button.primary:hover { background: #004b44; }
  .button.secondary { background: var(--surface); color: var(--accent-dark); }
  .button.secondary:hover { background: #edf5f2; }
  .hero-note { padding: 1.4rem 0 0 1.4rem; border-left: 3px solid var(--accent); color: var(--muted); }
  .hero-note strong { display: block; margin-bottom: .45rem; color: var(--ink); font-size: 1.05rem; }
  .section { padding: clamp(3.8rem, 8vw, 6.5rem) 0; border-top: 1px solid var(--line); }
  .section-heading { max-width: 35rem; margin-bottom: 2.8rem; }
  h2 { margin-bottom: .7rem; font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -.05em; line-height: 1.05; }
  .section-heading p, .step p { color: var(--muted); }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
  .step { padding-top: 1rem; border-top: 2px solid var(--ink); }
  .step-number { display: block; margin-bottom: 1rem; color: var(--accent-dark); font-size: .82rem; font-weight: 750; letter-spacing: .1em; }
  .step h3 { margin-bottom: .55rem; font-size: 1.15rem; }
  .example { display: inline-block; margin-top: .35rem; padding: .6rem .75rem; border: 1px solid var(--line); border-radius: .5rem; background: var(--surface); color: var(--ink); font: .88rem/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(2rem, 8vw, 7rem); align-items: start; }
  .split p { color: var(--muted); }
  footer { padding: 2rem 0 3rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .92rem; }
  footer .footer-row { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  @media (max-width: 700px) {
    .nav { align-items: flex-start; flex-direction: column; justify-content: center; padding: .9rem 0; }
    nav { gap: .9rem; }
    .hero, .split { grid-template-columns: 1fr; }
    .hero { padding-top: 4.5rem; }
    h1 { max-width: 8ch; }
    .hero-note { max-width: 32rem; }
    .steps { grid-template-columns: 1fr; gap: 2.4rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
`;

export const renderIndexDocument = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>fxinstagram | Better Instagram previews</title>
    ${namedMeta("description", "A small URL rewriting service that gives Instagram links useful previews in Discord and other clients.")}
    <style>${indexStyles}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header>
      <div class="shell nav">
        <a class="brand" href="/" aria-label="fxinstagram home">fxinstagram</a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="https://github.com/mynameistito/fxinstagram">Source code</a>
        </nav>
      </div>
    </header>
    <main id="main-content">
      <section class="shell hero" aria-labelledby="hero-title">
        <div>
          <p class="eyebrow">Open source URL rewriting</p>
          <h1 id="hero-title">Instagram links, properly previewed.</h1>
          <p class="lede">fxinstagram turns supported Instagram URLs into server-rendered metadata that chat apps can understand.</p>
          <div class="actions">
            <a class="button primary" href="#how-it-works">See how to use it</a>
            <a class="button secondary" href="https://buymeacoffee.com/mynameistito">Buy me a coffee</a>
          </div>
        </div>
        <aside class="hero-note" aria-label="Service summary">
          <strong>Made for the moment a link is shared.</strong>
          <span>Paste a supported Instagram URL into Discord or another client. Crawlers get useful metadata, while people continue to Instagram.</span>
        </aside>
      </section>
      <section class="section" id="how-it-works" aria-labelledby="how-title">
        <div class="shell">
          <div class="section-heading">
            <p class="eyebrow">How to use it</p>
            <h2 id="how-title">One small change to the link.</h2>
            <p>Use the fxinstagram hostname with the Instagram path you want to share.</p>
          </div>
          <div class="steps">
            <article class="step">
              <span class="step-number">01</span>
              <h3>Copy an Instagram URL</h3>
              <p>Posts, reels, IGTV, user-scoped posts, and stories are supported.</p>
            </article>
            <article class="step">
              <span class="step-number">02</span>
              <h3>Swap the hostname</h3>
              <p>Keep the path and query string. Replace only the Instagram hostname with this service.</p>
              <code class="example">ig.mynameistito.com/p/ABC</code>
            </article>
            <article class="step">
              <span class="step-number">03</span>
              <h3>Share the result</h3>
              <p>The receiving client can read the metadata and build a richer preview.</p>
            </article>
          </div>
        </div>
      </section>
      <section class="section" aria-labelledby="principles-title">
        <div class="shell split">
          <div class="section-heading">
            <p class="eyebrow">A focused service</p>
            <h2 id="principles-title">Useful previews, minimal machinery.</h2>
          </div>
          <div>
            <p>fxinstagram is not a Discord bot and is not affiliated with Instagram or Meta. It rewrites links and serves metadata for public Instagram content.</p>
            <p>Read the implementation, review the supported routes, or suggest an improvement in the <a href="https://github.com/mynameistito/fxinstagram">source repository</a>.</p>
          </div>
        </div>
      </section>
    </main>
    <footer>
      <div class="shell footer-row">
        <span>fxinstagram is open source and independently maintained.</span>
        <a href="https://buymeacoffee.com/mynameistito">Support the project</a>
      </div>
    </footer>
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
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });
