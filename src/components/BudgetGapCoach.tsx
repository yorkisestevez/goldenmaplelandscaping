import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Target, ArrowRight, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { suggestGapLevers, minimumAchievable, type RangeFor } from '../utils/budgetLevers';
import type { EstimateInput } from '../utils/estimateEngine';

/**
 * The customer's number vs. their build — and honest ways to close the gap.
 *
 * This is the piece that turns the estimator from something that prices you
 * into something you steer. Every lever is a real scope or material change,
 * applied with one tap, landing exactly where it said it would.
 *
 * What it will never do: suggest un-ticking a site condition, or bend the math
 * to hit a number. When the target isn't reachable it says so plainly and
 * points at the two things that actually help — phasing the work, or talking
 * to a human. See src/utils/budgetLevers.ts for the enforced rules.
 */

const fmtFull = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtK = (n: number) => `$${(n / 1000).toFixed(0)}k`;

export default function BudgetGapCoach({
  build,
  target,
  displayLow,
  displayHigh,
  rangeFor,
  onApply,
}: {
  build: EstimateInput;
  target: number;
  displayLow: number;
  displayHigh: number;
  /** Prices hypothetical builds in the same widened space the headline shows —
   *  this is what keeps a lever's promise identical to its outcome. */
  rangeFor: RangeFor;
  /** Applies a lever to the live build. */
  onApply: (leverId: string, patch: Partial<EstimateInput>) => void;
}) {
  const mid = (displayLow + displayHigh) / 2;
  const gap = mid - target;

  // ---- Under budget: acknowledge it, don't upsell into it. ----
  if (gap <= 0) {
    return (
      <div className="px-6 py-5 rounded-2xl bg-brand-success/[0.08] border border-brand-success/30">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Check size={15} className="text-brand-success shrink-0" strokeWidth={2.5} />
          <span className="font-sans text-[13px] text-brand-bone">
            This lands inside your {fmtFull(target)} target.
          </span>
        </div>
        <p className="font-sans text-[12px] font-normal text-brand-bonewhite/75 leading-relaxed">
          Your range midpoint is about {fmtFull(mid)} — roughly {fmtFull(Math.abs(gap))} of room.
          Worth spending it on base depth and drainage before finishes if you're deciding.
        </p>
      </div>
    );
  }

  const levers = suggestGapLevers(build, target, rangeFor);
  const floor = minimumAchievable(build, rangeFor);
  // Even the cheapest material at the smallest sensible scope can't get there.
  const unreachable = floor > target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 130, damping: 20 }}
      className="px-6 py-5 rounded-2xl bg-brand-gold/[0.07] border border-brand-gold/25"
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <Target size={15} className="text-brand-gold-dark shrink-0" strokeWidth={1.75} />
        <span className="font-sans text-[13px] text-brand-bone">
          About {fmtFull(gap)} over your {fmtFull(target)} target.
        </span>
      </div>

      {unreachable ? (
        <>
          <p className="font-sans text-[12px] font-normal text-brand-bonewhite/75 leading-relaxed mb-4">
            Being straight with you: even at the smallest sensible scope in our most
            affordable material, this project lands around {fmtK(floor)}. We won't quote
            a shallower base to make a number work — that's the part that fails in three
            winters. Two things that do help:
          </p>
          <ul className="space-y-2 mb-1">
            <li className="font-sans text-[12px] font-normal text-brand-bonewhite/85 flex gap-2.5">
              <span className="text-brand-gold-dark mt-[7px] w-1 h-1 rounded-full bg-brand-gold shrink-0" />
              <span><span className="text-brand-bone">Phase it.</span> Build the core this season, add the rest next — each phase is a complete, finished space.</span>
            </li>
            <li className="font-sans text-[12px] font-normal text-brand-bonewhite/85 flex gap-2.5">
              <span className="text-brand-gold-dark mt-[7px] w-1 h-1 rounded-full bg-brand-gold shrink-0" />
              <span><span className="text-brand-bone">Narrow the scope.</span> A smaller project done properly beats a big one done thin.</span>
            </li>
          </ul>
        </>
      ) : (
        <>
          <p className="font-sans text-[12px] font-normal text-brand-bonewhite/75 leading-relaxed mb-4">
            {levers.length > 0
              ? 'Real ways to close it — one tap each, and the number above updates:'
              : 'Nothing obvious left to trim without changing what gets built. Worth a conversation.'}
          </p>

          <div className="space-y-2">
            {levers.map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => onApply(l.id, l.patch)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200 group',
                  'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                )}
              >
                <ArrowRight
                  size={14}
                  className="text-brand-gold-dark shrink-0 mt-[3px] transition-transform duration-200 group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-sans text-[12.5px] text-brand-bone">{l.label}</span>
                    <span className="font-display text-[14px] text-brand-success tabular-nums whitespace-nowrap">
                      −{fmtFull(l.saving)}
                    </span>
                  </span>
                  <span className="block font-sans text-[11px] font-normal text-brand-bonewhite/65 mt-1 leading-relaxed">
                    {l.detail}
                    {l.closesGap ? (
                      <span className="text-brand-success/90"> · gets you there on its own</span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="font-sans text-[11px] font-normal text-brand-bonewhite/65 mt-4 leading-relaxed">
        Or keep the build as it is — plenty of projects get phased across two seasons.{' '}
        <Link to="/book" className="text-brand-gold-dark hover:underline">Talk it through with Yorkis</Link>.
      </p>
    </motion.div>
  );
}
