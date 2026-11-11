// Location + deal matching for Ontario Costco $99 cologne posts.

const FRAGRANCE_RE =
  /\b(cologne|perfume|fragrance|fragrances|edt|edp|parfum|aftershave)\b/i;
// Do not treat $79.99 / $229.99 as $99 (word-boundary before 99 matches ".99").
const PRICE_RE = /(?:^|[^0-9.])(?:\$\s*)?99(?:\.99)?(?![0-9.])|\bninety[\s-]?nine\b/i;
const COSTCO_RE = /\bcostco\b/i;

export function looksLikeCologneDeal(text) {
  if (!text) return false;
  return COSTCO_RE.test(text) && FRAGRANCE_RE.test(text) && PRICE_RE.test(text);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordHit(haystack, phrase) {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(p)}(?:$|[^a-z0-9])`, 'i');
  return re.test(haystack);
}

/**
 * @param {string} text
 * @param {Array<{number: string, city: string, name: string, aliases?: string[]}>} warehouses
 * @returns {Array<{key: string, number: string, city: string, name: string, how: string}>}
 */
export function extractOntarioLocations(text, warehouses) {
  if (!text || !warehouses?.length) return [];
  const hits = new Map();

  const numeric = warehouses.filter((w) => /^\d+$/.test(w.number));
  for (const w of numeric) {
    const re = new RegExp(
      `(?:warehouse\\s*(?:#|no\\.?|number)?\\s*)?#?\\b${w.number}\\b`,
      'i'
    );
    if (re.test(text)) {
      hits.set(w.number, {
        key: w.number,
        number: w.number,
        city: w.city,
        name: w.name,
        how: `warehouse ${w.number}`,
      });
    }
  }

  // Longer aliases first so "richmond hill" wins over a stray "hill".
  const named = warehouses
    .flatMap((w) => {
      const aliases = [...(w.aliases || []), w.city, w.name].filter(Boolean);
      return aliases.map((alias) => ({ w, alias: alias.toLowerCase() }));
    })
    .sort((a, b) => b.alias.length - a.alias.length);

  const ontarioCue = /\b(ontario|\bon\b|canada|gta|golden horseshoe)\b/i.test(text);

  for (const { w, alias } of named) {
    if (alias.length < 4) continue;
    if (!wordHit(text, alias)) continue;
    // "London" alone is often the UK Costco; require an Ontario cue unless
    // the alias already includes Ontario.
    if (w.city === 'London' && alias === 'london' && !ontarioCue) continue;
    const key = /^\d+$/.test(w.number) ? w.number : `city:${w.city.toLowerCase()}`;
    if (hits.has(key) || [...hits.values()].some((h) => h.city === w.city && h.name === w.name)) {
      continue;
    }
    // Skip generic city:* if a numbered warehouse in the same city already matched.
    if (
      !/^\d+$/.test(w.number) &&
      [...hits.values()].some((h) => h.city.toLowerCase() === w.city.toLowerCase())
    ) {
      continue;
    }
    hits.set(key, {
      key,
      number: /^\d+$/.test(w.number) ? w.number : null,
      city: w.city,
      name: w.name,
      how: `place "${alias}"`,
    });
  }

  return [...hits.values()].sort((a, b) => a.city.localeCompare(b.city) || (a.number || '').localeCompare(b.number || ''));
}

export function locationFingerprint(locations) {
  return locations
    .map((l) => `${l.city}|${l.number || l.name}`)
    .sort()
    .join(';');
}

export function formatDigest({ generatedAt, locations, posts, change }) {
  const lines = [];
  lines.push(`Ontario Costco $99 cologne watcher`);
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Change: ${change || 'none'}`);
  lines.push('');
  if (!locations.length) {
    lines.push('No Ontario warehouse/city mentions found in matching posts.');
  } else {
    lines.push('Locations mentioned:');
    for (const loc of locations) {
      const wh = loc.number ? ` warehouse ${loc.number}` : '';
      lines.push(`  • ${loc.city} — ${loc.name}${wh} (${loc.how})`);
    }
  }
  lines.push('');
  if (posts.length) {
    lines.push('Source posts:');
    for (const p of posts.slice(0, 20)) {
      const loc = (p.locations || []).map((l) => l.city).join(', ') || 'location unclear';
      lines.push(`  • ${p.title}`);
      lines.push(`    ${p.subreddit || p.source} · ${loc}`);
      if (p.url) lines.push(`    ${p.url}`);
    }
  } else {
    lines.push('No matching posts in this window.');
  }
  lines.push('');
  lines.push('Sources: Reddit JSON, Slickdeals RSS, Google News RSS, DuckDuckGo snippets.');
  lines.push('Instagram/Facebook/TikTok pages are not fetched.');
  return lines.join('\n');
}
