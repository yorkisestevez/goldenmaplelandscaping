/**
 * Which takeoff rules price a design. The owner's rule is that a saved design reopens at the price it was saved at, so
 * the 2026-10 changes apply to new designs only:
 * - minimum-seam stock at the manufacturer's listed lengths;
 * - stair guards that end on the last tread;
 * - the bump-out breaker and stair-screen fixes.
 *
 * Absent or 'legacy' keeps the rules every design saved before 2026-10-06 was quoted under. '2026-10' keeps that
 * takeoff (picture frame, stair guards, stock lengths) without the later structural review. '2026-10-struct' is the
 * current rules for a new design: the same takeoff, plus guard, beam, footing, snow, stair, post and ledger checks.
 * DEFAULT_DECK carries the current value, and parsing a save that has no value writes 'legacy' (designPersistence.ts),
 * so the `{...DEFAULT_DECK,...design}` spreads cannot upgrade an old save. Dependency-free on purpose: the pricing
 * worker imports it.
 */
export type BuildRules = 'legacy' | '2026-10' | '2026-10-struct';
export const BUILD_RULES: readonly BuildRules[] = ['legacy', '2026-10', '2026-10-struct'];
export const CURRENT_BUILD_RULES: BuildRules = '2026-10-struct';
/** True when the design uses the 2026-10 takeoff (picture frame, stair guards, stock lengths). Absent means legacy. */
export const usesCurrentBuildRules = (d: { buildRules?: BuildRules }): boolean => d.buildRules === '2026-10' || d.buildRules === '2026-10-struct';
/** True only for a new design under the structural review. Saved '2026-10' and legacy designs stay on their old framing. */
export const usesStructuralReview = (d: { buildRules?: BuildRules }): boolean => d.buildRules === '2026-10-struct';
