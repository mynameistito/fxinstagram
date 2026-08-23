import { Effect } from "effect";

import type { InstagramLocation } from "../../domain/instagram-url.ts";
import { instagramLocationPath } from "../../domain/instagram-url.ts";
import type {
  InstagramMetadataSource,
  MetadataError,
} from "../../domain/media.ts";
import {
  parsePublicInstagramHtml,
  parsePublicInstagramVideo,
} from "./public-html.ts";

const maxResponseBytes = 1_048_576;
const provider = "instagram-public-html";
const upstreamOrigin = "https://www.instagram.com";
const upstreamHosts = new Set(["instagram.com", "www.instagram.com"]);
const maxRedirects = 3;

/** Minimal outbound HTTP capability owned by the Instagram adapter. */
export type InstagramFetch = (
  input: Request | string | URL,
  init?: RequestInit
) => Promise<Response>;

const requestUrl = (location: InstagramLocation): URL =>
  new URL(`${instagramLocationPath(location)}/`, upstreamOrigin);

const embedUrl = (location: InstagramLocation): URL =>
  new URL(`/p/${location.shortcode}/embed/captioned/`, upstreamOrigin);

const retryAfterMs = (response: Response): number | undefined => {
  const value = response.headers.get("retry-after");
  if (value === null || !/^\d+$/u.test(value)) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds * 1000 : undefined;
};

const readBoundedText = async (response: Response): Promise<string> => {
  if (response.body === null) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      // oxlint-disable-next-line no-await-in-loop -- A response stream must be consumed sequentially while enforcing its cumulative size.
      const chunk = await reader.read();
      if (chunk.done) {
        return result + decoder.decode();
      }
      bytes += chunk.value.byteLength;
      if (bytes > maxResponseBytes) {
        throw new Error("Instagram response exceeded the size limit");
      }
      result += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

const fetchWithSafeRedirects = async (
  fetcher: InstagramFetch,
  initialUrl: URL,
  signal: AbortSignal
): Promise<Response> => {
  let url = initialUrl;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Redirect targets must be checked before the next sequential request.
    const response = await fetcher(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; fxinstagram/1.0)",
      },
      redirect: "manual",
      signal,
    });
    if (response.status < 300 || response.status >= 400) {
      return response;
    }
    const location = response.headers.get("location");
    if (location === null || redirects === maxRedirects) {
      throw new Error("Instagram redirect could not be followed safely");
    }
    const target = new URL(location, url);
    if (
      target.protocol !== "https:" ||
      !upstreamHosts.has(target.hostname.toLowerCase()) ||
      target.username !== "" ||
      target.password !== ""
    ) {
      throw new Error("Instagram returned an unsafe redirect target");
    }
    url = target;
  }
  throw new Error("Instagram redirect limit exceeded");
};

const responseBody = (
  response: Response,
  location: InstagramLocation
): Effect.Effect<string, MetadataError> => {
  if (response.status === 404) {
    return Effect.fail({
      _tag: "MetadataNotFound",
      shortcode: location.shortcode,
    });
  }
  if (response.status === 429) {
    const retryAfter = retryAfterMs(response);
    if (retryAfter === undefined) {
      return Effect.fail({
        _tag: "ProviderRateLimited",
        provider,
      });
    }
    return Effect.fail({
      _tag: "ProviderRateLimited",
      provider,
      retryAfterMs: retryAfter,
    });
  }
  if (!response.ok) {
    return Effect.fail({
      _tag: "ProviderUnavailable",
      cause: `upstream status ${response.status}`,
      provider,
    });
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html")) {
    return Effect.fail({ _tag: "ProviderResponseInvalid", provider });
  }
  return Effect.tryPromise({
    catch: (cause): MetadataError => ({
      _tag: "ProviderUnavailable",
      cause,
      provider,
    }),
    try: () => readBoundedText(response),
  });
};

const fetchPage = (
  fetcher: InstagramFetch,
  url: URL,
  location: InstagramLocation
): Effect.Effect<string, MetadataError> =>
  Effect.tryPromise({
    catch: (cause): MetadataError => ({
      _tag: "ProviderUnavailable",
      cause,
      provider,
    }),
    try: (signal) => fetchWithSafeRedirects(fetcher, url, signal),
  }).pipe(Effect.flatMap((response) => responseBody(response, location)));

/** Create the live, credential-free Instagram public HTML metadata adapter. */
export const makePublicInstagramSource = (
  fetcher: InstagramFetch = globalThis.fetch
): InstagramMetadataSource => ({
  find: (location) =>
    Effect.gen(function* findPublicInstagramMetadata() {
      const html = yield* fetchPage(fetcher, requestUrl(location), location);
      const post = yield* parsePublicInstagramHtml(html, location);
      const embed = yield* Effect.result(
        fetchPage(fetcher, embedUrl(location), location)
      );
      if (embed._tag === "Failure") {
        return post;
      }
      const videoUrl = parsePublicInstagramVideo(embed.success);
      return videoUrl === undefined
        ? post
        : { ...post, media: [{ type: "video", url: videoUrl }] };
    }),
});
