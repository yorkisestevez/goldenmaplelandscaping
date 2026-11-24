/**
 * Curation test for the Instagram feed ranking (scripts/instagram/rank.mjs), runs in `npm run lint`.
 *
 * The social-growth daily engine posts carousels on @goldenmaplelandscaping.ca whose cover is a
 * real job photo with an avatar sticker, and every caption ends with "Made with my AI avatar.".
 * The "job photos only" feed must skip them without a manual excludeIds entry.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rankCandidates } from './instagram/rank.mjs';

const ROOT = join(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts/instagram/config.json'), 'utf8'));
const ENGINE_MARKER = 'Made with my AI avatar.';

const post = (id: string, likes: number, caption: string | undefined, extra: Record<string, unknown> = {}) => ({
  id,
  like_count: likes,
  caption,
  media_type: 'IMAGE',
  media_url: `https://cdn.example/${id}.jpg`,
  timestamp: '2026-11-10T12:00:00+0000',
  ...extra,
});

const media = [
  post('1', 50, 'Interlock patio in Barrie, finished last week.'),
  post('2', 90, 'Why the base matters.\nRun a patio company? Comment PATIO.\nMade with my AI avatar.', {
    media_type: 'CAROUSEL_ALBUM',
    media_url: undefined,
    children: { data: [{ media_type: 'IMAGE', media_url: 'https://cdn.example/2-cover.jpg' }] },
  }),
  post('3', 70, 'Retaining wall in Innisfil.'),
  post('4', 80, 'Supplier promo'),
  post('5', 60, undefined),
  post('6', 99, 'Site walk', { media_type: 'VIDEO' }),
  post('7', 95, 'Made with my AI avatar.\n#barrie #hardscaping'),
  post('8', 85, 'Made with my own two hands, no AI here.'),
  post('9', 50, 'Flagstone path, same likes as post 1 but newer.', { timestamp: '2026-11-12T12:00:00+0000' }),
];
const ids = (rows: Array<{ id: string }>) => rows.map((m) => String(m.id));

// The shipped config carries the engine marker, so the real dry-run and refresh skip engine posts.
assert.ok(Array.isArray(config.excludeCaptionMarkers), 'config.json must define excludeCaptionMarkers');
assert.ok(config.excludeCaptionMarkers.includes(ENGINE_MARKER), `config.json excludeCaptionMarkers must include "${ENGINE_MARKER}"`);
assert.ok(config.excludeIds.length > 0, 'excludeIds stays in place for non-engine posts');

const ranked = rankCandidates(media, { excludeIds: ['4'], excludeCaptionMarkers: config.excludeCaptionMarkers });

// Engine posts are gone wherever the marker sits; near-misses, captionless posts and job photos stay.
assert.deepEqual(ids(ranked.candidates), ['8', '3', '5', '9', '1'], 'ranking: job photos by likes, newest first on a tie');
assert.deepEqual(ranked.captionExcluded, ['7', '2'], 'captionExcluded lists the skipped engine posts in like order');

// Without markers the same engine posts would top the feed, so the filter is what removes them.
const unfiltered = rankCandidates(media, { excludeIds: ['4'] });
assert.deepEqual(ids(unfiltered.candidates), ['7', '2', '8', '3', '5', '9', '1']);
assert.deepEqual(unfiltered.captionExcluded, []);

// excludeIds still works on its own, and the carousel keeps its first IMAGE child as the image.
const byIdOnly = rankCandidates(media, { excludeIds: ['4', '7'] });
assert.ok(!ids(byIdOnly.candidates).includes('4') && !ids(byIdOnly.candidates).includes('7'), 'excludeIds drops by id');
assert.equal(byIdOnly.candidates.find((m) => String(m.id) === '2')?.imageUrl, 'https://cdn.example/2-cover.jpg');

console.log('instagram ranking: passed (engine caption marker skipped, excludeIds kept)');
