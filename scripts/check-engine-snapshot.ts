// Estimator engine snapshot gate — runs in `npm run lint`, so before every deploy.
//
// WHY THIS EXISTS
// The estimator quotes real money to real customers. Its arithmetic lives in
// src/utils/estimateEngine.ts and is touched every time someone adds a UI
// affordance on top of it (live price deltas, the budget gap coach, the
// workbench). This gate pins the engine's output for every pricing branch so
// a refactor cannot silently reprice a $40K job.
//
// WHEN THIS FAILS you have exactly two honest options:
//   1. You did NOT mean to change pricing → the diff below is a bug. Fix the code.
//   2. You DID mean to change pricing → regenerate in the same commit:
//        npx tsx scripts/regen-engine-snapshot.ts
//      and say so in the commit message. Never regenerate to make CI go green.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeEstimate } from '../src/utils/estimateEngine';
import { FIXTURES } from './estimator-fixtures';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATH = join(ROOT, 'scripts/estimator-snapshot.json');

const snapshot: Record<string, unknown> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`); };

console.log(`Estimator engine snapshot — ${FIXTURES.length} fixtures`);

const seen = new Set<string>();
for (const [name, input] of FIXTURES) {
  seen.add(name);
  const expected = snapshot[name];
  if (expected === undefined) {
    fail(`${name}: no snapshot entry — new fixture, regenerate the snapshot`);
    continue;
  }
  const actual = computeEstimate(input);
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    fail(`${name}: engine output changed`);
    // Surface the money lines first — that's what a human needs to judge.
    const ex = expected as { totalLow: number; totalHigh: number };
    if (ex.totalLow !== actual.totalLow || ex.totalHigh !== actual.totalHigh) {
      console.log(`        was  $${ex.totalLow.toLocaleString()} – $${ex.totalHigh.toLocaleString()}`);
      console.log(`        now  $${actual.totalLow.toLocaleString()} – $${actual.totalHigh.toLocaleString()}`);
    } else {
      console.log(`        totals unchanged; a breakdown line or day count moved`);
      console.log(`        was  ${b}`);
      console.log(`        now  ${a}`);
    }
  }
}

for (const name of Object.keys(snapshot)) {
  if (!seen.has(name)) fail(`${name}: in the snapshot but no longer a fixture — regenerate`);
}

console.log(failures === 0
  ? `ENGINE SNAPSHOT OK — pricing unchanged across all ${FIXTURES.length} branches`
  : `${failures} ENGINE SNAPSHOT FAILURE(S) — pricing moved; confirm it was intentional`);
process.exit(failures === 0 ? 0 : 1);
