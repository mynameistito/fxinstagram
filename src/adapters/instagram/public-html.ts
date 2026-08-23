import { Effect } from "effect";

import type { InstagramLocation } from "@/domain/instagram-url.ts";
import type { InstagramPost, MetadataError } from "@/domain/media.ts";

const provider = "instagram-public-html";
const metaTag = /<meta\s+[^>]*>/giu;
const attribute =
  /(?<name>[:\w-]+)\s*=\s*(?<quote>["'])(?<value>.*?)\k<quote>/giu;
const escapedVideoUrl = /\\"video_url\\":\\"(?<value>(?:\\\\.|[^"\\])*)\\"/u;
const plainVideoUrl = /"video_url"\s*:\s*"(?<value>(?:\\.|[^"\\])*)"/u;
const videoVersionsUrl =
  /"video_versions"\s*:\s*\[\s*\{\s*"type"\s*:\s*\d+\s*,\s*"url"\s*:\s*"(?<value>(?:\\.|[^"\\])*)"/u;
const mediaHostSuffixes = [".cdninstagram.com", ".fbcdn.net"] as const;
const normalizedMediaHost = "scontent.cdninstagram.com";
const profilePictureUrl =
  /"profile_pic_url(?:_hd)?"\s*:\s*"(?<value>(?:\\.|[^"\\])*)"/u;

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

const normalizeMediaUrl = (url: URL): URL | undefined => {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname !== "cdninstagram.com" &&
    hostname !== "fbcdn.net" &&
    !mediaHostSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    return undefined;
  }
  const normalized = new URL(url);
  normalized.hostname = normalizedMediaHost;
  return normalized;
};

const decodeNestedJsonString = (
  value: string | undefined
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  let decoded = value;
  for (let depth = 0; depth < 2 && decoded.includes("\\"); depth += 1) {
    try {
      decoded = JSON.parse(`"${decoded}"`);
    } catch {
      return undefined;
    }
  }
  return decoded;
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

const profilePictureFrom = (html: string): URL | undefined => {
  const value = profilePictureUrl.exec(html)?.groups?.value;
  const rawUrl = safeUrl(decodeNestedJsonString(value));
  return rawUrl === undefined ? undefined : normalizeMediaUrl(rawUrl);
};

/** Parse Instagram's public Open Graph document into normalized metadata. */
export const parsePublicInstagramHtml = (
  html: string,
  location: InstagramLocation
): Effect.Effect<InstagramPost, MetadataError> => {
  const values = metadata(html);
  const canonicalUrl = safeUrl(values.get("og:url"));
  const rawImageUrl = safeUrl(
    values.get("og:image") ?? values.get("twitter:image")
  );
  const imageUrl =
    rawImageUrl === undefined ? undefined : normalizeMediaUrl(rawImageUrl);
  if (canonicalUrl === undefined || imageUrl === undefined) {
    return Effect.fail({ _tag: "ProviderResponseInvalid", provider });
  }
  const title = values.get("og:title") ?? values.get("twitter:title") ?? "";
  const profilePicture = profilePictureFrom(html);
  const post: InstagramPost = {
    canonicalUrl,
    caption: values.get("og:description") ?? values.get("description") ?? "",
    media: [{ type: "image", url: imageUrl }],
    shortcode: location.shortcode,
    username: usernameFrom(canonicalUrl, title),
  };
  return Effect.succeed(
    profilePicture === undefined
      ? post
      : { ...post, profilePictureUrl: profilePicture }
  );
};

/** Extract and normalize a direct video URL from Instagram's embed document. */
export const parsePublicInstagramVideo = (html: string): URL | undefined => {
  const match =
    videoVersionsUrl.exec(html) ??
    escapedVideoUrl.exec(html) ??
    plainVideoUrl.exec(html);
  const value = match?.groups?.value;
  if (value === undefined) {
    return undefined;
  }
  const rawUrl = safeUrl(decodeNestedJsonString(value));
  if (rawUrl === undefined) {
    return undefined;
  }
  return normalizeMediaUrl(rawUrl);
};
