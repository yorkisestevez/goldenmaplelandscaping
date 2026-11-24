'use strict';

// Deterministic publication checks for the scheduled blog lane. These checks
// complement, rather than replace, editorial review. Unknown facts fail closed.
const FORBIDDEN_CLAIMS = [
  { label: 'completed porcelain project / first-hand case study', re: /\b(?:we|our team|golden maple)\s+(?:have|has|had|just)\s+(?:installed|built|completed|finished|transformed|served)\b[^.?!]{0,100}\b(?:porcelain|porcelain paver|porcelain patio|porcelain paving)\b/i },
  { label: 'porcelain customer testimonial or review', re: /\b(?:customer|client|homeowner)\s+(?:review|testimonial|said|told us|wrote)\b[^.?!]{0,100}\bporcelain\b/i },
  { label: 'business warranty / guarantee', re: /\b(?:our|golden maple(?:'s)?)[^.?!]{0,100}\b(?:warranty|guarantee|guaranteed|guarantees)\b/i },
  { label: 'unverified fixed business price', re: /\b(?:our|golden maple(?:'s)?)\s+(?:price|rate|cost|quote)\s+(?:is|starts at|start at|from)\s*\$\s*\d/i },
  { label: 'unqualified engineering or safety guarantee', re: /\b(?:will never crack|never cracks|cannot crack|zero maintenance|maintenance[- ]free forever|guaranteed (?:not to|never) (?:slip|crack|stain))\b/i },
  { label: 'AI citation / ranking promise', re: /\b(?:guarantee|guaranteed|promise)\b[^.?!]{0,80}\b(?:google|ranking|rank|ai answer|ai citation|chatgpt|perplexity)\b/i },
  { label: 'fabricated review or rating claim', re: /\b\d(?:\.\d)?\s*(?:\/\s*5|out of 5)\b[^.?!]{0,80}\b(?:review|rating|google)\b/i },
];

const REQUIRED_TEXT = ['title', 'seoTitle', 'seoDescription', 'tldr', 'intro', 'author_bio', 'cta_paragraph'];

function sitePaths(routesText) {
  return [...routesText.matchAll(/route\(['\"]([^'\"]+)['\"]/g)].map(m => `/${m[1].replace(/^\/+|\/+$/g, '')}`);
}
const asText = (v) => typeof v === 'string' ? v : '';
function textOf(draft) {
  return [draft.title, draft.seoTitle, draft.seoDescription, draft.tldr, draft.intro,
    ...(draft.sections || []).flatMap(s => [s.heading, s.html]),
    ...(draft.faqs || []).flatMap(f => [f.question, f.answer]),
    draft.author_bio, draft.cta_paragraph,
    draft.comparison_table?.html || '',
  ].map(asText).join('\n');
}

function validateEditorialDraft(draft, {
  topic = {}, knownPaths = [], existingSlugs = [], scheduledFor = null, runDate = null,
} = {}) {
  const errors = [];
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { ok: false, errors: ['draft must be an object'], wordCount: 0, internalLinks: [], sourceLinks: [] };
  }
  for (const key of REQUIRED_TEXT) if (!asText(draft[key]).trim()) errors.push(`missing ${key}`);
  if (!Array.isArray(draft.sections) || draft.sections.length < 4) errors.push('sections must contain at least 4 items');
  if (!Array.isArray(draft.faqs) || draft.faqs.length < 4) errors.push('faqs must contain at least 4 items');
  const text = textOf(draft);
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plain ? plain.split(' ').length : 0;
  if (wordCount < 700) errors.push(`word count below 700 (${wordCount})`);

  for (const rule of FORBIDDEN_CLAIMS) if (rule.re.test(plain)) errors.push(`unsupported claim: ${rule.label}`);
  if (/\b(?:AI citation|ChatGPT citation|Perplexity citation|AI engines? will cite|guaranteed to rank)\b/i.test(plain)) errors.push('unsupported AI citation/ranking promise');

  const internalLinks = [...text.matchAll(/<a\b[^>]*\bhref\s*=\s*['"](\/[^'"#?]*)(?:\?[^'"]*)?['"][^>]*>/gi)].map(m => m[1]);
  const known = new Set(knownPaths);
  if (internalLinks.length < 3) errors.push(`fewer than 3 internal links (${internalLinks.length})`);
  for (const path of internalLinks) if (known.size && !known.has(path)) errors.push(`broken internal link: ${path}`);
  if (!known.size && internalLinks.length) errors.push('internal route manifest unavailable');

  const expectedSources = Array.isArray(topic.source_urls) ? topic.source_urls : [];
  const sourceLinks = [...text.matchAll(/<a\b[^>]*\bhref\s*=\s*['"](https:\/\/[^'"]+)['"][^>]*>/gi)].map(m => m[1]);
  if (expectedSources.length < 2) errors.push('editorial topic must provide at least 2 approved source_urls');
  for (const source of expectedSources) {
    if (typeof source !== 'string' || !/^https:\/\//i.test(source)) errors.push('source_urls entries must be https URLs');
    else if (!sourceLinks.includes(source)) errors.push(`required source not cited in article: ${source}`);
  }
  for (const url of sourceLinks) {
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { errors.push(`invalid source URL: ${url}`); continue; }
    if (!expectedSources.includes(url)) errors.push(`unapproved source link: ${url}`);
    if (!host || host === 'localhost' || /^\d/.test(host)) errors.push(`invalid source host: ${url}`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asText(draft.slug))) errors.push('slug must be lowercase kebab-case');
  if (existingSlugs.includes(draft.slug)) errors.push(`duplicate slug: ${draft.slug}`);
  if (scheduledFor && runDate && scheduledFor > runDate) errors.push(`not due until ${scheduledFor}`);
  if (scheduledFor && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) errors.push('scheduledFor must be YYYY-MM-DD');

  return { ok: errors.length === 0, errors, wordCount, internalLinks, sourceLinks };
}

// Small adapter seam used by dry-run tests and the real CLI. The caller owns
// persistence; a failed check never reaches the publication adapter.
async function runPublicationGate({ draft, topic, knownPaths, existingSlugs, scheduledFor, runDate, publish }) {
  const validation = validateEditorialDraft(draft, { topic, knownPaths, existingSlugs, scheduledFor, runDate });
  if (!validation.ok) return { published: false, validation };
  if (typeof publish !== 'function') throw new Error('publication adapter is required');
  const result = await publish(draft);
  return { published: true, validation, result };
}

module.exports = { validateEditorialDraft, runPublicationGate, FORBIDDEN_CLAIMS, sitePaths };
