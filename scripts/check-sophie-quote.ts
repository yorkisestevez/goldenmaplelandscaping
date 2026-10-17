import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeEstimate, widenTotals, type EstimateInput } from '../src/utils/estimateEngine';
import {
  ESTIMATOR_DEFAULT_SIZES, ESTIMATOR_DEFAULT_CONDITIONS, ESTIMATOR_DEFAULT_TIER,
  ESTIMATOR_DEFAULT_PAVER_ID, ESTIMATOR_DEFAULT_DECK_ID, ESTIMATOR_ENTRY_CONFIDENCE, FULL_BACKYARD_PREFILL,
  ESTIMATOR_PREFILL_SIZE,
} from '../src/data/estimatorDefaults';
import { QUICK_PROJECTS, QUICK_SIZES, quickRange, type QuickProject } from '../src/utils/sophieQuote';
import { ESTIMATOR_LOCATIONS } from '../src/data/locations';

// What /cost-estimator?type=<t>&sqft=<n>&city=<c> builds on arrival (Estimator.tsx prefill effect),
// assembled independently here from the link itself, so Sophie's range is pinned to what the visitor
// actually sees when they follow "Fine-tune it".
function estimatorArrival(href: string): EstimateInput {
  const params = new URL(href, 'https://x.test').searchParams;
  const type = params.get('type')!;
  const sqft = Number(params.get('sqft'));
  const sizes: Record<string, number | string> = { ...ESTIMATOR_DEFAULT_SIZES };
  if (params.has('sqft') && sqft >= ESTIMATOR_PREFILL_SIZE.min && sqft <= ESTIMATOR_PREFILL_SIZE.max) {
    sizes[type === 'full' ? 'patio' : type] = sqft;
  }
  return {
    projectType: type,
    selectedElements: type === 'full' ? [...FULL_BACKYARD_PREFILL] : [],
    sizes,
    details: {},
    conditions: { ...ESTIMATOR_DEFAULT_CONDITIONS },
    location: params.get('city') as EstimateInput['location'],
    tier: ESTIMATOR_DEFAULT_TIER,
    paverBrandId: ESTIMATOR_DEFAULT_PAVER_ID,
    deckBrandId: ESTIMATOR_DEFAULT_DECK_ID,
    addOns: [],
  };
}

const bookingSource = readFileSync('src/components/BookingScheduler.tsx', 'utf8');
const serviceBlock = bookingSource.match(/const SERVICE_OPTIONS = \[([\s\S]*?)\];/);
assert.ok(serviceBlock, 'BookingScheduler SERVICE_OPTIONS must stay a literal array');
const serviceOptions = [...serviceBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

let priced = 0;
for (const project of QUICK_PROJECTS) {
  for (const size of QUICK_SIZES[project.id]) {
    for (const city of [ESTIMATOR_LOCATIONS[0].key, ESTIMATOR_LOCATIONS[ESTIMATOR_LOCATIONS.length - 1].key]) {
      const result = quickRange({ project: project.id, size: size.id, city });
      if (project.id === 'deck') {
        assert.equal(result.kind, 'designer', 'decks are priced only by the deck designer');
        assert.equal(result.href, `/deck-designer?sqft=${size.amount}`);
        assert.ok(!('low' in result), 'a deck result must carry no price');
        continue;
      }
      assert.equal(result.kind, 'range');
      if (result.kind !== 'range') continue;
      const opened = widenTotals(computeEstimate(estimatorArrival(result.estimatorHref)), ESTIMATOR_ENTRY_CONFIDENCE);
      // A link that carries the size must open on Sophie's exact range; one that can't must say so.
      assert.equal(result.estimatorPrefilled, opened.low === result.low && opened.high === result.high,
        `${project.id}/${size.id}/${city}: estimatorPrefilled must be true exactly when the link opens on the same range`);
      if (size.amount === Number(ESTIMATOR_DEFAULT_SIZES[project.id === 'full' ? 'patio' : project.id]) || result.estimatorHref.includes('sqft=')) {
        assert.ok(result.estimatorPrefilled, `${project.id}/${size.id} link must reproduce the range`);
      }
      assert.ok(result.low > 0 && result.high > result.low, `${project.id}/${size.id} must be a real band`);
      assert.ok(serviceOptions.includes(result.serviceInterest), `${result.serviceInterest} must be a booking service option`);
      assert.match(result.bookingNotes, /\+ HST/);
      assert.ok(result.bookingNotes.includes(result.low.toLocaleString('en-CA')));
      assert.ok(result.contextText.includes(result.high.toLocaleString('en-CA')));
      assert.match(result.estimatorHref, new RegExp(`^/cost-estimator\\?type=${project.id}`));
      assert.ok(result.estimatorHref.includes(`city=${city}`));
      // The estimator only prefills sizes inside its window; others must not be sent.
      assert.equal(result.estimatorHref.includes('sqft='), size.amount >= ESTIMATOR_PREFILL_SIZE.min && size.amount <= ESTIMATOR_PREFILL_SIZE.max);
      priced++;
    }
  }
}

// Every project, including decks (used on deck pages), books under a real service option.
for (const project of QUICK_PROJECTS) assert.ok(serviceOptions.includes(project.serviceInterest), project.serviceInterest);

// Larger builds must never price below smaller ones of the same kind.
for (const project of QUICK_PROJECTS.filter((p) => p.id !== 'deck')) {
  const highs = QUICK_SIZES[project.id].map((s) => {
    const r = quickRange({ project: project.id as QuickProject, size: s.id, city: 'barrie' });
    return r.kind === 'range' ? r.high : 0;
  });
  assert.deepEqual([...highs].sort((a, b) => a - b), highs, `${project.id} ranges must grow with size`);
}

console.log(`sophie quick range: ${priced} priced cases match the estimator engine (links verified to reopen the same range or flagged); decks route to the designer`);
