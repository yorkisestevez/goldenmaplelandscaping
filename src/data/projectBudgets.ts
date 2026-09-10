// Owner-directed enquiry positioning. This is not an estimator price floor.
export const PROJECT_BUDGET_TARGET = 13000;
export const PROJECT_BUDGET_RANGES = [
  { value: 'under-13k', label: 'Under $13,000' },
  { value: '13k-25k', label: '$13,000 – $25,000' },
  { value: '25k-50k', label: '$25,000 – $50,000' },
  { value: '50k-100k', label: '$50,000 – $100,000' },
  { value: '100k-250k', label: '$100,000 – $250,000' },
  { value: '250k+', label: '$250,000+' },
] as const;
