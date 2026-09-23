import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

/**
 * Deck designer bundle budget, checked against the production build (runs in postbuild).
 * - The route's own initial JavaScript (beyond what every page already loads) stays within budget.
 * - The 3D viewer, the PDF engine and jsPDF's optional helpers, the Backyard step and the send and
 *   proposal dialogs are never part of the route's initial load: they are fetched only when needed.
 * - The lazy chunks themselves do not quietly grow.
 * Budgets were set on 2026-09-23 at the measured size plus about 15% headroom.
 */
const BUDGET_KB={routeInitial:170,viewer:340,pdf:150};
const assets=new URL('../build/client/assets/',import.meta.url);
assert(existsSync(assets),'No build found: run `npm run build` first.');
const files=readdirSync(assets);
const gz=(file:string)=>gzipSync(readFileSync(new URL(file,assets))).length/1024;
const manifestFile=files.find(f=>/^manifest-.*\.js$/.test(f));
assert(manifestFile,'The React Router manifest is missing from the build.');
const manifest=JSON.parse(readFileSync(new URL(manifestFile,assets),'utf8').replace(/^window\.__reactRouterManifest=/,'').replace(/;\s*$/,'')) as {entry:{module:string;imports:string[]};routes:Record<string,{module:string;imports?:string[]}>};
const route=Object.values(manifest.routes).find(r=>/\/DeckDesigner-[^/]+\.js$/.test(r.module));
assert(route,'The deck designer route is in the manifest.');
const shared=new Set([manifest.entry.module,...manifest.entry.imports,manifest.routes.root.module,...(manifest.routes.root.imports??[])]);
const initial=[route.module,...(route.imports??[])].filter(m=>!shared.has(m)).map(m=>m.replace(/^\/assets\//,''));
const routeKB=initial.reduce((n,f)=>n+gz(f),0);
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
ok(routeKB<=BUDGET_KB.routeInitial,`Deck designer initial JS is ${routeKB.toFixed(1)} KB gzip (budget ${BUDGET_KB.routeInitial} KB): ${initial.join(', ')}`);
for(const lazy of [/^Deck3DViewer-/,/^jspdf/,/^html2canvas/,/^purify/,/^BackyardStep-/,/^SendDesignDialog-/,/^ProposalSheet-/])ok(!initial.some(f=>lazy.test(f)),`${lazy.source} is loaded on demand, not with the page`);
const viewer=files.find(f=>/^Deck3DViewer-.*\.js$/.test(f)),pdf=files.find(f=>/^jspdf.*\.js$/.test(f));
ok(viewer&&gz(viewer)<=BUDGET_KB.viewer,`3D viewer chunk is ${viewer?gz(viewer).toFixed(1):'?'} KB gzip (budget ${BUDGET_KB.viewer} KB)`);
ok(pdf&&gz(pdf)<=BUDGET_KB.pdf,`PDF engine chunk is ${pdf?gz(pdf).toFixed(1):'?'} KB gzip (budget ${BUDGET_KB.pdf} KB)`);
console.log(`DECK BUNDLE OK — route ${routeKB.toFixed(1)}/${BUDGET_KB.routeInitial} KB, 3D viewer ${gz(viewer!).toFixed(1)}/${BUDGET_KB.viewer} KB, PDF ${gz(pdf!).toFixed(1)}/${BUDGET_KB.pdf} KB gzip, lazy chunks stay lazy; ${checks} checks.`);
