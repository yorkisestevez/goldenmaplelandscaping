export const DAILY_PRODUCTION_RATES = {
  bottom: 3400,
  target: 3700,
  premium: 4000,
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
}: {
  labourLow: number;
  labourHigh: number;
  daysLow: number;
  daysHigh: number;
}) {
  return {
    labourLow: Math.max(labourLow, daysLow * DAILY_PRODUCTION_RATES.bottom),
    labourHigh: Math.max(labourHigh, daysHigh * DAILY_PRODUCTION_RATES.premium),
  };
}

export function getEstimatorMinimumFloor(projectType: string | null, selectedElements: string[] = []) {
  if (projectType === 'full') return PROJECT_PLANNING_RANGES.fullBackyard.low;
  if (projectType === 'wall') return 30000;
  if (projectType === 'patio' || projectType === 'stone') return PROJECT_PLANNING_RANGES.premiumPatio.low;
  if (projectType === 'steps') return PROJECT_PLANNING_RANGES.frontEntrance.low;
  if (projectType === 'deck') return 25000;
  if (selectedElements.includes('wall') && selectedElements.includes('patio')) return PROJECT_PLANNING_RANGES.patioWallDrainage.low;
  return 18000;
}

export function getEstimatorRangeCopy(projectType: string | null, selectedElements: string[] = []) {
  if (projectType === 'full') return 'Full backyard transformations commonly plan at $90K–$150K+ when patio, walls, lighting, fire, kitchen, drainage, or grade work are included.';
  if (projectType === 'wall') return 'Retaining wall and sloped-yard projects commonly plan at $30K–$90K+, with patio + wall + drainage packages often landing $50K–$100K.';
  if (projectType === 'patio' || projectType === 'stone') return 'Premium patio and outdoor-room projects commonly plan at $35K–$75K depending on size, access, base prep, drainage, and material choice.';
  if (selectedElements.includes('wall') && selectedElements.includes('patio')) return 'Patio + wall/steps/drainage packages commonly plan at $50K–$100K because the structure and water management are the job.';
  return 'These are planning ranges, not final quotes. Exact pricing depends on access, excavation, drainage, base depth, material choice, and whether walls, steps, lighting, or fire features are included.';
}
