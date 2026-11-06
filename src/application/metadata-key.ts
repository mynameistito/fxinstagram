import { instagramLocationPath } from "@/domain/instagram-url.ts";
import type { InstagramLocation } from "@/domain/instagram-url.ts";

/**
 * Build a stable key from parsed location identity, excluding query mode.
 * @param location - Parsed Instagram location.
 * @returns The cache key for the selected media.
 */
export const metadataCacheKey = (location: InstagramLocation): string =>
  `metadata:${instagramLocationPath(location)}#media=${location.mediaIndex}`;
