// scripts/blog-publisher/adversarial-review.cjs
//
// Second-pass quality gate. After generate.cjs produces a draft, this calls
// Gemini AGAIN with an adversarial reviewer prompt:
//   "Critique this Yorkis-blog draft. Find fake stats, hedged claims,
//    duplicate angles vs prior posts, anything that would embarrass the brand
//    or get flagged by Google quality filters."
//
// Returns { verdict: 'pass'|'warn'|'block', issues: [...], score: 0-10 }.
//
// Verdict mapping:
//   pass  → no warnings (silent)
//   warn  → workflow continues, PR body shows warnings
//   block → workflow halts before PR creation, Telegram alerts operator
//
// Uses the existing GEMINI_API_KEY. No new secrets.

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PUBLISHED_LIST_PATH = path.join(__dirname, 'state.json');

// PATCHED 2026-07-28 — routed off Gemini onto the local Claude CLI (free tier is limit:0).
// Same request/response shape, so all call sites below are untouched.
const { geminiCompatPost } = require('./claude-provider.cjs');
function geminiPost(apiKey, body) {
  return geminiCompatPost(apiKey, body);
}

function extractText(response) {
  if (response.error) throw new Error(`Gemini reviewer error: ${response.error.message || JSON.stringify(response.error)}`);
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].text && !parts[i].thought) return parts[i].text;
  }
  const fallback = parts.find((p) => p.text);
  if (fallback) return fallback.text;
  throw new Error('No text in Gemini reviewer response');
}

function parseJson(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) s = fence[1].trim();
  return JSON.parse(s);
}

// Pull titles + slugs of previously generated posts for dedup context
function priorTitlesContext() {
  try {
    const state = JSON.parse(fs.readFileSync(PUBLISHED_LIST_PATH, 'utf8'));
    const history = (state.history || []).slice(-30);  // last 30 to keep prompt small
    return history.map((h) => h.slug).join(', ');
  } catch { return '(no history)'; }
}

function buildReviewerPrompt(draft) {
  const body = [
    draft.tldr ? `TL;DR (Quick Answer box at top):\n${draft.tldr}` : '',
    draft.intro,
    ...(draft.sections || []).map((s) => `## ${s.heading}\n${s.html}`),
    draft.comparison_table?.include && draft.comparison_table?.html ? `## Comparison table\n${draft.comparison_table.caption || ''}\n${draft.comparison_table.html}` : '',
    ...(draft.faqs || []).map((f) => `Q: ${f.question}\nA: ${f.answer}`),
    draft.author_bio ? `Author bio:\n${draft.author_bio}` : '',
  ].filter(Boolean).join('\n\n');

  return `You are an adversarial editor reviewing a draft blog post for Golden Maple Landscaping (Barrie, Ontario hardscape contractor). Your job is to find what's WRONG with this draft. The post is auto-generated and headed to production; a careless approval will damage the brand or hurt Google SEO + AI engine visibility (ChatGPT/Claude/Perplexity citation).

DRAFT TO REVIEW:
Title: ${draft.title}
SEO Description: ${draft.seoDescription}
Category: ${draft.category}
Hero image: ${draft.heroImage}

${body}

PRIOR PUBLISHED SLUGS (don't duplicate these angles):
${priorTitlesContext()}

EVALUATE on these axes (1-10 each, 10 = best):
- factual_accuracy:        Any made-up stats, fake pricing, fabricated standards, wrong product info? Specifically, the contractor uses: Permacon/Unilock/Techo-Bloc pavers + TimberTech composite + Carr Landscape Depot supplier + 12-16" clear stone bases (NOT granular A). Service area: Barrie, Innisfil, Oro-Medonte, Springwater, Orillia, Wasaga Beach, Midland, Collingwood.
- voice_fit:               Operator-honest contractor voice, NOT corporate marketing. "We" not "Golden Maple". No "industry-leading", "passionate team", "state-of-the-art", etc.
- specificity:             Real Simcoe County references (Lake Simcoe, freeze-thaw, Barrie clay, Bayfield St, etc.) — not generic Ontario filler.
- seo_value:               Does this target a real long-tail keyword? Will Google rank it? Or is it generic content-mill stuff?
- originality:             Does this duplicate ANGLES (the actual argument / takeaway) from prior published slugs? IMPORTANT: the SLUG itself cannot be a duplicate — upstream code in generate.cjs hard-guards against ever picking an already-used topic, so by the time you see this draft the slug is guaranteed unique. Originality concerns must be about CONTENT overlap (e.g. "this rehashes the same points as winter-damage-prevention-interlocking"), NEVER about slug-string similarity. Topic words like "interlocking" or "patio" appearing across many slugs is normal hyperlocal SEO coverage — that is NOT duplication. Do NOT block on slug-name similarity under any circumstances.
- safety:                  Any legal claims, regulatory advice, or safety guidance that could mislead a homeowner?
- canadian_english:        Metre/colour/neighbour/kilometre — not American spellings.
- tldr_quality:            Does the TL;DR Quick Answer (top of post) directly answer the article's main question in 50-90 words? Does it include at least one specific number/range? Could it stand alone as a Google featured snippet?
- featured_snippet_ready:  Are FAQ answers self-contained (each quotable as a standalone answer)? Do section opening sentences lead with the answer (not the lead-up)? Could Google pull a clean snippet from this?
- ai_citation_ready:       Is this content "citable" by AI engines (ChatGPT/Claude/Perplexity)? Named facts with specific numbers/brands? Could an AI confidently quote a sentence with attribution? Avoid hedged claims like "many people think" — bias toward declarative facts.
- numeric_density:         Does almost every section contain at least one specific number, measurement, percentage, range, or named product? Or does it drift into vague claims?
- e_e_a_t:                 Author bio shows real expertise (years on the tools since 2020, install volume, certifications WSIB / $5M liability)? Brand markers appear naturally without sounding like a marketing aside?

OUTPUT FORMAT — single JSON object, no prose before/after, no markdown fences:

{
  "verdict": "pass" | "warn" | "block",
  "score": <integer 1-10, weighted overall>,
  "axes": { "factual_accuracy": <1-10>, "voice_fit": <1-10>, "specificity": <1-10>, "seo_value": <1-10>, "originality": <1-10>, "safety": <1-10>, "canadian_english": <1-10> },
  "issues": [
    { "axis": "<axis name>", "severity": "low" | "medium" | "high", "quote": "<exact phrase from draft>", "problem": "<one-line problem>", "fix": "<one-line suggested fix>" }
  ],
  "summary": "<1-2 sentence overall assessment for the PR body>"
}

VERDICT RULES (apply strictly):
- "block" = ANY axis ≤4 OR ANY high-severity issue on factual_accuracy/safety. Do NOT auto-publish this — it will embarrass the brand.
- "warn"  = any axis 5-6 OR any medium-severity issue. Acceptable to publish but operator should read carefully.
- "pass"  = all axes ≥7 AND no high/medium issues.

Bias toward "block" for factual or safety problems. We can always regenerate; we can't easily un-publish.

Output the JSON now.`;
}

function openaiCompatiblePost(apiKey, prompt, { hostname, model }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
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

async function reviewDraft(draft, { apiKey = null } = {}) {
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !deepseekKey && !openaiKey) throw new Error('Set GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY for adversarial reviewer');

  const prompt = buildReviewerPrompt(draft);
  console.log(`[reviewer] critiquing draft: ${draft.slug}`);

  let text;
  if (geminiKey) {
    const response = await geminiPost(geminiKey, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });
    text = extractText(response);
    console.log('[reviewer] used Gemini');
  } else if (deepseekKey) {
    const response = await openaiCompatiblePost(deepseekKey, prompt, { hostname: 'api.deepseek.com', model: 'deepseek-chat' });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No text in DeepSeek reviewer response');
    text = content;
    console.log('[reviewer] used DeepSeek');
  } else {
    const response = await openaiCompatiblePost(openaiKey, prompt, { hostname: 'api.openai.com', model: 'gpt-4o' });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No text in OpenAI reviewer response');
    text = content;
    console.log('[reviewer] used OpenAI gpt-4o');
  }
  let review;
  try { review = parseJson(text); }
  catch (e) {
    // If reviewer crashes, fail open (warn) so we don't silently block
    return {
      verdict: 'warn',
      score: null,
      axes: {},
      issues: [{ axis: 'reviewer_error', severity: 'medium', problem: `Reviewer returned non-JSON: ${e.message}`, fix: 'Manual review recommended', quote: text.slice(0, 200) }],
      summary: `Adversarial reviewer failed to parse. Manual review recommended.`,
    };
  }

  // Defensive normalization
  if (!['pass', 'warn', 'block'].includes(review.verdict)) review.verdict = 'warn';
  if (!Array.isArray(review.issues)) review.issues = [];

  console.log(`[reviewer] verdict=${review.verdict} score=${review.score} issues=${review.issues.length}`);

  // Jev second-opinion (added 2026-09-21). The primary reviewer produces the
  // rich issue list; Jev independently classifies the draft on the same three
  // buckets using its Choice primitive. If Jev disagrees with the primary on
  // pass/block (the two decisive verdicts), downgrade to 'warn' so a human
  // eyeballs it. Non-fatal: Jev API outage falls silently back to the primary
  // verdict. Only fires when TYPESAFE_API_KEY is set.
  if (process.env.TYPESAFE_API_KEY) {
    try {
      const jev = await jevSecondOpinion(draft, review.verdict);
      if (jev && jev.verdict && jev.verdict !== review.verdict) {
        console.log(`[reviewer] jev-second-opinion=${jev.verdict} (conf ${(jev.confidence || 0).toFixed(2)}) — disagreed with primary=${review.verdict}`);
        // Only downgrade in the decisive direction: if either side says block,
        // treat as warn (human review); if both agree it's safe or both agree
        // block, verdict stays. This avoids Jev accidentally UPGRADING a block
        // to a pass.
        if (review.verdict === 'pass' || jev.verdict === 'block') {
          review.verdict = 'warn';
          review.issues.push({
            axis: 'jev_disagreement',
            severity: 'medium',
            problem: `Jev independent verdict was "${jev.verdict}" (${((jev.probabilities || {})[jev.verdict] || 0) * 100 | 0}%) while primary reviewer said "${review.verdict}". Downgraded to warn for manual review.`,
            fix: 'Read both reviews and decide.',
            quote: null,
          });
        }
      } else if (jev) {
        console.log(`[reviewer] jev-second-opinion=${jev.verdict} ✓ agrees with primary`);
      }
    } catch (e) {
      // Non-fatal — reviewer keeps its primary verdict.
      console.warn(`[reviewer] jev second-opinion failed: ${e.message}`);
    }
  }

  return review;
}

// Jev independent verdict via Choice primitive. Same three buckets as the
// primary reviewer. Returns { verdict, confidence, probabilities } or null.
async function jevSecondOpinion(draft, primaryVerdict) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return null;

  const state = {
    slug: draft.slug,
    title: draft.title || draft.metaTitle || '',
    tldr: draft.tldr || draft.summary || '',
    sections: (draft.sections || []).slice(0, 6).map((s) => ({
      heading: s.heading || s.h2 || '',
      content_preview: String(s.content || s.html || '').replace(/<[^>]+>/g, ' ').slice(0, 400),
    })),
  };

  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state,
      model: 'jev-latest',
      questions: {
        verdict: {
          type: 'choice',
          instructions: `You are a second-opinion adversarial reviewer for a Golden Maple Landscaping blog draft (hardscape contractor in Barrie, Ontario). Judge this draft using the same three buckets a human editor would use before publishing to goldenmaplelandscaping.ca. Focus on: fabricated stats, math inconsistencies (numbers that contradict elsewhere in the post), hedged/weasel language, embarrassing AI tells, or Google-quality-filter risks. Pick exactly one.`,
          criteria: {
            pass: 'Ready to publish as-is. Numbers check out, voice is grounded and specific, no embarrassing AI hedging.',
            warn: 'Publishable with minor edits — a hedged claim, a rough math approximation, a slightly generic paragraph, or a small hyperlocal-specificity gap. Ship with note.',
            block: 'Should NOT publish without a rewrite. Fabricated statistic, internally inconsistent numbers (e.g. $150/event in TL;DR but $4/event in body), unsourced claim about a real person or business, or a duplicate angle vs. a prior post.',
          },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`jev HTTP ${res.status}`);
  const data = await res.json();
  const ans = data.answers?.verdict;
  if (!ans || !ans.choice) return null;
  return {
    verdict: ans.choice,
    confidence: ans.confidence || 0,
    probabilities: ans.probabilities || {},
  };
}

module.exports = { reviewDraft };

// Allow direct invocation for local testing: `node adversarial-review.cjs path/to/draft.json`
if (require.main === module) {
  const draftPath = process.argv[2];
  if (!draftPath) { console.error('Usage: node adversarial-review.cjs <draft.json>'); process.exit(2); }
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  reviewDraft(draft).then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.verdict === 'block' ? 2 : r.verdict === 'warn' ? 1 : 0);
  }).catch((e) => { console.error('FAIL:', e.message); process.exit(3); });
}
