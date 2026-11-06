import type { EmbedApplicationError } from "@/application/embed.ts";

/** Audience inferred from an HTTP user agent. */
export type RequestAudience = "bot" | "human";

const botMarkers = [
  "bot",
  "crawler",
  "spider",
  "slackbot",
  "discordbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "embedly",
] as const;

/**
 * Classify a user agent for embed delivery.
 * @param value - User agent header value.
 * @returns The inferred audience.
 */
export const classifyUserAgent = (value: string): RequestAudience => {
  const normalized = value.trim().toLowerCase();

  return normalized !== "" &&
    botMarkers.some((marker) => normalized.includes(marker))
    ? "bot"
    : "human";
};

/**
 * Map an embed failure to an HTTP status.
 * @param error - Embed application failure.
 * @returns The corresponding HTTP status.
 */
export const statusForError = (
  error: EmbedApplicationError
  // oxlint-disable-next-line sonarjs/max-union-size -- HTTP status mapping is intentionally explicit.
): 404 | 422 | 429 | 503 => {
  switch (error._tag) {
    case "MetadataNotFound":
    case "MediaIndexOutOfRange":
    case "MediaMissing": {
      return 404;
    }

    case "ProviderResponseInvalid":
    case "UnsafeMediaUrl": {
      return 422;
    }

    case "ProviderRateLimited": {
      return 429;
    }

    case "ProviderUnavailable":
    case "CacheUnavailable": {
      return 503;
    }

    default: {
      return 503;
    }
  }
};

/**
 * Describe an error status for a response.
 * @param status - HTTP error status.
 * @returns A public error description.
 */
// oxlint-disable-next-line sonarjs/max-union-size -- HTTP status mapping is intentionally explicit.
export const errorDescription = (status: 404 | 422 | 429 | 503): string => {
  switch (status) {
    case 404: {
      return "The requested Instagram media was not found.";
    }

    case 422: {
      return "The requested embed is invalid.";
    }

    case 429: {
      return "The metadata provider is temporarily rate limited.";
    }

    case 503: {
      return "Instagram metadata is temporarily unavailable.";
    }

    default: {
      return "The request could not be completed.";
    }
  }
};
