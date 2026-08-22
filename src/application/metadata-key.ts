import { instagramLocationPath } from "../domain/instagram-url.ts";
import type { InstagramLocation } from "../domain/instagram-url.ts";

/** Build a stable key from parsed location identity, excluding query mode. */
export const metadataCacheKey = (location: InstagramLocation): string =>
  `metadata:${instagramLocationPath(location)}#media=${location.mediaIndex}`;
