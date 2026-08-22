import { Effect } from "effect";

import type { EmbedRequest } from "./embed-request.ts";
import type { InstagramMedia, MediaSelection } from "./media.ts";

/** The mutually exclusive embed projections. */
export type EmbedMode = "standard" | "direct" | "gallery";

/** Selectable media from normalized Instagram metadata. */
export type MediaSelectionError =
  | { readonly _tag: "MediaMissing" }
  | { readonly _tag: "MediaIndexOutOfRange"; readonly index: number };

/** Select one media item or the complete gallery for an embed request. */
export const selectMedia = (
  request: EmbedRequest,
  media: readonly InstagramMedia[]
): Effect.Effect<MediaSelection, MediaSelectionError> => {
  if (media.length === 0) {
    return Effect.fail({ _tag: "MediaMissing" });
  }
  if (request.mode === "gallery") {
    return Effect.succeed({ _tag: "gallery", items: media });
  }
  const selected = media[request.location.mediaIndex];
  if (selected === undefined) {
    return Effect.fail({
      _tag: "MediaIndexOutOfRange",
      index: request.location.mediaIndex,
    });
  }
  if (selected.type === "image") {
    return Effect.succeed({ _tag: "image", media: selected });
  }
  return Effect.succeed({ _tag: "video", media: selected });
};
