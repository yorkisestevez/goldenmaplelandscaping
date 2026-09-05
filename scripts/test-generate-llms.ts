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
assert.match(twice, /owner confirmation/i, 'generated brief must preserve publication guardrails');
console.log('llms generator idempotency: passed');
