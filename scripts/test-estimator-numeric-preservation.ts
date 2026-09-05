import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SNAPSHOT_PATH = resolve('scripts/estimator-snapshot.json');
const BASELINE_PATH = resolve(process.argv[2] ?? 'docs/business-facts-audit/estimator-snapshot.before-copy-only.json');
const PROOF_PATH = resolve('docs/business-facts-audit/engine-copy-only-proof.json');

type Difference = { path: string; before: unknown; after: unknown };

const before = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as unknown;
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Record<string, unknown>;

if (process.argv.includes('--apply-approved-copy')) {
  let replacements = 0;
  for (const fixture of Object.values(snapshot)) {
    const lines = (fixture as { lines?: { excavation?: { detail?: string }; labour?: { detail?: string } } }).lines;
    const excavationDetail = lines?.excavation?.detail;
    const excavation = excavationDetail && /^12–16" base depth on (\d+) sqft$/.exec(excavationDetail);
    if (excavation && lines?.excavation) {
      lines.excavation.detail = `Site-specific preparation allowance for ${excavation[1]} sqft`;
      replacements++;
    }
    const labourDetail = lines?.labour?.detail;
    const labour = labourDetail && /^(.*) days on-site, ICPI-certified crew$/.exec(labourDetail);
    if (labour && lines?.labour) {
      lines.labour.detail = `${labour[1]} estimated days on-site`;
      replacements++;
    }
  }
  assert.ok(replacements > 0, 'no approved snapshot detail strings found to replace');
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Applied ${replacements} approved snapshot detail-string replacements`);
}

const after = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as unknown;
const differences: Difference[] = [];

function compare(a: unknown, b: unknown, path = '$'): void {
  if (Object.is(a, b)) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    differences.push({ path, before: a, after: b });
    return;
  }
  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();
  assert.deepEqual(bKeys, aKeys, `${path}: keys changed`);
  for (const key of aKeys) compare((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`);
}

compare(before, after);

const excavationPattern = /^12–16" base depth on (\d+) sqft$/;
const labourPattern = /^(.*) days on-site, ICPI-certified crew$/;
let excavationChanges = 0;
let labourChanges = 0;
let numericDifferences = 0;
for (const difference of differences) {
  if (typeof difference.before === 'number' || typeof difference.after === 'number') numericDifferences++;
  const excavation = typeof difference.before === 'string' && excavationPattern.exec(difference.before);
  if (excavation) {
    assert.equal(difference.after, `Site-specific preparation allowance for ${excavation[1]} sqft`, `${difference.path}: unapproved excavation copy change`);
    excavationChanges++;
    continue;
  }
  const labour = typeof difference.before === 'string' && labourPattern.exec(difference.before);
  if (labour) {
    assert.equal(difference.after, `${labour[1]} estimated days on-site`, `${difference.path}: unapproved labour copy change`);
    labourChanges++;
    continue;
  }
  assert.fail(`${difference.path}: unapproved change ${JSON.stringify(difference)}`);
}

assert.ok(excavationChanges > 0, 'expected at least one excavation detail copy change');
assert.ok(labourChanges > 0, 'expected at least one labour detail copy change');
assert.equal(numericDifferences, 0, 'numeric snapshot values changed');

writeFileSync(PROOF_PATH, `${JSON.stringify({
  verification: 'deep baseline-versus-modified estimator snapshot comparison',
  baselinePath: BASELINE_PATH,
  snapshotPath: SNAPSHOT_PATH,
  fixtures: Object.keys(before as Record<string, unknown>).length,
  totalDifferences: differences.length,
  approvedExcavationDetailChanges: excavationChanges,
  approvedLabourDetailChanges: labourChanges,
  numericDifferences,
  keysChanged: 0,
  approvedPatterns: [
    '12–16\" base depth on <sqft> sqft -> Site-specific preparation allowance for <sqft> sqft',
    '<days> days on-site, ICPI-certified crew -> <days> estimated days on-site',
  ],
  status: 'pass',
}, null, 2)}\n`, 'utf8');

console.log(`NUMERIC PRESERVATION PASS — ${differences.length} approved detail changes (${excavationChanges} excavation, ${labourChanges} labour); 0 numeric or key changes`);
