import type { Effect } from "effect/Effect";

export type HttpOperation = "content" | "media" | "oembed";
export type HttpOutcome = "success" | "rejected" | "failure";

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

export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
}

export const defaultRateLimit: RateLimitConfig = {
  maxRequests: 120,
  windowMs: 60_000,
};
