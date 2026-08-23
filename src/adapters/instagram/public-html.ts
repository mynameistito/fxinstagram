import { Effect } from "effect";

import type { InstagramLocation } from "@/domain/instagram-url.ts";
import type {
  InstagramMedia,
  InstagramPost,
  MetadataError,
} from "@/domain/media.ts";

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

const positiveInteger = (value: string | undefined): number | undefined => {
  if (value === undefined || !/^\d+$/u.test(value)) {
    return undefined;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};

const imageMedia = (
  url: URL,
  width: number | undefined,
  height: number | undefined
): Extract<InstagramMedia, { readonly type: "image" }> => {
  const media = { type: "image" as const, url };
  if (width !== undefined) {
    return height === undefined
      ? { ...media, width }
      : { ...media, height, width };
  }
  return height === undefined ? media : { ...media, height };
};

const decodeHtml = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const metadata = (html: string): ReadonlyMap<string, readonly string[]> => {
  const values = new Map<string, string[]>();
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
    if (key !== undefined && content !== undefined) {
      const entries = values.get(key) ?? [];
      entries.push(content);
      values.set(key, entries);
    }
  }
  return values;
};

const metadataValue = (
  values: ReadonlyMap<string, readonly string[]>,
  key: string,
  index = 0
): string | undefined => values.get(key)?.[index] ?? values.get(key)?.[0];

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
  const canonicalUrl = safeUrl(metadataValue(values, "og:url"));
  const imageValues = values.get("og:image") ?? [
    metadataValue(values, "twitter:image"),
  ];
  const imageUrls = imageValues.flatMap((value, index) => {
    const rawUrl = safeUrl(value);
    const imageUrl =
      rawUrl === undefined ? undefined : normalizeMediaUrl(rawUrl);
    if (imageUrl === undefined) {
      return [];
    }
    return [
      imageMedia(
        imageUrl,
        positiveInteger(metadataValue(values, "og:image:width", index)),
        positiveInteger(metadataValue(values, "og:image:height", index))
      ),
    ];
  });
  if (canonicalUrl === undefined || imageUrls.length === 0) {
    return Effect.fail({ _tag: "ProviderResponseInvalid", provider });
  }
  const title =
    metadataValue(values, "og:title") ??
    metadataValue(values, "twitter:title") ??
    "";
  const profilePicture = profilePictureFrom(html);
  const post: InstagramPost = {
    canonicalUrl,
    caption:
      metadataValue(values, "og:description") ??
      metadataValue(values, "description") ??
      "",
    media: imageUrls,
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
