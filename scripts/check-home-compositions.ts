/**
 * Gate for src/data/homeCompositions.json, the data file that decides which
 * blocks the homepage shows, in what order, and how traffic is split between
 * the versions ("arms") under test. The weekly evolution job edits that file
 * on its own, so every rule it must not break is checked here.
 */
import compositions from '../src/data/homeCompositions.json';
import { BLOCK_IDS, DEFAULT_SEGMENT, MAX_ARMS, armsFor, pickArm, type HomeArm } from '../src/components/home/composition';
import { HOME_SERVICES } from '../src/components/home/intent';

const known = new Set<string>(BLOCK_IDS);
/** Blocks other parts of the page depend on: the hero links to #selected-work, and Home always emits FAQ schema. */
const REQUIRED = ['selected-work', 'faq', 'final-cta'];
/** Arm ids become part of an analytics event name, so they stay short and plain. */
const ARM_ID = /^[a-z][a-z0-9]{0,7}$/;
const SEGMENTS: string[] = [DEFAULT_SEGMENT, ...HOME_SERVICES];
const errors: string[] = [];
const file = compositions as Record<string, { arms?: unknown }>;

for (const segment of SEGMENTS) if (!file[segment]) errors.push(`missing "${segment}" segment`);
for (const segment of Object.keys(file)) if (!SEGMENTS.includes(segment)) errors.push(`unknown segment "${segment}"`);

/** The block directly under the hero. It is prerendered, so it must be the same for everyone or the page would jump after loading. */
const firstBlock = (file[DEFAULT_SEGMENT]?.arms as HomeArm[] | undefined)?.[0]?.blocks?.[0];

for (const [segment, composition] of Object.entries(file)) {
  const arms = composition.arms;
  if (!Array.isArray(arms) || arms.length < 1 || arms.length > MAX_ARMS) {
    errors.push(`${segment}: needs between 1 and ${MAX_ARMS} arms`);
    continue;
  }
  const ids = new Set<string>();
  let weight = 0;
  for (const arm of arms as Partial<HomeArm>[]) {
    const label = `${segment}/${String(arm?.id)}`;
    if (typeof arm?.id !== 'string' || !ARM_ID.test(arm.id)) errors.push(`${label}: arm id must match ${ARM_ID}`);
    else if (ids.has(arm.id)) errors.push(`${label}: arm id used twice`);
    else ids.add(arm.id);
    if (!Number.isInteger(arm?.weight) || (arm.weight as number) <= 0) errors.push(`${label}: weight must be a positive whole number`);
    else weight += arm.weight as number;

    const blocks = arm?.blocks;
    if (!Array.isArray(blocks) || blocks.length === 0) {
      errors.push(`${label}: "blocks" must be a non-empty array`);
      continue;
    }
    const seen = new Set<string>();
    for (const id of blocks) {
      if (typeof id !== 'string' || !known.has(id)) errors.push(`${label}: unknown block "${String(id)}"`);
      if (seen.has(id)) errors.push(`${label}: block "${id}" listed twice`);
      seen.add(id);
    }
    for (const id of REQUIRED) if (!seen.has(id)) errors.push(`${label}: required block "${id}" is missing`);
    if (blocks[0] !== firstBlock) errors.push(`${label}: first block must be "${String(firstBlock)}", the same as the prerendered page`);
    if (blocks[blocks.length - 1] !== 'final-cta') errors.push(`${label}: last block must be "final-cta"`);
  }
  if (weight !== 100) errors.push(`${segment}: arm weights must add up to 100 (got ${weight})`);
}

// Prices are human-only and live in the pricing files, never in this one.
if (JSON.stringify(compositions).includes('$')) errors.push('price-like "$" found; compositions hold block ids only');

// Splitting traffic between arms.
const check = (condition: boolean, name: string) => { if (!condition) errors.push(`pickArm: ${name}`); };
const arm = (id: string, weight: number): HomeArm => ({ id, weight, blocks: [] });
const split = [arm('a', 80), arm('b', 20)];
check(pickArm(split, 0).id === 'a' && pickArm(split, 0.79).id === 'a', 'the first 80% of rolls get the 80-weight arm');
check(pickArm(split, 0.8).id === 'b' && pickArm(split, 0.999).id === 'b', 'the last 20% of rolls get the 20-weight arm');
check(pickArm([arm('a', 100)], 0.5).id === 'a', 'a single arm always wins');
check(pickArm(split, 1).id === 'b' && pickArm(split, -1).id === 'a', 'an out-of-range roll still returns an arm');
check(armsFor('nonsense') === armsFor(DEFAULT_SEGMENT), 'an unknown segment falls back to the default arms');

if (errors.length) {
  console.error(`home compositions: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`home compositions: ${Object.keys(file).length} segments valid, arm splitting checked`);
