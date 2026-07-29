import engineBaseline from '../data/engine-baseline.json';

// Deck rates bracket the engine's $3,700/crew-day card. Hardscape floors come
// straight from the LOCKED all-in rate card ($2,470/crew-day — wages, burden,
// equipment, overhead, and margin already inside; labor-rate.json 2026-06-04).
// FACTS derive from engine-baseline.json — scripts/check-pricing-parity.ts
// fails the build if these drift from the DeckCraft engine.
// 2026-07-27 — deck all-in rate moved $3,700 → $3,000 (Yorkis). The bottom/
// premium rails keep the original ±$300 spread around target; leaving them at
// 3400/4000 would put the band FLOOR above the target rate and emit incoherent
// quotes (line 43 feeds bottom/premium straight into the band).
export const DAILY_PRODUCTION_RATES = {
  bottom: 3400,
  target: engineBaseline.facts.crewDayRateDeck,
  premium: 4000,
} as const;

export const HARDSCAPE_DAILY_RATES = {
  bottom: engineBaseline.facts.crewDayRateHardscape,
  premium: Math.round(engineBaseline.facts.crewDayRateHardscape * 1.13),
} as const;

export const PROJECT_PLANNING_RANGES = {
  frontEntrance: { low: 18000, high: 40000, label: 'Small walkway/front entrance' },
  premiumPatio: { low: 35000, high: 75000, label: 'Premium patio / outdoor room' },
  patioWallDrainage: { low: 50000, high: 100000, label: 'Patio + wall/steps/drainage' },
  fullBackyard: { low: 90000, high: 150000, label: 'Full backyard transformation' },
} as const;

export function applyDailyProductionFloor({
  labourLow,
  labourHigh,
  daysLow,
  daysHigh,
  projectType,
}: {
  labourLow: number;
  labourHigh: number;
  daysLow: number;
  daysHigh: number;
  /** 'deck' floors at the deck day-rate band; everything else (hardscape) at
   *  the locked all-in hardscape card. Omitted = legacy deck-band behaviour. */
  projectType?: string | null;
}) {
  const rates = projectType && projectType !== 'deck'
    ? { bottom: HARDSCAPE_DAILY_RATES.bottom, premium: HARDSCAPE_DAILY_RATES.premium }
    : { bottom: DAILY_PRODUCTION_RATES.bottom, premium: DAILY_PRODUCTION_RATES.premium };
  return {
    labourLow: Math.max(labourLow, daysLow * rates.bottom),
    labourHigh: Math.max(labourHigh, daysHigh * rates.premium),
  };
}

// NOTE: there is deliberately no getEstimatorMinimumFloor() any more.
// The estimator used to clamp every result up to a per-project-type job
// minimum ($18K–$90K), which meant a small walkway that genuinely costed out
// at $9K was shown as $18K. Removed 2026-07-27 — every visitor now prices
// their real project, whatever the size, and the name+email gate on the
// itemized breakdown is what qualifies the lead instead of a price wall.
//
// The labour day-rate floor in applyDailyProductionFloor() above is NOT the
// same thing and stays: it's real cost math (a crew-day costs what it costs),
// not a marketing minimum. Removing that one would let the estimator quote
// jobs below Golden Maple's actual cost to show up.

export function getEstimatorRangeCopy(projectType: string | null, selectedElements: string[] = []) {
  if (projectType === 'full') return 'Full backyard transformations commonly plan at $90K–$150K+ when patio, walls, lighting, fire, kitchen, drainage, or grade work are included.';
  if (projectType === 'wall') return 'Retaining wall and sloped-yard projects commonly plan at $30K–$90K+, with patio + wall + drainage packages often landing $50K–$100K.';
  if (projectType === 'patio' || projectType === 'stone') return 'Premium patio and outdoor-room projects commonly plan at $35K–$75K depending on size, access, base prep, drainage, and material choice.';
  if (selectedElements.includes('wall') && selectedElements.includes('patio')) return 'Patio + wall/steps/drainage packages commonly plan at $50K–$100K because the structure and water management are the job.';
  return 'These are planning ranges, not final quotes. Exact pricing depends on access, excavation, drainage, base depth, material choice, and whether walls, steps, lighting, or fire features are included.';
}
