// Budget gap-coach honesty gate — runs in `npm run lint`.
//
// WHY THIS EXISTS
// The coach tells a customer "switch to Standard pavers, −$4,100, gets you
// there on its own". If applying that lever doesn't actually land the build at
// or under their target, the estimator lied to someone about money. That bug
// existed for real during development: the levers reasoned on the RAW engine
// total while the headline showed the confidence-WIDENED one, so the two
// drifted and a lever confidently overshot.
//
// These are behavioural invariants, not snapshots — they must hold for every
// build and every target, so there is nothing to regenerate. A failure here
// means the coach is misleading customers. Fix the code.

import { computeEstimate, widenTotals } from '../src/utils/estimateEngine';
import { suggestGapLevers, minimumAchievable, type RangeFor } from '../src/utils/budgetLevers';
import { FIXTURES } from './estimator-fixtures';

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`); };

// Mirrors what the component does at the result step. Confidence 20 is a
// realistic mid-funnel value; 8 is the fully-answered floor.
const CONFIDENCES = [30, 20, 8];
const midOf = (r: { low: number; high: number }) => (r.low + r.high) / 2;

let checked = 0;
console.log('Budget gap-coach invariants');

for (const [name, build] of FIXTURES) {
  for (const confidence of CONFIDENCES) {
    const rangeFor: RangeFor = patch =>
      widenTotals(computeEstimate({ ...build, ...patch }), confidence);

    const baseMid = midOf(rangeFor({}));
    if (baseMid <= 0) continue;

    // Probe targets spanning "just under" to "wildly unrealistic".
    for (const frac of [0.9, 0.75, 0.5, 0.25]) {
      const target = Math.round(baseMid * frac);
      const levers = suggestGapLevers(build, target, rangeFor);
      checked++;

      for (const l of levers) {
        const landed = midOf(rangeFor(l.patch));

        // 1. A lever must actually save money.
        if (landed >= baseMid) {
          fail(`${name} @±${confidence}% target ${target}: lever "${l.label}" claims −$${Math.round(l.saving)} but lands at ${Math.round(landed)} vs base ${Math.round(baseMid)}`);
        }

        // 2. The advertised saving must match the real one.
        const realSaving = baseMid - landed;
        if (Math.abs(realSaving - l.saving) > 1) {
          fail(`${name} @±${confidence}% target ${target}: lever "${l.label}" advertises −$${Math.round(l.saving)} but really saves $${Math.round(realSaving)}`);
        }

        // 3. THE BIG ONE — "gets you there on its own" must be literally true.
        if (l.closesGap && landed > target) {
          fail(`${name} @±${confidence}% target ${target}: lever "${l.label}" claims to close the gap but lands at ${Math.round(landed)}`);
        }

        // 4. A lever may NEVER touch site conditions. Access, slope, drainage
        //    and levels are facts about the customer's yard — suggesting they
        //    be switched off to save money manufactures a number the site
        //    visit contradicts. This is the rule that protects trust.
        if ('conditions' in l.patch) {
          fail(`${name}: lever "${l.label}" patches site conditions — never allowed`);
        }
        // 5. Nor may it silently relocate the project to dodge a zone surcharge.
        if ('location' in l.patch) {
          fail(`${name}: lever "${l.label}" patches location — never allowed`);
        }
      }
    }

    // 6. The stated floor must be genuinely reachable, not aspirational.
    const floor = minimumAchievable(build, rangeFor);
    if (floor > baseMid + 1) {
      fail(`${name} @±${confidence}%: minimumAchievable ${Math.round(floor)} exceeds the current build ${Math.round(baseMid)}`);
    }
  }
}

console.log(failures === 0
  ? `BUDGET LEVERS OK — ${checked} target scenarios, every promise kept`
  : `${failures} BUDGET LEVER FAILURE(S) — the coach is misleading customers`);
process.exit(failures === 0 ? 0 : 1);
