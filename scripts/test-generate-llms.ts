import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public/llms.txt');
const run = () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-llms.ts'], { cwd: root, stdio: 'pipe' });

await run();
const once = await readFile(output, 'utf8');
await run();
const twice = await readFile(output, 'utf8');
assert.equal(twice, once, 'llms generator must be byte-idempotent on the second run');
assert.match(twice, /Structured Content Map/, 'existing content-map resources must be retained');
assert.match(twice, /Interlocking stone|interlocking patios/i, 'brief must say what the company builds');
assert.doesNotMatch(twice, /Ask us for current coverage|Ask for the current written|not validated|disputed claims|Founded:\s*2020/i, 'brief must not publish hedges or the unverified founding year');
console.log('llms generator idempotency: passed');
