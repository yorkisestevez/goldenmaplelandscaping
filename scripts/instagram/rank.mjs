/**
 * Pure ranking for the Instagram feed bake: no token, no network, no disk.
 * Used by fetch-top-posts.mjs; covered by scripts/test-instagram-ranking.ts (in `npm run lint`).
 */

/** First usable image of a Graph media item: the IMAGE itself, or a carousel's first IMAGE child. */
export function pickImage(m) {
  if (m.media_type === 'IMAGE') return m.media_url;
  if (m.media_type === 'CAROUSEL_ALBUM') {
    const child = (m.children?.data ?? []).find((c) => c.media_type === 'IMAGE');
    return child?.media_url;
  }
  return undefined;
}

/**
 * Photo candidates for the feed: IMAGE + CAROUSEL_ALBUM with a usable image, minus `excludeIds`
 * and minus any post whose caption contains one of `excludeCaptionMarkers`, sorted by
 * like_count desc, then newest first. `captionExcluded` lists the ids the markers removed
 * (in the same order) so the run can report them.
 *
 * @param {any[]} media Graph /media items (raw JSON)
 * @param {{ excludeIds?: Array<string | number>, excludeCaptionMarkers?: string[] }} [opts]
 */
export function rankCandidates(media, { excludeIds = [], excludeCaptionMarkers = [] } = {}) {
  const excluded = new Set(excludeIds.map(String));
  const photos = media
    .filter((m) => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM')
    .map((m) => ({ ...m, imageUrl: pickImage(m) }))
    .filter((m) => m.imageUrl && !excluded.has(String(m.id)))
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const hasMarker = (m) => excludeCaptionMarkers.some((marker) => (m.caption ?? '').includes(marker));
  return {
    candidates: photos.filter((m) => !hasMarker(m)),
    captionExcluded: photos.filter(hasMarker).map((m) => String(m.id)),
  };
}
