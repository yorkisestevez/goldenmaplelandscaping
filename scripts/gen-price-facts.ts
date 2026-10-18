import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { computeEstimate, type EstimateInput } from '../src/utils/estimateEngine';
import {
  ESTIMATOR_DEFAULT_SIZES, ESTIMATOR_DEFAULT_CONDITIONS, ESTIMATOR_DEFAULT_LOCATION, ESTIMATOR_DEFAULT_TIER,
  ESTIMATOR_DEFAULT_PAVER_ID, ESTIMATOR_DEFAULT_DECK_ID,
} from '../src/data/estimatorDefaults';
import { defaultPaverForTier, type PaverTier } from '../src/data/carrPrices';
const { extractPriceFigures } = createRequire(import.meta.url)('./blog-publisher/price-figures.cjs') as { extractPriceFigures: (t: string) => string[] };

/**
 * The only prices the site's writers may quote (owner decision 2026-10-17: no invented prices, at all cost).
 * Every figure here is computed by the cost-estimator engine — mid tier, the estimator's default paver, an
 * accessible site, before HST — and written to src/data/publishedPriceFacts.json for the blog publisher (plain
 * Node) and the price ledger. `npx tsx scripts/gen-price-facts.ts` rewrites it; `--check` (in lint) fails when
 * the file no longer matches the engine.
 */
const OUT = new URL('../src/data/publishedPriceFacts.json', import.meta.url);

type Opts = { tier?: PaverTier; sizes?: Record<string, number | string> };
function likely(projectType: string, sizes: Record<string, number | string>, o: Opts = {}) {
  const tier = o.tier ?? ESTIMATOR_DEFAULT_TIER;
  const input: EstimateInput = {
    projectType, selectedElements: [], sizes: { ...ESTIMATOR_DEFAULT_SIZES, ...sizes }, details: {},
    conditions: { ...ESTIMATOR_DEFAULT_CONDITIONS }, location: ESTIMATOR_DEFAULT_LOCATION, tier,
    paverBrandId: tier === ESTIMATOR_DEFAULT_TIER ? ESTIMATOR_DEFAULT_PAVER_ID : defaultPaverForTier(tier).id,
    deckBrandId: ESTIMATOR_DEFAULT_DECK_ID, addOns: [],
  };
  const r = computeEstimate(input);
  if (!r.precise) throw new Error(`engine returned no precise figure for ${projectType}`);
  return { likely: r.precise.subtotalCents / 100, low: r.totalLow, high: r.totalHigh };
}
const to = (n: number, step: number) => Math.round(n / step) * step;
const usd = (n: number) => `$${n.toLocaleString('en-CA')}`;
const patio = (sqft: number, o: Opts = {}) => likely('patio', { patio: sqft }, o);
const perFoot = (sqft: number, o: Opts = {}) => patio(sqft, o).likely / sqft;
const wall = (h: string) => likely('wall', { wall: 50, wallHeight: h });

const TYPICAL = [300, 400, 500, 600, 800, 1000];
const rate = `${usd(Math.round(perFoot(1000)))}–${usd(Math.round(perFoot(300)))}`;
const band = `${usd(Math.round(Math.min(...TYPICAL.map((s) => patio(s).low / s))))}–${usd(Math.round(Math.max(...TYPICAL.map((s) => patio(s).high / s))))}`;
const walkRate = `${usd(Math.round(perFoot(200)))}–${usd(Math.round(perFoot(100)))}`;
const wallFoot = (h: string) => usd(to(wall(h).likely / 50, 10));
const wallTypical = (h: string) => `${usd(to(wall(h).low / 50, 5))}–${usd(to(wall(h).high / 50, 5))}`;

/** `keywords`: a fact's figure only counts where one of these words is nearby, so "$5" for a bag of sand is not "approved". */
interface Fact { id: string; statement: string; keywords?: string[] }
const PATIO = ['patio', 'interlock', 'paver'];
const WALL = ['wall'];
const facts: Fact[] = [
  { id: 'basis', statement: 'Every price below is a planning figure from the Golden Maple cost estimator, before HST, mid-tier materials, an accessible site. Final prices are confirmed at a site visit.' },
  { id: 'patio.rate', keywords: PATIO, statement: `Most interlocking patios of 300–1,000 sq ft come out around ${rate} per square foot before HST, typically ${band} depending on access, shape and finishes.` },
  { id: 'patio.small', keywords: PATIO, statement: `Smaller patios cost more per square foot: about ${usd(Math.round(perFoot(200)))} at 200 sq ft.` },
  { id: 'patio.premium', keywords: PATIO, statement: `Premium paver lines add about ${usd(Math.round(perFoot(400, { tier: 'premium' }) - perFoot(400)))} per square foot.` },
  ...[300, 400, 600, 1000].map((s) => ({ id: `patio.total.${s}`, keywords: PATIO, statement: `A ${s.toLocaleString('en-CA')} sq ft interlocking patio is most likely about ${usd(to(patio(s).likely, 500))} before HST (planning band ${usd(to(patio(s).low, 500))}–${usd(to(patio(s).high, 500))}).` })),
  { id: 'walkway.rate', keywords: ['walkway', 'path'], statement: `A 100–200 sq ft paver walkway runs around ${walkRate} per square foot before HST (shorter walkways cost more per foot); a 200 sq ft walkway is most likely about ${usd(to(patio(200).likely, 500))}.` },
  { id: 'wall.rate', keywords: WALL, statement: `Retaining walls run around ${wallFoot('Under 2ft')}–${wallFoot('4-6ft')} per linear foot before HST for walls from under 2 ft up to 4–6 ft high (about 50 ft of wall).` },
  ...[['Under 2ft', 'under 2 ft'], ['2-4ft', '2–4 ft'], ['4-6ft', '4–6 ft'], ['6ft+', '6 ft+']].map(([h, label]) => ({ id: `wall.${h}`, keywords: WALL, statement: `A retaining wall ${label} high is around ${wallFoot(h)} per linear foot (typically ${wallTypical(h)}) for about 50 ft of wall.` })),
  { id: 'deck', statement: 'Decks are priced only in the 3D deck designer at /deck-designer. Never quote a deck price per square foot.' },
  { id: 'everything-else', statement: 'Anything not listed here (driveways, porcelain, natural stone, pergolas, kitchens, fire pits, drainage, lighting, sod, permits, repairs) has NO published price: say it is confirmed at a site visit and link the cost estimator.' },
];

const withFigures = facts.map((f) => ({ ...f, figures: [...new Set(extractPriceFigures(f.statement))] }));
const figures = [...new Set(withFigures.flatMap((f) => f.figures))].sort();
for (const f of withFigures) if (f.figures.length && !f.keywords?.length) throw new Error(`fact ${f.id} quotes a price but has no keywords`);
const sheet = { _readme: 'Generated by scripts/gen-price-facts.ts from the cost-estimator engine. Do not edit by hand.', facts: withFigures, figures };
const json = `${JSON.stringify(sheet, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  if (current !== json) {
    console.error('PRICE FACTS STALE — src/data/publishedPriceFacts.json no longer matches the estimator engine. Run: npx tsx scripts/gen-price-facts.ts');
    process.exit(1);
  }
  console.log(`PRICE FACTS OK — ${facts.length} facts, ${figures.length} engine figures match the estimator.`);
} else {
  writeFileSync(OUT, json);
  console.log(`wrote ${facts.length} facts / ${figures.length} figures`);
}
