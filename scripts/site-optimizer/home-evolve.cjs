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
 *       changed. Only the owner raises or resets that number.
 *
 * <file> is JSON: { "<segment>/<armId>": { "views": n, "acts": n, "leads": n }, ... }
 * for the seven days ending on --week-ending. Arms left out count as zero.
 */
const fs = require('node:fs');
const path = require('node:path');
const { decide, eventNames, emptyState, DEFAULTS } = require('./home-evolve-core.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
// The two overrides exist for scripts/check-home-evolve.ts, which runs this file against a temporary copy.
const COMPOSITIONS = process.env.GM_EVOLVE_COMPOSITIONS || path.join(ROOT, 'src', 'data', 'homeCompositions.json');
const STATE = process.env.GM_EVOLVE_STATE || path.join(__dirname, 'home-evolve-state.json');
const HALT = path.join(path.dirname(STATE), 'HALT');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const compositions = readJson(COMPOSITIONS);
  if (process.argv.includes('--events')) {
    console.log(JSON.stringify(eventNames(compositions)));
    return;
  }

  const statsFile = argument('--stats');
  const weekEnding = argument('--week-ending');
  if (!statsFile || !weekEnding) throw new Error('usage: home-evolve.cjs --stats <file> --week-ending YYYY-MM-DD [--write]   (or --events)');
  const write = process.argv.includes('--write');
  if (write && fs.existsSync(HALT)) throw new Error('HALT file present: the kill switch is on, nothing written');

  const state = fs.existsSync(STATE) ? readJson(STATE) : emptyState();
  const result = decide(compositions, state, readJson(statsFile), weekEnding, DEFAULTS);
  const digest = result.actions.map(({ segment, action, detail }) => `${segment}: ${action} (${detail})`);

  let mode = 'preview';
  if (write && state.dryRunsRemaining > 0) {
    // A dry run records the plan and the week, and leaves both the site and any running counts alone.
    mode = 'dry-run';
    writeJson(STATE, {
      ...state,
      dryRunsRemaining: state.dryRunsRemaining - 1,
      lastWeekEnding: weekEnding,
      log: [...(state.log || []), { weekEnding, dryRun: true, actions: result.actions }].slice(-DEFAULTS.logSize),
    });
  } else if (write) {
    mode = 'applied';
    writeJson(STATE, result.state);
    if (result.changed) writeJson(COMPOSITIONS, result.compositions);
  }

  console.log(JSON.stringify({
    mode,
    weekEnding,
    changed: mode === 'applied' && result.changed,
    wouldChange: result.changed,
    dryRunsRemaining: mode === 'dry-run' ? state.dryRunsRemaining - 1 : state.dryRunsRemaining,
    digest,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`home-evolve: ${error.message}`);
  process.exit(1);
}
