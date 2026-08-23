import { Effect } from "effect";

import type { EmbedService } from "@/application/embed.ts";
import type { EmbedRequest } from "@/domain/embed-request.ts";
import { parseEmbedRequest } from "@/domain/embed-request.ts";
import { parseInstagramUrl } from "@/domain/instagram-url.ts";
import { htmlResponse, indexResponse } from "@/http/html.ts";
import {
  classifyUserAgent,
  errorDescription,
  statusForError,
} from "@/http/policy.ts";
import { defaultRateLimit } from "@/http/telemetry.ts";
import type {
  HttpOperation,
  HttpTelemetry,
  RateLimitConfig,
} from "@/http/telemetry.ts";
import { wellKnownResponse } from "@/http/well-known.ts";

const instagramOrigin = "https://instagram.com";
const maxRequestUrlLength = 2048;
const maxPathLength = 512;

interface RouterOptions {
  readonly httpTelemetry?: HttpTelemetry | undefined;
  readonly rateLimit?: RateLimitConfig | undefined;
}

const requestId = (): string => crypto.randomUUID();

const withRequestId = (response: Response, id: string): Response => {
  response.headers.set("X-Request-ID", id);
  return response;
};

const operationFor = (path: string): HttpOperation => {
  if (path === "/oembed") {
    return "oembed";
  }
  if (path.startsWith("/images/") || path.startsWith("/videos/")) {
    return "media";
  }
  return "content";
};

const userAgent = (request: Request): string =>
  request.headers.get("user-agent") ?? "";

// oxlint-disable-next-line sonarjs/max-union-size -- HTTP status is intentionally explicit.
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
      userAgent: userAgent(request),
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
      errorDocument(new URL(instagramOrigin), status),
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

const documentFor = async (service: EmbedService, request: EmbedRequest) => {
  const result = await Effect.runPromise(
    Effect.result(service.resolve(request))
  );
  return result._tag === "Success" && result.success._tag === "Html"
    ? result.success
    : undefined;
};

const handleOembed = async (
  service: EmbedService,
  request: Request,
  url: URL
): Promise<Response> => {
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
  const requestForEmbed = {
    location: parsed.success,
    mode: "standard",
    userAgent: userAgent(request),
  } as const;
  const resolved = await documentFor(service, requestForEmbed);
  if (resolved === undefined) {
    return responseFor(service, requestForEmbed);
  }
  const embed = htmlResponse(resolved.document, resolved.status);
  const oEmbed = {
    html: await embed.text(),
    provider_name: "fxinstagram",
    provider_url: `${new URL(request.url).origin}/`,
    title: "fxinstagram embed",
    type: "rich" as const,
    version: "1.0" as const,
  };
  if (resolved.document.authorName !== undefined) {
    Object.assign(oEmbed, { author_name: resolved.document.authorName });
  }
  if (resolved.document.authorUrl !== undefined) {
    Object.assign(oEmbed, {
      author_url: resolved.document.authorUrl.toString(),
    });
  }
  return Response.json(oEmbed, {
    headers: { "X-Content-Type-Options": "nosniff" },
  });
};

const handleMedia = async (
  service: EmbedService,
  request: Request,
  parts: readonly string[]
): Promise<Response | undefined> => {
  const [mediaRoute, shortcode, mediaIndex] = parts;
  if (parts.length !== 3) {
    return undefined;
  }
  if (mediaRoute !== "images" && mediaRoute !== "videos") {
    return undefined;
  }
  if (shortcode === undefined || mediaIndex === undefined) {
    return undefined;
  }
  const parsed = await Effect.runPromise(
    Effect.result(
      parseInstagramUrl(
        `${instagramOrigin}/p/${shortcode}?img_index=${Number(mediaIndex) + 1}`
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
        userAgent: userAgent(request),
      })
    )
  );
  if (media._tag === "Failure") {
    const status = statusForError(media.failure);
    return htmlResponse(
      errorDocument(new URL(instagramOrigin), status),
      status
    );
  }
  if (media.success.type !== mediaRoute.slice(0, -1)) {
    return new Response("media type mismatch", { status: 404 });
  }
  return new Response(null, {
    headers: { Location: media.success.url.toString() },
    status: 302,
  });
};

const handleContent = async (
  service: EmbedService,
  request: Request,
  url: URL
): Promise<Response> => {
  const parts = url.pathname.split("/").filter(Boolean);
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
    return htmlResponse(errorDocument(new URL(instagramOrigin), 422), 422);
  }
  if (classifyUserAgent(parsed.success.userAgent) === "human") {
    return new Response(null, {
      headers: {
        Location: `${instagramOrigin}${target.replace(/^https:\/\/instagram\.com/u, "")}`,
      },
      status: 302,
    });
  }
  return responseFor(service, parsed.success);
};

const recordTelemetry = async (
  telemetry: HttpTelemetry | undefined,
  id: string,
  operation: HttpOperation,
  outcome: "success" | "rejected" | "failure",
  status: number,
  started: number
): Promise<void> => {
  if (telemetry === undefined) {
    return;
  }
  try {
    await Effect.runPromise(
      telemetry.record({
        durationMs: Date.now() - started,
        operation,
        outcome,
        requestId: id,
        status,
      })
    );
  } catch {
    // Telemetry failure must not change the public request result.
  }
};

export const makeRouter = (service: EmbedService, options?: RouterOptions) => {
  const rateLimitState = { requests: 0, startedAt: Date.now() };
  return async (request: Request): Promise<Response> => {
    const started = Date.now();
    const id = requestId();
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response("invalid request", { status: 422 });
    }
    const limit = options?.rateLimit ?? defaultRateLimit;
    const now = Date.now();
    if (now - rateLimitState.startedAt >= limit.windowMs) {
      rateLimitState.startedAt = now;
      rateLimitState.requests = 0;
    }
    rateLimitState.requests += 1;
    if (rateLimitState.requests > limit.maxRequests) {
      const response = withRequestId(
        new Response("rate limit exceeded", {
          headers: { "Retry-After": String(Math.ceil(limit.windowMs / 1000)) },
          status: 429,
        }),
        id
      );
      await recordTelemetry(
        options?.httpTelemetry,
        id,
        operationFor(url.pathname),
        "rejected",
        response.status,
        started
      );
      return response;
    }
    if (
      request.url.length > maxRequestUrlLength ||
      url.pathname.length > maxPathLength
    ) {
      const response = withRequestId(
        new Response("request too large", { status: 422 }),
        id
      );
      await recordTelemetry(
        options?.httpTelemetry,
        id,
        operationFor(url.pathname),
        "rejected",
        response.status,
        started
      );
      return response;
    }
    const wellKnown = wellKnownResponse(url.pathname);
    if (wellKnown !== undefined) {
      const result = withRequestId(wellKnown, id);
      await recordTelemetry(
        options?.httpTelemetry,
        id,
        operationFor(url.pathname),
        result.status >= 500 ? "failure" : "success",
        result.status,
        started
      );
      return result;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    let response: Response;
    if (url.pathname === "/") {
      response = indexResponse();
    } else if (parts[0] === "oembed") {
      response = await handleOembed(service, request, url);
    } else {
      const media = await handleMedia(service, request, parts);
      response = media ?? (await handleContent(service, request, url));
    }
    const result = withRequestId(response, id);
    await recordTelemetry(
      options?.httpTelemetry,
      id,
      operationFor(url.pathname),
      result.status >= 500 ? "failure" : "success",
      result.status,
      started
    );
    return result;
  };
};
