/**
 * Decision logic for the weekly homepage evolution job. Pure: it takes the
 * current compositions, the job's own state and one week of counts, and
 * returns the next compositions and state. home-evolve.cjs does the file I/O.
 *
 * What it may do to a segment, and nothing else:
 *   start    add one challenger arm that swaps two neighbouring blocks, 50/50
 *   promote  make a challenger that clearly wins the only arm
 *   retire   drop a challenger that clearly loses or cannot reach a result
 * It never touches the first or last block, never adds or removes a block,
 * and has no access to headlines, photos or prices: those are not in the file
 * it writes.
 */

const DEFAULTS = Object.freeze({
  /** Views a segment needs in the week before a test is worth starting. */
  minViewsToStartTest: 60,
  /** Views each arm needs, summed over the test, before it can be judged. */
  minArmViews: 100,
  /** Chance the challenger is better at which it is promoted, and at or below which it is retired. */
  promoteAt: 0.9,
  retireAt: 0.1,
  /** A test that has not been decided by now is ended and the original kept. */
  maxTestDays: 42,
  challengerWeight: 50,
  /** The original must not be getting real enquiries while the challenger gets none. */
  leadGuardMin: 3,
  /** Segments that may change in one run. */
  maxChangesPerRun: 2,
  logSize: 30,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const orderKey = (blocks) => blocks.join('>');
const zero = () => ({ views: 0, acts: 0, leads: 0 });

function emptyState() {
  return { dryRunsRemaining: 2, lastWeekEnding: null, nextArm: 2, segments: {}, log: [] };
}

/** Every order reachable by moving one block up a place, leaving the first and last block where they are. */
function candidates(blocks) {
  const out = [];
  for (let i = 2; i < blocks.length - 1; i += 1) {
    const next = [...blocks];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    out.push(next);
  }
  return out;
}

/**
 * Chance that arm `b` has the higher action rate than arm `a`, with a uniform
 * prior on each rate. Integrated on a fixed grid, so the same counts always
 * give the same answer.
 */
function probabilityBeats(a, b) {
  const GRID = 2000;
  const density = ({ views, acts }) => {
    const hits = Math.min(Math.max(0, acts), Math.max(0, views));
    const misses = Math.max(0, views) - hits;
    const logs = [];
    let peak = -Infinity;
    for (let i = 0; i < GRID; i += 1) {
      const x = (i + 0.5) / GRID;
      const value = hits * Math.log(x) + misses * Math.log(1 - x);
      logs.push(value);
      if (value > peak) peak = value;
    }
    const weights = logs.map((value) => Math.exp(value - peak));
    const total = weights.reduce((sum, w) => sum + w, 0);
    return weights.map((w) => w / total);
  };
  const pa = density(a);
  const pb = density(b);
  let below = 0;
  let chance = 0;
  for (let i = 0; i < GRID; i += 1) {
    chance += pb[i] * (below + pa[i] / 2);
    below += pa[i];
  }
  return chance;
}

function readCounts(weekStats, segment, armId) {
  const raw = weekStats[`${segment}/${armId}`] || {};
  const whole = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  const views = whole(raw.views);
  return { views, acts: Math.min(views, whole(raw.acts)), leads: whole(raw.leads) };
}

const add = (a, b) => ({ views: a.views + b.views, acts: a.acts + b.acts, leads: a.leads + b.leads });

/** Analytics event names for every arm in the file, for the collector to count. */
function eventNames(compositions) {
  const names = [];
  for (const [segment, { arms }] of Object.entries(compositions)) {
    for (const arm of arms) names.push(`home_view_${segment}_${arm.id}`, `home_act_${segment}_${arm.id}`);
  }
  return names;
}

function decide(currentCompositions, currentState, weekStats, weekEnding, options = DEFAULTS) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnding)) throw new Error(`weekEnding must be YYYY-MM-DD, got "${weekEnding}"`);
  const state = { ...emptyState(), ...clone(currentState || {}) };
  if (state.lastWeekEnding && weekEnding <= state.lastWeekEnding) {
    throw new Error(`week ending ${weekEnding} was already counted (last was ${state.lastWeekEnding})`);
  }
  const compositions = clone(currentCompositions);
  const actions = [];
  let budget = options.maxChangesPerRun;
  const settled = new Set();
  const segmentState = (segment) => (state.segments[segment] ||= { tested: [], test: null });

  // Tests already running: count the week, then decide.
  for (const [segment, composition] of Object.entries(compositions)) {
    if (composition.arms.length !== 2) continue;
    settled.add(segment);
    const [champion, challenger] = composition.arms;
    const record = segmentState(segment);
    if (!record.test || record.test.challenger !== challenger.id) {
      record.test = { challenger: challenger.id, startedOn: weekEnding, totals: {} };
    }
    const totals = record.test.totals;
    totals[champion.id] = add(totals[champion.id] || zero(), readCounts(weekStats, segment, champion.id));
    totals[challenger.id] = add(totals[challenger.id] || zero(), readCounts(weekStats, segment, challenger.id));
    const a = totals[champion.id];
    const b = totals[challenger.id];
    const ageDays = Math.round((Date.parse(weekEnding) - Date.parse(record.test.startedOn)) / DAY_MS);
    const enoughViews = a.views >= options.minArmViews && b.views >= options.minArmViews;
    const chance = enoughViews ? probabilityBeats(a, b) : null;
    const summary = `${champion.id} ${a.acts}/${a.views} acts, ${a.leads} leads; ${challenger.id} ${b.acts}/${b.views} acts, ${b.leads} leads; day ${ageDays}`;

    let verdict = 'hold';
    let reason = enoughViews ? `chance challenger is better ${(chance * 100).toFixed(0)}%` : `needs ${options.minArmViews} views per arm`;
    if (enoughViews && chance >= options.promoteAt) {
      if (a.leads >= options.leadGuardMin && b.leads === 0) reason += '; not promoted: the original has real enquiries and the challenger has none';
      else verdict = 'promote';
    } else if (enoughViews && chance <= options.retireAt) {
      verdict = 'retire';
    } else if (ageDays >= options.maxTestDays) {
      verdict = 'retire';
      reason += `; no result in ${options.maxTestDays} days`;
    }
    if (verdict !== 'hold' && budget <= 0) {
      verdict = 'hold';
      reason += '; decision deferred, change limit reached';
    }

    if (verdict === 'hold') {
      actions.push({ segment, action: 'hold', detail: `${summary}; ${reason}` });
      continue;
    }
    budget -= 1;
    record.tested.push(orderKey(challenger.blocks));
    record.test = null;
    const winner = verdict === 'promote' ? challenger : champion;
    composition.arms = [{ id: winner.id, weight: 100, blocks: winner.blocks }];
    actions.push({ segment, action: verdict, detail: `${summary}; ${reason}` });
  }

  // Segments with one arm: start a test where there is enough traffic and something left to try.
  for (const [segment, composition] of Object.entries(compositions)) {
    if (settled.has(segment) || composition.arms.length !== 1) continue;
    const [champion] = composition.arms;
    const record = segmentState(segment);
    const week = readCounts(weekStats, segment, champion.id);
    if (week.views < options.minViewsToStartTest) {
      actions.push({ segment, action: 'idle', detail: `${week.views} views this week; a test needs ${options.minViewsToStartTest}` });
      continue;
    }
    const next = candidates(champion.blocks).find((order) => !record.tested.includes(orderKey(order)));
    if (!next) {
      actions.push({ segment, action: 'idle', detail: 'every single move has been tried' });
      continue;
    }
    if (budget <= 0) {
      actions.push({ segment, action: 'idle', detail: 'test deferred, change limit reached' });
      continue;
    }
    budget -= 1;
    const challenger = { id: `v${state.nextArm}`, weight: options.challengerWeight, blocks: next };
    state.nextArm += 1;
    composition.arms = [{ ...champion, weight: 100 - options.challengerWeight }, challenger];
    record.test = { challenger: challenger.id, startedOn: weekEnding, totals: {} };
    const moved = next.find((block, i) => block !== champion.blocks[i]);
    actions.push({ segment, action: 'start', detail: `${week.views} views this week; trying "${moved}" one place higher as ${challenger.id}, 50/50` });
  }

  state.lastWeekEnding = weekEnding;
  state.log = [...state.log, { weekEnding, actions }].slice(-options.logSize);
  const changed = actions.some(({ action }) => action === 'start' || action === 'promote' || action === 'retire');
  return { compositions, state, actions, changed };
}

module.exports = { DEFAULTS, candidates, probabilityBeats, decide, eventNames, emptyState };
