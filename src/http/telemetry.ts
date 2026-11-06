import type { Effect } from "effect/Effect";

/** Supported request operations recorded in telemetry. */
export type HttpOperation = "content" | "media" | "oembed";

/** Outcome recorded for an HTTP request. */
type HttpOutcome = "success" | "rejected" | "failure";

/** Sanitized request telemetry; it intentionally contains no URL or user content. */
export interface HttpTelemetryEvent {
  readonly requestId: string;
  readonly operation: HttpOperation;
  readonly outcome: HttpOutcome;
  readonly status: number;
  readonly durationMs: number;
}

/** Optional sink for safe request telemetry. */
export interface HttpTelemetry {
  readonly record: (event: HttpTelemetryEvent) => Effect<void>;
}

/** Request count and time window for rate limiting. */
export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
}

export const defaultRateLimit: RateLimitConfig = {
  maxRequests: 120,
  windowMs: 60_000,
};
