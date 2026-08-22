import { Effect } from "effect";
import {
  is as isSchema,
  Literal,
  String as SchemaString,
  Union,
} from "effect/Schema";

/** The Instagram content families supported by the application. */
export type InstagramPostKind = "post" | "reel" | "tv" | "story";

/** A normalized Instagram content location. Media indices are zero-based. */
export interface InstagramLocation {
  readonly kind: InstagramPostKind;
  readonly shortcode: string;
  readonly username?: string;
  readonly mediaIndex: number;
}

/** Errors produced while parsing an Instagram URL. */
export type ParseInstagramUrlError =
  | { readonly _tag: "UnsupportedHost"; readonly host: string }
  | { readonly _tag: "UnsupportedPath"; readonly path: string }
  | { readonly _tag: "InvalidShortcode" }
  | { readonly _tag: "InvalidMediaIndex" };

const Host = Union([Literal("instagram.com"), Literal("www.instagram.com")]);
const Shortcode = /^[A-Za-z0-9_-]+$/u;
const Username = /^[A-Za-z0-9._]+$/u;

const routeKind = (segment: string): InstagramPostKind | undefined => {
  if (segment === "p") {
    return "post";
  }
  if (segment === "reel" || segment === "reels") {
    return "reel";
  }
  if (segment === "tv") {
    return "tv";
  }
  return undefined;
};

// This is the untrusted-string boundary for URL input.
// oxlint-disable anti-slop/no-unknown-parameters
const parseString = (value: unknown): string | undefined =>
  isSchema(SchemaString)(value) ? value : undefined;

const parseIndex = (
  value: string | null
): Effect.Effect<number, ParseInstagramUrlError> => {
  if (value === null || value === "") {
    return Effect.succeed(0);
  }
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return Effect.fail({ _tag: "InvalidMediaIndex" });
  }
  const index = Number(value);
  return Number.isSafeInteger(index)
    ? Effect.succeed(index)
    : Effect.fail({ _tag: "InvalidMediaIndex" });
};

const location = (
  kind: InstagramPostKind,
  shortcode: string,
  username: string | undefined,
  mediaIndex: number
): Effect.Effect<InstagramLocation, ParseInstagramUrlError> => {
  if (!Shortcode.test(shortcode)) {
    return Effect.fail({ _tag: "InvalidShortcode" });
  }
  if (username !== undefined && !Username.test(username)) {
    return Effect.fail({ _tag: "InvalidShortcode" });
  }
  return Effect.succeed(
    username === undefined
      ? { kind, mediaIndex, shortcode }
      : { kind, mediaIndex, shortcode, username }
  );
};

/** Parse an Instagram URL or untrusted URL string into a canonical location. */
export const parseInstagramUrl = (
  input: unknown
): Effect.Effect<InstagramLocation, ParseInstagramUrlError> => {
  const value = input instanceof URL ? input : parseString(input);
  if (value === undefined) {
    return Effect.fail({ _tag: "UnsupportedHost", host: "" });
  }

  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(value);
  } catch {
    return Effect.fail({ _tag: "UnsupportedHost", host: "" });
  }

  if (!isSchema(Host)(url.hostname.toLowerCase())) {
    return Effect.fail({ _tag: "UnsupportedHost", host: url.hostname });
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "";
      }
    });
  const index = parseIndex(url.searchParams.get("img_index"));
  // oxlint-disable-next-line unicorn/no-array-method-this-argument
  return Effect.flatMap(index, (mediaIndex) => {
    const rootKind = routeKind(parts[0] ?? "");
    const userKind = routeKind(parts[1] ?? "");
    if (parts.length === 2 && rootKind !== undefined) {
      return location(rootKind, parts[1] ?? "", undefined, mediaIndex);
    }
    if (
      parts.length === 3 &&
      Username.test(parts[0] ?? "") &&
      userKind !== undefined
    ) {
      return location(userKind, parts[2] ?? "", parts[0], mediaIndex);
    }
    if (parts.length === 3 && parts[0] === "stories") {
      return location("story", parts[2] ?? "", parts[1], mediaIndex);
    }
    return Effect.fail({ _tag: "UnsupportedPath", path: url.pathname });
  });
};
// oxlint-enable anti-slop/no-unknown-parameters

/** Render the stable canonical route form for a parsed location. */
export const instagramLocationPath = (value: InstagramLocation): string => {
  if (value.kind === "story") {
    return `/stories/${value.username ?? ""}/${value.shortcode}`;
  }
  const prefix = value.username === undefined ? "" : `/${value.username}`;
  const route = value.kind === "post" ? "p" : value.kind;
  return `${prefix}/${route}/${value.shortcode}`;
};
