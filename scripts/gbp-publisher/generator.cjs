// scripts/gbp-publisher/generator.js
// Takes a blog draft (from ../blog-publisher/drafts/<slug>.json) and asks Gemini
// to compress it into a Google Business Profile "What's New" post.
//
// GBP hard limits:
//   - summary: 1500 chars max (we target ≤1400 to leave headroom)
//   - CTA button: one of LEARN_MORE | BOOK | ORDER | SHOP | SIGN_UP | CALL
//   - image: one URL, public, ≥250x250, ≤5MB
//
// Output is a plain object ready for publisher.js to consume.

const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE_ORIGIN = 'https://goldenmaplelandscaping.ca';

function geminiPost(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 120000
    }, (res) => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout (120s)')); });
    req.write(data); req.end();
  });
}

function extractText(response) {
  if (response.error) throw new Error(`Gemini error: ${response.error.message || JSON.stringify(response.error)}`);
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].text && !parts[i].thought) return parts[i].text;
  }
  const fallback = parts.find(p => p.text);
  if (fallback) return fallback.text;
  throw new Error('No text in Gemini response: ' + JSON.stringify(response).slice(0, 400));
}

function parseJson(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) s = fence[1].trim();
  return JSON.parse(s);
}

function blogUrlForSlug(slug) {
  return `${SITE_ORIGIN}/resources/${slug}`;
}

function blogImageUrl(heroPath) {
  // heroPath comes in like "/images/projects/paver-driveway.JPG"
  // Site serves it as https://goldenmaplelandscaping.ca/images/projects/...
  if (!heroPath) return null;
  if (heroPath.startsWith('http')) return heroPath;
  return `${SITE_ORIGIN}${heroPath.startsWith('/') ? '' : '/'}${heroPath}`;
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(blog) {
  const introPlain = htmlToPlainText(blog.intro).slice(0, 1200);
  const firstSection = htmlToPlainText(blog.sections?.[0]?.html || '').slice(0, 800);
  const blogUrl = blogUrlForSlug(blog.slug);

  return `You are Yorkis Estevez, owner of Golden Maple Landscaping in Barrie, Ontario. You're writing a Google Business Profile "What's New" post that links to a new blog article.

OUTPUT FORMAT — return ONE JSON object only. No prose, no markdown fences.

{
  "summary": "<the post body, 800-1400 chars (NOT words), plain text only — no HTML, no markdown, no asterisks, no headers. Single block of prose with up to 4 short paragraphs separated by blank lines. Open with a Barrie/Simcoe-County hook. Tease the article without dumping the whole thing. End with one sentence that nudges the reader to tap the button.>",
  "ctaType": "LEARN_MORE",
  "ctaUrl": "${blogUrl}"
}

HARD CONSTRAINTS:
- summary length: between 800 and 1400 chars. Count chars, not words. Going over 1400 will be rejected.
- NO links inside summary (the CTA button handles that). NO email or phone — those go in the profile, not posts.
- NO emoji except at most ONE leaf 🍁 or 🌿 if it fits naturally. Do NOT use 🚀 ⭐ 🎯 💯 ✨ or anything corporate-sounding.
- Canadian English (metre, colour, neighbour).
- No banned phrases: "industry-leading", "passionate team", "dedicated team", "state-of-the-art", "in today's world", "look no further", "elevate your", "transform your".
- Reference real local context where it fits: Lake Simcoe, freeze-thaw, Barrie clay, Simcoe County weather. Don't fabricate addresses or named clients.
- Brand voice: operator-honest, anti-corporate, specific. Talk like a contractor explaining something at the kitchen table, not a marketing department.
- ctaType MUST be exactly "LEARN_MORE". Don't substitute.
- ctaUrl MUST be exactly "${blogUrl}". Don't substitute.

SOURCE ARTICLE (compress this — don't repeat verbatim):

TITLE: ${blog.title}
CATEGORY: ${blog.category}
LOCATION: ${blog.location_anchor || 'Barrie / Simcoe County'}

INTRO (excerpt):
${introPlain}

FIRST SECTION (excerpt):
${firstSection}

Output the JSON now.`;
}

const BANNED_PHRASES = [
  "in today's world", 'as a homeowner', 'industry-leading', 'state-of-the-art',
  'look no further', 'elevate your', 'transform your', 'passionate team', 'dedicated team'
];

function validatePost(post) {
  const errors = [];
  if (!post.summary || typeof post.summary !== 'string') errors.push('summary missing');
  if (!post.ctaType) errors.push('ctaType missing');
  if (!post.ctaUrl) errors.push('ctaUrl missing');

  const len = (post.summary || '').length;
  if (len < 600) errors.push(`summary too short (${len} chars, want ≥600)`);
  if (len > 1500) errors.push(`summary too long (${len} chars, GBP hard cap is 1500)`);

  const allowedCta = ['LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL'];
  if (post.ctaType && !allowedCta.includes(post.ctaType)) errors.push(`ctaType "${post.ctaType}" not in ${allowedCta.join('|')}`);

  if (post.ctaUrl && !/^https:\/\/goldenmaplelandscaping\.ca\//.test(post.ctaUrl)) {
    errors.push(`ctaUrl must be on goldenmaplelandscaping.ca (got ${post.ctaUrl})`);
  }

  const lower = (post.summary || '').toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) errors.push(`banned phrase: "${phrase}"`);
  }

  if (/<[a-z][^>]*>/i.test(post.summary || '')) errors.push('summary contains HTML tags (must be plain text)');
  if (/(?:^|\s)\*\*?\S/.test(post.summary || '')) errors.push('summary contains markdown asterisks');

  return { ok: errors.length === 0, errors, charCount: len };
}

async function generateGbpPost(blog) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY env var is required');
  if (!blog || !blog.slug || !blog.title) throw new Error('generateGbpPost: blog draft missing slug/title');

  console.log(`[gbp:generate] blog=${blog.slug}`);

  const response = await geminiPost(apiKey, {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(blog) }] }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  let post;
  try { post = parseJson(text); }
  catch (e) { throw new Error('Gemini returned non-JSON for GBP post: ' + text.slice(0, 500)); }

  // Hard-overwrite ctaUrl in case the model decided to "improve" it
  post.ctaType = 'LEARN_MORE';
  post.ctaUrl = blogUrlForSlug(blog.slug);

  post.slug = blog.slug;
  post.title = blog.title;
  post.imageUrl = blogImageUrl(blog.heroImage);
  post.generatedAt = new Date().toISOString();
  post.validation = validatePost(post);

  console.log(`[gbp:generate] chars=${post.validation.charCount} valid=${post.validation.ok}`);
  if (post.validation.errors.length) console.log('  - ' + post.validation.errors.join('\n  - '));

  return post;
}

function loadBlogDraft(slug) {
  const draftPath = path.join(__dirname, '..', 'blog-publisher', 'drafts', `${slug}.json`);
  if (!fs.existsSync(draftPath)) throw new Error(`Blog draft not found: ${draftPath}`);
  return JSON.parse(fs.readFileSync(draftPath, 'utf8'));
}

// Find the most-recent blog draft that hasn't been mirrored to GBP yet.
// Returns { blog, draftPath } or null if nothing pending.
function findPendingBlog(state, { maxAgeDays = 7 } = {}) {
  const blogStatePath = path.join(__dirname, '..', 'blog-publisher', 'state.json');
  if (!fs.existsSync(blogStatePath)) return null;
  const blogState = JSON.parse(fs.readFileSync(blogStatePath, 'utf8'));
  const history = blogState.history || [];
  if (!history.length) return null;

  const mirroredSlugs = new Set((state.mirrored || []).map(m => m.slug));
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  // Walk newest-first
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (mirroredSlugs.has(entry.slug)) continue;
    const ts = entry.at ? new Date(entry.at).getTime() : 0;
    if (ts < cutoff) continue;
    if (!entry.validation?.ok) continue;
    const draftPath = path.join(__dirname, '..', 'blog-publisher', 'drafts', `${entry.slug}.json`);
    if (!fs.existsSync(draftPath)) continue;
    const blog = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    return { blog, draftPath };
  }
  return null;
}

module.exports = {
  generateGbpPost,
  loadBlogDraft,
  findPendingBlog,
  validatePost,
  blogUrlForSlug,
  blogImageUrl
};
