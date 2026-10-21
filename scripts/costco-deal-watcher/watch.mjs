#!/usr/bin/env node
// Public-feed watcher for Ontario Costco $99 cologne drops.
// Fetches Reddit JSON only (no Instagram/Facebook). Emails via Gmail SMTP
// when --email is set AND locations/deals changed vs state.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  extractOntarioLocations,
  formatDigest,
  locationFingerprint,
  looksLikeCologneDeal,
} from './extract.mjs';
import { parseDdgHtml, parseRssItems } from './feeds.mjs';
import { sendGmail } from './send-gmail.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(dir, 'state.json');
const WAREHOUSES = JSON.parse(
  readFileSync(join(dir, 'ontario-warehouses.json'), 'utf8')
);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const REDDIT_SEARCHES = [
  {
    source: 'reddit',
    url: 'https://www.reddit.com/r/CostcoCanada/search.json?q=cologne%20OR%20fragrance%20OR%20perfume%2099&restrict_sr=1&sort=new&t=month&limit=25',
    subreddit: 'r/CostcoCanada',
  },
  {
    source: 'reddit',
    url: 'https://www.reddit.com/r/Costco/search.json?q=canada%20cologne%20OR%20fragrance%2099%20OR%20ontario&restrict_sr=1&sort=new&t=month&limit=25',
    subreddit: 'r/Costco',
  },
];

const RSS_SEARCHES = [
  {
    source: 'slickdeals',
    url: 'https://slickdeals.net/newsearch.php?q=costco+cologne&searcharea=deals&searchin=first&rss=1',
  },
  {
    source: 'google-news',
    url: 'https://news.google.com/rss/search?q=Costco+cologne+OR+fragrance+%2499+Ontario&hl=en-CA&gl=CA&ceid=CA:en',
  },
];

const DDG_QUERIES = [
  'costco cologne $99 ontario',
  'costco fragrance $99 warehouse ontario reddit',
  'site:reddit.com costco canada cologne $99',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    redirect: 'follow',
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}: ${body.slice(0, 200)}`);
  }
  return body;
}

async function fetchJson(url) {
  const body = await fetchText(url, 'application/json');
  return JSON.parse(body);
}

function redditChildren(json) {
  const listing = json?.data?.children;
  if (Array.isArray(listing)) return listing.map((c) => c.data).filter(Boolean);
  return [];
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { updatedAt: null, fingerprint: '', posts: [], locations: [] };
  }
}

export async function collect() {
  const errors = [];
  const rawPosts = [];

  for (const search of REDDIT_SEARCHES) {
    try {
      const json = await fetchJson(search.url);
      for (const d of redditChildren(json)) {
        const title = d.title || '';
        const body = d.selftext || '';
        rawPosts.push({
          id: d.name || d.id || `${search.subreddit}:${title}`,
          title,
          body,
          text: `${title}\n${body}`,
          url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url || '',
          subreddit: d.subreddit ? `r/${d.subreddit}` : search.subreddit,
          createdUtc: d.created_utc || null,
          source: search.source,
        });
      }
    } catch (err) {
      errors.push(`${search.subreddit}: ${err.message}`);
    }
    await sleep(800);
  }

  for (const search of RSS_SEARCHES) {
    try {
      const xml = await fetchText(search.url, 'application/rss+xml, application/xml, text/xml, */*');
      rawPosts.push(...parseRssItems(xml, search.source));
    } catch (err) {
      errors.push(`${search.source}: ${err.message}`);
    }
    await sleep(800);
  }

  for (const q of DDG_QUERIES) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const html = await fetchText(url, 'text/html');
      rawPosts.push(...parseDdgHtml(html, 'duckduckgo'));
    } catch (err) {
      errors.push(`duckduckgo: ${err.message}`);
    }
    await sleep(800);
  }

  const seen = new Set();
  const matching = [];
  for (const p of rawPosts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (!looksLikeCologneDeal(p.text) && !looksLikeCologneDeal(p.title)) continue;
    const host = (() => {
      try { return new URL(p.url).hostname; } catch { return ''; }
    })();
    if (/(^|\.)(instagram|facebook|tiktok)\.com$/i.test(host)) continue;
    const locations = extractOntarioLocations(p.text, WAREHOUSES);
    const canadaCue = /\b(ontario|\bon\b|canada|gta|costco\.ca|cocoeast|costcocanada)\b/i.test(
      `${p.text}\n${p.url || ''}`
    );
    if (!locations.length && !canadaCue) continue;
    if (
      !locations.length &&
      /\b(u\.?s\.?|united states)\b/i.test(`${p.title}\n${p.url || ''}`) &&
      !/\b(ontario|canada)\b/i.test(p.text)
    ) {
      continue;
    }
    matching.push({ ...p, locations, text: undefined, body: undefined });
  }

  const locMap = new Map();
  for (const p of matching) {
    for (const loc of p.locations) {
      locMap.set(loc.key, loc);
    }
  }
  const locations = [...locMap.values()].sort(
    (a, b) => a.city.localeCompare(b.city) || (a.number || '').localeCompare(b.number || '')
  );

  return { matching, locations, errors, fetched: rawPosts.length };
}

function describeChange(prev, next) {
  const prevKeys = new Set((prev.locations || []).map((l) => l.key));
  const nextKeys = new Set(next.locations.map((l) => l.key));
  const added = [...nextKeys].filter((k) => !prevKeys.has(k));
  const removed = [...prevKeys].filter((k) => !nextKeys.has(k));
  const prevPosts = new Set((prev.posts || []).map((p) => p.id));
  const newPosts = next.matching.filter((p) => !prevPosts.has(p.id) && p.locations.length);
  if (!prev.updatedAt && (next.locations.length || next.matching.length)) {
    return 'baseline';
  }
  if (!prev.updatedAt) return 'baseline-empty';
  if (added.length || removed.length) return 'locations';
  if (newPosts.length) return 'new-posts';
  return 'none';
}

async function main() {
  const wantEmail = process.argv.includes('--email');
  const forceEmail = process.argv.includes('--force-email') || process.env.COSTCO_WATCH_FORCE_EMAIL === '1';
  const writeState = !process.argv.includes('--no-write');

  const prev = loadState();
  const { matching, locations, errors, fetched } = await collect();
  const generatedAt = new Date().toISOString();
  const change = describeChange(prev, { matching, locations });
  const fingerprint = locationFingerprint(locations);

  const digest = formatDigest({
    generatedAt,
    locations,
    posts: matching,
    change,
  });

  console.log(digest);
  console.log(`Fetched listings: ${fetched}; matching posts: ${matching.length}`);
  if (errors.length) {
    console.log('Fetch warnings:');
    for (const e of errors) console.log(`  - ${e}`);
  }

  const nextState = {
    updatedAt: generatedAt,
    fingerprint,
    change,
    locations,
    posts: matching.map((p) => ({
      id: p.id,
      title: p.title,
      url: p.url,
      subreddit: p.subreddit,
      locationKeys: p.locations.map((l) => l.key),
    })),
  };

  if (writeState) {
    writeFileSync(STATE_PATH, JSON.stringify(nextState, null, 2) + '\n');
    console.log(`Wrote ${STATE_PATH}`);
  }

  const shouldEmail = wantEmail && (forceEmail || change !== 'none');
  if (!wantEmail) return;
  if (!shouldEmail) {
    console.log('No location/deal change; skipping email.');
    return;
  }

  const user = process.env.GMAIL_USER || '';
  const pass = process.env.GMAIL_APP_PASSWORD || '';
  const to = (process.env.GMAIL_TO || user).split(',').map((s) => s.trim()).filter(Boolean);

  if (!user || !pass) {
    console.log('GMAIL_USER / GMAIL_APP_PASSWORD unset; skipping email (inert).');
    return;
  }

  const subject =
    change === 'none'
      ? 'Costco $99 cologne — Ontario (no change)'
      : `Costco $99 cologne — Ontario update (${change})`;
  await sendGmail({ user, pass, to, subject, body: digest });
  console.log(`Emailed ${to.join(', ')}`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
