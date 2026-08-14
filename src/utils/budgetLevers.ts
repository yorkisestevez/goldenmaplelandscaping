/**
 * Honest ways to close the gap between what someone wants to spend and what
 * their build actually costs.
 *
 * THE RULES THAT MAKE THIS TRUSTWORTHY — do not relax them:
 *
 *  1. A lever may only change SCOPE or MATERIAL. Never the math.
 *  2. A lever may NEVER un-tick a site condition. Access, slope, drainage and
 *     levels are facts about the customer's yard, not preferences. "Untick
 *     drainage to save $3,400" would produce a number the site visit
 *     immediately contradicts, and a change order after the contract is
 *     signed — which is precisely the experience this company sells against.
 *  3. Every saving is measured by re-running the real engine on the patched
 *     build, so an applied lever always lands exactly where it promised.
 *  4. When the target simply isn't reachable, say so. Never contort the build
 *     to manufacture a number that fits.
 */

import type { EstimateInput } from './estimateEngine';
import { ADD_ONS, defaultPaverForTier, type PaverTier } from '../data/carrPrices';

/**
 * Prices a hypothetical build in the SAME space the customer sees — i.e. after
 * the confidence-widening the headline applies.
 *
 * This indirection is load-bearing. Reasoning about levers on the raw engine
 * total while the customer reads a widened one makes the two drift apart, and a
 * lever confidently labelled "gets you there on its own" lands over target.
 * (That bug shipped briefly during development; this signature is the fix.)
 */
export type RangeFor = (patch: Partial<EstimateInput>) => { low: number; high: number };

const midOf = (r: { low: number; high: number }) => (r.low + r.high) / 2;

/** Smallest scope we'd sensibly quote per element — mirrors the input controls. */
const SIZE_MIN: Record<string, number> = {
  patio: 100, stone: 100, turf: 100, deck: 100, wall: 10, steps: 2,
};

const SIZE_UNIT: Record<string, string> = {
  patio: 'sq ft', stone: 'sq ft', turf: 'sq ft', deck: 'sq ft',
  wall: 'ln ft', steps: 'steps',
};

const TIER_ORDER: PaverTier[] = ['budget', 'mid', 'premium'];
const TIER_LABEL: Record<PaverTier, string> = {
  budget: 'Standard', mid: 'Elevated', premium: 'Premium',
};

export interface GapLever {
  id: string;
  label: string;
  detail: string;
  patch: Partial<EstimateInput>;
  /** Positive dollars off the midpoint. */
  saving: number;
  /** True when taking this lever alone lands the build at or under target. */
  closesGap: boolean;
}

const elementsOf = (b: EstimateInput) =>
  b.projectType === 'full' ? b.selectedElements : (b.projectType ? [b.projectType] : []);

/**
 * The cheapest build we'd still be willing to quote: cheapest material, smallest
 * sensible scope, no optional add-ons. Site conditions stay exactly as the
 * customer reported them — see rule 2.
 */
export function minimumAchievable(build: EstimateInput, rangeFor: RangeFor): number {
  const sizes = { ...build.sizes };
  for (const el of elementsOf(build)) {
    if (typeof sizes[el] === 'number' && SIZE_MIN[el] !== undefined) sizes[el] = SIZE_MIN[el];
  }
  return midOf(rangeFor({
    sizes,
    addOns: [],
    tier: 'budget',
    paverBrandId: defaultPaverForTier('budget').id,
  }));
}

export function suggestGapLevers(
  build: EstimateInput,
  target: number,
  rangeFor: RangeFor,
  max = 3,
): GapLever[] {
  const baseMid = midOf(rangeFor({}));
  if (baseMid <= 0 || baseMid <= target) return [];

  const midFor = (patch: Partial<EstimateInput>) => midOf(rangeFor(patch));
  const savingOf = (patch: Partial<EstimateInput>) => baseMid - midFor(patch);

  const levers: GapLever[] = [];
  const add = (l: Omit<GapLever, 'closesGap'>) => {
    // Ignore rounding-noise levers — a "saving" under $500 isn't a real choice.
    if (l.saving < 500) return;
    // Measured, not inferred: re-price the patched build and check where it
    // actually lands, so "gets you there on its own" is always literally true.
    levers.push({ ...l, closesGap: midFor(l.patch) <= target });
  };

  // ---- 1. Step down a material tier ----
  const currentTierIdx = TIER_ORDER.indexOf(build.tier);
  for (let i = 0; i < currentTierIdx; i++) {
    const t = TIER_ORDER[i];
    // Tier drives the default brand, so patch both or the applied result
    // won't match the advertised saving.
    const patch = { tier: t, paverBrandId: defaultPaverForTier(t).id };
    add({
      id: `tier-${t}`,
      label: `Switch to ${TIER_LABEL[t]} pavers`,
      detail: `${TIER_LABEL[build.tier]} → ${TIER_LABEL[t]}. Same build, same base depth, same warranty.`,
      patch,
      saving: savingOf(patch),
    });
  }

  // ---- 2. Trim the largest measured element ----
  let biggest: { el: string; size: number } | null = null;
  for (const el of elementsOf(build)) {
    const v = build.sizes[el];
    if (typeof v === 'number' && SIZE_MIN[el] !== undefined) {
      if (!biggest || v > biggest.size) biggest = { el, size: v };
    }
  }
  if (biggest) {
    const { el, size } = biggest;
    const min = SIZE_MIN[el];
    const step = el === 'steps' ? 1 : el === 'wall' ? 5 : 10;
    const roundTo = (n: number) => Math.max(min, Math.round(n / step) * step);

    // Walk down until the build clears the target — the smallest cut that works,
    // not the biggest cut we could sell.
    let chosen: number | null = null;
    for (let pct = 0.95; pct >= 0.5; pct -= 0.05) {
      const cand = roundTo(size * pct);
      if (cand >= size) continue;
      if (midFor({ sizes: { ...build.sizes, [el]: cand } }) <= target) { chosen = cand; break; }
      chosen = cand; // keep the deepest cut we tried as a partial fallback
    }
    if (chosen !== null && chosen < size) {
      const patch = { sizes: { ...build.sizes, [el]: chosen } };
      const unit = SIZE_UNIT[el] ?? '';
      add({
        id: `size-${el}`,
        label: `Reduce to ${chosen} ${unit}`.trim(),
        detail: `${size} → ${chosen} ${unit}. Build the rest in a later phase if you want it.`.trim(),
        patch,
        saving: savingOf(patch),
      });
    }
  }

  // ---- 3. Drop an optional add-on ----
  for (const aid of build.addOns) {
    const a = ADD_ONS.find(x => x.id === aid);
    if (!a) continue;
    const patch = { addOns: build.addOns.filter(x => x !== aid) };
    add({
      id: `addon-${aid}`,
      label: `Drop ${a.label.toLowerCase()}`,
      detail: 'Easy to add later — it doesn\'t depend on the rest of the build.',
      patch,
      saving: savingOf(patch),
    });
  }

  // Prefer levers that actually close the gap; then biggest saving first.
  return levers
    .sort((a, b) => (Number(b.closesGap) - Number(a.closesGap)) || (b.saving - a.saving))
    .slice(0, max);
}
