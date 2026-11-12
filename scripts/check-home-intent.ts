/**
 * Behaviour checks for the homepage intent engine (src/components/home/intent.ts)
 * and the owner-approved hero variants it selects between.
 */
import {
  HOME_SERVICES,
  cityFrom,
  parseSegment,
  recordSession,
  sanitizeProfile,
  scoreSignals,
  segmentOf,
  totalAt,
  type IntentSignals,
} from '../src/components/home/intent';
import { HERO_VARIANTS } from '../src/data/homeHeroVariants';
import { heroBootScript, storedSegmentValue } from '../src/components/home/heroBoot';

let failed = 0;
let passed = 0;
function ok(condition: boolean, name: string): void {
  if (condition) { passed += 1; return; }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}

const NONE: IntentSignals = { utmText: '', pagePaths: [], clickLabels: [] };
const segment = (signals: Partial<IntentSignals>) => segmentOf(scoreSignals({ ...NONE, ...signals }));
const DAY = 24 * 60 * 60 * 1000;
const EMPTY_PROFILE = { sessions: {} };

// Scoring one visit.
ok(segment({}) === 'default', 'no signals gives the default page');
ok(segment({ utmText: 'composite deck builder barrie' }) === 'decks', 'a deck search term selects decks');
ok(segment({ utmText: 'Retaining Wall Contractor' }) === 'walls', 'search terms match in any letter case');
ok(segment({ utmText: 'interlocking driveway barrie' }) === 'driveways', 'an interlocking driveway search is driveways, not patios');
ok(segment({ pagePaths: ['/services/interlocking-barrie/'] }) === 'default', 'one service page view is not enough to change the page');
ok(segment({ pagePaths: ['/services/interlocking-barrie/', '/patios-barrie/'] }) === 'patios', 'two patio pages select patios');
ok(segment({ pagePaths: ['/patios-barrie/', '/patios-barrie/', '/patios-barrie/'] }) === 'default', 'the same page viewed repeatedly counts once');
ok(segment({ pagePaths: ['/', '/contact/', '/about/', '/cost-estimator/'] }) === 'default', 'general pages carry no interest');
ok(segment({ pagePaths: ['/deck-designer/'], clickLabels: ['home_estimate_deck_medium_barrie', 'chat: how much is a deck'] }) === 'decks', 'the deck designer plus deck clicks select decks');
ok(segment({ utmText: 'deck builder', pagePaths: ['/services/retaining-walls-barrie/', '/retaining-walls-barrie/'] }) === 'default', 'two interests that are nearly tied stay on the default page');
ok(Object.values(scoreSignals({ ...NONE, clickLabels: Array(40).fill('deck') })).every((n) => n <= 3), 'click labels are capped');

// Carrying interest across visits.
const DECK_VISIT = scoreSignals({ ...NONE, utmText: 'deck builder', pagePaths: ['/deck-designer/'] });
const first = recordSession(null, 's1', DECK_VISIT, 0);
ok(segmentOf(totalAt(first, 0)) === 'decks', 'the first visit records the interest');
const again = recordSession(first, 's1', DECK_VISIT, 1000);
ok(JSON.stringify(totalAt(again, 1000)) === JSON.stringify(totalAt(first, 0)), 'refreshing within one visit does not inflate the score');
let tabs = null as ReturnType<typeof recordSession> | null;
for (let i = 0; i < 20; i += 1) tabs = recordSession(tabs, i % 2 ? 'tab-a' : 'tab-b', scoreSignals({ ...NONE, pagePaths: ['/deck-designer/'] }), i);
ok(Math.abs(totalAt(tabs!, 20).decks - 4) < 0.001, 'two open tabs taking turns do not inflate the score');
const weekLater = recordSession(first, 's2', scoreSignals(NONE), 7 * DAY);
ok(segmentOf(totalAt(weekLater, 7 * DAY)) === 'decks', 'a returning visitor a week later still gets their interest');
const twoMonthsLater = recordSession(first, 's3', scoreSignals(NONE), 60 * DAY);
ok(segmentOf(totalAt(twoMonthsLater, 60 * DAY)) === 'default', 'the interest fades after two months away');
let regular = first;
for (let i = 2; i < 40; i += 1) regular = recordSession(regular, `s${i}`, scoreSignals({ ...NONE, utmText: 'deck builder' }), i);
ok(Object.keys(regular.sessions).length === 6, 'only the most recent sessions are kept');
ok(totalAt(regular, 40).decks <= 16, 'remembered interest is capped however often they return');
const switched = recordSession(regular, 'new', scoreSignals({ ...NONE, utmText: 'retaining wall', pagePaths: ['/services/retaining-walls-barrie/', '/retaining-walls-barrie/', '/sloped-backyard-solutions-barrie/'] }), 30 * DAY);
ok(segmentOf(totalAt(switched, 30 * DAY)) === 'walls', 'a strong new interest overtakes an old one');

let idle = first;
for (let i = 0; i < 10; i += 1) idle = recordSession(idle, `idle${i}`, scoreSignals(NONE), i + 1);
ok(segmentOf(totalAt(idle, 11)) === 'decks', 'visits that show no interest do not push a real one out of memory');
const skewed = recordSession({ sessions: { ahead: { scores: DECK_VISIT, at: 400 * DAY } } }, 'now', scoreSignals(NONE), 0);
ok(skewed.sessions.ahead.at === 0, 'a timestamp from the future is pulled back to now');
ok(Object.values(totalAt(EMPTY_PROFILE, DAY, { projectType: 'constructor', savedAt: 0 })).every((n) => n === 0), 'an unknown estimate type scores nothing');

// A saved estimate counts, and fades from the day it was saved.
ok(segmentOf(totalAt(EMPTY_PROFILE, DAY, { projectType: 'wall', savedAt: 0 })) === 'walls', 'a wall estimate saved yesterday selects walls');
ok(segmentOf(totalAt(EMPTY_PROFILE, 90 * DAY, { projectType: 'wall', savedAt: 0 })) === 'default', 'an estimate saved three months ago no longer decides the page');
ok(segmentOf(totalAt(EMPTY_PROFILE, DAY, { projectType: 'full', savedAt: 0 })) === 'default', 'a full-backyard estimate stays on the default page');

// Reading a stored profile back.
ok(sanitizeProfile(null) === null && sanitizeProfile({}) === null && sanitizeProfile('x') === null, 'a missing or foreign stored value is ignored');
const damaged = sanitizeProfile({ sessions: { good: first.sessions.s1, noTime: { scores: DECK_VISIT }, partial: { scores: { decks: 3 }, at: 5 }, text: 'x' } });
ok(damaged !== null && Object.keys(damaged.sessions).join() === 'good', 'damaged entries are dropped and sound ones kept');
ok(Object.values(totalAt(damaged!, 0)).every(Number.isFinite), 'a cleaned profile never scores NaN');

// Town.
const TOWNS = ['barrie', 'innisfil', 'oro-medonte', 'wasaga-beach'];
ok(cityFrom(['/services/interlocking-barrie/', '/locations/innisfil/', '/contact/'], TOWNS) === 'innisfil', 'a location page sets the town');
ok(cityFrom(['/locations/innisfil/', '/services/retaining-walls-wasaga-beach/'], TOWNS) === 'wasaga-beach', 'the most recent town wins');
ok(cityFrom(['/', '/services/interlocking-barrie/', '/about/'], TOWNS) === null, 'no town page means no town');
ok(cityFrom(['/services/interlocking-innisfil/'], TOWNS) === 'innisfil', 'a service page for a town sets the town');

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
ok(boot.includes('hasOwnProperty') && boot.includes('Date.now()'), 'the pre-paint script only accepts its own segments and checks the stored one has not expired');
const stored = storedSegmentValue('decks', 1000).split('|');
ok(stored[0] === 'decks' && Number(stored[1]) > 1000, 'the stored segment carries an expiry');
ok(boot.length < 6000, `the pre-paint script stays small (${boot.length} chars)`);

if (failed) {
  console.error(`HOME INTENT FAILED: ${failed} of ${passed + failed} checks`);
  process.exit(1);
}
console.log(`HOME INTENT OK: ${passed} checks`);
