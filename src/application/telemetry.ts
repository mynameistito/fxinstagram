import { Context } from "effect";

import type { MetadataTelemetry } from "./metadata.ts";

/** Effect service for sanitized metadata telemetry. */
export class MetadataTelemetryService extends Context.Service<
  MetadataTelemetryService,
  MetadataTelemetry
>()("fxinstagram/MetadataTelemetry") {}
