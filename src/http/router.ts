import { Effect } from "effect";

import type { EmbedService } from "../application/embed.ts";
import type { EmbedRequest } from "../domain/embed-request.ts";
import { parseEmbedRequest } from "../domain/embed-request.ts";
import { parseInstagramUrl } from "../domain/instagram-url.ts";
import { htmlResponse } from "./html.ts";
import {
  classifyUserAgent,
  errorDescription,
  statusForError,
} from "./policy.ts";

const errorDocument = (origin: URL, status: 404 | 422 | 429 | 503) => ({
  canonicalUrl: origin,
  card: "summary_large_image" as const,
  description: errorDescription(status),
  title: "fxinstagram",
});

const routeTarget = (url: URL): string | undefined => {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "stories" && parts.length === 3) {
    return `https://instagram.com/stories/${parts[1]}/${parts[2]}${url.search}`;
  }
  if (
    parts.length === 2 &&
    ["p", "reel", "reels", "tv"].includes(parts[0] ?? "")
  ) {
    return `https://instagram.com/${parts[0]}/${parts[1]}${url.search}`;
  }
  if (
    parts.length === 3 &&
    ["p", "reel", "reels", "tv"].includes(parts[1] ?? "")
  ) {
    return `https://instagram.com/${parts[0]}/${parts[1]}/${parts[2]}${url.search}`;
  }
  if (parts[0] === "grid" && parts.length === 2) {
    return `https://instagram.com/p/${parts[1]}${url.search}`;
  }
  return undefined;
};

const requestFor = (
  url: URL,
  request: Request
): Effect.Effect<EmbedRequest, unknown> => {
  const target = routeTarget(url);
  if (target === undefined) {
    return Effect.fail({ _tag: "InvalidRoute" });
  }
  const headerMode = request.headers.get("x-embed-type");
  return Effect.flatMap(parseInstagramUrl(target), (location) =>
    parseEmbedRequest(location, {
      headers: headerMode === null ? {} : { "x-embed-type": headerMode },
      query: Object.fromEntries(url.searchParams.entries()),
      userAgent: request.headers.get("user-agent") ?? "",
    })
  );
};

const responseFor = async (
  service: EmbedService,
  request: EmbedRequest
): Promise<Response> => {
  const result = await Effect.runPromise(
    Effect.result(service.resolve(request))
  );
  if (result._tag === "Failure") {
    const status = statusForError(result.failure);
    return htmlResponse(
      errorDocument(new URL("https://instagram.com"), status),
      status
    );
  }
  const response = result.success;
  if (response._tag === "Redirect" || response._tag === "MediaRedirect") {
    return new Response(null, {
      headers: { Location: response.location.toString() },
      status: 302,
    });
  }
  return htmlResponse(response.document, response.status);
};

export const makeRouter =
  (service: EmbedService) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "oembed") {
      const target = url.searchParams.get("url");
      if (target === null) {
        return new Response("invalid oembed url", { status: 422 });
      }
      const parsed = await Effect.runPromise(
        Effect.result(parseInstagramUrl(target))
      );
      if (parsed._tag === "Failure") {
        return new Response("invalid oembed url", { status: 422 });
      }
      const embed = await responseFor(service, {
        location: parsed.success,
        mode: "standard",
        userAgent: request.headers.get("user-agent") ?? "",
      });
      if (embed.status !== 200) {
        return embed;
      }
      const document = await embed.text();
      return new Response(
        JSON.stringify({
          html: document,
          provider_name: "Instagram",
          provider_url: "https://instagram.com/",
          title: "Instagram embed",
          type: "rich",
          version: "1.0",
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }
    if (["images", "videos"].includes(parts[0] ?? "") && parts.length === 3) {
      const parsed = await Effect.runPromise(
        Effect.result(
          parseInstagramUrl(
            `https://instagram.com/p/${parts[1] ?? ""}?img_index=${parts[2] ?? ""}`
          )
        )
      );
      if (parsed._tag === "Failure") {
        return new Response("invalid media route", { status: 422 });
      }
      const media = await Effect.runPromise(
        Effect.result(
          service.resolveMedia({
            location: parsed.success,
            mode: "direct",
            userAgent: request.headers.get("user-agent") ?? "",
          })
        )
      );
      if (media._tag === "Failure") {
        const status = statusForError(media.failure);
        return htmlResponse(
          errorDocument(new URL("https://instagram.com"), status),
          status
        );
      }
      const mediaRoute = parts[0];
      if (
        mediaRoute === undefined ||
        media.success.type !== mediaRoute.slice(0, -1)
      ) {
        return new Response("media type mismatch", { status: 404 });
      }
      return new Response(null, {
        headers: { Location: media.success.url.toString() },
        status: 302,
      });
    }
    if (parts[0] === "grid" && parts.length === 2) {
      url.searchParams.set("gallery", "1");
    }
    const target = routeTarget(url);
    if (target === undefined) {
      return new Response("not found", { status: 404 });
    }
    const parsed = await Effect.runPromise(
      Effect.result(requestFor(url, request))
    );
    if (parsed._tag === "Failure") {
      return htmlResponse(
        errorDocument(new URL("https://instagram.com"), 422),
        422
      );
    }
    if (classifyUserAgent(parsed.success.userAgent) === "human") {
      return new Response(null, {
        headers: {
          Location: `https://instagram.com${target.replace(/^https:\/\/instagram\.com/u, "")}`,
        },
        status: 302,
      });
    }
    return responseFor(service, parsed.success);
  };
