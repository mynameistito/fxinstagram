import { Effect } from "effect";
import {
  is as isSchema,
  Record as SchemaRecord,
  String as SchemaString,
} from "effect/Schema";

import type { EmbedMode } from "@/domain/embed-policy.ts";
import type { InstagramLocation } from "@/domain/instagram-url.ts";

/** Untrusted query and header values accepted by the application boundary. */
export interface EmbedRequestInput {
  readonly query?: unknown;
  readonly headers?: unknown;
  readonly userAgent: unknown;
}

/** A normalized request passed to embed policy and retrieval. */
export interface EmbedRequest {
  readonly location: InstagramLocation;
  readonly mode: EmbedMode;
  readonly userAgent: string;
}

/** Errors produced while decoding embed request options. */
export type EmbedRequestError =
  | { readonly _tag: "InvalidEmbedMode"; readonly value: string }
  | { readonly _tag: "InvalidMediaIndex" }
  | { readonly _tag: "InvalidUserAgent" };

const modeValues: readonly EmbedMode[] = ["standard", "direct", "gallery"];

// oxlint-disable-next-line anti-slop/no-unknown-parameters
const readRecord = (value: unknown): Readonly<Record<string, string>> => {
  const record = value ?? {};
  return isSchema(SchemaRecord(SchemaString, SchemaString))(record)
    ? record
    : {};
};

const readMode = (
  value: string
): Effect.Effect<EmbedMode, EmbedRequestError> => {
  const mode = modeValues.find((candidate) => candidate === value);
  if (mode !== undefined) {
    return Effect.succeed(mode);
  }
  return Effect.fail({ _tag: "InvalidEmbedMode", value });
};

/** Parse query/header mode options using the explicit precedence table. */
export const parseEmbedRequest = (
  location: InstagramLocation,
  input: EmbedRequestInput
): Effect.Effect<EmbedRequest, EmbedRequestError> => {
  const { userAgent } = input;
  if (!isSchema(SchemaString)(userAgent)) {
    return Effect.fail({ _tag: "InvalidUserAgent" });
  }

  const query = readRecord(input.query);
  const headers = readRecord(input.headers);
  const headerMode = headers["X-Embed-Type"] ?? headers["x-embed-type"];
  let selected = "standard";
  if (query.direct === "1") {
    selected = "direct";
  }
  if (query.gallery === "1") {
    selected = "gallery";
  }
  if (headerMode !== undefined) {
    selected = headerMode;
  }
  return Effect.map(readMode(selected), (mode) => ({
    location,
    mode,
    userAgent,
  }));
};
