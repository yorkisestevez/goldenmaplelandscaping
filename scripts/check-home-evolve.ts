/**
 * Behaviour checks for the weekly homepage evolution job
 * (scripts/site-optimizer/home-evolve-core.cjs): the only code allowed to
 * change src/data/homeCompositions.json on its own.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import liveCompositions from '../src/data/homeCompositions.json';

const require = createRequire(import.meta.url);
const core = require('./site-optimizer/home-evolve-core.cjs');
const { candidates, probabilityBeats, decide, eventNames, emptyState, DEFAULTS } = core;

type Arm = { id: string; weight: number; blocks: string[] };
type Compositions = Record<string, { arms: Arm[] }>;
type Stats = Record<string, { views: number; acts: number; leads: number }>;

let failed = 0;
let passed = 0;
function ok(condition: boolean, name: string): void {
  if (condition) { passed += 1; return; }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}
const throws = (run: () => unknown): boolean => { try { run(); return false; } catch { return true; } };

const BLOCKS = ['instant-estimate', 'selected-work', 'process', 'services', 'faq', 'final-cta'];
const single = (): Compositions => ({ default: { arms: [{ id: 'a', weight: 100, blocks: [...BLOCKS] }] } });
const stat = (views: number, acts: number, leads = 0) => ({ views, acts, leads });
/** Weeks are named by the date they end on. */
const week = (n: number) => new Date(Date.UTC(2026, 10, 16) + n * 7 * 86400000).toISOString().slice(0, 10);
const run = (compositions: Compositions, state: unknown, stats: Stats, n: number) => decide(compositions, state, stats, week(n), DEFAULTS);

// Candidate orders.
const orders: string[][] = candidates(BLOCKS);
ok(orders.length === BLOCKS.length - 3, 'one candidate per block that can move up a place');
ok(orders.every((o) => o[0] === BLOCKS[0] && o[o.length - 1] === BLOCKS[BLOCKS.length - 1]), 'the first and last block never move');
ok(orders.every((o) => [...o].sort().join() === [...BLOCKS].sort().join()), 'a candidate only reorders; it never adds or drops a block');
ok(orders.every((o) => o.filter((b, i) => b !== BLOCKS[i]).length === 2), 'each candidate swaps exactly two neighbours');

// Comparing two arms.
ok(Math.abs(probabilityBeats(stat(100, 20), stat(100, 20)) - 0.5) < 0.01, 'identical results are a coin flip');
ok(probabilityBeats(stat(200, 20), stat(200, 60)) > 0.99, 'a clearly better arm is recognised');
ok(probabilityBeats(stat(200, 60), stat(200, 20)) < 0.01, 'a clearly worse arm is recognised');
ok(Math.abs(probabilityBeats(stat(120, 30), stat(90, 31)) + probabilityBeats(stat(90, 31), stat(120, 30)) - 1) < 0.01, 'the comparison is symmetric');
ok(Math.abs(probabilityBeats(stat(0, 0), stat(0, 0)) - 0.5) < 0.01, 'no data is a coin flip, not an error');

// Starting a test.
const quiet = run(single(), emptyState(), { 'default/a': stat(30, 5) }, 0);
ok(!quiet.changed && quiet.actions[0].action === 'idle', 'a segment with too few visitors is left alone');
const input = single();
const inputState = emptyState();
const started = run(input, inputState, { 'default/a': stat(80, 12) }, 0);
const startedArms: Arm[] = started.compositions.default.arms;
ok(started.changed && startedArms.length === 2, 'a busy segment gets a challenger');
ok(startedArms[0].id === 'a' && startedArms[0].weight === 50 && startedArms[1].weight === 50, 'traffic is split evenly');
ok(/^[a-z][a-z0-9]{0,7}$/.test(startedArms[1].id) && startedArms[1].id !== 'a', 'the challenger gets a fresh, valid id');
ok(startedArms[1].blocks[0] === BLOCKS[0] && startedArms[1].blocks.join() !== BLOCKS.join(), 'the challenger is a reorder that keeps the first block');
ok(JSON.stringify(input) === JSON.stringify(single()) && JSON.stringify(inputState) === JSON.stringify(emptyState()), 'the compositions and state passed in are never mutated');

// Holding, promoting, retiring.
const b = startedArms[1].id;
const held = run(started.compositions, started.state, { 'default/a': stat(40, 6), [`default/${b}`]: stat(40, 14) }, 1);
ok(!held.changed && held.actions[0].action === 'hold', 'a test with too few views per arm keeps running, however lopsided');
const promoted = run(held.compositions, held.state, { 'default/a': stat(90, 12), [`default/${b}`]: stat(90, 40) }, 2);
ok(promoted.changed && promoted.compositions.default.arms.length === 1 && promoted.compositions.default.arms[0].id === b, 'weekly counts add up, and a clear winner becomes the page');
ok(promoted.compositions.default.arms[0].weight === 100 && promoted.compositions.default.arms[0].blocks.join() === startedArms[1].blocks.join(), 'the winner keeps its order and takes all traffic');
ok(promoted.state.segments.default.test === null, 'the test is closed after a decision');

const loser = run(started.compositions, started.state, { 'default/a': stat(150, 50), [`default/${b}`]: stat(150, 10) }, 1);
ok(loser.changed && loser.compositions.default.arms.length === 1 && loser.compositions.default.arms[0].id === 'a', 'a clear loser is retired and the original stays');
const afterLoser = run(loser.compositions, loser.state, { 'default/a': stat(80, 12) }, 2);
ok(afterLoser.compositions.default.arms[1].blocks.join() !== startedArms[1].blocks.join(), 'an order that already lost is not tried again');

const guarded = run(started.compositions, started.state, { 'default/a': stat(150, 15, 4), [`default/${b}`]: stat(150, 50, 0) }, 1);
ok(!guarded.changed && guarded.actions[0].action === 'hold', 'more clicks but no real enquiries is not a win while the original is getting enquiries');

let stale = started;
for (let n = 1; n <= 6; n += 1) stale = run(stale.compositions, stale.state, { 'default/a': stat(5, 1), [`default/${b}`]: stat(5, 1) }, n);
ok(stale.compositions.default.arms.length === 1 && stale.compositions.default.arms[0].id === 'a', 'a test that cannot reach a result in six weeks is ended and the original kept');

// Limits.
const many: Compositions = Object.fromEntries(['default', 'patios', 'decks', 'walls', 'driveways'].map((s) => [s, { arms: [{ id: 'a', weight: 100, blocks: [...BLOCKS] }] }]));
const busy: Stats = Object.fromEntries(Object.keys(many).map((s) => [`${s}/a`, stat(200, 30)]));
const capped = run(many, emptyState(), busy, 0);
ok(Object.values(capped.compositions as Compositions).filter((c) => c.arms.length === 2).length === 2, 'at most two changes in one run');
ok(throws(() => run(started.compositions, started.state, {}, 0)), 'the same week cannot be counted twice');
let exhausted = single();
let exhaustedState = emptyState();
exhaustedState.segments.default = { tested: candidates(BLOCKS).map((o: string[]) => o.join('>')), test: null };
const nothingLeft = run(exhausted, exhaustedState, { 'default/a': stat(500, 50) }, 0);
ok(!nothingLeft.changed && /tried/.test(nothingLeft.actions[0].detail), 'when every single move has been tried, nothing is invented');

// What it is allowed to write.
for (const result of [started, promoted, loser, capped]) {
  const text = JSON.stringify(result.compositions);
  ok(!text.includes('$') && !/headline|subhead|image|price/i.test(text), 'output holds arms, weights and block ids only');
  for (const [segment, composition] of Object.entries(result.compositions as Compositions)) {
    const total = composition.arms.reduce((sum, arm) => sum + arm.weight, 0);
    ok(composition.arms.length >= 1 && composition.arms.length <= 2 && total === 100, `${segment}: one or two arms with weights totalling 100`);
  }
}

// Reading the live file.
const names: string[] = eventNames(liveCompositions);
ok(names.includes('home_view_default_a') && names.includes('home_act_decks_a'), 'event names are derived from the live compositions');
ok(names.every((n) => /^[a-z][a-z0-9_]{0,39}$/.test(n)), 'every event name is a valid GA4 name');

// The command-line wrapper, run against a temporary copy of the files.
const dir = mkdtempSync(join(tmpdir(), 'gm-evolve-'));
try {
  const files = { compositions: join(dir, 'compositions.json'), state: join(dir, 'state.json'), stats: join(dir, 'stats.json') };
  const original = JSON.stringify(single(), null, 2) + '\n';
  writeFileSync(files.compositions, original);
  writeFileSync(files.stats, JSON.stringify({ 'default/a': stat(120, 20) }));
  const cli = (weekEnding: string, ...flags: string[]) => {
    try {
      const out = execFileSync(process.execPath, ['scripts/site-optimizer/home-evolve.cjs', '--stats', files.stats, '--week-ending', weekEnding, ...flags], {
        env: { ...process.env, GM_EVOLVE_COMPOSITIONS: files.compositions, GM_EVOLVE_STATE: files.state },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return JSON.parse(out);
    } catch {
      return null;
    }
  };
  const untouched = () => readFileSync(files.compositions, 'utf8') === original;

  const preview = cli(week(0));
  ok(preview?.mode === 'preview' && preview.wouldChange === true && untouched() && !existsSync(files.state), 'a preview writes nothing at all');
  const dryOne = cli(week(0), '--write');
  ok(dryOne?.mode === 'dry-run' && dryOne.dryRunsRemaining === 1 && untouched(), 'the first write is a dry run: the plan is recorded and the site is not changed');
  ok(cli(week(0), '--write') === null && untouched(), 'the same week cannot be run twice, dry run or not');
  const dryTwo = cli(week(1), '--write');
  ok(dryTwo?.mode === 'dry-run' && dryTwo.dryRunsRemaining === 0 && untouched(), 'the second write is still a dry run');
  writeFileSync(join(dir, 'HALT'), '');
  ok(cli(week(2), '--write') === null && untouched(), 'the kill switch stops a write');
  rmSync(join(dir, 'HALT'));
  const applied = cli(week(2), '--write');
  const written = JSON.parse(readFileSync(files.compositions, 'utf8'));
  ok(applied?.mode === 'applied' && applied.changed === true && written.default.arms.length === 2, 'after the dry runs, a write changes the compositions');
  ok(JSON.parse(readFileSync(files.state, 'utf8')).segments.default.test.challenger === written.default.arms[1].id, 'and records the test it started');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`HOME EVOLVE FAILED: ${failed} of ${passed + failed} checks`);
  process.exit(1);
}
console.log(`HOME EVOLVE OK: ${passed} checks`);
