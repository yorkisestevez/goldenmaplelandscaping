// scripts/blog-publisher/generate.cjs
// In-repo, env-driven generator. NOT called by .github/workflows/blog-publisher.yml
// (that workflow is disabled) — invoked by whatever routine runs the weekly
// publish today (see README.md "Generation model").
// Requires env: GEMINI_API_KEY (vestigial presence-gate — set to any non-empty
// value to route through the local Claude CLI via claude-provider.cjs; it is
// NOT a real Gemini key and nothing here calls Google's API) or OPENAI_API_KEY
// (real fallback, unchanged)

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

// PATCHED 2026-07-28 — routed off Gemini onto the local Claude CLI.
// Google zeroed this key's free tier (limit: 0) so every publisher in the
// fleet died at the generate stage. geminiCompatPost keeps the exact request
// and response shape, so every call site and extractText() work unchanged.
// Original implementation preserved in generate.cjs.bak-gemini-20260728.
const { geminiCompatPost } = require('./claude-provider.cjs');
function geminiPost(apiKey, body) {
  return geminiCompatPost(apiKey, body);
}

function extractText(response) {
  // NOTE: despite the "Gemini error" prefix (kept for compat with the response
  // shape below), this path is actually the local Claude CLI (claude-provider.cjs)
  // — a failure here almost always means `claude` isn't on PATH or errored, not
  // a Gemini quota/API problem. Check the Claude CLI first.
  if (response.error) throw new Error(`Gemini error: ${response.error.message || JSON.stringify(response.error)}`);
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].text && !parts[i].thought) return parts[i].text;
  }
  const fallback = parts.find(p => p.text);
  if (fallback) return fallback.text;
  throw new Error('No text in Gemini response: ' + JSON.stringify(response).slice(0, 400));
}

// Generic OpenAI-compatible POST. Works for OpenAI (api.openai.com) and
// DeepSeek (api.deepseek.com) which share the same /v1/chat/completions format.
function openaiCompatiblePost(apiKey, prompt, { hostname, model }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional SEO content writer. You MUST write LONG, DETAILED content. Each section in the "sections" array MUST contain at least 200-350 words of HTML content. The total word count across all fields MUST be at least 1300 words. Do not truncate or summarize — write full, complete paragraphs. Return only valid JSON with no markdown fences.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 8192,
      response_format: { type: 'json_object' }
    });
    const req = https.request({
      hostname,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 180000
    }, (res) => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`${hostname} timeout (180s)`)); });
    req.write(data); req.end();
  });
}

function extractOpenAICompatibleText(response, provider) {
  if (response.error) throw new Error(`${provider} error: ${response.error.message || JSON.stringify(response.error)}`);
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No text in ${provider} response: ` + JSON.stringify(response).slice(0, 400));
  return content;
}

// The Claude CLI often wraps its answer in a ```json fence despite the prompt
// saying not to. The original regex required BOTH fences, so any output whose
// closing fence was missing (truncated, or the model just stopped) fell through
// to JSON.parse('```json{...') and always threw. That was the 2026-08-01 Nudgel
// failure: the blog never published a single post because of it.
function parseJson(text) {
  let s = text.trim();
  const fenced = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) {
    s = fenced[1].trim();
  } else {
    // Unclosed fence — strip whatever opener/closer is actually there.
    s = s.replace(/^```(?:json)?[ \t]*\r?\n?/, '').replace(/\r?\n?[ \t]*```$/, '').trim();
  }
  try {
    return JSON.parse(s);
  } catch (err) {
    // Model wrapped the object in prose ("Here's the JSON:"). Take the
    // outermost {...} span before giving up.
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last > first) return JSON.parse(s.slice(first, last + 1));
    throw err;
  }
}

function pickNextTopic(topics, state) {
  const used = new Set(state.usedTopicIds || []);
  return topics.find(t => !used.has(t.id)) || null;
}

/**
 * Topic-matched estimator link. A retaining-wall post should send readers to
 * the calculator ALREADY on the wall path (`?type=wall` lands them on step 2
 * with the right project selected) — a bare link makes them re-answer what the
 * article was about. Prefill params only; NO utm_* on internal links (UTMs on
 * internal navigation restart GA4 sessions and clobber true acquisition source).
 */
function estimatorPathFor(topic) {
  const text = `${topic.title} ${topic.primary_keyword} ${topic.category}`.toLowerCase();
  if (/retaining wall|armour stone|garden wall|slope|grading|drainage/.test(text)) return '/cost-estimator?type=wall';
  // Positive match, not a bare /deck/ test — "Best Pavers for Pool Decks" is a
  // paver topic that happens to contain the word "decks"; a bare /deck/ test
  // routed it to the composite-decking estimator prefill instead of patio.
  if (/composite deck|decking|timbertech|azek/.test(text)) return '/cost-estimator?type=deck';
  if (/walkway|steps|front entrance/.test(text)) return '/cost-estimator?type=steps';
  if (/turf/.test(text)) return '/cost-estimator?type=turf';
  if (/fire pit|firepit/.test(text)) return '/cost-estimator?type=firepit';
  if (/pergola|pavilion|gazebo/.test(text)) return '/cost-estimator?type=pergola';
  if (/outdoor kitchen/.test(text)) return '/cost-estimator?type=kitchen';
  if (/lighting/.test(text)) return '/cost-estimator?type=lighting';
  if (/backyard transformation|outdoor living/.test(text)) return '/cost-estimator?type=full';
  if (/patio|interlock|paver|flagstone|natural stone|concrete/.test(text)) return '/cost-estimator?type=patio';
  return '/cost-estimator';
}

function buildPrompt(topic) {
  const linkHints = (topic.internal_link_hints || []).join(', ') || '(none)';
  const estimatorPath = estimatorPathFor(topic);
  return `You are Yorkis Estevez writing for the Golden Maple Landscaping blog. You are a working hardscape contractor in Barrie, Ontario. Your readers are real homeowners in Simcoe County making a buying decision in the next 90 days.

OUTPUT FORMAT — return ONE JSON object only. No prose before or after. No markdown fences.

CRITICAL — never type a straight double quote (") inside any string value. It
ends the JSON string early and the whole response is discarded. When you need
quotation marks inside prose, use curly quotes (“ ”). Use single quotes for any
HTML attribute, e.g. <a href='/blog'>. This is the single most common way this
response gets thrown away.

{
  "title": "<full article title, ≤80 chars — front-load the primary keyword>",
  "seoTitle": "<title tag, ≤60 chars, primary keyword at the very front, location second>",
  "seoDescription": "<meta description, ≤155 chars, single sentence that includes the numeric answer/range if relevant>",
  "category": "<one of: Engineering, Materials, Design, Investment, Decking, Hiring Guide, Process, Seasonal, Regulations, Retaining Walls>",
  "readTime": "<STRING formatted as 'X min' where X is an integer 6-12, e.g. '8 min'. MUST be a JSON string, NOT a bare integer.>",
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
  "author_bio": "<40-70 words closing in the author's voice. CRITICAL: invent NO facts about the business — no founding year, no years-in-business, no square footage, no job counts, no revenue, no client counts. Use ONLY details supplied in credibilityMarkers above. If a specific number is not given to you, do not state one. Write about the WORK and the POV, not about scale.>",
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
- Internal links: place at least 3 anchor links pointing to paths from this list (use only these paths, exactly as written): ${linkHints}, /contact, ${estimatorPath}, /portfolio
- The cost-estimator link (${estimatorPath}) MUST appear in the cta_paragraph${estimatorPath.includes('?type=') ? ` — it opens the calculator with this topic's project type already selected, so anchor it with copy like "price out your own ${topic.category.toLowerCase()} project" rather than generic "click here"` : ' — this topic has no matching prefill, so the link opens the calculator on its first step; anchor it with general copy like "get a real price on your project" rather than claiming a preselected type'}.
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

  const linkMatches = bodyHtml.match(/<a\s+href=['"]\/[^'"]*['"]/g) || [];
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
  const geminiKey = process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !deepseekKey && !openaiKey) {
    throw new Error('Set GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY');
  }

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

  let text;
  if (geminiKey) {
    const response = await geminiPost(geminiKey, {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(topic) }] }],
      generationConfig: {
        temperature: 0.75,
        topP: 0.95,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json'
      }
    });
    text = extractText(response);
    console.log('[generate] used local Claude CLI (via claude-provider.cjs, GEMINI_API_KEY presence-gate)');
  } else if (deepseekKey) {
    console.log('[generate] using DeepSeek deepseek-chat (~10x cheaper than OpenAI)');
    const response = await openaiCompatiblePost(deepseekKey, buildPrompt(topic), {
      hostname: 'api.deepseek.com',
      model: 'deepseek-chat'
    });
    text = extractOpenAICompatibleText(response, 'DeepSeek');
    console.log('[generate] used DeepSeek');
  } else {
    console.log('[generate] using OpenAI gpt-4o (DEEPSEEK_API_KEY not set)');
    const response = await openaiCompatiblePost(openaiKey, buildPrompt(topic), {
      hostname: 'api.openai.com',
      model: 'gpt-4o'
    });
    text = extractOpenAICompatibleText(response, 'OpenAI');
    console.log('[generate] used OpenAI gpt-4o');
  }

  let draft;
  try { draft = parseJson(text); }
  catch (e) { throw new Error('LLM returned non-JSON: ' + text.slice(0, 500)); }

  // Defensive normalization — Gemini sometimes returns shapes that differ
  // from the prompt's contract (e.g. readTime as a bare integer instead of
  // a string like "8 min"). Caught 2026-06-08: inject.cjs crashed on
  // `draft.readTime.includes is not a function`. Normalize once here so all
  // downstream consumers see a consistent shape.
  if (typeof draft.readTime === 'number') draft.readTime = `${draft.readTime} min`;
  if (typeof draft.readTime !== 'string') draft.readTime = '8 min';

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

// parseJson is exported for its regression test — the unclosed-fence bug it
// guards silently killed the Nudgel blog entirely (2026-08-01).
module.exports = { generateDraft, validateDraft, parseJson, ALLOWED_HEROES, estimatorPathFor };
