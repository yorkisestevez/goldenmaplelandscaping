// S5 "Design from my ground" (src/features/deckcraft/designer/SiteDesignerPanel.tsx): a server-render smoke test.
// Real concepts from the S3 engine on e2e/fixtures/craighurst-extended.json (the real Craighurst shots plus SYNTHETIC
// SYN-* shots, labelled in the fixture's note) rendered as cards: price effects in the option-delta words (never "$0"
// beside a quote), quoted work counted by what it is for (a terrace concept's 46 quote lines are a few items, every
// exact line still listed), scores as plain words, no trend words while the trend table is a draft, the Barrie rule on a
// fire concept, Preview and Apply named for the concept. Every status of a real AI designer turn (the browser client's
// runDesignerTurn with a stand-in for the cloud call: no network) mapped to what the panel shows. The panel's first
// paint with and without a survey, the AI designer's unavailable lines, and that the panel and the engine stay lazy.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {register} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DESIGN_TRENDS_STATUS} from '../src/features/deckcraft/designTrends';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
async function load(name:string):Promise<DeckData>{const doc=JSON.parse(readFileSync(new URL(`../e2e/fixtures/${name}`,import.meta.url),'utf8'));await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));}
// The panel imports its stylesheet; Node has no CSS loader.
register('data:text/javascript,'+encodeURIComponent('export async function load(url,context,next){if(url.endsWith(".css"))return {format:"module",source:"",shortCircuit:true};return next(url,context);}'));
const P=await import('../src/features/deckcraft/designer/SiteDesignerPanel');
const {siteConcepts,quoteKindCount}=await import('../src/features/deckcraft/siteConcepts');
const {runDesignerTurn,DesignerAiError}=await import('../src/features/deckcraft/designer/siteDesignerAiClient');
const text=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&#x27;|&#39;/g,'\'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const PRICE=/^(?:[+−]\$[\d,]+(?: plus \d+ items? by quote)?|no change|\d+ items? by quote)(?: · \d+ fewer to quote)?$/;

// 1. Price words: the option-delta words, never "$0" beside a quote; the baseline plus the effect is the card's subtotal.
{
 const e=P.conceptPriceEffect;
 assert.deepEqual(e({subtotal:2240.4,delta:1240.4,quotes:[],newQuotes:[]},{subtotal:1000,quotes:[]}),{kind:'up',text:'+$1,240'});checks++;
 assert.deepEqual(e({subtotal:620,delta:-380,quotes:[],newQuotes:[]}),{kind:'down',text:'−$380'});checks++;
 assert.deepEqual(e({subtotal:1000,delta:0,quotes:[],newQuotes:[]},{subtotal:1000,quotes:[]}),{kind:'none',text:'no change'});checks++;
 assert.deepEqual(e({subtotal:1000.2,delta:.2,quotes:['Gas line'],newQuotes:['Gas line']},{subtotal:1000,quotes:[]}),{kind:'quote',text:'1 item by quote'});checks++;
 assert.deepEqual(e({subtotal:5100,delta:4100,quotes:['Gas line','Wall engineering'],newQuotes:['Gas line','Wall engineering']},{subtotal:1000,quotes:[]}),{kind:'quote',text:'+$4,100 plus 2 items by quote'});checks++;
 // Per-wall lines are one item: two walls of 3 lines and a bed of 2 are "plus 2 items by quote", not 8 lines.
 const walls=['Terrace wall 1: Geogrid installation','Terrace wall 1: Drainage stone and placement','Terrace wall 1: Cap adhesive and installation','Terrace wall 2: Geogrid installation','Terrace wall 2: Drainage stone and placement','Terrace wall 2: Cap adhesive and installation','Raised bed 1 — area preparation','Raised bed 1 — mulch supply and placement'];
 assert.deepEqual(e({subtotal:5100,delta:4100,quotes:walls,newQuotes:walls},{subtotal:1000,quotes:[]}),{kind:'quote',text:'+$4,100 plus 2 items by quote'});checks++;
 assert.deepEqual(e({subtotal:900,delta:-100,quotes:[],newQuotes:[]},{subtotal:1000,quotes:['Old wall 1: Geogrid','Old wall 2: Geogrid']}),{kind:'down',text:'−$100 · 1 fewer to quote'});checks++;
 assert.deepEqual(e({subtotal:900,delta:-100,quotes:[],newQuotes:[]},{subtotal:1000,quotes:['Old bank earthwork']}),{kind:'down',text:'−$100 · 1 fewer to quote'});checks++;
 ok(e({subtotal:1000.4,delta:.4,quotes:['x'],newQuotes:['x']}).text.indexOf('$0')<0,'A rounding-zero change beside a quote never reads "$0"');
}
// 1b. Quote items: grouped by the feature named before ": " or " — ", numbers off; plural only for several features.
{
 const k=P.quoteKinds(['Terrace wall 1: Geogrid stock supply','Terrace wall 2: Geogrid stock supply','Terrace wall 2: Wall survey/design services','Seat wall: Cap adhesive and installation','Seat wall: second finished face and two-sided cap (builder quote)','Natural shrub — supply and installation','Natural shrub: botanical specification and planting spacing confirmation','Proposed grading fill and compaction','Paver packaging, colour and freight adjustments (supplier quote)','Terrace bed 1 — area preparation','Terrace bed 2 — area preparation','Raised patio wall: drain outlet route and length confirmation']);
 assert.deepEqual(k.map(x=>x.kind),['Terrace walls','Seat wall','Natural shrub','Proposed grading fill and compaction','Paver packaging, colour and freight adjustments (supplier quote)','Terrace beds','Raised patio wall']);checks++;
 ok(k[0].labels.length===3&&k[2].labels.length===2&&k.reduce((n,x)=>n+x.labels.length,0)===12,'Every exact line stays with its item');
 ok(P.quoteKinds([]).length===0&&P.quoteKinds(['A','A']).length===1&&P.quoteKinds(['A'])[0].labels.length===1,'No lines, no items; a repeated line once');
 ok(quoteKindCount(k.flatMap(x=>x.labels))===k.length,'The engine counts quote items the way the card shows them');
}
// 2. The AI designer's unavailable lines: one plain line each, the engine's concepts named as still working.
{
 const lines=['not_configured','cap_reached','rate_limited','unavailable',undefined].map(r=>P.aiUnavailableLine(r));
 ok(new Set(lines.slice(0,4)).size===4,'Each unavailable reason has its own line');
 ok(/switched on/.test(lines[0])&&/resting until next month/.test(lines[1])&&/today’s AI designer turns/.test(lines[2])&&/isn’t available/.test(lines[3])&&lines[4]===lines[3],'Not configured, resting until next month, daily limit, unavailable');
 ok(lines.every(l=>/concepts/.test(l)&&!/coming soon/i.test(l)),'Every line keeps the engine concepts in view; no "coming soon"');
}
// 3. Real concepts rendered as cards.
const ext=await load('craighurst-extended.json'),before=JSON.stringify(ext);
const result=await siteConcepts(ext);
ok(result.status==='ready'&&result.concepts.length>=2&&result.concepts.length<=3,`2–3 concepts on the extended fixture (${result.concepts.length})`);
const baseline=result.baseline!;let lowest=0,easiest=0;
for(const c of result.concepts){
 const html=renderToStaticMarkup(createElement(P.SiteConceptCard,{concept:c,all:result.concepts,baseline,canPreview:true,onPreview:()=>{},onApply:()=>{}})),t=text(html);
 const price=text(/<span class="dd-sd-price"[^>]*>([^<]*)<\/span>/.exec(html)?.[1]??'');
 ok(PRICE.test(price)&&!/(?:^|[+−])\$0\b/.test(price),`${c.title}: price effect in the delta words (${price})`);
 ok(price===P.conceptPriceEffect(c,baseline).text,`${c.title}: the card shows the computed effect`);
 ok(t.includes('Price effect before HST:')&&/priced subtotal \$[\d,]+/.test(t),`${c.title}: price line with its own subtotal`);
 const strengths=text(/<p class="dd-sd-strengths">(.*?)<\/p>/.exec(html)?.[1]??'');
 ok(strengths.length>0&&!/\d/.test(strengths),`${c.title}: scores as words, not numbers (${strengths})`);
 if(/lowest cost/i.test(strengths))lowest++;if(/easiest to build/i.test(strengths))easiest++;
 if((DESIGN_TRENDS_STATUS as string)!=='approved')ok(!/trend/i.test(t),`${c.title}: nothing about trends while the trend table is a draft`);
 ok(!/Measured: /.test(t),`${c.title}: the measured summary is in the brief above, not repeated on the card`);
 ok(html.includes(`aria-label="Apply: ${c.title.replace(/&/g,'&amp;')}"`)&&html.includes(`aria-label="Preview in 3D: ${c.title.replace(/&/g,'&amp;')}"`),`${c.title}: Apply and Preview are named for the concept`);
 ok(c.moves.every(m=>t.includes(m.title)),`${c.title}: every move is listed`);
 ok(c.skipped.every(s=>t.includes(s.reason)),`${c.title}: every left-out move says why`);
 if(c.moves.some(m=>m.kind==='fire-room'))ok(/<p class="dd-sd-fire">[^<]*Barrie/.test(html),`${c.title}: the Barrie fire rule shows on a fire concept`);
 else ok(!html.includes('dd-sd-fire'),`${c.title}: no fire note without a fire`);
 ok(!/\$0\b/.test(t.replace(/\$0\.\d/g,'')),`${c.title}: no "$0" anywhere on the card`);
 // Quoted work by item: the summary counts items, the list names them, the exact lines are all still there.
 const items=P.quoteKinds(c.newQuotes);
 if(c.newQuotes.length){
  ok(t.includes(`${items.length} item${items.length===1?'':'s'} still to quote`)&&items.every(i=>t.includes(i.kind))&&c.newQuotes.every(q=>t.includes(q)),`${c.title}: ${items.length} items still to quote, every one of its ${c.newQuotes.length} quote lines listed`);
  const reason=c.reasons.at(-1)!;ok(new RegExp(`\\b${items.length} items? (?:is|are) still to be quoted`).test(reason)&&quoteKindCount(c.newQuotes)===items.length,`${c.title}: the engine's own words count the same ${items.length} items (${reason})`);
 }else ok(t.includes('Adds nothing by quote'),`${c.title}: says it adds nothing by quote`);
}
// The terraces: many walls' lines are a few items.
{
 const garden=result.concepts.find(c=>c.goal==='garden'),items=garden?P.quoteKinds(garden.newQuotes):[];
 ok(garden&&garden.newQuotes.length>20&&items.length<=6&&items.some(i=>/walls$/.test(i.kind)),`Garden terraces: ${garden?.newQuotes.length} quote lines read as ${items.length} items (${items.map(i=>`${i.kind} ${i.labels.length}`).join(', ')})`);
 ok(garden&&new RegExp(`plus ${items.length} items by quote(?: · |$)`).test(P.conceptPriceEffect(garden,baseline).text),`Garden terraces: the price says "${garden&&P.conceptPriceEffect(garden,baseline).text}"`);
}
ok(lowest<=1&&easiest<=1,'"Lowest cost" and "easiest to build" mark one card each at most');
ok(!P.measureGuidance(result).length,'With the ground measured round it, nothing asks for more measuring');
// The real survey alone: moves that need more ground are left out, and the panel says how far to measure.
{
 const real=await siteConcepts(await load('craighurst-ground-fit.json')),guide=P.measureGuidance(real);
 ok(real.status==='ready'&&guide.length>0&&guide.every(g=>/Measure about \d+ ft further/.test(g))&&new Set(guide).size===guide.length,`Real survey: "measure about N ft further" guidance, once each (${guide.length})`);
}
// The AI designer's pick: highlighted, with its explanation, highlights and questions.
{
 const c=result.concepts[0],html=renderToStaticMarkup(createElement(P.SiteConceptCard,{concept:c,all:[c],pick:{kind:'ai',explanation:'Because the yard falls 9 in away from the house.',highlights:['Flattest ground'],questions:['Gas or wood?']}})),t=text(html);
 ok(html.includes('data-pick="ai"')&&t.includes('AI designer’s pick')&&t.includes('falls 9 in')&&t.includes('Flattest ground')&&t.includes('Gas or wood?'),'The AI pick card shows its label, explanation, highlights and questions');
 ok(!html.includes('Preview in 3D'),'No Preview button without a 3D view to show it in');
}
// 3b. Every status of a real AI designer turn (runDesignerTurn with a stand-in for the cloud: no network) as the panel shows it.
{
 const room=result.concepts.find(c=>c.goal==='entertaining')!,meta={model:'claude-opus-5-5',remainingTurnsToday:9};
 const designed=await runDesignerTurn(ext,'A fire for evenings with friends',{ask:async()=>({kind:'choice',choice:{base:room.id,include:room.moves.map(m=>m.kind),params:{}},explanation:'The fire room sits on the flattest ground.',highlights:['Gas, no burn permit'],questions:[],meta})});
 const o1=P.designerTurnOutcome(designed);
 ok(designed.status==='designed'&&o1.show==='pick'&&o1.remaining===9&&!o1.off&&designed.concepts.length===result.concepts.length,`Designed: the pick card, 9 turns left from the answer, the engine's concepts alongside (${designed.status}: ${designed.findings.join(' | ')})`);
 const pickHtml=renderToStaticMarkup(createElement(P.SiteConceptCard,{concept:designed.concept!,all:[designed.concept!],baseline:designed.baseline,pick:{kind:'ai',explanation:designed.explanation,highlights:designed.highlights,questions:designed.questions,revised:designed.revised}})),pt=text(pickHtml);
 ok(pickHtml.includes('data-pick="ai"')&&pt.includes('AI designer’s pick')&&pt.includes('flattest ground')&&PRICE.test(text(/<span class="dd-sd-price"[^>]*>([^<]*)<\/span>/.exec(pickHtml)?.[1]??'')),'Designed: the pick card shows its label, the AI’s words and the engine’s price effect');
 const wrong={kind:'choice' as const,choice:{base:'slope',include:['seat-wall' as const],params:{}},explanation:'A seat wall alone.',highlights:[],questions:[],meta};
 const fallback=await runDesignerTurn(ext,'Just a seat wall',{ask:async()=>wrong}),o2=P.designerTurnOutcome(fallback);
 ok(fallback.status==='fallback'&&o2.show==='fallback'&&!!o2.line&&fallback.concept?.id==='slope'&&fallback.findings.length>0,`Fallback: the engine’s own concept with a plain note (${o2.line})`);
 const fbHtml=renderToStaticMarkup(createElement(P.SiteConceptCard,{concept:fallback.concept!,all:[fallback.concept!],pick:{kind:'fallback',note:o2.line,findings:fallback.findings}})),ft=text(fbHtml);
 ok(fbHtml.includes('data-pick="fallback"')&&ft.includes('The engine’s concept')&&!ft.includes('AI designer’s pick')&&ft.includes(o2.line!)&&/What the engine found \(\d+\)/.test(ft),'Fallback: labelled the engine’s concept, never the AI’s pick, with the note and what the engine found');
 const clarify=await runDesignerTurn(ext,'Something nice',{ask:async()=>({kind:'clarify',explanation:'Two directions fit your yard.',highlights:[],questions:['A fire room or garden beds?'],meta:{model:'x',remainingTurnsToday:4}})}),o3=P.designerTurnOutcome(clarify);
 ok(clarify.status==='clarify'&&o3.show==='clarify'&&o3.remaining===4&&!clarify.concept,'Clarify: the questions, 4 turns left');
 const ct=text(renderToStaticMarkup(createElement(P.DesignerQuestions,{answer:clarify})));
 ok(ct.includes('Two directions fit your yard.')&&ct.includes('A fire room or garden beds?')&&/ask again/.test(ct),'Clarify: the AI’s question and how to answer it');
 const capped=await runDesignerTurn(ext,'Fire',{ask:async()=>{throw new DesignerAiError('cap_reached','The AI has reached this month’s budget.','cap_reached');}}),o4=P.designerTurnOutcome(capped);
 ok(capped.status==='engine-only'&&o4.show==='line'&&o4.off==='cap_reached'&&o4.line===P.aiUnavailableLine('cap_reached')&&capped.concepts.length===result.concepts.length,'Engine-only over the monthly cap: the AI designer goes off with its line; the engine’s concepts stand');
 const base={status:'engine-only' as const,concept:null,response:null,warnings:[]};
 const o5=P.designerTurnOutcome({...base,reason:'rate_limited',message:'You have used today’s AI turns.'});ok(o5.off==='rate_limited'&&o5.remaining===0&&/today’s AI designer turns/.test(o5.line!),'Engine-only out of turns: off, 0 left');
 const o6=P.designerTurnOutcome({...base,reason:'not_configured'});ok(o6.off==='not_configured'&&/switched on/.test(o6.line!),'Engine-only, not configured: off');
 const o7=P.designerTurnOutcome({...base,reason:'unavailable',message:'The AI could not help with that request. Try describing the yard you want.'});ok(o7.show==='line'&&!o7.off&&/could not help/.test(o7.line!),'Engine-only, a passing failure: its own plain line, and the AI designer stays on to ask again');
 const o8=P.designerTurnOutcome({...base,message:'No concept fits the measured ground yet, so there is nothing for the AI to choose from.'});ok(!o8.off&&/No concept fits/.test(o8.line!),'Engine-only with no concepts: says so');
 const bare=structuredClone(DEFAULT_DECK) as DeckData;delete (bare as Partial<DeckData>).siteModel;
 const pending=await runDesignerTurn(bare,'Fire',{ask:async()=>{throw new Error('not called');}}),o9=P.designerTurnOutcome(pending);
 ok(pending.status==='pending'&&o9.show==='line'&&!o9.off&&/measured site/.test(o9.line!),`Pending: one line (${o9.line})`);
}
// 4. The panel's first paint: brief loading, inputs, Show concepts; without a survey it says what it needs.
{
 const t=text(renderToStaticMarkup(createElement(P.default,{data:ext,update:()=>{}})));
 ok(t.startsWith('Design from my ground')&&t.includes('What the survey says')&&t.includes('Budget to add, before HST (optional)')&&t.includes('Which way does the back yard face?')&&t.includes('Show concepts'),'Header, survey summary, budget, goals, compass and Show concepts');
 ok(['Value for money','Entertaining','Gardening'].every(g=>t.includes(g)),'The three goals');
 ok(t.includes(ext.permitSite?'Saved with the design':'Kept for this visit only'),'Says where the compass direction is kept');
 ok(t.includes('Checking whether the AI designer is available'),'The AI designer is checked, not assumed');
 const bare=structuredClone(DEFAULT_DECK) as DeckData;delete (bare as Partial<DeckData>).siteModel;
 ok(/needs measured ground/.test(text(renderToStaticMarkup(createElement(P.default,{data:bare,update:()=>{}})))),'Without a survey the panel says it needs measured ground');
 ok(JSON.stringify(ext)===before,'Rendering never changes the design');
}
// 5. Lazy: the panel is only ever loaded dynamically, and it loads the engine and the brief dynamically.
{
 const files:string[]=[];const walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(n))files.push(f);}};walk(new URL('../src',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
 const statics=files.filter(f=>!f.endsWith('SiteDesignerPanel.tsx')&&/^\s*import\s+(?!type\b)[^;]*?from\s*['"][^'"]*\/SiteDesignerPanel['"]/m.test(readFileSync(f,'utf8')));
 ok(!statics.length,`SiteDesignerPanel is only imported dynamically (${statics.join(', ')||'no static imports'})`);
 const mounts=files.filter(f=>/lazy\(\(\)=>import\(['"][^'"]*\/SiteDesignerPanel['"]\)\)/.test(readFileSync(f,'utf8'))).map(f=>f.replace(/.*[\\/]src[\\/]features[\\/]deckcraft[\\/]/,''));
 ok(['YardEditor.tsx','ElevationWorkspace.tsx'].every(m=>mounts.some(f=>f.endsWith(m))),`Mounted lazily in the Backyard step and the elevation workspace (${mounts.join(', ')})`);
 const own=readFileSync(new URL('../src/features/deckcraft/designer/SiteDesignerPanel.tsx',import.meta.url),'utf8');
 ok(!/^\s*import\s+(?!type\b)[^;]*from\s*'\.\.\/(siteConcepts|siteBrief|siteDesignMoves|groundFit)'/m.test(own),'The panel loads the engine and the brief dynamically');
 ok(!/^\s*import\s+(?!type\b)[^;]*from\s*'\.\/siteDesignerAiClient'/m.test(own)&&/import\('\.\/siteDesignerAiClient'\)/.test(own)&&!/import\.meta\.glob/.test(own),'The AI client loads on demand, by a typed dynamic import');
}
console.log(`check-site-designer-panel: ${checks} checks passed — ${result.concepts.map(c=>`${c.title} ${P.conceptPriceEffect(c,baseline).text}`).join('; ')}`);
