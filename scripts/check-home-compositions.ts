/**
 * Gate for src/data/homeCompositions.json, the data file that decides which
 * blocks the homepage shows and in what order. The weekly evolution job edits
 * that file on its own, so every rule it must not break is checked here.
 */
import compositions from '../src/data/homeCompositions.json';
import { BLOCK_IDS, DEFAULT_SEGMENT } from '../src/components/home/composition';

const known = new Set<string>(BLOCK_IDS);
/** Blocks other parts of the page depend on: the hero links to #selected-work, and Home always emits FAQ schema. */
const REQUIRED = ['selected-work', 'faq', 'final-cta'];
const errors: string[] = [];
const segments = compositions as Record<string, { blocks?: unknown }>;

if (!segments[DEFAULT_SEGMENT]) errors.push(`missing "${DEFAULT_SEGMENT}" segment`);

for (const [segment, composition] of Object.entries(segments)) {
  const blocks = composition.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    errors.push(`${segment}: "blocks" must be a non-empty array`);
    continue;
  }
  const seen = new Set<string>();
  for (const id of blocks) {
    if (typeof id !== 'string' || !known.has(id)) errors.push(`${segment}: unknown block "${String(id)}"`);
    if (seen.has(id)) errors.push(`${segment}: block "${id}" listed twice`);
    seen.add(id);
  }
  for (const id of REQUIRED) if (!seen.has(id)) errors.push(`${segment}: required block "${id}" is missing`);
  if (blocks[blocks.length - 1] !== 'final-cta') errors.push(`${segment}: last block must be "final-cta"`);
}

// Prices are human-only and live in the pricing files, never in this one.
if (JSON.stringify(compositions).includes('$')) errors.push('price-like "$" found; compositions hold block ids only');

if (errors.length) {
  console.error(`home compositions: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`home compositions: ${Object.keys(segments).length} segment(s) valid`);
