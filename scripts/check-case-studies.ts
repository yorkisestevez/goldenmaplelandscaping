/**
 * Lint gate for project case studies (src/data/projects.ts `caseStudy`).
 *
 * A case study is first-hand proof, so every fact in it must be traceable:
 * - each Attested field has attestedBy, a past ISO attestedOn and a source
 * - numbers are positive and plausible (no placeholder zeros)
 * - budgetBracket is one of PROJECT_BUDGET_RANGES
 * - every phase photo is an ATTESTED register photo (scripts/portfolio-sources.mjs)
 *   for this same project, tagged with the same `stage`; stages are unique
 * - text fields pass the disputed-claim rules (scripts/claim-rules.json)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSTRUCTION_STAGES, PROJECTS, type Attested, type CaseStudy } from '../src/data/projects.ts';
import { PROJECT_BUDGET_RANGES } from '../src/data/projectBudgets.ts';
import { SOURCES } from './portfolio-sources.mjs';

type Source = { id: string; project: string; attestedOn: string | null; stage?: string };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = (JSON.parse(readFileSync(join(ROOT, 'scripts/claim-rules.json'), 'utf8')).rules as { id: string; pattern: string; tier?: string }[])
  .filter((r) => (r.tier ?? 'block') === 'block');
const today = new Date().toISOString().slice(0, 10);
const sources = new Map((SOURCES as Source[]).map((s) => [s.id, s]));
const budgetValues = new Set<string>(PROJECT_BUDGET_RANGES.map((r) => r.value));

const ATTESTED_FIELDS = ['areaSqFt', 'problem', 'excavationDepthIn', 'base', 'bedding', 'paverProduct', 'drainage', 'durationDays', 'budgetBracket'] as const satisfies readonly (keyof CaseStudy)[];
const NUMERIC_LIMITS: Partial<Record<(typeof ATTESTED_FIELDS)[number], [number, number]>> = {
  areaSqFt: [10, 50000],
  excavationDepthIn: [2, 60],
  durationDays: [1, 365],
};

function checkClaims(where: string, text: string) {
  for (const r of rules) assert.ok(!new RegExp(r.pattern, 'i').test(text), `${where}: text trips claim rule '${r.id}': ${text}`);
}

let studies = 0;
let facts = 0;
for (const project of PROJECTS) {
  const cs = project.caseStudy;
  if (!cs) continue;
  studies++;
  for (const field of ATTESTED_FIELDS) {
    const fact = cs[field] as Attested<unknown> | undefined;
    if (!fact) continue;
    facts++;
    const where = `${project.slug}.caseStudy.${field}`;
    assert.ok(fact.attestedBy?.trim(), `${where}: attestedBy is required`);
    assert.match(fact.attestedOn ?? '', /^\d{4}-\d{2}-\d{2}$/, `${where}: attestedOn must be YYYY-MM-DD`);
    assert.ok(fact.attestedOn <= today, `${where}: attestedOn ${fact.attestedOn} is in the future`);
    assert.ok(fact.source?.trim().length >= 6, `${where}: record the source (job sheet, invoice, voice memo…)`);
    const limits = NUMERIC_LIMITS[field];
    if (limits) {
      assert.equal(typeof fact.value, 'number', `${where}: must be a number`);
      const n = fact.value as number;
      assert.ok(n >= limits[0] && n <= limits[1], `${where}: ${n} is outside the plausible range ${limits[0]}–${limits[1]}`);
    }
    if (field === 'budgetBracket') assert.ok(budgetValues.has(fact.value as string), `${where}: unknown budget bracket '${String(fact.value)}'`);
    const text = typeof fact.value === 'string' ? fact.value : field === 'paverProduct' ? JSON.stringify(fact.value) : '';
    if (text) checkClaims(where, text);
  }

  const seenStages = new Set<string>();
  for (const photo of cs.phasePhotos ?? []) {
    const where = `${project.slug}.caseStudy.phasePhotos[${photo.id}]`;
    assert.ok((CONSTRUCTION_STAGES as readonly string[]).includes(photo.stage), `${where}: unknown stage '${photo.stage}'`);
    assert.ok(!seenStages.has(photo.stage), `${where}: stage '${photo.stage}' used twice`);
    seenStages.add(photo.stage);
    const src = sources.get(photo.id);
    assert.ok(src, `${where}: not in scripts/portfolio-sources.mjs`);
    assert.ok(src.attestedOn, `${where}: register photo is not attested`);
    assert.equal(src.project, project.slug, `${where}: register photo belongs to '${src.project}', not '${project.slug}'`);
    assert.equal(src.stage, photo.stage, `${where}: register stage is '${src.stage ?? '(none)'}', page says '${photo.stage}'`);
    assert.ok(photo.alt.trim().length > 10, `${where}: needs a descriptive alt`);
    checkClaims(where, photo.alt);
  }
}

console.log(`CASE STUDIES OK — ${studies} case ${studies === 1 ? 'study' : 'studies'}, ${facts} attested facts (awaiting owner intake: docs/seo-authority/case-study-intake.md).`);
