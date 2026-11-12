/**
 * Behaviour checks for the weekly homepage evolution job
 * (scripts/site-optimizer/home-evolve-core.cjs and home-evolve.cjs): the only
 * code allowed to change src/data/homeCompositions.json on its own.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import liveCompositions from '../src/data/homeCompositions.json';

const require = createRequire(import.meta.url);
const { candidates, probabilityBeats, decide, eventNames, emptyState, normalizeState, validateStats, isDate, DEFAULTS, ARM_ID } =
  require('./site-optimizer/home-evolve-core.cjs');
const { run: runJob } = require('./site-optimizer/home-evolve.cjs');

type Arm = { id: string; weight: number; blocks: string[] };
type Compositions = Record<string, { arms: Arm[] }>;
type Counts = { views: number; acts: number; leads: number };
type Stats = Record<string, Counts>;

let failed = 0;
let passed = 0;
function ok(condition: boolean, name: string): void {
  if (condition) { passed += 1; return; }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}
/** The error message, or null when nothing was thrown. */
const errorOf = (action: () => unknown): string | null => { try { action(); return null; } catch (error) { return (error as Error).message; } };

const BLOCKS = ['instant-estimate', 'selected-work', 'process', 'services', 'faq', 'final-cta'];
const single = (blocks = BLOCKS, id = 'a'): Compositions => ({ default: { arms: [{ id, weight: 100, blocks: [...blocks] }] } });
const stat = (views: number, acts: number, leads = 0): Counts => ({ views, acts, leads });
/** Weeks are named by the date they end on. */
const week = (n: number) => new Date(Date.UTC(2026, 10, 16) + n * 7 * 86400000).toISOString().slice(0, 10);
const step = (compositions: Compositions, state: unknown, stats: Stats, n: number) => decide(compositions, state, stats, week(n), DEFAULTS);
const arms = (result: { compositions: Compositions }, segment = 'default') => result.compositions[segment].arms;

/** The rules scripts/check-home-compositions.ts enforces on the real file, applied to anything the job produces. */
function passesGate(compositions: Compositions): boolean {
  const first = compositions.default.arms[0].blocks[0];
  return Object.values(compositions).every(({ arms: list }) =>
    list.length >= 1 && list.length <= 2
    && new Set(list.map((arm) => arm.id)).size === list.length
    && list.reduce((sum, arm) => sum + arm.weight, 0) === 100
    && list.every((arm) =>
      ARM_ID.test(arm.id) && Number.isInteger(arm.weight) && arm.weight > 0
      && Object.keys(arm).sort().join() === 'blocks,id,weight'
      && arm.blocks[0] === first && arm.blocks[arm.blocks.length - 1] === 'final-cta'
      && new Set(arm.blocks).size === arm.blocks.length
      && ['selected-work', 'faq', 'final-cta'].every((required) => arm.blocks.includes(required))));
}

// Candidate orders.
const orders: string[][] = candidates(BLOCKS);
ok(orders.length === BLOCKS.length - 3, 'one candidate per block that can move up a place');
ok(orders.every((o) => o[0] === BLOCKS[0] && o[o.length - 1] === BLOCKS[BLOCKS.length - 1]), 'the first and last block never move');
ok(orders.every((o) => [...o].sort().join() === [...BLOCKS].sort().join()), 'a candidate only reorders; it never adds or drops a block');
ok(orders.every((o) => o.filter((block, i) => block !== BLOCKS[i]).length === 2), 'each candidate swaps exactly two neighbours');

// Comparing two arms.
ok(Math.abs(probabilityBeats(stat(100, 20), stat(100, 20)) - 0.5) < 0.01, 'identical results are a coin flip');
ok(probabilityBeats(stat(200, 20), stat(200, 60)) > 0.99, 'a clearly better arm is recognised');
ok(probabilityBeats(stat(200, 60), stat(200, 20)) < 0.01, 'a clearly worse arm is recognised');
ok(Math.abs(probabilityBeats(stat(120, 30), stat(90, 31)) + probabilityBeats(stat(90, 31), stat(120, 30)) - 1) < 0.01, 'the comparison is symmetric');
ok(Math.abs(probabilityBeats(stat(0, 0), stat(0, 0)) - 0.5) < 0.01, 'no data is a coin flip, not an error');
// Exact value from an independent calculation: P(Beta(76, 49926) > Beta(51, 49951)) = 0.987.
ok(Math.abs(probabilityBeats(stat(50000, 50), stat(50000, 75)) - 0.987) < 0.005, 'large counts with low rates are still integrated accurately');

// Reading inputs.
ok(isDate('2026-11-16') && !isDate('2026-13-45') && !isDate('9999-99-99') && !isDate('2026-02-30') && !isDate('16/11/2026'), 'only real calendar dates are accepted');
ok(errorOf(() => step(single(), emptyState(), {}, 0)) === null && /real date/.test(errorOf(() => decide(single(), emptyState(), {}, '2026-13-45', DEFAULTS)) ?? ''), 'an impossible week ending is refused');
ok(/whole number/.test(errorOf(() => validateStats({ 'default/a': { views: 120 } })) ?? ''), 'an arm reported without its action count is refused, not read as zero actions');
ok(/whole number/.test(errorOf(() => validateStats({ 'default/a': { views: '210', acts: 3, leads: 0 } })) ?? ''), 'counts given as text are refused');
ok(/whole number/.test(errorOf(() => validateStats({ 'default/a': { views: 10, acts: -1, leads: 0 } })) ?? ''), 'negative counts are refused');
ok(validateStats({ 'default/a': stat(10, 14) })['default/a'].acts === 10, 'more actions than views cannot make a rate above 100%');
ok(normalizeState({}).dryRunsRemaining === DEFAULTS.initialDryRuns && normalizeState(null).dryRunsRemaining === DEFAULTS.initialDryRuns, 'a state with no dry-run counter still owes its dry runs');
ok(normalizeState({ dryRunsRemaining: 'none' }).dryRunsRemaining === DEFAULTS.initialDryRuns && normalizeState({ dryRunsRemaining: -1 }).dryRunsRemaining === DEFAULTS.initialDryRuns, 'a damaged dry-run counter is not read as zero');
ok(normalizeState({ dryRunsRemaining: 0 }).dryRunsRemaining === 0, 'a counter of zero set on purpose is kept');
ok(normalizeState({ lastWeekEnding: '9999-99-99' }).lastWeekEnding === null, 'an impossible stored date cannot lock the job');

// Starting a test.
const quiet = step(single(), emptyState(), { 'default/a': stat(30, 5) }, 0);
ok(!quiet.changed && quiet.actions[0].action === 'idle', 'a segment with too few visitors is left alone');
const input = single();
const inputState = emptyState();
const started = step(input, inputState, { 'default/a': stat(80, 12) }, 0);
ok(started.changed && arms(started).length === 2, 'a busy segment gets a challenger');
ok(arms(started)[0].id === 'a' && arms(started)[0].weight === 50 && arms(started)[1].weight === 50, 'traffic is split evenly');
ok(arms(started)[1].id !== 'a' && arms(started)[1].blocks.join() !== BLOCKS.join(), 'the challenger has a new id and a different order');
ok(JSON.stringify(input) === JSON.stringify(single()) && JSON.stringify(inputState) === JSON.stringify(emptyState()), 'the compositions and state passed in are never mutated');
const b = arms(started)[1].id;
const challengerOrder = arms(started)[1].blocks.join();

// Holding and promoting.
const held = step(started.compositions, started.state, { 'default/a': stat(40, 6), [`default/${b}`]: stat(40, 14) }, 1);
ok(!held.changed && held.actions[0].action === 'hold', 'a test with too few views per arm keeps running, however lopsided');
const promoted = step(held.compositions, held.state, { 'default/a': stat(90, 12), [`default/${b}`]: stat(90, 40) }, 2);
ok(promoted.changed && arms(promoted).length === 1 && arms(promoted)[0].id === b, 'weekly counts add up, and a clear winner becomes the page');
ok(arms(promoted)[0].weight === 100 && arms(promoted)[0].blocks.join() === challengerOrder, 'the winner keeps its order and takes all traffic');
ok(promoted.state.segments.default.test === null, 'the test is closed after a decision');
const afterPromotion = step(promoted.compositions, promoted.state, { [`default/${b}`]: stat(80, 20) }, 3);
ok(arms(afterPromotion).length === 2 && arms(afterPromotion)[1].blocks.join() !== BLOCKS.join(), 'the next challenger is never the order that was just replaced');
ok(new Set(arms(afterPromotion).map((arm) => arm.id)).size === 2 && arms(afterPromotion)[1].id !== 'a', 'and it gets an id that was never used');

const fewActs = step(started.compositions, started.state, { 'default/a': stat(100, 0), [`default/${b}`]: stat(100, 4) }, 1);
ok(!fewActs.changed && /actions of its own/.test(fewActs.actions[0].detail), 'a handful of clicks against none is not enough to promote');

// Retiring.
const loser = step(started.compositions, started.state, { 'default/a': stat(150, 50), [`default/${b}`]: stat(150, 10) }, 1);
ok(loser.changed && arms(loser).length === 1 && arms(loser)[0].id === 'a', 'a clear loser is retired and the original stays');
const afterLoser = step(loser.compositions, loser.state, { 'default/a': stat(80, 12) }, 2);
ok(arms(afterLoser)[1].blocks.join() !== challengerOrder, 'an order that already lost is not tried again');

const guarded = step(started.compositions, started.state, { 'default/a': stat(150, 15, 4), [`default/${b}`]: stat(150, 50, 0) }, 1);
ok(!guarded.changed && /enquiries/.test(guarded.actions[0].detail), 'more clicks but no real enquiries is not a win while the original is getting enquiries');
let stuck = guarded;
for (let n = 2; n <= 6; n += 1) stuck = step(stuck.compositions, stuck.state, { 'default/a': stat(20, 2, 1), [`default/${b}`]: stat(20, 8, 0) }, n);
ok(arms(stuck).length === 1 && arms(stuck)[0].id === 'a', 'a challenger held back by the enquiry guard is still ended at six weeks');

let stale = started;
for (let n = 1; n <= 6; n += 1) stale = step(stale.compositions, stale.state, { 'default/a': stat(5, 1), [`default/${b}`]: stat(5, 1) }, n);
ok(arms(stale).length === 1 && arms(stale)[0].id === 'a', 'a test that cannot reach a result in six weeks is ended and the original kept');

// File and state out of step.
const reversed: Compositions = { default: { arms: [arms(started)[1], arms(started)[0]] } };
const reversedLoser = step(reversed, started.state, { 'default/a': stat(150, 50), [`default/${b}`]: stat(150, 10) }, 1);
ok(arms(reversedLoser)[0].id === 'a', 'the challenger is the arm the state names, wherever it sits in the file');
const orphan = step(started.compositions, emptyState(), { 'default/a': stat(150, 15), [`default/${b}`]: stat(150, 60) }, 1);
ok(orphan.actions.length === 1 && orphan.actions[0].action === 'promote' && arms(orphan)[0].id === b, 'a test with no record is picked up and judged on the counts it has');
ok(orphan.state.segments.default.tested.length === 2, 'and both of its orders are remembered');
const lostState = step(single(BLOCKS, 'v2'), emptyState(), { 'default/v2': stat(80, 10) }, 0);
ok(new Set(arms(lostState).map((arm) => arm.id)).size === 2, 'a lost state file cannot lead to two arms with the same id');

// Limits.
const many: Compositions = Object.fromEntries(['default', 'patios', 'decks', 'walls', 'driveways'].map((s) => [s, single().default]));
const busy: Stats = Object.fromEntries(Object.keys(many).map((s) => [`${s}/a`, stat(200, 30)]));
const capped = step(many, emptyState(), busy, 0);
ok(Object.values(capped.compositions as Compositions).filter((c) => c.arms.length === 2).length === 2, 'at most two changes in one run');
const mixed: Compositions = { ...many, walls: started.compositions.default, driveways: started.compositions.default };
const mixedState = { ...emptyState(), segments: { walls: started.state.segments.default, driveways: started.state.segments.default }, lastWeekEnding: week(0) };
const decided = step(mixed, mixedState, { ...busy, 'walls/a': stat(150, 50), [`walls/${b}`]: stat(150, 10), 'driveways/a': stat(150, 50), [`driveways/${b}`]: stat(150, 10) }, 1);
ok(arms(decided, 'walls').length === 1 && arms(decided, 'driveways').length === 1 && arms(decided, 'default').length === 1, 'decisions on running tests come before new tests when the change limit is tight');
ok(/less than 7 days/.test(errorOf(() => step(started.compositions, started.state, {}, 0)) ?? ''), 'the same week cannot be counted twice');
ok(/less than 7 days/.test(errorOf(() => decide(started.compositions, started.state, {}, '2026-11-18', DEFAULTS)) ?? ''), 'nor can a "week" that ends two days after the last one');
const exhaustedState = { ...emptyState(), segments: { default: { tested: candidates(BLOCKS).map((o: string[]) => o.join('>')), test: null } } };
const nothingLeft = step(single(), exhaustedState, { 'default/a': stat(500, 50) }, 0);
ok(!nothingLeft.changed && /tried/.test(nothingLeft.actions[0].detail), 'when every single move has been tried, nothing is invented');

// Everything it produces passes the gate on the real file.
ok([started, held, promoted, afterPromotion, loser, afterLoser, stuck, stale, reversedLoser, lostState, capped, decided].every((result) => passesGate(result.compositions)), 'every result passes the composition rules');
let live = { compositions: liveCompositions as Compositions, state: emptyState() as unknown };
const liveStats = (compositions: Compositions): Stats => Object.fromEntries(Object.entries(compositions).flatMap(([segment, { arms: list }]) => list.map((arm, i) => [`${segment}/${arm.id}`, stat(400, i === 1 ? 160 : 60)])));
let liveOk = true;
/** Per segment, each order that has been the page, in the order it took over. */
const reigns: Record<string, string[]> = {};
for (let n = 0; n < 12; n += 1) {
  live = step(live.compositions, live.state, liveStats(live.compositions), n);
  liveOk &&= passesGate(live.compositions);
  for (const [segment, { arms: list }] of Object.entries(live.compositions)) {
    const order = list[0].blocks.join('>');
    const seen = (reigns[segment] ||= []);
    if (seen[seen.length - 1] !== order) seen.push(order);
  }
}
ok(liveOk, 'twelve weeks of starts and promotions on the live file never break the composition rules');
ok(Object.values(reigns).some((seen) => seen.length > 2), 'the simulation really does promote more than once');
ok(Object.values(reigns).every((seen) => new Set(seen).size === seen.length), 'and the page never flips back to an order it has already replaced');

// Event names.
const names: string[] = eventNames(liveCompositions);
ok(names.includes('home_view_default_a') && names.includes('home_act_decks_a'), 'event names are derived from the live compositions');
ok(names.every((name) => /^[a-z][a-z0-9_]{0,39}$/.test(name)), 'every event name is a valid GA4 name');

// The job itself, run against a temporary copy of the files.
const dir = mkdtempSync(join(tmpdir(), 'gm-evolve-'));
try {
  const paths = { compositions: join(dir, 'compositions.json'), state: join(dir, 'state.json'), halt: join(dir, 'HALT') };
  const statsPath = join(dir, 'stats.json');
  const original = `${JSON.stringify(single(), null, 2)}\n`;
  writeFileSync(paths.compositions, original);
  writeFileSync(statsPath, JSON.stringify({ 'default/a': stat(120, 20) }));
  const job = (n: number, write: boolean) => runJob({ paths, statsPath, weekEnding: week(n), write, today: week(20) });
  const untouched = () => readFileSync(paths.compositions, 'utf8') === original;

  const preview = job(0, false);
  ok(preview.mode === 'preview' && preview.wouldChange === true && untouched() && !existsSync(paths.state), 'a preview writes nothing at all');
  const dryOne = job(0, true);
  ok(dryOne.mode === 'dry-run' && dryOne.dryRunsRemaining === 1 && untouched(), 'the first write is a dry run: the plan is recorded and the site is not changed');
  ok(/less than 7 days/.test(errorOf(() => job(0, true)) ?? '') && untouched(), 'the same week cannot be run twice, dry run or not');
  writeFileSync(paths.state, '{}');
  const emptied = job(1, true);
  ok(emptied.mode === 'dry-run' && untouched(), 'emptying the state file does not skip the dry runs');
  writeFileSync(paths.state, 'not json');
  ok(job(2, true).mode === 'dry-run' && untouched(), 'nor does a state file that will not parse');
  rmSync(paths.state);
  ok(job(3, true).mode === 'dry-run' && untouched(), 'nor does deleting it');
  writeFileSync(paths.state, JSON.stringify({ ...emptyState(), dryRunsRemaining: 0 }));
  writeFileSync(paths.halt, '');
  ok(/HALT/.test(errorOf(() => job(4, true)) ?? '') && untouched(), 'the kill switch stops a write');
  rmSync(paths.halt);
  ok(/future/.test(errorOf(() => runJob({ paths, statsPath, weekEnding: week(30), write: true, today: week(20) })) ?? '') && untouched(), 'a week that has not happened yet is refused');
  const applied = job(4, true);
  const written = JSON.parse(readFileSync(paths.compositions, 'utf8')) as Compositions;
  ok(applied.mode === 'applied' && applied.changed === true && written.default.arms.length === 2 && passesGate(written), 'once the owner has cleared the dry runs, a write changes the compositions');
  ok(JSON.parse(readFileSync(paths.state, 'utf8')).segments.default.test.challenger === written.default.arms[1].id, 'and records the test it started');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`HOME EVOLVE FAILED: ${failed} of ${passed + failed} checks`);
  process.exit(1);
}
console.log(`HOME EVOLVE OK: ${passed} checks`);
