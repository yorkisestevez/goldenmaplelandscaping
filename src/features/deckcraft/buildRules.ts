/**
 * Which takeoff rules price a design. The owner's rule is that a saved design reopens at the price it was saved at, so
 * the 2026-10 changes apply to new designs only:
 * - minimum-seam stock at the manufacturer's listed lengths;
 * - stair guards that end on the last tread;
 * - the bump-out breaker and stair-screen fixes.
 *
 * Absent or 'legacy' keeps the rules every design saved before 2026-10-06 was quoted under. DEFAULT_DECK carries
 * '2026-10', and parsing a save that has no value writes 'legacy' (designPersistence.ts), so the
 * `{...DEFAULT_DECK,...design}` spreads cannot upgrade an old save. Dependency-free on purpose: the pricing worker
 * imports it.
 */
export type BuildRules = 'legacy' | '2026-10';
export const BUILD_RULES: readonly BuildRules[] = ['legacy', '2026-10'];
export const CURRENT_BUILD_RULES: BuildRules = '2026-10';
/** True when the design is priced under the 2026-10 rules. Absent means legacy. */
export const usesCurrentBuildRules = (d: { buildRules?: BuildRules }): boolean => d.buildRules === '2026-10';
