// scripts/blog-publisher/topic-suggester.cjs
//
// When the topic queue runs low (≤8 unused topics), the watchdog calls this
// to spawn a Gemini-generated batch of 20 new Barrie/Simcoe topics, deduped
// against existing topics.json + the live sitemap (so we don't suggest
// something we've already published). Opens a PR adding them to topics.json.
//
// Uses existing GEMINI_API_KEY + GITHUB_TOKEN. No new secrets.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const TOPICS_PATH = path.join(SCRIPT_DIR, 'topics.json');
const STATE_PATH = path.join(SCRIPT_DIR, 'state.json');
const SITEMAP_URL = 'https://goldenmaplelandscaping.ca/sitemap.xml';
const REPO = 'yorkisestevez/goldenmaplelandscaping';

function gh(args, opts = {}) {
  const env = { ...process.env };
  if (opts.usePat && process.env.ACTIONS_PAT) env.GH_TOKEN = process.env.ACTIONS_PAT;
  return execSync(`gh ${args}`, { encoding: 'utf8', env, cwd: REPO_ROOT }).trim();
}
function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', timeout: 15000 },
      (res) => { let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, body })); }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function geminiPost(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 120000,
      },
      (res) => {
        let result = '';
        res.on('data', (c) => (result += c));
        res.on('end', () => { try { resolve(JSON.parse(result)); } catch { resolve({ raw: result }); } });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(data); req.end();
  });
}

function extractText(response) {
  if (response.error) throw new Error(`Gemini error: ${response.error.message || JSON.stringify(response.error)}`);
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].text && !parts[i].thought) return parts[i].text;
  }
  throw new Error('no text in response');
}

function parseJson(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) s = fence[1].trim();
  return JSON.parse(s);
}

async function gatherExisting() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const existingSlugs = new Set(topics.topics.map((t) => t.slug));
  const existingTitles = topics.topics.map((t) => t.title);

  // Also pull live sitemap to ensure we don't propose anything already published
  try {
    const sm = await httpsGet(SITEMAP_URL);
    if (sm.status === 200) {
      const liveSlugs = (sm.body.match(/\/resources\/[a-z0-9-]+/g) || [])
        .map((s) => s.slice('/resources/'.length));
      for (const s of liveSlugs) existingSlugs.add(s);
    }
  } catch { /* best effort */ }

  return { topics, existingSlugs, existingTitles };
}

function buildPrompt(existingTitles) {
  return `You are designing a long-tail SEO content backlog for Golden Maple Landscaping, a premium hardscape contractor in Barrie, Ontario. Service area: Barrie, Innisfil, Oro-Medonte, Springwater, Orillia, Wasaga Beach, Midland, Collingwood. The contractor installs Permacon/Unilock/Techo-Bloc pavers, TimberTech composite decking, builds retaining walls and outdoor living spaces, sources from Carr Landscape Depot, uses 12-16" clear stone bases (not granular A).

EXISTING / ALREADY PUBLISHED TITLES (don't duplicate these or near-duplicates):
${existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Generate 20 NEW long-tail SEO topic ideas. Each must:
- Target a specific Barrie/Simcoe-County keyword a homeowner would actually search
- Be a genuine buying-decision question (not generic content-mill filler)
- Avoid any overlap (even angle-wise) with the existing titles above
- Be specific enough to write 1500-2000 words of unique value

OUTPUT FORMAT — single JSON array, no prose, no fences:

[
  {
    "title": "<full article title, ≤80 chars>",
    "slug": "<kebab-case-slug, unique, ≤60 chars>",
    "category": "<Engineering|Materials|Design|Investment|Decking|Hiring Guide|Process|Seasonal|Regulations|Retaining Walls>",
    "primary_keyword": "<the search phrase this targets>",
    "location_anchor": "<Barrie|Innisfil|Oro-Medonte|Springwater|Orillia|Wasaga Beach|Midland|Collingwood|Simcoe County|Ontario>",
    "internal_link_hints": ["<3-4 site paths the article should link to, e.g. /services/interlocking-barrie, /locations/innisfil, /resources/why-patios-sink-barrie>"]
  }
]

Mix locations across the service area. Mix categories. Bias toward Investment + Engineering + Hiring Guide topics (highest conversion). At least 6 topics should reference a specific named municipality (Innisfil, Oro-Medonte, Wasaga Beach, etc.) in the title for hyperlocal SEO.

Output the JSON array now.`;
}

async function suggestTopics() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required');

  const { topics, existingSlugs, existingTitles } = await gatherExisting();
  console.log(`[topic-suggester] ${existingTitles.length} existing titles, ${existingSlugs.size} unique slugs (incl. live sitemap)`);

  const response = await geminiPost(apiKey, {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(existingTitles) }] }],
    generationConfig: {
      temperature: 0.85,    // higher than generation — we want creative range
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  const proposed = parseJson(extractText(response));
  if (!Array.isArray(proposed)) throw new Error('Gemini returned non-array');

  // Determine next auto-id from existing topics
  const existingIds = topics.topics
    .map((t) => /^auto-(\d+)$/.exec(t.id))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  const nextNum = (existingIds.length ? Math.max(...existingIds) : 0) + 1;

  // Dedup against existing slugs + within the proposed batch itself
  const seenSlugs = new Set(existingSlugs);
  const accepted = [];
  for (const p of proposed) {
    if (!p.slug || !p.title) continue;
    if (seenSlugs.has(p.slug)) { console.log(`[topic-suggester] skipping duplicate slug: ${p.slug}`); continue; }
    seenSlugs.add(p.slug);
    accepted.push({
      id: `auto-${String(nextNum + accepted.length).padStart(3, '0')}`,
      title: p.title,
      slug: p.slug,
      category: p.category || 'Engineering',
      primary_keyword: p.primary_keyword || p.title,
      location_anchor: p.location_anchor || 'Simcoe County',
      internal_link_hints: Array.isArray(p.internal_link_hints) ? p.internal_link_hints : [],
    });
  }

  console.log(`[topic-suggester] proposed ${proposed.length}, accepted ${accepted.length} after dedup`);
  return { accepted, originalCount: proposed.length };
}

async function openRefillPR({ accepted, originalCount }) {
  if (!accepted.length) {
    console.log('[topic-suggester] nothing to add (all duplicates) — skipping PR');
    return { skipped: true };
  }

  // Read fresh topics + append
  const topics = JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
  topics.topics.push(...accepted);
  fs.writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 2) + '\n');

  // Git: new branch, commit, push, PR
  const branch = `auto/topics-refill-${new Date().toISOString().slice(0, 10)}`;
  sh(`git config user.name "gm-blog-publisher[bot]"`);
  sh(`git config user.email "noreply@goldenmaplelandscaping.ca"`);
  sh(`git checkout -b "${branch}"`);
  sh(`git add scripts/blog-publisher/topics.json`);
  sh(`git commit -m "chore(topics): auto-suggest ${accepted.length} new topics (queue refill)"`);
  sh(`git push origin "${branch}"`);

  const titleList = accepted.map((t, i) => `${i + 1}. **${t.title}** (\`${t.slug}\`, ${t.category}, ${t.location_anchor})`).join('\n');
  const body = `## 📚 Topic queue auto-refill

The watchdog detected the topic queue running low and asked Gemini to propose ${originalCount} new long-tail SEO topics. After deduping against existing topics + the live sitemap, **${accepted.length} survived**.

### Proposed topics

${titleList}

### How to review
- Open \`scripts/blog-publisher/topics.json\` — the new entries are at the bottom.
- Drop any topic that doesn't match your strategy. Edit any title/keyword you want to refine.
- Merge to refill the queue.

### What happens after merge
The publisher cron picks topics in id order from \`topics.json\`, so these will get drawn after all currently-unused topics. Plenty of runway.

---

_Auto-opened by [scripts/blog-publisher/topic-suggester.cjs](./scripts/blog-publisher/topic-suggester.cjs) when the watchdog saw queue ≤8._
`;

  const bodyFile = path.join(SCRIPT_DIR, '_refill-pr-body.tmp.md');
  fs.writeFileSync(bodyFile, body);
  const prUrl = gh(
    `pr create --base main --head "${branch}" --title "chore(topics): auto-suggest ${accepted.length} new topics" --body-file "${bodyFile}"`,
    { usePat: true }
  );
  fs.unlinkSync(bodyFile);

  return { prUrl, accepted, branch };
}

module.exports = { suggestTopics, openRefillPR };

// Direct invocation
if (require.main === module) {
  (async () => {
    try {
      const result = await suggestTopics();
      const pr = await openRefillPR(result);
      console.log(JSON.stringify(pr, null, 2));
    } catch (e) {
      console.error('FAIL:', e.message);
      process.exit(1);
    }
  })();
}
