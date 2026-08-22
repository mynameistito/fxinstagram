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
      : meta("og:video", document.videoUrl.toString()),
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
): Response =>
  new Response(renderDocument(document), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Security-Policy": "default-src 'none'; base-uri 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
