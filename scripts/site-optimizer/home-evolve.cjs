#!/usr/bin/env node
/**
 * Weekly homepage evolution: the only thing allowed to change
 * src/data/homeCompositions.json without the owner. Run by the site optimizer
 * in `optimize` mode (see ROUTINE.md, "Step 3b").
 *
 *   node scripts/site-optimizer/home-evolve.cjs --events
 *       Print the analytics event names to count for the current arms.
 *
 *   node scripts/site-optimizer/home-evolve.cjs --stats <file> --week-ending YYYY-MM-DD
 *       Preview: print what it would do. Writes nothing.
 *
 *   ... --write
 *       Apply: write the compositions and this job's state. While
 *       `dryRunsRemaining` in home-evolve-state.json is above zero, --write
 *       only counts the dry run down and records the plan; the site is not
 *       changed. A missing or unreadable counter means dry runs are still
 *       owed. Only the owner sets that number. Dry runs are for the weeks
 *       before the first test: a dry run does not add to a running test's
 *       counts.
 *
 * <file> is JSON: { "<segment>/<armId>": { "views": n, "acts": n, "leads": n }, ... }
 * for the seven days ending on --week-ending. An arm left out counts as zero;
 * an arm that is listed must give all three numbers.
 *
 * The file locations are fixed on purpose: there is no flag or environment
 * variable that points this at other files.
 */
const fs = require('node:fs');
const path = require('node:path');
const { decide, eventNames, normalizeState, DEFAULTS } = require('./home-evolve-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const PATHS = Object.freeze({
  compositions: path.join(ROOT, 'src', 'data', 'homeCompositions.json'),
  state: path.join(__dirname, 'home-evolve-state.json'),
  halt: path.join(__dirname, 'HALT'),
});

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/** A state file that is missing or will not parse is read as "nothing known", which normalizeState turns into dry runs owed. */
function readState(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

/**
 * One run of the job. `paths` and `today` are parameters so the checks in
 * scripts/check-home-evolve.ts can run it against a temporary copy.
 */
function run({ paths = PATHS, statsPath, weekEnding, write = false, today = new Date().toISOString().slice(0, 10) }) {
  if (write && fs.existsSync(paths.halt)) throw new Error('HALT file present: the kill switch is on, nothing written');
  if (typeof weekEnding === 'string' && weekEnding > today) throw new Error(`week ending ${weekEnding} is in the future (today is ${today})`);

  const compositions = readJson(paths.compositions);
  const state = normalizeState(readState(paths.state));
  const result = decide(compositions, state, readJson(statsPath), weekEnding, DEFAULTS);
  const digest = result.actions.map(({ segment, action, detail }) => `${segment}: ${action} (${detail})`);

  let mode = 'preview';
  let dryRunsRemaining = state.dryRunsRemaining;
  if (write && state.dryRunsRemaining > 0) {
    mode = 'dry-run';
    dryRunsRemaining -= 1;
    writeJson(paths.state, {
      ...state,
      dryRunsRemaining,
      lastWeekEnding: weekEnding,
      log: [...state.log, { weekEnding, dryRun: true, actions: result.actions }].slice(-DEFAULTS.logSize),
    });
  } else if (write) {
    mode = 'applied';
    // Compositions first: if the second write fails, the next run finds a test with no record and starts counting it then.
    if (result.changed) writeJson(paths.compositions, result.compositions);
    writeJson(paths.state, result.state);
  }

  return { mode, weekEnding, changed: mode === 'applied' && result.changed, wouldChange: result.changed, dryRunsRemaining, digest };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

function main() {
  if (process.argv.includes('--events')) {
    console.log(JSON.stringify(eventNames(readJson(PATHS.compositions))));
    return;
  }
  const statsPath = argument('--stats');
  const weekEnding = argument('--week-ending');
  if (!statsPath || !weekEnding) throw new Error('usage: home-evolve.cjs --stats <file> --week-ending YYYY-MM-DD [--write]   (or --events)');
  console.log(JSON.stringify(run({ statsPath, weekEnding, write: process.argv.includes('--write') }), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`home-evolve: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { run };
