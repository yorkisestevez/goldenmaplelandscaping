/** The owner's company rates for earthwork on ground-fit banks round patios, in CAD per cubic yard before HST
 * (the same footing as the shared restoration rate). Null until the owner supplies them: a null rate keeps that
 * bank earthwork inside the existing hauling review and grading-fill rows as a builder quote, never a $0 line.
 * - cutHaulPerYd3: digging the bank down and hauling the soil away.
 * - fillCompactionPerYd3: importing fill, placing and compacting it in the bank. */
export const GROUND_FIT_RATES={cutHaulPerYd3:null as number|null,fillCompactionPerYd3:null as number|null};
