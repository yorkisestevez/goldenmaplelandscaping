import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { computeEstimate, type EstimateInput } from '../src/utils/estimateEngine';
import { defaultPaverForTier, type PaverTier } from '../src/data/carrPrices';
import {
  ESTIMATOR_DEFAULT_SIZES, ESTIMATOR_DEFAULT_CONDITIONS, ESTIMATOR_DEFAULT_LOCATION, ESTIMATOR_DEFAULT_TIER,
  ESTIMATOR_DEFAULT_PAVER_ID, ESTIMATOR_DEFAULT_DECK_ID,
} from '../src/data/estimatorDefaults';
import type { EstimatorLocationKey } from '../src/data/locations';

/**
 * Interlocking patio and walkway prices in the blog are the cost estimator's own (owner decision 2026-10-17:
 * rewrite them to the engine "the same way as walls", mid tier, and drop per-sq-ft driveway claims because the
 * engine does not price driveways). A paver walkway is the engine's paver (patio) element at walkway sizes — the
 * estimator's `stone` element is natural stone. Posts carry plain text so the prerendered HTML stays crawlable;
 * this check recomputes every quoted figure so an engine change cannot leave a post behind. `--print` lists facts.
 */
let checks = 0;
const ok = (value: unknown, message: string) => { assert(value, message); checks++; };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const post = (name: string) => read(`src/pages/blog/${name}.tsx`);

type Opts = { town?: EstimatorLocationKey; tier?: PaverTier; conditions?: Record<string, boolean>; details?: Record<string, string> };
function price(els: string[], sizes: Record<string, number | string>, o: Opts = {}) {
  const tier = o.tier ?? ESTIMATOR_DEFAULT_TIER;
  const input: EstimateInput = {
    projectType: els.length > 1 ? 'full' : els[0], selectedElements: els.length > 1 ? els : [], sizes: { ...ESTIMATOR_DEFAULT_SIZES, ...sizes },
    details: o.details ?? {}, conditions: { ...ESTIMATOR_DEFAULT_CONDITIONS, ...o.conditions }, location: o.town ?? ESTIMATOR_DEFAULT_LOCATION, tier,
    paverBrandId: tier === ESTIMATOR_DEFAULT_TIER ? ESTIMATOR_DEFAULT_PAVER_ID : defaultPaverForTier(tier).id,
    deckBrandId: ESTIMATOR_DEFAULT_DECK_ID, addOns: [],
  };
  const r = computeEstimate(input);
  assert(r.precise, 'the engine must return a precise figure for every quoted build');
  return { likely: r.precise.subtotalCents / 100, low: r.totalLow, high: r.totalHigh, perCategory: r.precise.perCategoryCents };
}
const patio = (sqft: number, o: Opts = {}) => price(['patio'], { patio: sqft }, o);
/** A paver walkway: the paver element at walkway sizes. */
const walkway = (sqft: number) => patio(sqft);

const to = (n: number, step: number) => Math.round(n / step) * step;
const usd = (n: number) => `$${n.toLocaleString('en-CA')}`;
const r500 = (n: number) => usd(to(n, 500));
const span = (a: number, b: number, step: number, sep = '–') => `${usd(to(a, step))}${sep}${usd(to(b, step))}`;
const pct = (xs: number[]) => `${Math.round(Math.min(...xs) * 100)}–${Math.round(Math.max(...xs) * 100)}%`;

// ---- Facts ----
const TYPICAL = [300, 400, 500, 600, 800, 1000];
const perFoot = (sqft: number, o: Opts = {}) => patio(sqft, o).likely / sqft;
const RATE = `${usd(Math.round(perFoot(1000)))}–${usd(Math.round(perFoot(300)))}`;
const BAND = `${usd(Math.round(Math.min(...TYPICAL.map((s) => patio(s).low / s))))}–${usd(Math.round(Math.max(...TYPICAL.map((s) => patio(s).high / s))))}`;
const SMALL = usd(Math.round(perFoot(200)));
const PREMIUM_ADD = usd(Math.round(perFoot(400, { tier: 'premium' }) - perFoot(400)));
const PREMIUM_500 = r500(patio(500, { tier: 'premium' }).likely - patio(500).likely);
const RED_FLAG = usd(Math.floor(Math.min(...TYPICAL.map((s) => patio(s).low / s)) / 5) * 5);
const total = (sqft: number, o: Opts = {}) => r500(patio(sqft, o).likely);
const band = (from: number, to2: number, o: Opts = {}, sep = '–') => span(patio(from, o).low, patio(to2, o).high, 500, sep);
const cat = patio(400).perCategory;
const dollarsPerFoot = (cents: number) => Math.round(cents / 100 / 400);
const CATS = { excavation: dollarsPerFoot(cat.excavation), materials: dollarsPerFoot(cat.materials), labour: dollarsPerFoot(cat.labour), cleanup: dollarsPerFoot(cat.disposal + cat.restoration) };
const CAT_TOTAL = CATS.excavation + CATS.materials + CATS.labour + CATS.cleanup;
const uplift = (c: Record<string, boolean>) => TYPICAL.map((s) => patio(s, { conditions: c }).likely / patio(s).likely - 1);
const ACCESS = pct(uplift({ access: true })), SLOPE = pct(uplift({ slope: true })), DRAINAGE = pct(uplift({ drainage: true }));
const COMBINED = pct(uplift({ access: true, slope: true, drainage: true }));
// The worked example (mid tier): a 350 sq ft patio, then 3 steps, then lighting, each as the engine adds it.
const ex350 = patio(350).likely;
const exSteps = price(['patio', 'steps'], { patio: 350, steps: 3 }).likely - ex350;
const exLighting = price(['patio', 'steps', 'lighting'], { patio: 350, steps: 3 }).likely - ex350 - exSteps;
const EXAMPLE = { patio: to(ex350, 100), steps: to(exSteps, 100), lighting: to(exLighting, 100) };
/** The engine's own total for the whole build (the listed items are rounded, so they need not add to it exactly). */
const EXAMPLE_TOTAL = to(price(['patio', 'steps', 'lighting'], { patio: 350, steps: 3 }).likely, 100);
const lightingOn400 = price(['patio', 'lighting'], { patio: 400 }).likely - patio(400).likely;
/** Rounded outward so both the stand-alone add-on and the worked example's increment sit inside it. */
const LIGHTING = `${usd(Math.floor(Math.min(lightingOn400, exLighting) / 500) * 500)}–${usd(Math.ceil(Math.max(lightingOn400, exLighting) / 500) * 500)}`;
const STEPS = r500(exSteps);
const WALK_RATE = `${usd(Math.round(walkway(200).likely / 200))}–${usd(Math.round(walkway(100).likely / 100))}`;
const rebuild = span(patio(350, { details: { 'patio.surface': 'pavers' } }).low, patio(450, { details: { 'patio.surface': 'pavers' } }).high, 500, '-');
const wasaga = (sqft: number, tier: PaverTier = 'mid') => patio(sqft, { town: 'wasaga-beach', tier }).likely;
const POOL = `${usd(Math.round(perFoot(800)))}–${usd(Math.round(perFoot(800, { tier: 'premium' })))}`;
const MELVILLE = usd(Math.round(price(['patio'], { patio: 800 }, { tier: 'budget' }).likely / 800));
ok(defaultPaverForTier('budget').id === 'permacon-melville', 'the pool-deck Melville row is the engine budget paver');

const FACTS = {
  RATE, BAND, SMALL, PREMIUM_ADD, PREMIUM_500, RED_FLAG, CATS, CAT_TOTAL, ACCESS, SLOPE, DRAINAGE, COMBINED, LIGHTING, STEPS, EXAMPLE, EXAMPLE_TOTAL, WALK_RATE, rebuild, POOL, MELVILLE,
  totals: Object.fromEntries([200, 300, 350, 400, 450, 600].map((s) => [s, total(s)])),
  bands: { '150-300': band(150, 300, {}, ' – '), '300-600': band(300, 600, {}, ' – '), '400': band(400, 400) },
  walk: { '200': r500(walkway(200).likely), '200band': span(walkway(200).low, walkway(200).high, 500), '50-120': span(walkway(50).low, walkway(120).high, 500, ' – ') },
  wasaga: { per400: usd(Math.round(wasaga(400) / 400)), total400: r500(wasaga(400)), mid300to400: [to(wasaga(300), 500), to(wasaga(400), 500)], premium450to600: [to(wasaga(450, 'premium'), 500), to(wasaga(600, 'premium'), 500)] },
  innisfil300to400: span(patio(300, { town: 'innisfil' }).likely, patio(400, { town: 'innisfil' }).likely, 500),
  example450: total(450), example600premiumCurves: r500(patio(600, { tier: 'premium', details: { 'patio.shape': 'curves' } }).likely),
};
if (process.argv.includes('--print')) { console.log(JSON.stringify(FACTS, null, 1)); process.exit(0); }

// ---- Sanity: the facts behave the way the copy describes them ----
ok(perFoot(200) > perFoot(300) && perFoot(300) > perFoot(1000), 'smaller patios cost more per square foot');
ok(perFoot(400, { tier: 'premium' }) > perFoot(400), 'premium paver lines cost more');
ok(walkway(100).likely / 100 > walkway(200).likely / 200, 'shorter walkways cost more per square foot');
ok(CAT_TOTAL === Math.round(patio(400).likely / 400), `category breakdown sums to the engine's $${Math.round(patio(400).likely / 400)}/sq ft`);

const has = (name: string, text: string, label: string) => ok(post(name).includes(text), `${name}: ${label}`);
const count = (name: string, text: string, n: number, label: string) => ok(post(name).split(text).length - 1 === n, `${name}: ${label} (${n}x)`);
const none = (name: string, re: RegExp, label = 'superseded patio/walkway/driveway figures are gone') => ok(!re.test(post(name)), `${name}: ${label}`);
const RATE_PHRASE = `around ${RATE} per square foot before HST`;

/** Every "$A–$B per square foot" range in a post must be the engine rate or a listed non-engine figure. */
const RANGE_RE = /\$(\d+)\s?(?:-|–| to )\s?\$(\d+)\+?\s?(?:per square foot|per sq ft|\/sq ?ft|\/sqft)/g;
function onlyEngineRates(name: string, allowed: string[]) {
  const found = [...post(name).matchAll(RANGE_RE)].map((m) => `$${m[1]}–$${m[2]}`);
  const stray = found.filter((r) => r !== RATE && !allowed.includes(r));
  ok(found.length > 0 && stray.length === 0, `${name}: every per-square-foot range is the engine rate ${RATE}${stray.length ? ` (stray: ${stray.join(', ')})` : ''}`);
}

// ---- InterlockingCostBarrie ----
{
  const n = 'InterlockingCostBarrie';
  has(n, `<td className="py-3 pr-6">150–300 sq ft</td><td className="py-3">${FACTS.bands['150-300']}</td>`, '150-300 sq ft band');
  has(n, `<td className="py-3 pr-6">Large patio</td><td className="py-3 pr-6">300–600 sq ft</td><td className="py-3">${FACTS.bands['300-600']}</td>`, '300-600 sq ft band');
  has(n, `<td className="py-3 pr-6">50–120 sq ft</td><td className="py-3">${FACTS.walk['50-120']}</td>`, 'front walkway band (paver element)');
  has(n, "Patio and walkway figures in the table are our cost estimator's planning bands for mid-tier pavers on an accessible site, before HST.", 'table basis stated');
  has(n, `Most Barrie interlocking patios between 300 and 1,000 sq ft come out <strong>${RATE_PHRASE}</strong> (typically ${BAND}), including base preparation, materials, and finishing. Smaller patios cost more per foot: about ${SMALL} at 200 sq ft.`, 'headline rate');
  has(n, `<td className="py-3 pr-6">Standard concrete pavers</td><td className="py-3 pr-6">around ${RATE}</td>`, 'standard pavers row');
  has(n, `<td className="py-3 pr-6">Premium concrete paver lines</td><td className="py-3 pr-6">about ${PREMIUM_ADD} more</td>`, 'premium pavers row');
  has(n, `<td className="py-3 pr-4">Interlocking stone</td><td className="py-3 pr-4">${RATE.replace('–', ' – ')}</td>`, 'comparison table row');
  has(n, `<li><strong>Multiply by about ${RATE}</strong> per sq ft (smaller patios cost more per foot; premium paver lines add about ${PREMIUM_ADD})</li>`, 'budget framework rate');
  has(n, `<li><strong>Add for site conditions</strong>: tight access about ${ACCESS}, a slope ${SLOPE}, drainage work ${DRAINAGE}; together roughly ${COMBINED}</li>`, 'site-condition uplifts');
  has(n, `lighting (about ${LIGHTING} with mid-tier pavers), steps (about ${STEPS} for 3 steps), seat walls ($3,000-$8,000)`, 'feature costs (mid tier)');
  has(n, '<p><strong>Example:</strong> A 350 sq ft patio with mid-tier pavers, 3 steps down, and landscape lighting:</p>', 'example heading');
  has(n, `<li>Patio: 350 sq ft ≈ ${usd(EXAMPLE.patio)}</li>`, 'example patio');
  has(n, `<li>Steps: ≈ ${usd(EXAMPLE.steps)}</li>`, 'example steps');
  has(n, `<li>Lighting: ≈ ${usd(EXAMPLE.lighting)}</li>`, 'example lighting');
  has(n, `<li><strong>Total estimate: ~${usd(EXAMPLE_TOTAL)} before HST</strong> (items are rounded)</li>`, 'example total is the engine total');
  ok(Math.abs(EXAMPLE.patio + EXAMPLE.steps + EXAMPLE.lighting - EXAMPLE_TOTAL) <= 200, `${n}: rounded items stay within $200 of the total`);
  ok(exLighting <= Math.ceil(Math.max(lightingOn400, exLighting) / 500) * 500, `${n}: the example's lighting sits inside the quoted lighting range`);
  has(n, `<li><strong>Per-square-foot quotes under ${RED_FLAG}</strong>`, 'red-flag threshold below the engine band');
  none(n, /\$55 and \$85|\$55 – \$85|\$55-\$85|350 × \$70|\$24,500|\$9,000 – \$18,000|\$18,000 – \$40,000|\$4,000 – \$9,000|\$45 – \$60|\$60 – \$80|quotes under \$40|Techo-Bloc pavers, 3 steps/);
  onlyEngineRates(n, []);
}

// ---- PermaconPaversHonestReview2026 ----
{
  const n = 'PermaconPaversHonestReview2026';
  has(n, `installed ${RATE_PHRASE} in our cost estimator`, 'SEO description');
  count(n, `In our cost estimator, a mid-tier patio of 300–1,000 sq ft comes out ${RATE_PHRASE} (priced on Permacon Mondrian Plus)`, 2, 'TL;DR rate and the paver it is priced on');
  has(n, 'why do interlock quotes vary so much per square foot?', 'quote-variance question without unsourced numbers');
  has(n, `Within Permacon's own range, our cost estimator puts a premium-line paver at <strong>about ${PREMIUM_ADD} per square foot</strong> more than a mid-tier one — roughly ${PREMIUM_500} on a 500-square-foot patio.`, 'premium-line delta is within Permacon, not a brand gap');
  count(n, 'Techo-Bloc offers more surface finish options at a higher installed price, confirmed on product selection.', 2, 'FAQ brand comparison without an unsourced percentage');
  has(n, `<p><strong>Excavation and base preparation:</strong> about $${CATS.excavation} per square foot.`, 'excavation category');
  has(n, `all materials for a 400 sq ft patio — pavers, base stone, polymeric sand, edging and delivery — come to about $${CATS.materials} per square foot.`, 'materials category');
  has(n, `<p><strong>Labour for laying:</strong> about $${CATS.labour} per square foot.`, 'labour category');
  has(n, `<p><strong>Disposal and restoration:</strong> about $${CATS.cleanup} per square foot`, 'disposal + restoration');
  has(n, `<strong>Total installed: about $${CAT_TOTAL} per square foot before HST</strong> for a 400 sq ft mid-tier patio on an accessible site`, 'category total');
  has(n, `a 450-square-foot patio in a running bond on a flat, accessible Barrie lot — about ${FACTS.example450} before HST. A 600-square-foot premium-line patio with curved edges — about ${FACTS.example600premiumCurves}.`, 'estimator examples');
  has(n, `<td>Permacon</td><td>around $${Math.round(perFoot(400))}/sq ft (mid-tier, 400 sq ft, before HST)</td>`, 'brand table Permacon');
  none(n, /\$18–26|\$18–\$26|\$17\.50–\$31|\$22–\$35\+|\$20–\$32|\$8,500–\$11,000|\$18,000–\$25,000|\$25,000–\$32,000|quotes \$18 per square foot|15–25%|\$2–\$5 per square foot less|1,000-square-foot driveway|consistently the most affordable|that gap is often/);
}

// ---- OutdoorLivingPlanningInnisfil ----
{
  const n = 'OutdoorLivingPlanningInnisfil';
  count(n, `starts around ${FACTS.innisfil300to400} before HST for a 300–400 sq ft surface`, 2, 'FAQ answers');
  has(n, `<td>Driveways, value-focused patios</td><td>around $${Math.round(perFoot(400))} per sq ft (mid-tier, 400 sq ft, before HST)</td>`, 'brand table Permacon');
  none(n, /\$18–\$26 per sq ft|\$22–\$35 per sq ft|\$24–\$38 per sq ft|\$15,000–\$20,000 for a 300/);
}

// ---- Posts that quote the generic installed patio rate ----
{
  const dash = RATE.replace('–', '-'), words = RATE.replace('–', ' to ');
  count('ConcreteVsInterlockingPatioBarrie', `around ${dash} per square foot`, 6, 'hyphenated engine rate');
  count('ConcreteVsInterlockingPatioBarrie', `around ${words} per square foot before HST`, 2, 'spelled-out engine rate');
  has('ConcreteVsInterlockingPatioBarrie', `<td>${dash}</td>`, 'comparison table cell');
  onlyEngineRates('ConcreteVsInterlockingPatioBarrie', ['$10–$20']);
  none('ConcreteVsInterlockingPatioBarrie', /\$37 and \$65|\$37-\$65|\$37 to \$65|\$10 to \$65/);

  count('NaturalStoneVsPaversBarrie', `around ${dash} per square foot installed before HST`, 4, 'engine rate (FAQ + TL;DR)');
  has('NaturalStoneVsPaversBarrie', `around <strong>${words} per square foot</strong> installed before HST for standard residential work of 300–1,000 sq ft.`, 'body rate');
  has('NaturalStoneVsPaversBarrie', `<td>Installed cost / sq ft</td><td>${dash} (before HST)</td>`, 'comparison table cell');
  has('NaturalStoneVsPaversBarrie', `A typical 400 sq ft paver patio lands around ${FACTS.bands['400'].replace('–', ' to ')} before HST (most likely about ${FACTS.totals[400]})`, '400 sq ft band');
  onlyEngineRates('NaturalStoneVsPaversBarrie', ['$55–$95']);
  none('NaturalStoneVsPaversBarrie', /\$37-\$65|\$37 to \$65|\$14,800 to \$26,000|40% to 70%/);

  has('BestPaversPoolDeckSimcoeCounty', `Budget around ${RATE}/sq ft installed before HST.`, 'SEO description');
  count('BestPaversPoolDeckSimcoeCounty', `Budget around ${RATE} per square foot installed before HST for a 300–1,000 sq ft pool deck in mid-tier pavers, including`, 2, 'FAQ answers with basis');
  onlyEngineRates('BestPaversPoolDeckSimcoeCounty', []);
  none('BestPaversPoolDeckSimcoeCounty', /\$37-65/);

  has('PatioCostFactors', `typically ranges <strong>around ${RATE} before HST</strong> per square foot for most 300–1,000 sq ft patios (typically ${BAND}; smaller patios cost more per foot).`, 'baseline rate, band and size note');
  has('PatioCostFactors', `you are looking at roughly <strong>${FACTS.bands['400'].replace('–', ' to ')} before HST</strong>, most likely about ${FACTS.totals[400]}.`, '400 sq ft band');
  none('PatioCostFactors', /\$35 to \$65\+|\$14,000 to \$26,000/);
}
has('FailingInterlockingPatioSignsBarrie', `a full rebuild of a 350-450 square foot patio with a proper compacted base runs about ${rebuild} before HST, including removing the old pavers`, 'rebuild band (FAQ)');
count('FailingInterlockingPatioSignsBarrie', rebuild, 6, 'rebuild band everywhere it appears');
none('FailingInterlockingPatioSignsBarrie', /\$12,000-\$20,000/);

// ---- PoolDeckMaterials ----
{
  const n = 'PoolDeckMaterials';
  has(n, `Concrete pavers land around ${POOL}/sqft installed before HST (mid to premium lines)`, 'pool-deck paver rate');
  has(n, `<td className="p-4">Permacon Melville 60</td>`, 'Melville row present');
  ok(new RegExp(`Permacon Melville 60</td>\\s*<td className="p-4">around \\${MELVILLE} \\(before HST\\)</td>`).test(post(n)), `${n}: Melville row is the engine budget paver (${MELVILLE})`);
  for (const product of ['Techo-Bloc Blu 60 Slate', 'Techo-Bloc Blu HD² Smooth', 'Unilock Umbriano']) {
    ok(new RegExp(`${product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</td>\\s*<td className="p-4">Confirmed on product selection</td>`).test(post(n)), `${n}: ${product} is priced on selection`);
  }
  none(n, /\$40–48\/sqft|\$32–38|\$38–42|\$44–48|\$46–50/);
}

// ---- BackyardEntertainingWasagaBeach (Wasaga Beach rate; budget tiers must add up) ----
{
  const n = 'BackyardEntertainingWasagaBeach';
  count(n, `A standard 400 sq ft interlocking patio runs about ${FACTS.wasaga.per400} per sq ft installed before HST (about ${FACTS.wasaga.total400})`, 2, 'TL;DRs');
  has(n, `about ${FACTS.wasaga.per400} per sq ft for an interlocking patio`, 'SEO description');
  ok(read('src/data/blogPosts.ts').includes(`$20K–$65K for a full setup, about ${FACTS.wasaga.per400} per sq ft for an interlocking patio`), `${n}: blog-index excerpt matches`);
  const [m1, m2] = FACTS.wasaga.mid300to400, [p1, p2] = FACTS.wasaga.premium450to600;
  has(n, `300–400 sq ft of mid-tier interlocking patio (${usd(m1)}–${usd(m2)})`, 'tier 1 patio component');
  has(n, `450–600 sq ft of premium-line interlocking patio (${usd(p1)}–${usd(p2)})`, 'tier 2 patio component');
  // Non-engine components the tiers quote (pergola, lighting, sod / accents), as published.
  for (const c of ['($5,500–$7,000)', '($1,800–$2,500)', '($1,500–$2,500)', '($10,000–$18,000)', '($3,500–$5,500)', '($3,000–$6,000)']) has(n, c, `tier component ${c}`);
  const tier1 = [m1 + 5500 + 1800 + 1500, m2 + 7000 + 2500 + 2500], tier2 = [p1 + 10000 + 3500 + 3000, p2 + 18000 + 5500 + 6000];
  ok(tier1[0] >= 20000 && tier1[1] <= 30000, `${n}: tier 1 components (${usd(tier1[0])}–${usd(tier1[1])}) fit its $20,000–$30,000 label`);
  const t2 = `${usd(to(tier2[0], 1000))}–${usd(to(tier2[1], 1000))}`;
  has(n, `<p><strong>${t2}</strong> delivers: 450–600 sq ft`, `tier 2 label is its components' sum (${t2})`);
  const t2k = `${usd(to(tier2[0], 1000) / 1000)}K–${usd(to(tier2[1], 1000) / 1000)}K`, top = `${usd(to(tier2[1], 1000) / 1000)}K`;
  has(n, `<th>${t2k}</th><th>${top}–$80K</th>`, 'tier table headers follow');
  has(n, `<p><strong>${usd(to(tier2[1], 1000))}–$80,000</strong> typically adds`, 'tier 3 starts where tier 2 ends');
  has(n, `pushing almost any project above the ${top} line.`, 'kitchen line follows');
  has(n, '<td>Paver brand</td><td>Mid-tier pavers</td><td>Premium-line pavers</td>', 'brand row matches the tiers');
  none(n, /\$22–\$28|\$8,500–\$11,000|\$12,000–\$17,000|Permacon or entry Unilock/);
}

// ---- PaverWalkwayCostBarrie (paver element at walkway sizes) ----
{
  const n = 'PaverWalkwayCostBarrie';
  has(n, `For a standard 4-foot wide walkway (200 sq. ft.), our cost estimator puts it at about ${FACTS.walk['200']} before HST in the Barrie area for 2026 (planning band ${FACTS.walk['200band']}).`, 'FAQ answer');
  has(n, `A professionally installed paver walkway in Barrie runs around ${WALK_RATE} per square foot before HST for 2026 (shorter walkways cost more per foot) — so a standard 4-foot-wide, 50-foot walkway (about 200 sq ft) typically lands around ${FACTS.walk['200']}.`, 'TL;DR');
  has(n, `you should budget around <strong>${WALK_RATE} per square foot</strong> before HST for a 100–200 sq ft walkway in 2026.`, 'body rate');
  has(n, "Shorter walkways cost more per foot because the dig-out, delivery and cleanup don't shrink with the walkway", 'explains why the range is size-driven');
  none(n, /\$35 and \$65|\$35–\$65|\$35-\$65|\$7,000 and \$13,000|\$64–\$93|That's a big range/);
}

// ---- Driveways: no engine path, so no per-square-foot driveway price anywhere in the blog ----
{
  none('InterlockingDrivewayLifespanOntario', /\$20 and \$35 per square foot|\$20 - \$35|\$5 to \$10 per square foot|\$5 - \$10|\$15 - \$25/, 'per-square-foot driveway prices are gone');
  has('InterlockingDrivewayLifespanOntario', '<td><strong>Upfront Cost</strong></td><td>Highest</td><td>Lowest</td><td>Moderate</td>', 'relative upfront-cost row');
  has('BackyardDrainageSolutionsBarrie', '<td>Confirmed at a site visit</td>', 'permeable-paver row is not given an unsupported price');
  none('LandscaperQuoteExcavationLineItem', /\$7 to \$14 per square foot/, 'driveway excavation per-square-foot price is gone');
  // Heated-driveway posts price a heating system, not the driveway paving, so they are outside this rule.
  const SENTENCE = /[^.<>]*driveway[^.<>]*\$\d[^.<>]*(?:per square foot|per sq\.? ?ft|\/sq ?ft)[^.<>]*/gi;
  for (const file of readdirSync(new URL('../src/pages/blog/', import.meta.url)).filter((f) => f.endsWith('.tsx') && f !== 'HeatedDrivewayWorthItBarrie.tsx')) {
    const hits = (read(`src/pages/blog/${file}`).match(SENTENCE) ?? []).filter((s) => !/heated|heating|cable/i.test(s));
    ok(hits.length === 0, `${file}: no per-square-foot driveway price${hits.length ? ` (found: ${hits[0].trim().slice(0, 120)})` : ''}`);
  }
}

// ---- Money pages: the interlocking planning rate, and no deck rate anywhere (decks are priced in the designer) ----
{
  const detail = 'per square foot before HST for most 300–1,000 sq ft interlocking patios with mid-tier pavers. A planning range, not a quote for your property.';
  for (const page of ['src/pages/services/Interlocking.tsx', 'src/pages/PatiosBarrie.tsx']) {
    ok(read(page).includes(`rate="${RATE}"`) && read(page).includes(`rateDetail="${detail}"`), `${page}: planning rate is the engine's ${RATE}, with its basis`);
  }
  const data = read('src/data/serviceLocations.ts');
  const interlock = /\binterlocking: \{[\s\S]*?startingPriceText: '([^']*)',\s*perUnitText: '([^']*)',\s*rateBasis: '([^']*)'/.exec(data);
  ok(interlock?.[1] === RATE && interlock?.[2] === 'per sq ft before HST' && interlock?.[3] === 'most 300–1,000 sq ft interlocking patios, mid-tier pavers', `serviceLocations: every town's interlocking page quotes ${RATE} with its basis`);
  const deck = /'composite-decking': \{[\s\S]*?startingPriceText: '([^']*)'/.exec(data);
  ok(deck && !deck[1].includes('$'), 'serviceLocations: decks carry no per-square-foot price (the deck designer prices decks)');
  ok(!/rate="\$/.test(read('src/pages/services/CompositeDecking.tsx')), 'CompositeDecking: no per-square-foot deck rate');
}

console.log(`PATIO PRICES OK — ${checks} checks: every interlocking patio and walkway price in the blog is the estimator engine's (mid tier, accessible site); no per-square-foot driveway prices.`);
