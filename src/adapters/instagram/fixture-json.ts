// oxlint-disable anti-slop/no-unsafe-dictionary-type, anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof, anti-slop/no-conditional-empty-object-spread
import { Effect, Layer } from "effect";

import { MetadataSourceService } from "@/application/metadata-ports.ts";
import type { InstagramLocation } from "@/domain/instagram-url.ts";
import type {
  InstagramMedia,
  InstagramPost,
  MetadataError,
  InstagramMetadataSource,
} from "@/domain/media.ts";

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMedia = (value: unknown): InstagramMedia | undefined => {
  if (!isRecord(value) || (value.type !== "image" && value.type !== "video")) {
    return undefined;
  }
  if (typeof value.url !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:" || url.toString().length > 2048) {
      return undefined;
    }
    return {
      type: value.type,
      url,
      ...(typeof value.width === "number" ? { width: value.width } : {}),
      ...(typeof value.height === "number" ? { height: value.height } : {}),
    };
  } catch {
    return undefined;
  }
};

const parsePost = (
  value: unknown,
  location: InstagramLocation
): InstagramPost | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value.username !== "string" || typeof value.caption !== "string") {
    return undefined;
  }
  if (typeof value.canonicalUrl !== "string" || !Array.isArray(value.media)) {
    return undefined;
  }
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(value.canonicalUrl);
  } catch {
    return undefined;
  }
  if (canonicalUrl.toString().length > 2048) {
    return undefined;
  }
  const media = value.media.map(parseMedia);
  if (media.some((item) => item === undefined)) {
    return undefined;
  }
  return {
    canonicalUrl,
    caption: value.caption,
    media: media.filter((item): item is InstagramMedia => item !== undefined),
    shortcode: location.shortcode,
    username: value.username,
    ...(typeof value.profilePictureUrl === "string"
      ? (() => {
          try {
            const profilePictureUrl = new URL(value.profilePictureUrl);
            return profilePictureUrl.protocol === "https:"
              ? { profilePictureUrl }
              : {};
          } catch {
            return {};
          }
        })()
      : {}),
  };
};

/** A credential-free provider adapter for versioned local JSON fixtures. */
export const makeFixtureJsonSource = (
  fixtures: ReadonlyMap<string, unknown>
): InstagramMetadataSource => ({
  find: (location) => {
    const fixture = fixtures.get(location.shortcode);
    if (fixture === undefined) {
      return Effect.fail({
        _tag: "MetadataNotFound",
        shortcode: location.shortcode,
      });
    }
    const post = parsePost(fixture, location);
    return post === undefined
      ? Effect.fail<MetadataError>({
          _tag: "ProviderResponseInvalid",
          provider: "fixture-json",
        })
      : Effect.succeed(post);
  },
});

/** Provide a fixture source as an Effect Layer. */
export const layerFixtureJson = (fixtures: ReadonlyMap<string, unknown>) =>
  Layer.succeed(MetadataSourceService, makeFixtureJsonSource(fixtures));
