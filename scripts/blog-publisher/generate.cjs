// scripts/blog-publisher/generate.cjs
// In-repo, env-driven generator. Called by .github/workflows/blog-publisher.yml.
// Requires env: GEMINI_API_KEY

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname);
const TOPICS_PATH = path.join(ROOT, 'topics.json');
const STATE_PATH = path.join(ROOT, 'state.json');
const DRAFTS_DIR = path.join(ROOT, 'drafts');

const ALLOWED_HEROES = [
  '/images/projects/paver-driveway.JPG',
  '/images/projects/best.JPEG',
  '/images/projects/orillia-walkway.jpg',
  '/images/projects/Permacon-approved.jpeg',
  '/images/projects/patio-pergola.jpg',
  '/images/projects/IMG_4826.jpg',
  '/images/projects/garden-wall.JPEG',
  '/images/projects/IHPX8926.JPEG',
  '/images/projects/composite deck.jpeg',
  '/images/projects/TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg',
  '/images/projects/rendering1.jpg',
  '/images/projects/Yorkis Estevez.jpg'
];

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function geminiPost(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 180000
    }, (res) => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout (180s)')); });
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

function pickNextTopic(topics, state) {
  const used = new Set(state.usedTopicIds || []);
  return topics.find(t => !used.has(t.id)) || null;
}

function buildPrompt(topic) {
  const linkHints = (topic.internal_link_hints || []).join(', ') || '(none)';
  return `You are Yorkis Estevez writing for the Golden Maple Landscaping blog. You are a working hardscape contractor in Barrie, Ontario. Your readers are real homeowners in Simcoe County making a buying decision in the next 90 days.

OUTPUT FORMAT — return ONE JSON object only. No prose before or after. No markdown fences.

{
  "title": "<full article title, ≤80 chars — front-load the primary keyword>",
  "seoTitle": "<title tag, ≤60 chars, primary keyword at the very front, location second>",
  "seoDescription": "<meta description, ≤155 chars, single sentence that includes the numeric answer/range if relevant>",
  "category": "<one of: Engineering, Materials, Design, Investment, Decking, Hiring Guide, Process, Seasonal, Regulations, Retaining Walls>",
  "readTime": "<X min, integer between 6 and 12>",
  "heroImage": "<one path from ALLOWED list below — pick the most relevant>",
  "tldr": "<50-90 words. THE direct answer to the article's main question, written for Google featured snippets AND AI engines (ChatGPT/Claude/Perplexity citation). MUST contain at least one specific number, range, or named product. Plain prose — no HTML. This goes in a 'Quick Answer' box at the very top of the post.>",
  "intro": "<2-3 paragraph opening that follows the TL;DR — expands on it with a specific Barrie/Simcoe-County observation or real frustration. Plain HTML, only <p>, <strong>, <em> tags. No fluff openers. No 'In today's world.' No 'As a homeowner.'>",
  "sections": [
    {
      "heading": "<H2 — keyword-rich but human. Phrase as a question when the topic is informational.>",
      "html": "<3-5 paragraphs of plain HTML using only <p>, <strong>, <em>, <ul>, <li>, <a href='/internal/path'>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. NO inline styles. NO classes. NO <h3>. Aim for 200-350 words per section. EVERY section must contain at least one specific number, measurement, range, or named product/brand — not generic claims.>"
    }
  ],
  "comparison_table": {
    "include": <true|false — set true ONLY if the article meaningfully compares 2+ things (materials, brands, methods, prices). Set false for pure 'how-to' or definitional articles.>,
    "caption": "<short table caption, e.g. 'Paver brand comparison for Barrie installations'>",
    "html": "<a single <table> with <thead><tr><th> headers and <tbody><tr><td> data rows. 3-6 columns, 3-8 rows. Honest comparison — don't fake-skew toward our products. AI engines and Google featured snippets specifically extract from tables.>"
  },
  "faqs": [
    { "question": "<plain question a Barrie homeowner would actually type into Google. Phrase as a real search query.>", "answer": "<2-4 sentence direct answer that leads with the answer in the first sentence. No hedging. Include a specific number/range when possible.>" }
  ],
  "author_bio": "<one short paragraph (40-70 words) closing the article in Yorkis's voice. Mention: years on the tools (founded 2020), specific install volume claim that's verifiable ('we've installed hundreds of patios across Simcoe County'), one credibility marker (WSIB certified, $5M liability, 5.0 Google rating). This builds E-E-A-T for both Google and AI engines.>",
  "cta_paragraph": "<one paragraph that bridges from the article to contacting Golden Maple. Mention Barrie/Simcoe County. End naturally — the layout adds the actual button.>"
}

HARD CONSTRAINTS:
- Topic: ${topic.title}
- Primary keyword: ${topic.primary_keyword}
- Location anchor: ${topic.location_anchor}
- Category: ${topic.category}
- Target total length: 1500-2200 words across tldr + intro + sections + faqs + author_bio.
- 4 to 6 sections.
- 5 to 8 FAQs.
- Internal links: place at least 3 anchor links pointing to paths from this list (use only these paths, exactly as written): ${linkHints}, /contact, /cost-estimator, /portfolio
- **Numeric specificity (critical for SEO + AI citation):** every section should contain at least one specific number, range, measurement, percentage, or brand/product name. Generic statements like "many homeowners" or "high-quality materials" are banned — replace with "homeowners in Bayfield-Street neighbourhoods" or "ICPI-rated 80mm pavers".
- **Featured-snippet optimization:** FAQ answers and section opening sentences should be self-contained — readable as an extracted quote without surrounding context. Lead with the answer, then explain.
- Brand voice: operator-honest, anti-corporate, specific. No "industry-leading", "passionate", "dedicated team", "state-of-the-art", "in today's world", "look no further", "elevate your", "transform your".
- Use Canadian English (metre, colour, neighbour, kilometre, centimetre).
- No fake stats. No fake testimonials. If you need a number, give a range like "$X-$Y per square foot" and say what drives the variance.
- Reference real local context: Lake Simcoe, freeze-thaw cycles, Barrie's clay soil, Highway 400 corridor, Bayfield Street, City of Barrie bylaws, Simcoe County weather. Don't fabricate addresses or named clients.
- Founder is Yorkis Estevez. Company is Golden Maple Landscaping (founded 2020). Service area: Barrie, Innisfil, Oro-Medonte, Springwater, Orillia, Wasaga Beach, Midland, Collingwood. We install Permacon, Unilock, Techo-Bloc pavers + TimberTech composite decking. We use 12-16" compacted clear stone bases (not granular A). Supplier: Carr Landscape Depot in Barrie. WSIB certified, $5M liability, 5.0 Google rating.
- Don't mention competitors as superior. Don't recommend specific products outside this list.

ALLOWED hero image paths (pick the single most relevant one):
${ALLOWED_HEROES.map(h => '- ' + h).join('\n')}

Output the JSON now.`;
}

function htmlPlainTextLength(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
}

function validateDraft(draft) {
  const errors = [];
  const required = ['title', 'seoTitle', 'seoDescription', 'category', 'readTime', 'heroImage', 'tldr', 'intro', 'sections', 'faqs', 'author_bio', 'cta_paragraph'];
  for (const k of required) if (!draft[k]) errors.push(`missing ${k}`);
  if (draft.seoTitle && draft.seoTitle.length > 65) errors.push(`seoTitle too long (${draft.seoTitle.length})`);
  if (draft.seoDescription && draft.seoDescription.length > 165) errors.push(`seoDescription too long (${draft.seoDescription.length})`);
  if (!ALLOWED_HEROES.includes(draft.heroImage)) errors.push(`heroImage not in allowed list: ${draft.heroImage}`);
  if (!Array.isArray(draft.sections) || draft.sections.length < 4) errors.push(`sections must be ≥4 (got ${draft.sections?.length})`);
  if (!Array.isArray(draft.faqs) || draft.faqs.length < 4) errors.push(`faqs must be ≥4 (got ${draft.faqs?.length})`);

  // TLDR length check — featured-snippet sweet spot is ~50-90 words
  if (draft.tldr) {
    const tldrWords = draft.tldr.split(/\s+/).filter(Boolean).length;
    if (tldrWords < 35) errors.push(`tldr too short (${tldrWords}w, target 50-90)`);
    if (tldrWords > 110) errors.push(`tldr too long (${tldrWords}w, target 50-90)`);
  }

  const bodyHtml = [draft.tldr, draft.intro, ...(draft.sections || []).map(s => s.html), ...(draft.faqs || []).map(f => f.answer), draft.author_bio, draft.cta_paragraph].join(' ');
  const words = htmlPlainTextLength(bodyHtml);
  if (words < 1300) errors.push(`word count low (${words})`);

  const linkMatches = bodyHtml.match(/<a\s+href=['"]\/[^'"]+['"]/g) || [];
  if (linkMatches.length < 3) errors.push(`internal links <3 (got ${linkMatches.length})`);

  const banned = ['in today\'s world', 'as a homeowner', 'industry-leading', 'state-of-the-art', 'look no further', 'elevate your', 'transform your', 'passionate team', 'dedicated team'];
  const lower = bodyHtml.toLowerCase();
  for (const phrase of banned) {
    if (lower.includes(phrase)) errors.push(`banned phrase: "${phrase}"`);
  }

  // Soft signals (don't fail, but track)
  const hasTable = !!draft.comparison_table?.include && !!draft.comparison_table?.html;
  const numericMatches = (bodyHtml.match(/\b\d+([.,]\d+)?\s*(%|mm|cm|m|ft|in|"|sq\.?\s*ft|sqft|\$|CAD|years?|hours?|days?)\b/gi) || []).length;

  return { ok: errors.length === 0, errors, wordCount: words, linkCount: linkMatches.length, hasTable, numericCount: numericMatches };
}

async function generateDraft({ topicId = null } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY env var is required');

  const topics = readJson(TOPICS_PATH).topics;
  const state = readJson(STATE_PATH);

  let topic;
  if (topicId) {
    topic = topics.find(t => t.id === topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);
  } else {
    topic = pickNextTopic(topics, state);
    if (!topic) throw new Error('No unused topics remaining. Refill topics.json.');
  }

  console.log(`[generate] ${topic.id} — ${topic.title}`);

  const response = await geminiPost(apiKey, {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(topic) }] }],
    generationConfig: {
      temperature: 0.75,
      topP: 0.95,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  let draft;
  try { draft = parseJson(text); }
  catch (e) { throw new Error('Gemini returned non-JSON: ' + text.slice(0, 500)); }

  draft.slug = topic.slug;
  draft.topicId = topic.id;
  draft.generatedAt = new Date().toISOString();
  draft.author = 'Yorkis Estevez';
  draft.validation = validateDraft(draft);

  // Queue-low awareness: count topics still unused AFTER this run (i.e. topics
  // that won't be picked by future cron firings). Used by the PR-body builder
  // to flag when the operator needs to refill topics.json.
  const usedAfterThisRun = new Set([...(state.usedTopicIds || []), topic.id]);
  draft.queueRemaining = topics.filter(t => !usedAfterThisRun.has(t.id)).length;

  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const draftPath = path.join(DRAFTS_DIR, `${topic.slug}.json`);
  writeJson(draftPath, draft);

  state.usedTopicIds = [...(state.usedTopicIds || []), topic.id];
  state.lastRunAt = new Date().toISOString();
  state.currentDraft = topic.slug;
  state.history = [...(state.history || []), { topicId: topic.id, slug: topic.slug, at: draft.generatedAt, validation: draft.validation }];
  writeJson(STATE_PATH, state);

  console.log(`[generate] draft=${draftPath} valid=${draft.validation.ok} words=${draft.validation.wordCount} links=${draft.validation.linkCount}`);
  if (draft.validation.errors.length) console.log('  - ' + draft.validation.errors.join('\n  - '));

  return draft;
}

module.exports = { generateDraft, validateDraft, ALLOWED_HEROES };
