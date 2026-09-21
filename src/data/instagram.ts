/**
 * Typed accessor over the GENERATED Instagram feed.
 *
 * `src/data/instagramFeed.json` is written by `scripts/instagram/fetch-top-posts.mjs`
 * on the operator's machine (never on Netlify) and committed. Images are mirrored
 * under /images/instagram because Graph `media_url`s are short-lived signed URLs.
 */
import feed from './instagramFeed.json';
import type { ImageRef } from './portfolioImages';

export interface InstagramPost {
  id: string;
  permalink: string;
  caption: string;
  likeCount: number;
  commentsCount: number;
  timestamp: string;
  mediaType: 'IMAGE' | 'CAROUSEL_ALBUM';
  image: ImageRef;
}

export interface InstagramFeed {
  schemaVersion: number;
  fetchedAt: string | null;
  account: { id: string; username: string | null; url: string | null };
  window: { since: string; until: string } | null;
  topN: number;
  posts: InstagramPost[];
}

const data = feed as unknown as InstagramFeed;

export const INSTAGRAM_POSTS: readonly InstagramPost[] = data.posts;
export const INSTAGRAM_ACCOUNT = data.account;
export const INSTAGRAM_FETCHED_AT = data.fetchedAt;
