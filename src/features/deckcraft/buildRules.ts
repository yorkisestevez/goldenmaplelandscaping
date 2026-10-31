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
 * checks. '2026-10-piers' is that review, with a pier the review sizes past the price book's pier priced at its own size.
 * '2026-10-walls' is the rules for a design saved from 2026-10-21: the same, with the ledger decided by the cladding
 * of the walls the deck fastens to (a wall's own finish, then its block's, then the house's), not the whole house's.
 * '2026-10-frame' is the current rules for a new design (2026-10-30): the same, with the fascia's own thickness over the
 * rim and a picture frame that overhangs it by the most its board allows unless the user sets the overhang.
 * DEFAULT_DECK carries the current value, and parsing a save that has no value writes 'legacy' (designPersistence.ts),
 * so the `{...DEFAULT_DECK,...design}` spreads cannot upgrade an old save. Dependency-free on purpose: the pricing
 * worker imports it.
 */
export type BuildRules = 'legacy' | '2026-10' | '2026-10-struct' | '2026-10-piers' | '2026-10-walls' | '2026-10-frame';
export const BUILD_RULES: readonly BuildRules[] = ['legacy', '2026-10', '2026-10-struct', '2026-10-piers', '2026-10-walls', '2026-10-frame'];
export const CURRENT_BUILD_RULES: BuildRules = '2026-10-frame';
/** True when the design uses the 2026-10 takeoff (picture frame, stair guards, stock lengths). Absent means legacy. */
export const usesCurrentBuildRules = (d: { buildRules?: BuildRules }): boolean => !!d.buildRules && d.buildRules !== 'legacy';
/** True for a design saved under `first` or any later rules: BUILD_RULES lists them oldest first. */
const rulesFrom = (first: BuildRules) => (d: { buildRules?: BuildRules }): boolean => !!d.buildRules && BUILD_RULES.indexOf(d.buildRules) >= BUILD_RULES.indexOf(first);
/** True only for a new design under the structural review. Saved '2026-10' and legacy designs stay on their old framing. */
export const usesStructuralReview = rulesFrom('2026-10-struct');
/** True only for a new design: a pier the structural review sizes past the price book's pier is priced at that size. */
export const usesSizedPiers = rulesFrom('2026-10-piers');
/** True only for a new design: the walls the deck fastens to, not the whole house, decide whether brick or stone blocks the ledger. */
export const usesWallLedgerRule = rulesFrom('2026-10-walls');
/** True only for a new design: the fascia over the rim has its own thickness, and a picture frame left at its default
 * overhangs that fascia by the most its board allows. Older saves keep the rim-face fascia and their saved overhang. */
export const usesFinishedFascia = rulesFrom('2026-10-frame');
