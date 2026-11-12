/**
 * Behaviour checks for the homepage intent engine (src/components/home/intent.ts)
 * and the owner-approved hero variants it selects between.
 */
import {
  HOME_SERVICES,
  cityFrom,
  nextProfile,
  parseSegment,
  scoreSignals,
  segmentOf,
  totalAt,
  type IntentSignals,
} from '../src/components/home/intent';
import { HERO_VARIANTS } from '../src/data/homeHeroVariants';
import { heroBootScript } from '../src/components/home/heroBoot';

let failed = 0;
let passed = 0;
function ok(condition: boolean, name: string): void {
  if (condition) { passed += 1; return; }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}

const NONE: IntentSignals = { utmText: '', pagePaths: [], clickLabels: [], lastEstimateType: null };
const segment = (signals: Partial<IntentSignals>) => segmentOf(scoreSignals({ ...NONE, ...signals }));
const DAY = 24 * 60 * 60 * 1000;

// Scoring one visit.
ok(segment({}) === 'default', 'no signals gives the default page');
ok(segment({ utmText: 'composite deck builder barrie' }) === 'decks', 'a deck search term selects decks');
ok(segment({ utmText: 'Retaining Wall Contractor' }) === 'walls', 'search terms match in any letter case');
ok(segment({ utmText: 'interlocking driveway barrie' }) === 'driveways', 'an interlocking driveway search is driveways, not patios');
ok(segment({ pagePaths: ['/services/interlocking-barrie/'] }) === 'default', 'one service page view is not enough to change the page');
ok(segment({ pagePaths: ['/services/interlocking-barrie/', '/patios-barrie/'] }) === 'patios', 'two patio pages select patios');
ok(segment({ pagePaths: ['/patios-barrie/', '/patios-barrie/', '/patios-barrie/'] }) === 'default', 'the same page viewed repeatedly counts once');
ok(segment({ pagePaths: ['/', '/contact/', '/about/', '/cost-estimator/'] }) === 'default', 'general pages carry no interest');
ok(segment({ lastEstimateType: 'wall' }) === 'walls', 'a saved wall estimate selects walls');
ok(segment({ lastEstimateType: 'full' }) === 'default', 'a full-backyard estimate stays on the default page');
ok(segment({ pagePaths: ['/deck-designer/'], clickLabels: ['home_estimate_deck_medium_barrie', 'chat: how much is a deck'] }) === 'decks', 'the deck designer plus deck clicks select decks');
ok(segment({ utmText: 'deck builder', pagePaths: ['/services/retaining-walls-barrie/', '/retaining-walls-barrie/'] }) === 'default', 'two interests that are nearly tied stay on the default page');
ok(Object.values(scoreSignals({ ...NONE, clickLabels: Array(40).fill('deck') })).every((n) => n <= 3), 'click labels are capped');

// Carrying interest across visits.
const first = nextProfile(null, 's1', scoreSignals({ ...NONE, utmText: 'deck builder', pagePaths: ['/deck-designer/'] }), 0);
ok(segmentOf(totalAt(first, 0)) === 'decks', 'the first visit records the interest');
const again = nextProfile(first, 's1', scoreSignals({ ...NONE, utmText: 'deck builder', pagePaths: ['/deck-designer/'] }), 1000);
ok(JSON.stringify(totalAt(again, 1000)) === JSON.stringify(totalAt(first, 0)), 'refreshing within one visit does not inflate the score');
const weekLater = nextProfile(first, 's2', scoreSignals(NONE), 7 * DAY);
ok(segmentOf(totalAt(weekLater, 7 * DAY)) === 'decks', 'a returning visitor a week later still gets their interest');
const twoMonthsLater = nextProfile(first, 's3', scoreSignals(NONE), 60 * DAY);
ok(segmentOf(totalAt(twoMonthsLater, 60 * DAY)) === 'default', 'the interest fades after two months away');
let runaway = first;
for (let i = 2; i < 40; i += 1) runaway = nextProfile(runaway, `s${i}`, scoreSignals({ ...NONE, utmText: 'deck builder' }), i);
ok(totalAt(runaway, 40).decks <= 17, 'carried interest is capped however often they return');
const switched = nextProfile(runaway, 'new', scoreSignals({ ...NONE, utmText: 'retaining wall', pagePaths: ['/services/retaining-walls-barrie/', '/retaining-walls-barrie/', '/sloped-backyard-solutions-barrie/'] }), 41 + 30 * DAY);
ok(segmentOf(totalAt(switched, 41 + 30 * DAY)) === 'walls', 'a strong new interest overtakes an old one');

// Town.
const TOWNS = ['barrie', 'innisfil', 'oro-medonte', 'wasaga-beach'];
ok(cityFrom(['/services/interlocking-barrie/', '/locations/innisfil/', '/contact/'], TOWNS) === 'innisfil', 'a location page sets the town');
ok(cityFrom(['/locations/innisfil/', '/services/retaining-walls-wasaga-beach/'], TOWNS) === 'wasaga-beach', 'the most recent town wins');
ok(cityFrom(['/', '/services/interlocking-barrie/', '/about/'], TOWNS) === null, 'no town page means no town');

// The testing override.
ok(parseSegment('decks') === 'decks' && parseSegment('default') === 'default', 'known segments are accepted');
ok(parseSegment('pools') === null && parseSegment('') === null && parseSegment(null) === null, 'unknown segments are ignored');

// Owner-approved hero variants.
ok(HOME_SERVICES.every((s) => HERO_VARIANTS[s]), 'every service has a hero variant');
for (const s of HOME_SERVICES) {
  const v = HERO_VARIANTS[s];
  ok(v.headline.length === 3 && v.headline.every((line) => line.trim().length > 0), `${s}: headline has three lines`);
  ok(!/[$—]/.test(JSON.stringify(v)), `${s}: no price and no em dash in the hero copy`);
  ok(v.image.src.startsWith('/images/portfolio/'), `${s}: hero photo comes from the attested portfolio`);
}
const boot = heroBootScript();
ok(HOME_SERVICES.every((s) => boot.includes(`"${s}"`)), 'the pre-paint script carries every variant');
ok(!boot.includes('</script'), 'the pre-paint script cannot close its own tag');
let bootParses = true;
try { new Function(boot); } catch { bootParses = false; }
ok(bootParses, 'the pre-paint script is valid JavaScript');
ok(boot.length < 6000, `the pre-paint script stays small (${boot.length} chars)`);

if (failed) {
  console.error(`HOME INTENT FAILED: ${failed} of ${passed + failed} checks`);
  process.exit(1);
}
console.log(`HOME INTENT OK: ${passed} checks`);
