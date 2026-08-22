import { Context } from "effect";

import type { InstagramMetadataSource } from "../domain/media.ts";

/** Application-owned metadata source port. */
export class MetadataSourceService extends Context.Service<
  MetadataSourceService,
  InstagramMetadataSource
>()("fxinstagram/MetadataSource") {}
