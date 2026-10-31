import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

/**
 * Desktop app build budget, checked against dist/deckcraft (runs after npm run build:deckcraft).
 * - The installer carries the whole build, so the build stays within a total size: app code (assets/) plus the
 *   supplier library and photos copied from public/deckcraft.
 * - The page's first JavaScript and stylesheet stay within budget, since the window opens once they have run.
 * - Only the files the designer needs reach the build: no site photos, sitemaps or prerendered pages.
 * Budgets were set on 2026-10-31 at the measured size plus about 10% headroom: 123.6 MB total (18.1 MB app code,
 * 105.4 MB supplier library), first JS 351.5 KB and first CSS 27.4 KB gzip. Raising one needs the owner's approval.
 */
const BUDGET={totalMB:136,assetsMB:20,entryJsKB:390,entryCssKB:31};
const TOP_LEVEL=new Set(['index.html','assets','deckcraft','deckcraft-icon.svg','deckcraft-icon-32.png','deckcraft-icon-256.png','favicon.ico','favicon-16.png','favicon-32.png','logo-mark.png','logo-mark.webp']);

const ROOT='dist/deckcraft';
assert.ok(existsSync(join(ROOT,'index.html')),`${ROOT}/index.html is missing: run npm run build:deckcraft first.`);
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const mb=(dir:string)=>files(dir).reduce((sum,f)=>sum+statSync(f).size,0)/2**20;
const gzKB=(rel:string)=>gzipSync(readFileSync(join(ROOT,rel))).length/1024;

const stray=readdirSync(ROOT).filter(name=>!TOP_LEVEL.has(name));
assert.deepEqual(stray,[],`Unexpected files in the desktop build: ${stray.join(', ')}`);
const missing=['deckcraft/hardscape-catalogue.json','logo-mark.png','deckcraft-icon.svg'].filter(rel=>!existsSync(join(ROOT,rel)));
assert.deepEqual(missing,[],`The desktop build is missing files the designer loads: ${missing.join(', ')}`);
const html=readFileSync(join(ROOT,'index.html'),'utf8');
const entryJs=html.match(/<script[^>]+src="\/(assets\/[^"]+\.js)"/)?.[1];
const entryCss=html.match(/<link[^>]+href="\/(assets\/[^"]+\.css)"/)?.[1];
assert.ok(entryJs&&entryCss,'The page does not load one script and one stylesheet from assets/.');

const measured={totalMB:mb(ROOT),assetsMB:mb(join(ROOT,'assets')),entryJsKB:gzKB(entryJs),entryCssKB:gzKB(entryCss)};
for(const key of Object.keys(BUDGET) as (keyof typeof BUDGET)[])
  assert.ok(measured[key]<=BUDGET[key],`Desktop build ${key} ${measured[key].toFixed(1)} is over its budget of ${BUDGET[key]}.`);

console.log(`DECKCRAFT DESKTOP BUILD OK — total ${measured.totalMB.toFixed(1)}/${BUDGET.totalMB} MB (app code ${measured.assetsMB.toFixed(1)}/${BUDGET.assetsMB} MB), first JS ${measured.entryJsKB.toFixed(1)}/${BUDGET.entryJsKB} KB, first CSS ${measured.entryCssKB.toFixed(1)}/${BUDGET.entryCssKB} KB gzip.`);
