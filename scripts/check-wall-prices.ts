import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeEstimate, type EstimateInput } from '../src/utils/estimateEngine';
import type { EstimatorLocationKey } from '../src/data/locations';

/**
 * Retaining-wall prices on the site (blog posts, the retaining-walls service page, location cost tables) are the cost estimator's own (owner decision 2026-10-17: the engine's wall
 * allowance, about $330–$670 per linear foot by height at the default mid tier, is closer to what Golden Maple
 * charges than the old blog ranges). The posts carry plain text so the prerendered HTML stays crawlable; this
 * check recomputes every quoted figure from the engine so a rate change cannot leave a post behind.
 */
let checks = 0;
const ok = (value: unknown, message: string) => { assert(value, message); checks++; };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

type Height = 'Under 2ft' | '2-4ft' | '4-6ft' | '6ft+';
const HEIGHTS: Height[] = ['Under 2ft', '2-4ft', '4-6ft', '6ft+'];
type Condition = 'access' | 'slope' | 'drainage';
/** Per-foot prices are quoted for the estimator's default 50 ft wall; site-work minimums make short walls cost more per foot. */
const QUOTED_LENGTH = 50;
/** The estimator's starting build (Estimator.tsx useState defaults): mid tier, its default paver, an accessible site. */
const SIZES = { patio: 500, stone: 500, wall: QUOTED_LENGTH, wallHeight: '2-4ft', steps: 5, deck: 300, kitchen: 'Basic', firepit: 'Medium', pergola: 'Medium', turf: 500, lighting: 'Medium' };
const EASY_SITE = { access: false, slope: false, drainage: false, levels: false };

function input(els: string[], sizes: Record<string, number | string>, town: EstimatorLocationKey, conditions: Partial<Record<Condition, boolean>> = {}): EstimateInput {
  return {
    projectType: els.length > 1 ? 'full' : els[0], selectedElements: els.length > 1 ? els : [], sizes: { ...SIZES, ...sizes }, details: {},
    conditions: { ...EASY_SITE, ...conditions }, location: town, tier: 'mid',
    paverBrandId: 'permacon-mondrian-plus', deckBrandId: 'timbertech-prime', addOns: [],
  };
}
/** The engine's most-likely pre-HST figure and its own low/high band. */
function price(i: EstimateInput) {
  const r = computeEstimate(i);
  assert(r.precise, 'the engine must return a precise figure for every quoted wall');
  return { likely: r.precise.subtotalCents / 100, low: r.totalLow, high: r.totalHigh };
}
const wall = (lf: number, h: Height, town: EstimatorLocationKey, conditions: Partial<Record<Condition, boolean>> = {}) =>
  price(input(['wall'], { wall: lf, wallHeight: h }, town, conditions));

const to = (n: number, step: number) => Math.round(n / step) * step;
const usd = (n: number) => `$${n.toLocaleString('en-CA')}`;
const range = (low: number, high: number, step: number) => `${usd(to(low, step))}–${usd(to(high, step))}`;
/** "around $330 per linear foot (typically $280–$425)" for one height band at the quoted length. */
const foot = (h: Height, town: EstimatorLocationKey) => {
  const p = wall(QUOTED_LENGTH, h, town);
  return { around: usd(to(p.likely / QUOTED_LENGTH, 10)), typical: range(p.low / QUOTED_LENGTH, p.high / QUOTED_LENGTH, 5) };
};
const pct = (n: number) => Math.round(n * 100);

// ---- Sanity: the engine figures the posts rely on behave like the posts say ----
for (const town of ['barrie', 'oro-medonte'] as EstimatorLocationKey[]) {
  const perFoot = HEIGHTS.map((h) => wall(QUOTED_LENGTH, h, town).likely / QUOTED_LENGTH);
  ok(perFoot.every((v, i) => i === 0 || v > perFoot[i - 1]), `${town}: taller walls cost more per foot`);
  ok(wall(20, 'Under 2ft', town).likely / 20 > perFoot[0], `${town}: a short wall costs more per foot than a ${QUOTED_LENGTH} ft one`);
}
/** What tight access, a slope and wet soil add, across the heights the posts discuss (under 2 ft to 4-6 ft). */
const uplift = (conditions: Partial<Record<Condition, boolean>>) =>
  (['Under 2ft', '2-4ft', '4-6ft'] as Height[]).map((h) => wall(QUOTED_LENGTH, h, 'barrie', conditions).likely / wall(QUOTED_LENGTH, h, 'barrie').likely - 1);
const span = (xs: number[]) => `${pct(Math.min(...xs))}–${pct(Math.max(...xs))}%`;
const ACCESS = span(uplift({ access: true })), SLOPE = span(uplift({ slope: true })), DRAINAGE = span(uplift({ drainage: true }));
const COMBINED = span(uplift({ access: true, slope: true, drainage: true }));
const CONDITIONS = `Tight equipment access adds roughly ${ACCESS}, a steep slope ${SLOPE} and wet soil that needs extra drainage ${DRAINAGE}; together they add about ${COMBINED}.`;

// ---- RetainingWallGuide (Simcoe County / Barrie figures) ----
{
  const post = read('src/pages/blog/RetainingWallGuide.tsx');
  const line = (label: string, h: Height, plus = '') => {
    const f = foot(h, 'barrie');
    return `<li><strong>${label}:</strong> around ${f.around}${plus} per linear foot (typically ${f.typical})</li>`;
  };
  ok(post.includes(line('Small garden walls (under 2 ft)', 'Under 2ft')), 'guide: under 2 ft');
  ok(post.includes(line('Structural walls (2-4 ft)', '2-4ft')), 'guide: 2-4 ft');
  ok(post.includes(line('Engineered walls (4-6 ft)', '4-6ft')), 'guide: 4-6 ft');
  ok(post.includes(line('Taller engineered walls (6 ft+)', '6ft+', '+')), 'guide: 6 ft+');
  ok(post.includes(`for about ${QUOTED_LENGTH} feet of wall on an accessible site in Barrie, before HST`), 'guide: says what the figures assume');
  ok(post.includes(CONDITIONS), `guide: site conditions (${COMBINED} combined) stated`);
  ok(!/\$150-\$250|\$300-\$500|\$500-\$800|\$280–\$400|\$380–\$590/.test(post), 'guide: superseded per-foot ranges are gone');
}

// ---- RetainingWallCostOroMedonte (Oro-Medonte figures) ----
const oro: EstimatorLocationKey = 'oro-medonte';
{
  const post = read('src/pages/blog/RetainingWallCostOroMedonte.tsx');
  const excerpt = read('src/data/blogPosts.ts').split(/\r?\n/).find((l) => l.includes('excerpt: "Retaining walls in Oro-Medonte')) ?? '';
  const [low, mid, tall] = (['Under 2ft', '2-4ft', '4-6ft'] as Height[]).map((h) => foot(h, oro));
  const seo = `Retaining walls in Oro-Medonte cost about ${low.around}–${tall.around} per linear foot installed in 2026, before HST, depending on height, site access and engineering.`;
  ok(seo.length <= 160, `oro: SEO description fits a results snippet (${seo.length} chars)`);
  ok(post.includes(`seoDescription="${seo}"`), 'oro: SEO description');
  ok(excerpt.includes(`excerpt: "${seo}`), 'oro: blog index excerpt matches the SEO description');
  const run30 = range(wall(30, 'Under 2ft', oro).likely, wall(30, '2-4ft', oro).likely, 500);
  const tldr = `A single-tier retaining wall in Oro-Medonte runs about ${low.around}–${mid.around} per linear foot installed before HST for walls up to 4 ft, or roughly ${run30} for a typical 30-foot run.`;
  ok(post.includes(`tldr="${tldr}`), `oro: TL;DR (${run30} for 30 ft)`);
  ok(post.includes(`leading-relaxed mb-0">${tldr}`), 'oro: visible TL;DR matches the tldr prop');
  const total = (fromLf: number, toLf: number, h: Height) => range(wall(fromLf, h, oro).low, wall(toLf, h, oro).high, 500);
  ok(post.includes(`<li><strong>Basic single-tier wall (under 2 ft / 600 mm high, 20–30 linear feet):</strong> ${total(20, 30, 'Under 2ft')} total</li>`), 'oro: basic wall total');
  ok(post.includes(`<li><strong>Mid-height wall (2–4 ft / 600–1,200 mm, 30–50 linear feet, with drainage system):</strong> ${total(30, 50, '2-4ft')}</li>`), 'oro: mid wall total');
  ok(post.includes(`<li><strong>Engineered wall (4–6 ft / 1.2–1.8 m, 30–50 linear feet, full drainage and geogrid; taller or tiered walls cost more):</strong> ${total(30, 50, '4-6ft')}+</li>`), 'oro: engineered wall total');
  ok(post.includes(`On a per-linear-foot basis (about ${QUOTED_LENGTH} feet of wall on an accessible site, before HST), pricing runs around ${low.around} under 2 ft (typically ${low.typical}), ${mid.around} at 2–4 ft (${mid.typical}) and ${tall.around} at 4–6 ft (${tall.typical}). Shorter walls cost more per foot, because the dig-out, delivery and cleanup don't shrink with the wall. ${CONDITIONS}`), 'oro: per-foot sentence, length note and site conditions');
  ok(post.includes('Here is what our cost estimator shows for installed retaining walls in Oro-Medonte in 2026, before HST, on an accessible site:'), 'oro: totals are attributed to the estimator');
  ok(post.includes('divide the per-foot price by the wall height to compare'), 'oro: face-area pricing explained without an unsourced rate');
  const spread = `price spread between an ${usd(to(wall(20, 'Under 2ft', oro).low, 500))} job and a ${usd(to(wall(50, '4-6ft', oro).high, 500))} job`;
  ok(post.includes(spread), `oro: ${spread}`);
  const step = `about ${to(pct(wall(QUOTED_LENGTH, '4-6ft', oro).likely / wall(QUOTED_LENGTH, '2-4ft', oro).likely - 1), 5)}% more per foot`;
  ok((post.match(new RegExp(step, 'g')) ?? []).length === 2, `oro: both height-jump claims say "${step}"`);
  const lowWall = `our estimator puts a wall under 2 ft at around ${low.around} per linear foot before HST for about ${QUOTED_LENGTH} feet, with a basic gravel base`;
  ok((post.match(new RegExp(lowWall.replace(/\$/g, '\\$'), 'g')) ?? []).length === 2, 'oro: both low-wall FAQ answers quote the estimator, not a product price');
  ok(!/\$150–\$350|\$150–\$300|\$150 to \$350|\$130–\$180|\$4,500–\$9,000|\$4,000–\$8,500|\$7,500–\$18,000|\$18,000–\$45,000|\$55–\$120|\$290–\$870|\$290–\$340|roughly double|A \$7,000 quote/.test(post + excerpt), 'oro: superseded wall figures and claims are gone');
}

// ---- PatioCostFactors: what a wall adds to a patio ----
{
  const post = read('src/pages/blog/PatioCostFactors.tsx');
  const base = price(input(['patio'], { patio: 400 }, 'barrie')).likely;
  const adds = (h: Height) => price(input(['patio', 'wall'], { patio: 400, wall: 30, wallHeight: h }, 'barrie')).likely - base;
  const added = range(adds('Under 2ft'), adds('2-4ft'), 500);
  ok(post.includes(`On a 400 sq ft patio, a 30-foot retaining wall up to 4 ft high adds roughly ${added} before HST, depending on its height.`), `patio factors: a 30 ft wall adds ${added}`);
  ok(!/\$5,000 to \$10,000|\$7,000–\$17,000/.test(post), 'patio factors: superseded wall add-on figures are gone');
}

// ---- Retaining-walls service page: the planning rate (owner's "~$330–$670 per linear ft by height") ----
{
  const page = read('src/pages/services/RetainingWalls.tsx');
  const rate = `${foot('Under 2ft', 'barrie').around}–${foot('4-6ft', 'barrie').around}`;
  ok(page.includes(`rate="${rate}"`), `service page: planning rate is ${rate}`);
  ok(page.includes(`rateDetail="per linear foot for walls from under 2 ft up to 4–6 ft high, about ${QUOTED_LENGTH} ft on an accessible site, before HST. A planning range, not a quote for your property."`), 'service page: rate unit and assumptions stated');
  ok(!/\$60–\$140|per square foot of wall face/.test(page), 'service page: unsourced face-area rate is gone');
  // The same rate feeds every town's retaining-walls page (meta description, JSON-LD priceDescription, visible rate).
  const data = read('src/data/serviceLocations.ts');
  const entry = /'retaining-walls': \{[\s\S]*?startingPriceText: '([^']*)',\s*perUnitText: '([^']*)'/.exec(data);
  ok(entry, 'service-location data: retaining-walls entry found');
  ok(entry![1] === rate, `service-location data: starting price is ${rate}`);
  ok(entry![2] === `per linear foot before HST, for walls from under 2 ft up to 4–6 ft high (about ${QUOTED_LENGTH} ft, accessible site)`, 'service-location data: unit and assumptions stated');
  ok(!/per square foot of wall face/.test(data), 'service-location data: unsourced face-area rate is gone');
}

// ---- Location pages: the retaining-wall row of each cost table ----
for (const [file, town, fromLf, toLf] of [
  ['OroMedonte', 'oro-medonte', 50, 100],
  ['Innisfil', 'innisfil', 30, 60],
  ['Springwater', 'springwater', 30, 60],
] as Array<[string, EstimatorLocationKey, number, number]>) {
  const page = read(`src/pages/locations/${file}.tsx`);
  const cost = `$${to(wall(fromLf, '2-4ft', town).low, 500).toLocaleString('en-CA')} – $${to(wall(toLf, '2-4ft', town).high, 500).toLocaleString('en-CA')}`;
  const row = `{ project: "Retaining wall (${fromLf}-${toLf} linear ft, 2-4 ft high, before HST)", range: "${cost}" },`;
  ok(page.includes(row), `${file}: wall row is ${cost}`);
  ok(!/\$8,000 – \$20,000|\$15,000 – \$40,000/.test(page), `${file}: superseded wall range is gone`);
}

console.log(`WALL PRICES OK — ${checks} checks: every retaining-wall price on the site (blog, service page, location pages) is the estimator engine's (mid tier, accessible site).`);
