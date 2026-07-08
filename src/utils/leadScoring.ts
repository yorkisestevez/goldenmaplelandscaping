export type LeadScoreInput = {
  budget?: string;
  service?: string;
  projectType?: string;
  selectedElements?: string[];
  conditions?: string[];
  details?: string;
  city?: string;
  sqft?: number;
  totalLow?: number;
  totalHigh?: number;
  hasPhotos?: boolean;
};

const premiumLocations = ['barrie', 'innisfil', 'springwater', 'oro-medonte', 'midhurst', 'horseshoe', 'shanty bay'];
const moneyServices = ['outdoor', 'backyard', 'patio', 'interlock', 'retaining', 'wall', 'slope', 'drainage', 'hardscape'];
const lowFitWords = ['cheap', 'small repair', 'just pricing', 'lawn', 'maintenance', 'garden bed', 'sod only'];

function text(input: LeadScoreInput) {
  return [
    input.budget,
    input.service,
    input.projectType,
    input.selectedElements?.join(' '),
    input.conditions?.join(' '),
    input.details,
    input.city,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function scoreGoldenMapleLead(input: LeadScoreInput) {
  const haystack = text(input);
  let score = 0;
  const reasons: string[] = [];

  const budget = input.budget || '';
  const estimateHigh = input.totalHigh || 0;
  if (['50k-100k', '100k-250k', '250k+'].includes(budget) || estimateHigh >= 50000) {
    score += 25; reasons.push('budget_or_estimate_50k_plus');
  } else if (budget === '25k-50k' || estimateHigh >= 35000) {
    score += 15; reasons.push('budget_or_estimate_35k_plus');
  } else if (budget === 'under-25k' || (estimateHigh > 0 && estimateHigh < 25000)) {
    score -= 30; reasons.push('below_target_budget');
  }

  if (moneyServices.some(w => haystack.includes(w))) {
    score += 20; reasons.push('priority_hardscape_scope');
  }
  if (['access', 'slope', 'drainage', 'levels'].some(w => haystack.includes(w))) {
    score += 20; reasons.push('complexity_protects_margin');
  }
  if (premiumLocations.some(w => haystack.includes(w))) {
    score += 15; reasons.push('premium_service_area');
  }
  if ((input.sqft || 0) >= 500) {
    score += 10; reasons.push('500sqft_plus');
  }
  if (input.hasPhotos) {
    score += 10; reasons.push('photos_supplied');
  }
  if (lowFitWords.some(w => haystack.includes(w))) {
    score -= 25; reasons.push('low_fit_language');
  }

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 25 ? 'C' : 'D';
  return { score, tier, reasons };
}
