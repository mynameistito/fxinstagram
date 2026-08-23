import { Effect } from "effect";

import type { InstagramLocation } from "../../domain/instagram-url.ts";
import { instagramLocationPath } from "../../domain/instagram-url.ts";
import type {
  InstagramMetadataSource,
  MetadataError,
} from "../../domain/media.ts";
import { parsePublicInstagramHtml } from "./public-html.ts";

const maxResponseBytes = 1_048_576;
const provider = "instagram-public-html";
const upstreamOrigin = "https://www.instagram.com";

/** Minimal outbound HTTP capability owned by the Instagram adapter. */
export type InstagramFetch = (
  input: Request | string | URL,
  init?: RequestInit
) => Promise<Response>;

const requestUrl = (location: InstagramLocation): URL =>
  new URL(`${instagramLocationPath(location)}/`, upstreamOrigin);

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

/** Create the live, credential-free Instagram public HTML metadata adapter. */
export const makePublicInstagramSource = (
  fetcher: InstagramFetch = globalThis.fetch
): InstagramMetadataSource => ({
  find: (location) =>
    Effect.tryPromise({
      catch: (cause): MetadataError => ({
        _tag: "ProviderUnavailable",
        cause,
        provider,
      }),
      try: (signal) =>
        fetcher(requestUrl(location), {
          headers: {
            Accept: "text/html",
            "User-Agent": "Mozilla/5.0 (compatible; fxinstagram/1.0)",
          },
          redirect: "error",
          signal,
        }),
    }).pipe(
      Effect.flatMap((response) => responseBody(response, location)),
      Effect.flatMap((html) => parsePublicInstagramHtml(html, location))
    ),
});
