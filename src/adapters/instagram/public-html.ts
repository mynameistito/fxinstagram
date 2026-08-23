import { Effect } from "effect";

import type { InstagramLocation } from "../../domain/instagram-url.ts";
import type { InstagramPost, MetadataError } from "../../domain/media.ts";

const provider = "instagram-public-html";
const metaTag = /<meta\s+[^>]*>/giu;
const attribute =
  /(?<name>[:\w-]+)\s*=\s*(?<quote>["'])(?<value>.*?)\k<quote>/giu;

const decodeHtml = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const metadata = (html: string): ReadonlyMap<string, string> => {
  const values = new Map<string, string>();
  for (const tag of html.match(metaTag) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(attribute)) {
      const { name, value } = match.groups ?? {};
      if (name !== undefined && value !== undefined) {
        attributes.set(name.toLowerCase(), decodeHtml(value));
      }
    }
    const key = attributes.get("property") ?? attributes.get("name");
    const content = attributes.get("content");
    if (key !== undefined && content !== undefined && !values.has(key)) {
      values.set(key, content);
    }
  }
  return values;
};

const safeUrl = (value: string | undefined): URL | undefined => {
  if (value === undefined) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.username === "" &&
      url.password === ""
      ? url
      : undefined;
  } catch {
    return undefined;
  }
};

const usernameFrom = (canonicalUrl: URL, title: string): string => {
  const canonicalUsername = canonicalUrl.pathname
    .split("/")
    .find((part) => part !== "");
  if (
    canonicalUsername !== undefined &&
    !["p", "reel", "reels", "tv"].includes(canonicalUsername)
  ) {
    return canonicalUsername;
  }
  const titleUsername = /^@(?<username>[^\s]+)(?:\s|$)/u.exec(title)?.groups
    ?.username;
  return titleUsername ?? "instagram";
};

/** Parse Instagram's public Open Graph document into normalized metadata. */
export const parsePublicInstagramHtml = (
  html: string,
  location: InstagramLocation
): Effect.Effect<InstagramPost, MetadataError> => {
  const values = metadata(html);
  const canonicalUrl = safeUrl(values.get("og:url"));
  const imageUrl = safeUrl(
    values.get("og:image") ?? values.get("twitter:image")
  );
  if (canonicalUrl === undefined || imageUrl === undefined) {
    return Effect.fail({ _tag: "ProviderResponseInvalid", provider });
  }
  const title = values.get("og:title") ?? values.get("twitter:title") ?? "";
  return Effect.succeed({
    canonicalUrl,
    caption: values.get("og:description") ?? values.get("description") ?? "",
    media: [{ type: "image", url: imageUrl }],
    shortcode: location.shortcode,
    username: usernameFrom(canonicalUrl, title),
  });
};
