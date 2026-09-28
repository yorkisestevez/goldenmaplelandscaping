/**
 * Postbuild: export every BUSINESS fact's publishability to build/fact-status.json.
 *
 * scripts/check-build-business-facts.py reads this so a claim rule carrying
 * `allowWhenConfirmed` (scripts/claim-rules.json) is skipped only while that
 * exact register fact passes canPublish(). Nothing here changes a status —
 * confirming a credential still means editing src/data/business.ts with a
 * lastVerified date and a source.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS, canPublish, type BusinessFact } from '../src/data/business.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build', 'fact-status.json');

type FactStatusEntry = { status: string; publishable: boolean; lastVerified: string | null };

function isFact(node: unknown): node is BusinessFact<unknown> {
  return typeof node === 'object' && node !== null && 'status' in node && 'source' in node && 'value' in node;
}

function walk(node: unknown, path: string[], out: Record<string, FactStatusEntry>) {
  if (isFact(node)) {
    out[path.join('.')] = { status: node.status, publishable: canPublish(node), lastVerified: node.lastVerified };
    return;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return;
  for (const [key, child] of Object.entries(node)) walk(child, [...path, key], out);
}

const facts: Record<string, FactStatusEntry> = {};
walk(BUSINESS, [], facts);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), facts }, null, 2));
const publishable = Object.values(facts).filter(f => f.publishable).length;
console.log(`fact-status: ${Object.keys(facts).length} facts exported (${publishable} publishable) -> build/fact-status.json`);
