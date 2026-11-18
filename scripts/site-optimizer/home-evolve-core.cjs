/**
 * Decision logic for the weekly homepage evolution job. Pure: it takes the
 * current compositions, the job's own state and one week of counts, and
 * returns the next compositions and state. home-evolve.cjs does the file I/O.
 *
 * What it may do to a segment, and nothing else:
 *   start    add one challenger arm that swaps two neighbouring blocks
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
  /**
   * Chance the challenger is better at which it is promoted, and at or below
   * which it is retired. The counts are looked at every week, which makes a
   * lucky streak more likely to cross a line than the number suggests, so the
   * lines are set wide.
   */
  promoteAt: 0.95,
  retireAt: 0.05,
  /** A challenger needs this many actions of its own; a handful of clicks is not a result. */
  minActsToPromote: 10,
  /** A test that has not been decided by now is ended and the original kept. */
  maxTestDays: 42,
  challengerWeight: 50,
  /** The original must not be getting real enquiries while the challenger gets none. */
  leadGuardMin: 3,
  /** Segments that may change in one run. */
  maxChangesPerRun: 2,
  /** Runs are weekly; counting two "weeks" closer together than this would double-count. */
  minDaysBetweenRuns: 7,
  /** Dry runs a fresh or unreadable state starts with. */
  initialDryRuns: 2,
  logSize: 30,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const ARM_ID = /^[a-z][a-z0-9]{0,7}$/;
const clone = (value) => JSON.parse(JSON.stringify(value));
const orderKey = (blocks) => blocks.join('>');
const zero = () => ({ views: 0, acts: 0, leads: 0 });
const isCount = (value) => Number.isInteger(value) && value >= 0;

/** A real calendar date written YYYY-MM-DD. */
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

function emptyState() {
  return { dryRunsRemaining: DEFAULTS.initialDryRuns, lastWeekEnding: null, nextArm: 2, segments: {}, log: [] };
}

/**
 * The job's state as read from disk, with anything missing or damaged put back
 * to its safe value. In particular an unreadable dry-run counter is treated as
 * "dry runs still owed", never as zero.
 */
function normalizeState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const segments = {};
  if (raw.segments && typeof raw.segments === 'object' && !Array.isArray(raw.segments)) {
    for (const [segment, record] of Object.entries(raw.segments)) {
      const tested = Array.isArray(record?.tested) ? record.tested.filter((key) => typeof key === 'string') : [];
      const test = record?.test;
      const sound = test && typeof test.challenger === 'string' && isDate(test.startedOn) && test.totals && typeof test.totals === 'object';
      segments[segment] = { tested, test: sound ? clone(test) : null };
    }
  }
  return {
    dryRunsRemaining: isCount(raw.dryRunsRemaining) ? raw.dryRunsRemaining : base.dryRunsRemaining,
    lastWeekEnding: isDate(raw.lastWeekEnding) ? raw.lastWeekEnding : null,
    nextArm: Number.isInteger(raw.nextArm) && raw.nextArm >= 2 ? raw.nextArm : base.nextArm,
    segments,
    log: Array.isArray(raw.log) ? clone(raw.log) : [],
  };
}

/**
 * One week of counts, checked. Every arm that is reported must report all
 * three numbers as whole numbers: a missing "acts" would otherwise read as
 * "no one acted" and hand the other arm a win it did not earn.
 */
function validateStats(weekStats) {
  if (!weekStats || typeof weekStats !== 'object' || Array.isArray(weekStats)) throw new Error('stats must be an object keyed by "<segment>/<arm>"');
  const out = {};
  for (const [key, counts] of Object.entries(weekStats)) {
    for (const field of ['views', 'acts', 'leads']) {
      if (!isCount(counts?.[field])) throw new Error(`stats "${key}": "${field}" must be a whole number, got ${JSON.stringify(counts?.[field])}`);
    }
    // An action without a counted view can happen (a blocked or late view event); it cannot make a rate above 100%.
    out[key] = { views: counts.views, acts: Math.min(counts.views, counts.acts), leads: counts.leads };
  }
  return out;
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
  const GRID = 20000;
  const density = ({ views, acts }) => {
    const hits = Math.min(Math.max(0, acts), Math.max(0, views));
    const misses = Math.max(0, views) - hits;
    const logs = new Array(GRID);
    let peak = -Infinity;
    for (let i = 0; i < GRID; i += 1) {
      const x = (i + 0.5) / GRID;
      const value = hits * Math.log(x) + misses * Math.log(1 - x);
      logs[i] = value;
      if (value > peak) peak = value;
    }
    let total = 0;
    for (let i = 0; i < GRID; i += 1) {
      logs[i] = Math.exp(logs[i] - peak);
      total += logs[i];
    }
    return logs.map((w) => w / total);
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
  if (!isDate(weekEnding)) throw new Error(`weekEnding must be a real date written YYYY-MM-DD, got "${weekEnding}"`);
  const state = normalizeState(currentState);
  if (state.lastWeekEnding && daysBetween(state.lastWeekEnding, weekEnding) < options.minDaysBetweenRuns) {
    throw new Error(`week ending ${weekEnding} is less than ${options.minDaysBetweenRuns} days after the last one counted (${state.lastWeekEnding})`);
  }
  const stats = validateStats(weekStats);
  const counts = (segment, armId) => stats[`${segment}/${armId}`] || zero();
  const compositions = clone(currentCompositions);
  // The lint gate checks the file in full; this is only enough to refuse a shape the job cannot reason about.
  for (const [segment, composition] of Object.entries(compositions)) {
    const arms = composition?.arms;
    const sound = Array.isArray(arms) && (arms.length === 1 || arms.length === 2)
      && arms.every((arm) => typeof arm?.id === 'string' && Array.isArray(arm.blocks));
    if (!sound) throw new Error(`compositions "${segment}": expected one or two arms, each with an id and a list of blocks`);
  }
  const usedIds = new Set(Object.values(compositions).flatMap(({ arms }) => arms.map((arm) => arm.id)));
  const actions = [];
  let budget = options.maxChangesPerRun;
  const settled = new Set();
  const segmentState = (segment) => (state.segments[segment] ||= { tested: [], test: null });
  /** Every order a segment has ever shown is remembered, so no order is ever tried, or returned to, twice. */
  const remember = (record, blocks) => { if (!record.tested.includes(orderKey(blocks))) record.tested.push(orderKey(blocks)); };

  // Tests already running: count the week, then decide. These go first so starts can never crowd out a decision.
  for (const [segment, composition] of Object.entries(compositions)) {
    if (composition.arms.length !== 2) continue;
    settled.add(segment);
    const record = segmentState(segment);
    // The challenger is whichever arm the state says it is, wherever it sits in the file. If the state has no
    // usable record (lost or damaged), the second arm is taken as the challenger and its test starts counting now.
    if (!record.test || !composition.arms.some((arm) => arm.id === record.test.challenger)) {
      record.test = { challenger: composition.arms[1].id, startedOn: weekEnding, totals: {} };
    }
    const challenger = composition.arms.find((arm) => arm.id === record.test.challenger);
    const champion = composition.arms.find((arm) => arm !== challenger);
    remember(record, champion.blocks);
    remember(record, challenger.blocks);

    const totals = record.test.totals;
    totals[champion.id] = add(totals[champion.id] || zero(), counts(segment, champion.id));
    totals[challenger.id] = add(totals[challenger.id] || zero(), counts(segment, challenger.id));
    const a = totals[champion.id];
    const b = totals[challenger.id];
    const ageDays = daysBetween(record.test.startedOn, weekEnding);
    const enoughViews = a.views >= options.minArmViews && b.views >= options.minArmViews;
    const chance = enoughViews ? probabilityBeats(a, b) : null;
    const summary = `${champion.id} ${a.acts}/${a.views} acts, ${a.leads} leads; ${challenger.id} ${b.acts}/${b.views} acts, ${b.leads} leads; day ${ageDays}`;

    const ahead = enoughViews && chance >= options.promoteAt;
    const tooFewActs = ahead && b.acts < options.minActsToPromote;
    const noEnquiries = ahead && a.leads >= options.leadGuardMin && b.leads === 0;
    let verdict = 'hold';
    let reason = enoughViews ? `chance challenger is better ${(chance * 100).toFixed(0)}%` : `needs ${options.minArmViews} views per arm`;
    if (tooFewActs) reason += `; not promoted: needs ${options.minActsToPromote} actions of its own`;
    if (noEnquiries) reason += '; not promoted: the original has real enquiries and the challenger has none';

    // The same floor applies both ways: the original must have earned its lead with real actions before an order is dropped for good.
    const behind = enoughViews && chance <= options.retireAt && a.acts >= options.minActsToPromote;
    if (ahead && !tooFewActs && !noEnquiries) verdict = 'promote';
    else if (behind) verdict = 'retire';
    else if (ageDays >= options.maxTestDays) {
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
    record.test = null;
    remember(record, champion.blocks);
    const week = counts(segment, champion.id);
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
    while (usedIds.has(`v${state.nextArm}`)) state.nextArm += 1;
    const id = `v${state.nextArm}`;
    if (!ARM_ID.test(id)) throw new Error(`cannot name another arm: "${id}" is not a valid arm id`);
    state.nextArm += 1;
    usedIds.add(id);
    const challenger = { id, weight: options.challengerWeight, blocks: next };
    composition.arms = [{ ...champion, weight: 100 - options.challengerWeight }, challenger];
    remember(record, next);
    record.test = { challenger: id, startedOn: weekEnding, totals: {} };
    const moved = next.find((block, i) => block !== champion.blocks[i]);
    actions.push({
      segment,
      action: 'start',
      detail: `${week.views} views this week; trying "${moved}" one place higher as ${id}, ${100 - options.challengerWeight}/${options.challengerWeight}`,
    });
  }

  state.lastWeekEnding = weekEnding;
  state.log = [...state.log, { weekEnding, actions }].slice(-options.logSize);
  const changed = actions.some(({ action }) => action === 'start' || action === 'promote' || action === 'retire');
  return { compositions, state, actions, changed };
}

module.exports = { DEFAULTS, ARM_ID, candidates, probabilityBeats, decide, eventNames, emptyState, normalizeState, validateStats, isDate };
