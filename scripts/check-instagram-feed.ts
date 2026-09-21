/**
 * Lint gate for src/data/instagramFeed.json (runs in `npm run lint`, so also in Netlify's build).
 *
 * - schema sanity (ids, permalinks, ISO timestamps, numeric likes, image refs)
 * - every referenced webp exists on disk; every webp on disk is referenced (the bake prunes)
 * - REFUSES anything token-shaped anywhere in the file (EAA… strings, access_token=)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FEED = join(ROOT, 'src/data/instagramFeed.json');
const OUT_DIR = join(ROOT, 'public/images/instagram');

const raw = readFileSync(FEED, 'utf8');
const problems: string[] = [];

if (/EAA[A-Za-z0-9]{20,}/.test(raw)) problems.push('token-shaped string (EAA…) present in feed JSON');
if (/access_token/i.test(raw)) problems.push('"access_token" present in feed JSON');

interface FeedPost {
  id: string; permalink: string; caption: string; likeCount: number; commentsCount: number;
  timestamp: string; mediaType: string;
  image: { src: string; srcSet: string; width: number; height: number; alt: string };
}
interface Feed { schemaVersion: number; topN: number; posts: FeedPost[] }

const feed = JSON.parse(raw) as Feed;
if (feed.schemaVersion !== 1) problems.push(`schemaVersion ${feed.schemaVersion} ≠ 1`);
if (!Array.isArray(feed.posts)) problems.push('posts is not an array');
const posts = Array.isArray(feed.posts) ? feed.posts : [];
if (posts.length > feed.topN + 3) problems.push(`${posts.length} posts exceeds topN+3 (${feed.topN + 3})`);

const referenced = new Set<string>();
for (const p of posts) {
  const tag = `post ${p?.id}`;
  if (!/^\d+$/.test(String(p.id))) problems.push(`${tag}: id is not numeric`);
  if (!/^https:\/\/www\.instagram\.com\//.test(p.permalink)) problems.push(`${tag}: permalink not on instagram.com`);
  if (typeof p.caption !== 'string' || p.caption.length > 140) problems.push(`${tag}: caption missing or > 140 chars`);
  if (!Number.isFinite(p.likeCount)) problems.push(`${tag}: likeCount not numeric`);
  if (!Number.isFinite(Date.parse(p.timestamp))) problems.push(`${tag}: timestamp not ISO`);
  if (!p.image?.src?.startsWith('/images/instagram/')) problems.push(`${tag}: image.src not under /images/instagram/`);
  if (!(p.image?.width > 0 && p.image?.height > 0)) problems.push(`${tag}: image width/height missing`);
  if (typeof p.image?.alt !== 'string' || !p.image.alt) problems.push(`${tag}: image.alt missing`);
  for (const cand of String(p.image?.srcSet ?? '').split(',')) {
    const file = cand.trim().split(' ')[0];
    if (!file) continue;
    referenced.add(file.replace('/images/instagram/', ''));
    if (!existsSync(join(ROOT, 'public', file))) problems.push(`${tag}: ${file} missing on disk`);
  }
}
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    if (!referenced.has(f)) problems.push(`${f}: on disk but not referenced by the feed (orphan)`);
  }
}

if (problems.length) {
  console.error(`instagram feed check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`instagram feed check: ok (${posts.length} posts, ${referenced.size} files)`);
