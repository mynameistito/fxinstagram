import { Effect } from "effect";

import { selectMedia } from "../domain/embed-policy.ts";
import type { EmbedRequest } from "../domain/embed-request.ts";
import type { MediaSelection, MetadataError } from "../domain/media.ts";
import type { CacheError } from "./cache.ts";
import { MetadataServiceTag } from "./metadata.ts";

// oxlint-disable-next-line sonarjs/max-union-size -- This is the public projection contract.
export type EmbedResponse =
  | { readonly _tag: "Redirect"; readonly location: URL }
  | {
      readonly _tag: "Html";
      // oxlint-disable-next-line sonarjs/max-union-size -- HTTP status is intentionally explicit.
      readonly status: 200 | 404 | 422 | 429 | 503;
      readonly document: EmbedDocument;
    }
  | { readonly _tag: "MediaRedirect"; readonly location: URL };

export interface EmbedDocument {
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl: URL;
  readonly card: "summary_large_image" | "player";
  readonly authorName?: string;
  readonly authorUrl?: URL;
  readonly authorIconUrl?: URL;
  readonly footerText?: string;
  readonly imageUrl?: URL;
  readonly videoUrl?: URL;
  readonly oEmbedUrl?: URL;
}

export interface EmbedServiceConfig {
  readonly origin: URL;
  readonly mediaHosts: ReadonlySet<string>;
}

export type EmbedApplicationError =
  | MetadataError
  | CacheError
  | { readonly _tag: "MediaMissing" }
  | { readonly _tag: "MediaIndexOutOfRange"; readonly index: number }
  | { readonly _tag: "UnsafeMediaUrl" };

export interface EmbedService {
  readonly resolve: (
    request: EmbedRequest
  ) => Effect.Effect<EmbedResponse, EmbedApplicationError>;
  readonly resolveMedia: (
    request: EmbedRequest
  ) => Effect.Effect<
    { readonly type: "image" | "video"; readonly url: URL },
    EmbedApplicationError
  >;
}

const description = (caption: string, gallery: boolean): string =>
  gallery ? "" : caption.slice(0, 255);

const localUrl = (
  config: EmbedServiceConfig,
  path: string,
  params?: Readonly<Record<string, string>>
): URL => {
  const url = new URL(path, config.origin);
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
};

const maxMediaUrlLength = 2048;

const isSafeMediaUrl = (url: URL, hosts: ReadonlySet<string>): boolean => {
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return false;
  }
  return (
    url.toString().length <= maxMediaUrlLength &&
    hosts.has(url.hostname.toLowerCase())
  );
};

const canonicalHosts = new Set(["instagram.com", "www.instagram.com"]);

const isSafeCanonicalUrl = (url: URL): boolean =>
  url.protocol === "https:" &&
  canonicalHosts.has(url.hostname) &&
  url.username === "" &&
  url.password === "";

const selectedUrl = (selection: MediaSelection): URL | undefined => {
  if (selection._tag === "gallery") {
    return undefined;
  }
  return selection.media.url;
};

const hasSafeMedia = (
  media: readonly { readonly url: URL }[],
  hosts: ReadonlySet<string>
): boolean => media.every((item) => isSafeMediaUrl(item.url, hosts));

const authorUrl = (username: string): URL =>
  new URL(`/${encodeURIComponent(username)}`, "https://instagram.com");

export const makeEmbedService = (
  config: EmbedServiceConfig
): Effect.Effect<EmbedService, never, MetadataServiceTag> =>
  Effect.gen(function* buildEmbedService() {
    const metadata = yield* MetadataServiceTag;
    const resolve = (request: EmbedRequest) =>
      // oxlint-disable-next-line sonarjs/no-nested-functions -- Effect requires the scoped operation body.
      Effect.gen(function* resolveEmbed() {
        const post = yield* metadata.get(request.location);
        if (!isSafeCanonicalUrl(post.canonicalUrl)) {
          return yield* Effect.fail({ _tag: "UnsafeMediaUrl" } as const);
        }
        if (!hasSafeMedia(post.media, config.mediaHosts)) {
          return yield* Effect.fail({ _tag: "UnsafeMediaUrl" } as const);
        }
        const selection = yield* selectMedia(request, post.media);
        const profilePicture =
          post.profilePictureUrl !== undefined &&
          isSafeMediaUrl(post.profilePictureUrl, config.mediaHosts)
            ? post.profilePictureUrl
            : undefined;
        const attribution = {
          authorName: post.username,
          authorUrl: authorUrl(post.username),
          footerText: "fxinstagram",
        } as const;
        const attributionWithIcon =
          profilePicture === undefined
            ? attribution
            : { ...attribution, authorIconUrl: profilePicture };
        const index = String(request.location.mediaIndex);
        const mediaUrl = selectedUrl(selection);
        if (
          mediaUrl !== undefined &&
          !isSafeMediaUrl(mediaUrl, config.mediaHosts)
        ) {
          return yield* Effect.fail({ _tag: "UnsafeMediaUrl" } as const);
        }
        if (request.mode === "direct") {
          return {
            _tag: "MediaRedirect",
            location: localUrl(
              config,
              `/${selection._tag === "image" ? "images" : "videos"}/${post.shortcode}/${index}`
            ),
          } as const;
        }
        if (selection._tag === "gallery") {
          const [first] = selection.items;
          const imageUrl = first?.type === "image" ? first.url : undefined;
          const document: EmbedDocument = {
            ...attributionWithIcon,
            canonicalUrl: post.canonicalUrl,
            card: "summary_large_image",
            description: description(post.caption, true),
            oEmbedUrl: localUrl(config, "/oembed", {
              url: post.canonicalUrl.toString(),
            }),
            title: `${post.username} on Instagram`,
          };
          if (imageUrl !== undefined) {
            return {
              _tag: "Html",
              document: { ...document, imageUrl },
              status: 200,
            } as const;
          }
          return {
            _tag: "Html",
            document,
            status: 200,
          } as const;
        }
        const { media } = selection;
        const document: EmbedDocument = {
          ...attributionWithIcon,
          canonicalUrl: post.canonicalUrl,
          card: media.type === "video" ? "player" : "summary_large_image",
          description: description(post.caption, false),
          oEmbedUrl: localUrl(config, "/oembed", {
            url: post.canonicalUrl.toString(),
          }),
          title: `${post.username} on Instagram`,
        };
        if (media.type === "image") {
          return {
            _tag: "Html",
            document: { ...document, imageUrl: media.url },
            status: 200,
          } as const;
        }
        const videoDocument =
          media.posterUrl === undefined
            ? { ...document, videoUrl: media.url }
            : {
                ...document,
                imageUrl: media.posterUrl,
                videoUrl: media.url,
              };
        return {
          _tag: "Html",
          document: videoDocument,
          status: 200,
        } as const;
      });
    const resolveMedia = (request: EmbedRequest) =>
      Effect.gen(function* resolveMediaProjection() {
        const post = yield* metadata.get(request.location);
        if (!isSafeCanonicalUrl(post.canonicalUrl)) {
          return yield* Effect.fail({ _tag: "UnsafeMediaUrl" } as const);
        }
        const selection = yield* selectMedia(request, post.media);
        if (selection._tag === "gallery") {
          return yield* Effect.fail({ _tag: "MediaMissing" } as const);
        }
        if (!isSafeMediaUrl(selection.media.url, config.mediaHosts)) {
          return yield* Effect.fail({ _tag: "UnsafeMediaUrl" } as const);
        }
        return { type: selection._tag, url: selection.media.url };
      });
    return { resolve, resolveMedia };
  });

export const instagramRedirect = (location: URL): EmbedResponse => ({
  _tag: "Redirect",
  location,
});
