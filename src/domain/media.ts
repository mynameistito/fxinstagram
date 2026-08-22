import type { Effect } from "effect/Effect";

import type { InstagramLocation } from "./instagram-url.ts";

/** Media normalized from any future Instagram metadata provider. */
export type InstagramMedia =
  | {
      readonly type: "image";
      readonly url: URL;
      readonly width?: number;
      readonly height?: number;
    }
  | {
      readonly type: "video";
      readonly url: URL;
      readonly width?: number;
      readonly height?: number;
    };

/** Projection selected by the pure embed policy. */
export type MediaSelection =
  | {
      readonly _tag: "image";
      readonly media: Extract<InstagramMedia, { readonly type: "image" }>;
    }
  | {
      readonly _tag: "video";
      readonly media: Extract<InstagramMedia, { readonly type: "video" }>;
    }
  | { readonly _tag: "gallery"; readonly items: readonly InstagramMedia[] };

/** Normalized metadata owned by the application, not by a provider adapter. */
export interface InstagramPost {
  readonly shortcode: string;
  readonly username: string;
  readonly caption: string;
  readonly media: readonly InstagramMedia[];
  readonly canonicalUrl: URL;
}

/** Typed failures a metadata source may return. */
export type MetadataError =
  | { readonly _tag: "MetadataNotFound"; readonly shortcode: string }
  | {
      readonly _tag: "ProviderUnavailable";
      readonly provider: string;
      readonly cause: unknown;
    }
  | { readonly _tag: "ProviderResponseInvalid"; readonly provider: string }
  | {
      readonly _tag: "ProviderRateLimited";
      readonly provider: string;
      readonly retryAfterMs?: number;
    };

/** Application-owned retrieval port for Plan 003 adapters. */
export interface InstagramMetadataSource {
  readonly find: (
    location: InstagramLocation
  ) => Effect<InstagramPost, MetadataError>;
}
