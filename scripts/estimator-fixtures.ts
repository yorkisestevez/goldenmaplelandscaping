// Fixture builds for the estimator engine snapshot gate.
// One per pricing branch, plus the multipliers that stack. Used by
// scripts/check-engine-snapshot.ts to prove the engine's arithmetic never
// moves by accident.
//
// Adding a fixture is free. CHANGING one means you are changing what a real
// customer would be quoted — regenerate the snapshot deliberately, never to
// "make the build pass".

import type { EstimateInput } from '../src/utils/estimateEngine';

const base: EstimateInput = {
  projectType: 'patio',
  selectedElements: [],
  sizes: {
    patio: 500, stone: 500, wall: 50, wallHeight: '2-4ft', steps: 5,
    deck: 300, kitchen: 'Basic', firepit: 'Medium', pergola: 'Medium',
    turf: 500, lighting: 'Medium',
  },
  details: {},
  conditions: { access: false, slope: false, drainage: false, levels: false },
  location: 'barrie',
  tier: 'mid',
  paverBrandId: 'permacon-mondrian-plus',
  deckBrandId: 'timbertech-prime',
  addOns: [],
};

const f = (name: string, patch: Partial<EstimateInput>): [string, EstimateInput] =>
  [name, { ...base, ...patch }];

export const FIXTURES: [string, EstimateInput][] = [
  // --- empty / guard ---
  f('empty-no-type', { projectType: null }),

  // --- patio across tiers ---
  f('patio-500-mid-barrie', {}),
  f('patio-500-budget', { tier: 'budget', paverBrandId: 'permacon-melville' }),
  f('patio-500-premium', { tier: 'premium', paverBrandId: 'permacon-brooklyn' }),
  f('patio-100-min-size', { sizes: { ...base.sizes, patio: 100 } }),
  f('patio-2000-max-size', { sizes: { ...base.sizes, patio: 2000 } }),

  // --- patio detail-question branches ---
  f('patio-surface-concrete', { details: { 'patio.surface': 'concrete' } }),
  f('patio-surface-pavers', { details: { 'patio.surface': 'pavers' } }),
  f('patio-surface-deck', { details: { 'patio.surface': 'deck' } }),
  f('patio-shape-curves', { details: { 'patio.shape': 'curves' } }),
  f('patio-shape-complex', { details: { 'patio.shape': 'complex' } }),
  f('patio-use-hottub', { details: { 'patio.use': 'hottub' } }),
  f('patio-use-multi', { details: { 'patio.use': 'multi' } }),
  f('patio-all-details', {
    details: { 'patio.surface': 'concrete', 'patio.shape': 'complex', 'patio.use': 'hottub' },
  }),

  // --- site conditions, individually and stacked ---
  f('patio-cond-access', { conditions: { ...base.conditions, access: true } }),
  f('patio-cond-slope', { conditions: { ...base.conditions, slope: true } }),
  f('patio-cond-drainage', { conditions: { ...base.conditions, drainage: true } }),
  f('patio-cond-levels', { conditions: { ...base.conditions, levels: true } }),
  f('patio-cond-all', { conditions: { access: true, slope: true, drainage: true, levels: true } }),

  // --- zone surcharge ---
  f('patio-zone2-orillia', { location: 'orillia' }),
  f('patio-zone3-midland', { location: 'midland' }),
  f('patio-zone4-collingwood', { location: 'collingwood' }),

  // --- add-ons ---
  f('patio-addon-lighting', { addOns: ['lighting'] }),
  f('patio-addons-all', { addOns: ['lighting', 'drainage', 'firepit', 'seatingwall', 'sealing'] }),

  // --- other project types ---
  f('stone-400', { projectType: 'stone', sizes: { ...base.sizes, stone: 400 } }),
  f('turf-600', { projectType: 'turf', sizes: { ...base.sizes, turf: 600 } }),

  f('wall-50-2to4-garden', { projectType: 'wall' }),
  f('wall-50-under2', { projectType: 'wall', sizes: { ...base.sizes, wallHeight: 'Under 2ft' } }),
  f('wall-50-4to6-slope', {
    projectType: 'wall',
    sizes: { ...base.sizes, wallHeight: '4-6ft' },
    details: { 'wall.wallPurpose': 'slope' },
  }),
  f('wall-80-over6-structure-premium', {
    projectType: 'wall', tier: 'premium',
    sizes: { ...base.sizes, wall: 80, wallHeight: 'Over 6ft' },
    details: { 'wall.wallPurpose': 'structure' },
  }),

  f('steps-5-mid', { projectType: 'steps' }),
  f('steps-12-premium-concrete', {
    projectType: 'steps', tier: 'premium',
    sizes: { ...base.sizes, steps: 12 },
    details: { 'steps.surface': 'concrete' },
  }),

  f('deck-300-prime-ground', { projectType: 'deck', details: { 'deck.deckHeight': 'ground' } }),
  f('deck-300-mid-height', { projectType: 'deck', details: { 'deck.deckHeight': 'mid' } }),
  f('deck-500-vintage-walkout', {
    projectType: 'deck', tier: 'premium', deckBrandId: 'timbertech-vintage',
    sizes: { ...base.sizes, deck: 500 },
    details: { 'deck.deckHeight': 'walkout' },
  }),

  f('kitchen-basic-mid', { projectType: 'kitchen' }),
  f('kitchen-full-premium', {
    projectType: 'kitchen', tier: 'premium',
    sizes: { ...base.sizes, kitchen: 'Full Build' },
  }),

  f('firepit-wood-mid', { projectType: 'firepit', details: { 'firepit.fuel': 'wood' } }),
  f('firepit-gas-premium', { projectType: 'firepit', tier: 'premium', details: { 'firepit.fuel': 'gas' } }),

  f('pergola-budget', { projectType: 'pergola', tier: 'budget' }),
  f('lighting-mid', { projectType: 'lighting' }),

  // --- full backyard (multi-element) ---
  f('full-patio-wall-lighting', {
    projectType: 'full',
    selectedElements: ['patio', 'wall', 'lighting'],
  }),
  f('full-everything-loaded', {
    projectType: 'full',
    selectedElements: ['patio', 'wall', 'deck', 'steps', 'kitchen', 'firepit', 'lighting'],
    sizes: { ...base.sizes, patio: 900, wall: 70, wallHeight: '4-6ft', deck: 400, kitchen: 'Full Build' },
    details: {
      'patio.surface': 'concrete', 'patio.shape': 'complex', 'patio.use': 'multi',
      'wall.wallPurpose': 'structure', 'deck.deckHeight': 'walkout', 'firepit.fuel': 'gas',
    },
    conditions: { access: true, slope: true, drainage: true, levels: true },
    location: 'collingwood',
    tier: 'premium',
    paverBrandId: 'permacon-brooklyn',
    deckBrandId: 'timbertech-vintage',
    addOns: ['lighting', 'drainage', 'seatingwall'],
  }),
];
