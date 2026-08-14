// Regenerate scripts/estimator-snapshot.json from the current engine.
//
// Run this ONLY when you intentionally changed what a customer gets quoted,
// and commit the regenerated snapshot alongside the pricing change so the diff
// is reviewable. Running it to silence a red build defeats the entire point of
// the gate — the snapshot is the record of what Golden Maple promises people.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeEstimate } from '../src/utils/estimateEngine';
import { FIXTURES } from './estimator-fixtures';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out: Record<string, unknown> = {};
for (const [name, input] of FIXTURES) out[name] = computeEstimate(input);
writeFileSync(join(ROOT, 'scripts/estimator-snapshot.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Regenerated snapshot for ${FIXTURES.length} fixtures. Review the diff before committing.`);
