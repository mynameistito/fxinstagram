import type { EmbedApplicationError } from "../application/embed.ts";

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

export const classifyUserAgent = (value: string): RequestAudience => {
  const normalized = value.trim().toLowerCase();
  return normalized !== "" &&
    botMarkers.some((marker) => normalized.includes(marker))
    ? "bot"
    : "human";
};

export const statusForError = (
  error: EmbedApplicationError
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
  }
};

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
  }
};
