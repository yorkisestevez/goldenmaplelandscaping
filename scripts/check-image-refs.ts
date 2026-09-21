/**
 * Lint gate: every literal `/images/portfolio/...` or `/images/instagram/...` path
 * referenced from src/ or netlify/ must exist under public/. Scoped to the two
 * register-backed directories on purpose — the legacy /images/projects drawer is
 * not policed here.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCAN = ['src', 'netlify'];
const RE = /\/images\/(?:portfolio|instagram)\/[^'"`\s)]+/g;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?|mjs|cjs|json|css|html)$/.test(name)) yield p;
  }
}

const missing = new Map<string, string[]>();
let refs = 0;
for (const base of SCAN) {
  const dir = join(ROOT, base);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(RE)) {
      refs++;
      const rel = m[0].split('?')[0];
      if (!existsSync(join(ROOT, 'public', rel))) {
        const list = missing.get(rel) ?? [];
        list.push(file.replace(ROOT, '').replace(/\\/g, '/'));
        missing.set(rel, list);
      }
    }
  }
}

if (missing.size) {
  console.error(`image ref check: ${missing.size} missing file(s)`);
  for (const [rel, files] of missing) console.error(`  - ${rel}  ← ${[...new Set(files)].join(', ')}`);
  process.exit(1);
}
console.log(`image ref check: ok (${refs} refs to /images/portfolio|instagram, all present)`);
