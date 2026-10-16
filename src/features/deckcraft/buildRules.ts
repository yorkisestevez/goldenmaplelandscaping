/**
 * Which takeoff rules price a design. The owner's rule is that a saved design reopens at the price it was saved at, so
 * the 2026-10 changes apply to new designs only:
 * - minimum-seam stock at the manufacturer's listed lengths;
 * - stair guards that end on the last tread;
 * - the bump-out breaker and stair-screen fixes.
 *
 * Absent or 'legacy' keeps the rules every design saved before 2026-10-06 was quoted under. '2026-10' keeps that
 * takeoff (picture frame, stair guards, stock lengths) without the later structural review. '2026-10-struct' is the
 * rules for a design saved from 2026-10-08: the same takeoff, plus guard, beam, footing, snow, stair, post and ledger
 * checks. '2026-10-piers' is the current rules for a new design: that review, with a pier the review sizes past the
 * price book's pier priced at its own size.
 * DEFAULT_DECK carries the current value, and parsing a save that has no value writes 'legacy' (designPersistence.ts),
 * so the `{...DEFAULT_DECK,...design}` spreads cannot upgrade an old save. Dependency-free on purpose: the pricing
 * worker imports it.
 */
export type BuildRules = 'legacy' | '2026-10' | '2026-10-struct' | '2026-10-piers';
export const BUILD_RULES: readonly BuildRules[] = ['legacy', '2026-10', '2026-10-struct', '2026-10-piers'];
export const CURRENT_BUILD_RULES: BuildRules = '2026-10-piers';
/** True when the design uses the 2026-10 takeoff (picture frame, stair guards, stock lengths). Absent means legacy. */
export const usesCurrentBuildRules = (d: { buildRules?: BuildRules }): boolean => !!d.buildRules && d.buildRules !== 'legacy';
/** True only for a new design under the structural review. Saved '2026-10' and legacy designs stay on their old framing. */
export const usesStructuralReview = (d: { buildRules?: BuildRules }): boolean => d.buildRules === '2026-10-struct' || d.buildRules === '2026-10-piers';
/** True only for a new design: a pier the structural review sizes past the price book's pier is priced at that size. */
export const usesSizedPiers = (d: { buildRules?: BuildRules }): boolean => d.buildRules === '2026-10-piers';
