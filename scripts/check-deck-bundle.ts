import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

/**
 * Deck designer bundle budget, checked against the production build (runs in postbuild).
 * - The route's own initial JavaScript (beyond what every page already loads) stays within budget.
 * - The 3D viewer, the PDF engine and jsPDF's optional helpers, every section body (House, Deck shape & size, Boards &
 *   finish, Stairs & railings, the lighting/extras/site body, Backyard, Proposal & files), the send and proposal
 *   dialogs, the custom outline editor, the accent-board panel, the inlay editor, the exterior studio, the skirting
 *   editor, the deck-part finishes panel, the site plan's editor (its handles, typed figures and shape shortcuts), the
 *   option deltas (each option's price effect: the section bodies' hook, and the engine side it loads only once deltas
 *   are wanted) and the DXF/OBJ exports are never part of the route's initial load: they are fetched only when needed.
 * - The lazy chunks themselves do not quietly grow.
 * Budgets were set on 2026-09-23 at the measured size plus about 15% headroom. The route's was raised from 170 to
 * 185 KB the same day, with the owner's approval, for the Finishes track (accent boards, inlays, exterior finishes
 * and skirting), whose price and layout code runs with the page's first estimate. On 2026-09-24 (redesign R1) the
 * section bodies became lazy chunks, which freed room under the same budget.
 * The redesign (R1-R7, 2026-09-24) finished at 176.75 KB route JS (8.25 KB headroom) and 8.64 KB route CSS (3.36 KB
 * headroom), against 180.16 KB and 6.53 KB before it (R0): the sections, price schedule, drawing-set look, site plan
 * and option deltas all fit because every section body, the plan's editor and the deltas load on demand.
 * - The option deltas' worker (R6) carries its own copy of the price engine, so it prices options off the main thread;
 *   it loads only once deltas are wanted and stays within 140 KB gzip (122 KB when added, 2026-09-24).
 * - The route's own stylesheet (the drawing-set look, redesign R3) stays within 12 KB gzip. The fonts come from Google
 *   Fonts on this route only (owner's decision, 2026-09-24), so no font file is part of the build to measure.
 * - The luxury proposal (R8, 2026-09-24) loads only when asked for: the dialog and its sheets with a stylesheet of their
 *   own (none of it in the route's CSS), and the PDF builder and its pictures with jsPDF. The PDF budget covers jsPDF
 *   and the builder's chunks together (jsPDF 126 KB and the builder about 9.5 KB when R8 landed). R8 took the old
 *   proposal styles and the PDF builder out of the route: route JS 176.8 -> 174.8 KB, route CSS 8.7 -> 7.7 KB.
 * - The board atlases (Real Life G2, 2026-09-25) are built in a worker of their own, about 2.4 KB gzip, fetched with
 *   the 3D view.
 */
const BUDGET_KB={routeInitial:185,routeCss:12,viewer:340,pdf:150,deltaWorker:140,swatchWorker:5};
const assets=new URL('../build/client/assets/',import.meta.url);
assert(existsSync(assets),'No build found: run `npm run build` first.');
const files=readdirSync(assets);
const gz=(file:string)=>gzipSync(readFileSync(new URL(file,assets))).length/1024;
const manifestFile=files.find(f=>/^manifest-.*\.js$/.test(f));
assert(manifestFile,'The React Router manifest is missing from the build.');
const manifest=JSON.parse(readFileSync(new URL(manifestFile,assets),'utf8').replace(/^window\.__reactRouterManifest=/,'').replace(/;\s*$/,'')) as {entry:{module:string;imports:string[]};routes:Record<string,{module:string;imports?:string[];css?:string[]}>};
const route=Object.values(manifest.routes).find(r=>/\/DeckDesigner-[^/]+\.js$/.test(r.module));
assert(route,'The deck designer route is in the manifest.');
const shared=new Set([manifest.entry.module,...manifest.entry.imports,manifest.routes.root.module,...(manifest.routes.root.imports??[])]);
const initial=[route.module,...(route.imports??[])].filter(m=>!shared.has(m)).map(m=>m.replace(/^\/assets\//,''));
const routeKB=initial.reduce((n,f)=>n+gz(f),0);
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
ok(routeKB<=BUDGET_KB.routeInitial,`Deck designer initial JS is ${routeKB.toFixed(1)} KB gzip (budget ${BUDGET_KB.routeInitial} KB): ${initial.join(', ')}`);
// The route's own CSS, beyond the stylesheet every page loads.
const sharedCss=new Set(manifest.routes.root.css??[]);
const css=(route.css??[]).filter(f=>!sharedCss.has(f)).map(f=>f.replace(/^\/assets\//,''));
const cssKB=css.reduce((n,f)=>n+gz(f),0);
ok(css.length>0,'The deck designer route has a stylesheet of its own');
ok(cssKB<=BUDGET_KB.routeCss,`Deck designer route CSS is ${cssKB.toFixed(1)} KB gzip (budget ${BUDGET_KB.routeCss} KB): ${css.join(', ')}`);
for(const lazy of [/^Deck3DViewer-/,/^jspdf/,/^html2canvas/,/^purify/,/^ProposalDialog-/,/^proposalPdf-/,/^pdfAssets-/,/^proposalModel-/,/^DimensionsStep-/,/^MaterialsStep-/,/^StairsStep-/,/^SiteExtrasStep-/,/^EstimateStep-/,/^HouseSection-/,/^BackyardStep-/,/^SendDesignDialog-/,/^ProposalSheet-/,/^OutlineEditor-/,/^BoardColourPanel-/,/^InlayEditor-/,/^ExteriorStudio-/,/^SkirtingEditor-/,/^DeckFinishesPanel-/,/^PlanEditor-/,/^railingScreenColours-/,/^deckReleaseExports-/,/^designExports-/,/^optionDeltas-/,/^useOptionDeltas-/])ok(!initial.some(f=>lazy.test(f)),`${lazy.source} is loaded on demand, not with the page`);
// Each section body, and the site plan's editor, is a chunk of its own (one merged into the route would pass the test
// above unseen).
for(const body of ['HouseSection','DimensionsStep','MaterialsStep','StairsStep','SiteExtrasStep','BackyardStep','EstimateStep','PlanEditor','optionDeltas','useOptionDeltas','ProposalDialog','proposalPdf'])ok(files.some(f=>f.startsWith(`${body}-`)&&f.endsWith('.js')),`${body} is its own chunk`);
const viewer=files.find(f=>/^Deck3DViewer-.*\.js$/.test(f)),pdf=files.find(f=>/^jspdf.*\.js$/.test(f)),deltaWorker=files.find(f=>/^optionDeltas\.worker-.*\.js$/.test(f));
ok(viewer&&gz(viewer)<=BUDGET_KB.viewer,`3D viewer chunk is ${viewer?gz(viewer).toFixed(1):'?'} KB gzip (budget ${BUDGET_KB.viewer} KB)`);
// The PDF: jsPDF plus the proposal's builder, its pictures and the model it shares with the dialog, all loaded on demand.
const builder=files.filter(f=>/^(proposalPdf|pdfAssets|proposalModel)-.*\.js$/.test(f)),pdfKB=(pdf?gz(pdf):Infinity)+builder.reduce((n,f)=>n+gz(f),0);
ok(builder.some(f=>f.startsWith('proposalPdf-'))&&pdfKB<=BUDGET_KB.pdf,`PDF engine (jsPDF and the proposal builder) is ${pdfKB.toFixed(1)} KB gzip (budget ${BUDGET_KB.pdf} KB): ${[pdf,...builder].join(', ')}`);
// The proposal's styles come with its dialog, never in the route's stylesheet.
const proposalCss=files.find(f=>/^ProposalDialog-.*\.css$/.test(f));
ok(proposalCss&&readFileSync(new URL(proposalCss,assets),'utf8').includes('.dd-proposal-page')&&!css.some(f=>readFileSync(new URL(f,assets),'utf8').includes('.dd-proposal-page')),'The proposal stylesheet loads with its dialog, not with the page');
ok(deltaWorker&&!initial.includes(deltaWorker)&&gz(deltaWorker)<=BUDGET_KB.deltaWorker,`Option deltas' worker is ${deltaWorker?gz(deltaWorker).toFixed(1):'missing'} KB gzip (budget ${BUDGET_KB.deltaWorker} KB), loaded on demand`);
const swatchWorker=files.find(f=>/^swatchMaps\.worker-.*\.js$/.test(f));
ok(swatchWorker&&!initial.includes(swatchWorker)&&gz(swatchWorker)<=BUDGET_KB.swatchWorker,`Board atlas worker is ${swatchWorker?gz(swatchWorker).toFixed(1):'missing'} KB gzip (budget ${BUDGET_KB.swatchWorker} KB), loaded with the 3D view`);
const headroom=(kb:number,budget:number)=>`${kb.toFixed(1)}/${budget} KB (${(budget-kb).toFixed(1)} KB headroom)`;
console.log(`DECK BUNDLE OK — route JS ${headroom(routeKB,BUDGET_KB.routeInitial)}, route CSS ${headroom(cssKB,BUDGET_KB.routeCss)}, 3D viewer ${gz(viewer!).toFixed(1)}/${BUDGET_KB.viewer} KB, PDF ${pdfKB.toFixed(1)}/${BUDGET_KB.pdf} KB (jsPDF ${gz(pdf!).toFixed(1)}), delta worker ${gz(deltaWorker!).toFixed(1)}/${BUDGET_KB.deltaWorker} KB gzip, lazy chunks stay lazy; ${checks} checks.`);
