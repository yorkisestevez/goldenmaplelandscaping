// Ground fit G3: priced options that fit the design (landing level and risers, stair position, deck height, stone edge)
// to the measured ground. Uses the real Craighurst design (12×5 ft deck at 30 in, 4 risers onto a stone landing at +5 in,
// e2e/fixtures/craighurst-ground-fit.json) and variants of it: a second patio, a second stair, a big survey.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import {performance} from 'node:perf_hooks';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {syncAutoLighting} from '../src/features/deckcraft/lightingSystem';
import {GROUND_FIT_RATES} from '../src/features/deckcraft/groundFitRates';
import {dollars} from '../src/features/deckcraft/designFacts';
import {STAIR_TARGET_LIMITS,stairTargetId} from '../src/features/deckcraft/stairTargets';
import type {DeckData} from '../src/features/deckcraft/types';
import {createDeckAgentController,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const FIXTURE=readFileSync(new URL('../e2e/fixtures/craighurst-ground-fit.json',import.meta.url),'utf8');
/** The Craighurst design, optionally edited first (its configuration, as saved). */
async function load(edit?:(c:any)=>void):Promise<DeckData>{const doc=JSON.parse(FIXTURE);edit?.(doc.configuration);await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));}
await loadAdvancedYardRuntime();
const data=await load(),before=JSON.stringify(data),beforeClone=structuredClone(data);
const {groundFitOptions}=await import('../src/features/deckcraft/groundFit');
// The panel's price words (its stylesheet is stubbed: Node has no CSS loader).
register('data:text/javascript,'+encodeURIComponent('export async function load(url,context,next){if(url.endsWith(".css"))return {format:"module",source:"",shortCircuit:true};return next(url,context);}'));
const {groundFitPriceEffect}=await import('../src/features/deckcraft/designer/GroundFitPanel');
type Result=Awaited<ReturnType<typeof groundFitOptions>>;type Option=Result['options'][number];
const sill=data.houseConfig!.floorHeightIn!,ALLOWED=new Set(['yardFeatures','stairTargets','stairOffset','height','lightingSystem']);
const CONTACT=/^(?:the measured ground beside it is up to ([\d.]+) in above|its finished surface stands up to ([\d.]+) in above)/;
const JUMP=/^(\d+) proposed grading boundary span\(s\) change elevation abruptly \(maximum ([\d.]+) in\)/,STAIR=/\brises?\b|\btreads?\b/i;
/** A patio's own ground messages (G1), tallest by side: ground above its top (cut) and its top standing up (fill). */
const contactOf=(warnings:string[],name='Stone landing')=>{const out={above:-Infinity,below:-Infinity};for(const w of warnings){if(!w.startsWith(`${name}: `))continue;const m=CONTACT.exec(w.slice(name.length+2));if(m){if(m[1]!==undefined)out.above=Math.max(out.above,+m[1]);else out.below=Math.max(out.below,+m[2]);}}return out;};
const jumpOf=(warnings:string[])=>{let count=0,most=0;for(const w of warnings){const m=JUMP.exec(w);if(m){count+=+m[1];most=Math.max(most,+m[2]);}}return {count,most};};
const offRise=(d:DeckData)=>{const tk=buildDeckTakeoff(d);return {issues:new Set(tk.issues.filter(i=>STAIR.test(i))),off:new Set(tk.flights.filter(f=>f.risers>0&&(f.rise<STAIR_TARGET_LIMITS.minRiseIn-1e-6||f.rise>STAIR_TARGET_LIMITS.maxRiseIn+1e-6)).map(f=>f.id))};};
/** The design as it stands, lights settled the way the page settles them. */
function settled(d:DeckData){const tk=buildDeckTakeoff(d),ex=extrasLayout(d,tk),items=syncAutoLighting(d,{posts:tk.railing.posts.length,stairs:tk.treads.length,privacy:ex.privacyMounts.length,border:ex.borderMounts.length});return JSON.stringify(items)===JSON.stringify(d.lightingSystem.selectedItems)?d:{...d,lightingSystem:{...d.lightingSystem,selectedItems:items}};}
const quotedWork=(r:Result)=>{const cur=r.options[0],q=new Set(cur.quotes),unpriced=(o:Option)=>(GROUND_FIT_RATES.cutHaulPerYd3===null?o.metrics.bankCutYd3:0)+(GROUND_FIT_RATES.fillCompactionPerYd3===null?o.metrics.bankFillYd3:0);return (o:Option)=>o.quotes.some(x=>!q.has(x))||unpriced(o)>unpriced(cur)+.01?1:0;};

/** Every option of a result: valid patch, parses, re-prices exactly against the one baseline, equal-rise stair, sill rule,
 * no new or taller ground message for this patio (a stone edge excuses only its raised side), no new grading jump, no
 * stair (this one or another) with a new rise or tread problem, stone edge within two courses. */
function checkAll(r:Result,design:DeckData,label:string,stairLands:boolean){
 ok(r.status==='ready'&&!!r.baseline,`${label}: ready with a baseline (${r.warnings.join(' ')})`);
 const asStands=calculateEstimate(settled(design));
 ok(r.baseline!.subtotal===asStands.subtotal&&JSON.stringify(r.baseline!.quotes)===JSON.stringify(asStands.quoteRequired),`${label}: baseline is the design as it stands, lights settled (${r.baseline!.subtotal.toFixed(2)})`);
 const current=r.options[0],fitted=calculateEstimate({...design,...current.patch}),contact0=contactOf(fitted.yardModel.warnings),jump0=jumpOf(fitted.yardModel.warnings),start=offRise(design);
 const flightId=design.stairTargets?.find(t=>t.patioId==='landing')?.flightId;
 for(const o of r.options){const name=`${label} ${o.id}`;
  ok(Object.keys(o.patch).every(k=>ALLOWED.has(k)),`${name}: patch touches only patio, stair targets, stair position, deck height and settled lights (${Object.keys(o.patch).join(', ')})`);
  const patched={...design,...o.patch},parsed=parseDesign(serializeDesign(patched)),est=calculateEstimate(patched),reparsed=calculateEstimate(parsed);
  ok(est.subtotal===o.subtotal&&reparsed.subtotal===o.subtotal,`${name}: re-prices to exactly its subtotal ${o.subtotal.toFixed(2)} (${est.subtotal.toFixed(2)} / parsed ${reparsed.subtotal.toFixed(2)})`);
  ok(JSON.stringify(est.quoteRequired)===JSON.stringify(o.quotes),`${name}: quotes are the estimate's quote list`);
  ok(Math.abs(o.deltaFromCurrent-(o.subtotal-r.baseline!.subtotal))<.006,`${name}: delta ${o.deltaFromCurrent} is from the one baseline`);
  const patio=parsed.yardFeatures!.find(f=>f.id==='landing')!;ok(!!patio.groundFit&&patio.finishedElevationIn===o.metrics.landingIn,`${name}: patio graded round at its landing level ${o.metrics.landingIn}`);
  ok(o.lines.length>=2&&o.lines.length<=4&&o.title.length>10,`${name}: titled with 2–4 lines`);
  if(stairLands&&flightId){const tk=buildDeckTakeoff(parsed),flights=tk.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===flightId),rise=flights[0].rise;
   ok(flights.length>0&&flights.every(f=>Math.abs(f.rise-rise)<1e-6)&&rise>=STAIR_TARGET_LIMITS.minRiseIn-1e-7&&rise<=STAIR_TARGET_LIMITS.maxRiseIn+1e-7,`${name}: equal rise ${rise.toFixed(3)} in within limits`);
   ok(flights.reduce((n,f)=>n+f.risers,0)===o.metrics.risers&&Math.abs(Math.min(...flights.map(f=>f.end.y))-patio.finishedElevationIn!)<1e-6,`${name}: ${o.metrics.risers} risers land on the patio top`);
   ok(o.metrics.riseIn!==null&&Math.abs(o.metrics.riseIn-rise)<1e-6,`${name}: reported rise matches the takeoff`);}
  if(o.patch.height!==undefined)ok(o.patch.height>=sill-4-1e-9&&o.patch.height<=sill-1+1e-9,`${name}: deck ${o.patch.height} in is 1–4 in below the ${sill} in sill`);
  if(o.kind!=='current'){const c=contactOf(est.yardModel.warnings),j=jumpOf(est.yardModel.warnings),s=offRise(patched);
   ok(c.above<=contact0.above+.05&&(o.kind==='edge'||c.below<=contact0.below+.05),`${name}: no new or taller ground message for the landing (${JSON.stringify(c)} vs ${JSON.stringify(contact0)})`);
   ok(j.count<=jump0.count&&j.most<=jump0.most+.005,`${name}: no new grading jump (${JSON.stringify(j)} vs ${JSON.stringify(jump0)})`);
   ok([...s.issues].every(i=>start.issues.has(i))&&[...s.off].every(f=>start.off.has(f)),`${name}: no stair gains a rise or tread problem (${[...s.issues].filter(i=>!start.issues.has(i)).join(' ')})`);}
  if(o.kind==='edge')ok(o.metrics.edgeLf>0&&o.metrics.edgeMaxIn<=16&&o.metrics.bankFillYd3<current.metrics.bankFillYd3&&o.lines.some(l=>l.startsWith('Stone edge course')),`${name}: stone edge carries its course (${o.metrics.edgeLf} ft, up to ${o.metrics.edgeMaxIn} in, at most two courses) and takes out fill`);
 }
 const sig=(o:Option)=>JSON.stringify([o.metrics.risers,o.metrics.landingIn,o.metrics.stairOffsetPct,o.metrics.deckTopIn,o.kind==='edge']);
 ok(new Set(r.options.map(sig)).size===r.options.length&&new Set(r.options.map(o=>o.id)).size===r.options.length,`${label}: options are distinct in what they change`);
 const adds=quotedWork(r),rest=r.options.slice(1);
 ok(rest.every((o,i)=>!i||adds(o)>adds(rest[i-1])||adds(o)===adds(rest[i-1])&&o.subtotal>=rest[i-1].subtotal),`${label}: options adding work by quote come after those that add none, each group best priced first (${rest.map(o=>`${o.id}${adds(o)?'*':''}`).join(', ')})`);
}

// (a) A big survey never freezes the page (run first, while the process is fresh): 2000 shots (and a traced 180-point
// boundary) round Craighurst. The solver yields through scheduler.yield where there is one, so a stand-in here
// timestamps every yield: the longest stretch of work between two yields, the whole run against its 4 s budget, and how
// soon an abort lands after it was due.
let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,ground=(x:number,z:number)=>-2+x*.07-z*.03+Math.sin(x/40)*2+Math.cos(z/35)*2;
const shots=Array.from({length:2000},(_,i)=>{const x=-120+rnd()*400,z=-40+rnd()*300;return {id:'r'+i,xIn:+x.toFixed(3),zIn:+z.toFixed(3),elevationIn:+ground(x,z).toFixed(3)};});
const big=await load(c=>{c.siteModel={...c.siteModel,points:shots};}),traced=await load(c=>{c.siteModel={...c.siteModel,points:shots,boundary:Array.from({length:180},(_,i)=>{const a=i/180*2*Math.PI;return {x:+(80+Math.cos(a)*(190+Math.sin(a*9)*8)).toFixed(3),y:+(110+Math.sin(a)*(140+Math.cos(a*7)*6)).toFixed(3)};})};});
/** One run: every stretch of work between two yields (timestamped by a scheduler.yield stand-in and reported by the
 * solver with the engine calls in it), the whole run, and how late an abort lands after it was due. */
async function timed(design:DeckData,abortAt?:number){
 const g=globalThis as {scheduler?:unknown},had=g.scheduler,ac=new AbortController(),slices:{ms:number;engineMs:number;calls:number;longestMs:number}[]=[];let resumed=0,longest=0,yields=0;
 g.scheduler={yield:()=>{longest=Math.max(longest,performance.now()-resumed);yields++;return new Promise<void>(r=>setImmediate(()=>{resumed=performance.now();r();}));}};
 const start=performance.now(),timer=abortAt?setTimeout(()=>ac.abort(),abortAt):undefined;resumed=start;
 try{const r=await groundFitOptions(design,{featureId:'landing',signal:ac.signal,onYield:s=>slices.push(s)}),end=performance.now();
  return {r,ms:end-start,longest:Math.max(longest,end-resumed),yields,slices,engine:Math.max(0,...slices.map(s=>s.longestMs)),late:abortAt?end-(start+abortAt):0};}
 finally{clearTimeout(timer);g.scheduler=had;}
}
// No stretch runs past 250 ms of work, except one taken up by a single engine call (an estimate, a stair refit, a
// surface: shared code the solver cannot cut short) with at most 50 ms of other work round it. On this machine one such
// call takes about 150–250 ms, more under load or a garbage collection.
const own=(s:{ms:number;longestMs:number})=>s.ms<=250||s.ms-s.longestMs<=50;
const run=await timed(big),over=run.slices.filter(s=>s.ms>250);
ok(run.r.status==='ready'&&run.r.options.length>=2,`2000 shots: options (${run.r.options.map(o=>o.id).join(', ')})`);
ok(run.ms<=6000,`2000 shots: done in ${run.ms.toFixed(0)} ms (budget 4000 ms, limit 6000)`);
ok(run.yields>=20&&run.yields===run.slices.length&&run.slices.every(own),`2000 shots: ${run.yields} yields; longest stretch ${run.longest.toFixed(0)} ms, longest engine call ${run.engine.toFixed(0)} ms; ${over.length} past 250 ms, each one engine call (${over.map(s=>`${s.ms.toFixed(0)} ms with ${(s.ms-s.longestMs).toFixed(0)} ms besides the call`).join(', ')||'none'})`);
ok(run.r.warnings.every(w=>!/time limit/.test(w))||run.r.warnings.some(w=>/^The search stopped at its time limit, so only the nearest variations were tried/.test(w)),`2000 shots: a cut-short search says so (${run.r.warnings.join(' ')})`);
// An abort lands at the next yield: within 300 ms, or within the one engine call under way plus 50 ms.
const lates:number[]=[];for(const at of [400,1500,3000]){const a=await timed(big,at);lates.push(a.late);ok(a.r.status==='pending'&&a.r.warnings[0].includes('cancelled')&&a.slices.every(own)&&a.late<=Math.max(300,a.engine+50),`2000 shots: an abort due at ${at} ms lands ${a.late.toFixed(0)} ms later (longest engine call ${a.engine.toFixed(0)} ms)`);}
const tr=await timed(traced);
ok(tr.r.status==='ready'&&tr.ms<=6000&&tr.slices.every(own),`Traced 180-point boundary: done in ${tr.ms.toFixed(0)} ms, longest stretch ${tr.longest.toFixed(0)} ms (${tr.r.options.map(o=>o.id).join(', ')})`);
checkAll(run.r,big,'2000 shots',true);

// (b) Craighurst: ready, current first, deterministic, input untouched, timed.
let progress:[number,number][]=[];
const t0=performance.now(),first=await groundFitOptions(data,{featureId:'landing',onProgress:(d,n)=>progress.push([d,n])}),coldMs=performance.now()-t0;
const t1=performance.now(),second=await groundFitOptions(data,{featureId:'landing'}),warmMs=performance.now()-t1;
ok(first.status==='ready'&&first.featureId==='landing'&&!first.warnings.some(w=>/time limit/.test(w)),`Craighurst: ready, searched in full (${first.warnings.join(' ')})`);
ok(first.options[0]?.id==='current'&&first.options[0].kind==='current','Current design comes first');
ok(first.options.length>=2&&first.options.length<=5,`Current plus 1–4 options (${first.options.length-1})`);
ok(JSON.stringify(first)===JSON.stringify(second),'Deterministic: two runs give the same options');
ok(JSON.stringify(data)===before,'Input design unchanged (serialized)');assert.deepEqual(data,beforeClone);checks++;
ok(coldMs<4000&&warmMs<4000,`Craighurst under 4 s (cold ${coldMs.toFixed(0)} ms, warm ${warmMs.toFixed(0)} ms)`);
ok(progress.length>2&&progress.every(([d,n],i)=>d<=n&&(i===0||d>=progress[i-1][0]))&&progress.at(-1)![0]===progress.at(-1)![1],`Progress counts up to its total (${progress.length} reports)`);

// (c) Every option checked; the stone edge is capped at two courses; quoted work ranks last.
checkAll(first,data,'Craighurst',true);
const current=first.options[0],all8=await groundFitOptions(data,{featureId:'landing',maxOptions:8});checkAll(all8,data,'Craighurst (8)',true);
const fewer=first.options.filter(o=>o.metrics.risers!==null&&o.metrics.risers<4),three=all8.options.find(o=>o.metrics.risers===3&&o.kind==='level');
ok(fewer.length>0,`An option changes the risers (${fewer.map(o=>`${o.id}: ${o.metrics.risers}×${o.metrics.riseIn!.toFixed(2)} in`).join(', ')})`);
// 3 risers reach no lower than 30 − 3 × 7.75 = +6.75 in; the ground under the landing averages about +2 in, so the
// least-earthwork 3-riser landing is that lowest one (the request expected ~+7.5 in at ~7.5 in risers).
ok(!!three&&three.metrics.landingIn>=6.75&&three.metrics.landingIn<=8&&three.metrics.riseIn!>=7.25,`3 risers of ${three?.metrics.riseIn?.toFixed(2)} in at a landing of +${three?.metrics.landingIn} in`);
ok(current.metrics.risers===4&&current.metrics.landingIn===5&&current.patch.yardFeatures!.find(f=>f.id==='landing')!.groundFit?.slopeRatio===3,'Current: 4 risers onto +5 in, graded at the default 3:1');
ok(current.deltaFromCurrent>0&&current.lines.some(l=>l.includes('priced by quote until your rates are set')),'Current: fitting adds the priced lawn restoration; bank earthwork stays a quote');
ok(all8.options.slice(1).every(o=>o.subtotal<current.subtotal||o.metrics.bankCutYd3+o.metrics.bankFillYd3<current.metrics.bankCutYd3+current.metrics.bankFillYd3-1e-4),'No option is worse than the current design on both price and earthwork');
// The 2-riser landing at +14.5 in would need a 16.8 in stone face: a retaining wall, so no longer offered as an edge.
ok(!all8.options.some(o=>o.id==='level:2+edge')&&all8.options.every(o=>o.metrics.edgeMaxIn<=16),`No stone edge past two courses (${all8.options.filter(o=>o.kind==='edge').map(o=>`${o.id} ${o.metrics.edgeMaxIn} in`).join(', ')||'none offered'})`);
const adds=quotedWork(first);ok(!adds(first.options[1])&&first.options.slice(1).some(o=>adds(o)),`Craighurst lists an option without quoted work first (${first.options.slice(1).map(o=>`${o.id}${adds(o)?' (by quote)':''}`).join(', ')})`);
// A raised patio whose only way past a wide bank is a stone edge taller than two courses: not offered, and said so.
const raised=async(e:number)=>{const d=await load(c=>{c.stairFlights=0;delete c.stairTargets;c.yardFeatures[0].finishedElevationIn=e;});return {d,r:await groundFitOptions(d,{featureId:'landing',levers:{level:false}})};};
const tall=await raised(16),low=await raised(12);
ok(!tall.r.options.some(o=>o.kind==='edge')&&tall.r.warnings.some(w=>/retaining wall/.test(w)&&/past two courses/.test(w)),`A 20 in stone face is not offered, and the panel says why (${tall.r.warnings.join(' ')})`);
ok(low.r.options.some(o=>o.kind==='edge'&&o.metrics.edgeMaxIn<=16)&&!low.r.warnings.some(w=>/retaining wall/.test(w)),`A stone edge within two courses is still offered (${low.r.options.map(o=>`${o.id} ${o.metrics.edgeMaxIn}`).join(', ')})`);
checkAll(low.r,low.d,'Raised patio',false);

// (d) One baseline (the design as it stands) for every price, in the panel's words too.
const base=first.baseline!,effect=(o:Option)=>groundFitPriceEffect(o,base).text,amount=(o:Option)=>Math.round(o.subtotal)-Math.round(base.subtotal);
ok(Math.abs(current.subtotal-current.deltaFromCurrent-base.subtotal)<.006&&first.options.every(o=>Math.abs(base.subtotal+o.deltaFromCurrent-o.subtotal)<.006),'Baseline + delta = subtotal on every card, current included');
ok(new RegExp(`^\\+\\${dollars(amount(current))} to grade round the landing, plus earthwork by quote$`).test(effect(current)),`Current card: "${effect(current)}"`);
for(const o of all8.options.slice(1)){const text=groundFitPriceEffect(o,all8.baseline).text,m=/^([+−])\$([\d,]+)/.exec(text),shown=m?(m[1]==='+'?1:-1)*+m[2].replace(/,/g,''):0,want=Math.round(o.subtotal)-Math.round(all8.baseline!.subtotal);
 ok(shown===want&&/^(?:[+−]\$[\d,]+|no change|[a-z].* by quote)/.test(text)&&!/^\$0\b|[+−]\$0\b/.test(text),`${o.id}: "${text}" = ${dollars(o.subtotal)} − ${dollars(all8.baseline!.subtotal)}`);}

// (e) Lever switches, patio only, legacy, cancel.
const levelOnly=await groundFitOptions(data,{featureId:'landing',levers:{stair:false,deck:false,edge:false},maxOptions:8});
ok(levelOnly.status==='ready'&&levelOnly.options.slice(1).every(o=>o.kind==='level'&&o.patch.stairOffset===undefined&&o.patch.height===undefined),`Level lever alone (${levelOnly.options.slice(1).map(o=>o.id).join(', ')})`);
checkAll(levelOnly,data,'Level-only',true);
const patioOnly=parseDesign(serializeDesign({...data,stairFlights:0,stairTargets:undefined}));
const po=await groundFitOptions(patioOnly,{featureId:'landing'}),poLevel=await groundFitOptions(patioOnly,{featureId:'landing',levers:{edge:false}});
ok(po.status==='ready'&&po.options.length>=2&&po.options.slice(1).every(o=>(o.kind==='level'||o.kind==='edge')&&o.metrics.risers===null&&o.patch.stairTargets===undefined),`Patio only: options (${po.options.slice(1).map(o=>`${o.id} ${o.metrics.landingIn}`).join(', ')})`);
ok(poLevel.options.length>=2&&poLevel.options.slice(1).every(o=>o.kind==='level')&&new Set(poLevel.options.map(o=>o.metrics.landingIn)).size===poLevel.options.length,`Patio only: distinct level options (${poLevel.options.slice(1).map(o=>`${o.id} ${o.metrics.landingIn}`).join(', ')})`);
checkAll(poLevel,patioOnly,'Patio-only level',false);checkAll(po,patioOnly,'Patio-only',false);
const legacy=await groundFitOptions({...data,siteModel:undefined},{featureId:'landing'});
ok(legacy.status==='pending'&&!legacy.options.length&&legacy.warnings.length===1,`Legacy design without a survey is pending (${legacy.warnings[0]})`);
ok((await groundFitOptions(data,{featureId:'nope'})).status==='pending','Unknown patio is pending');
const abort=new AbortController();abort.abort();ok((await groundFitOptions(data,{featureId:'landing',signal:abort.signal})).status==='pending','An aborted request returns pending');
const late=new AbortController();let calls=0;const lateResult=await groundFitOptions(data,{featureId:'landing',signal:late.signal,onProgress:()=>{if(++calls===2)late.abort();}});
ok(lateResult.status==='pending'&&lateResult.warnings[0].includes('cancelled'),'An abort during pricing stops the run');
ok(JSON.stringify(data)===before,'Input still unchanged after every run');

// (f) Another patio's own ground message never hides this patio's options (G1 is scoped to this patio, and to what
// fitting it changes). The side patio's dig-back warning used to leave only a stone-edge option.
const side=await load(c=>{const l=c.yardFeatures[0];c.yardFeatures=[{...structuredClone(l),id:'side',name:'Side patio',xFt:9,widthFt:3,zFt:7.75,depthFt:2},l];});
const sideFit=await groundFitOptions(side,{featureId:'landing',maxOptions:8});
ok(calculateEstimate(side).yardModel.warnings.some(w=>w.startsWith('Side patio: the measured ground beside it is up to')),'Side patio: carries its own ground message');
ok(sideFit.options.some(o=>o.kind==='level')&&sideFit.options.some(o=>o.kind==='stair'),`Side patio: level and stair options come back (${sideFit.options.slice(1).map(o=>o.id).join(', ')})`);
checkAll(sideFit,side,'Side patio',true);
const sideFitted=await load(c=>{const l=c.yardFeatures[0];c.yardFeatures=[{...structuredClone(l),id:'side',name:'Side patio',xFt:9,widthFt:3,zFt:7.75,depthFt:2,finishedElevationIn:9,groundFit:{slopeRatio:3}},l];});
checkAll(await groundFitOptions(sideFitted,{featureId:'landing',maxOptions:8}),sideFitted,'Fitted side patio',true);

// (g) A second stair with a set riser count keeps its rise in limits: the deck lever used to raise the deck to 30.25 in
// and leave it at 4 × 7.79 in ("Edited stair count gives 7.79-inch rises").
const twoFlights=async(e1:number)=>{const d=await load(c=>{c.houseConfig.floorHeightIn=34.12;c.stairFlights=2;});return {...d,stairTargets:[...d.stairTargets!,{flightId:'grade-1',elevationIn:e1,riserCount:4,treadDepthIn:10.6875,surface:'terrain' as const}]};};
const tight=await twoFlights(-.9),roomy=await twoFlights(0);
ok(!buildDeckTakeoff(tight).issues.some(i=>/Edited stair count/.test(i)),'Two stairs: the second starts at 4 × 7.725 in, within limits');
const tightAll=await groundFitOptions(tight,{featureId:'landing',maxOptions:8}),tightDeck=await groundFitOptions(tight,{featureId:'landing',levers:{level:false,stair:false,edge:false},maxOptions:8});
checkAll(tightAll,tight,'Two stairs',true);
ok(tightDeck.status==='ready'&&!tightDeck.options.some(o=>o.kind==='deck'),`Two stairs: no deck height breaks the second stair (${tightDeck.options.slice(1).map(o=>`${o.id} h=${o.patch.height}`).join(', ')||'none offered'})`);
const roomyDeck=await groundFitOptions(roomy,{featureId:'landing',levers:{level:false,stair:false,edge:false},maxOptions:8});
ok(roomyDeck.options.some(o=>o.kind==='deck'),`Two stairs with room: the deck lever still works (${roomyDeck.options.slice(1).map(o=>`${o.id} h=${o.patch.height}`).join(', ')})`);
checkAll(roomyDeck,roomy,'Two stairs, deck lever',true);

// (h) No option adds a jump in the grading: here sliding the stair with a stone edge used to leave a 0.5 in step.
const bumped=await load(c=>{c.stairFlights=2;for(const p of c.siteModel.points)if(p.zIn>100)p.elevationIn+=12;});
const bumpedTwo={...bumped,stairTargets:[...bumped.stairTargets!,{flightId:'grade-1',elevationIn:0,riserCount:4,treadDepthIn:10.6875,surface:'terrain' as const}]};
checkAll(await groundFitOptions(bumpedTwo,{featureId:'landing',maxOptions:8}),bumpedTwo,'Raised back yard',true);

// (i) The agent command: options without a change, then one option applied as one design change.
let state:DeckAgentHostState={data,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0;
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;state={...state,data:next,canUndo:true,canRedo:false};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async predicate=>{assert.ok(predicate(state),'Host acknowledges committed state');}});
ok(api.describe().commands.includes('ground.fit')&&JSON.stringify(api.describe().units).includes('ground.fit'),'Descriptor lists ground.fit');
const listed=await api.execute({id:'gf-list',commands:[{type:'ground.fit',featureId:'landing'}]}) as Extract<AgentResponse,{ok:true}>;
ok(listed.ok&&!listed.changed&&commits===0&&JSON.stringify(listed.groundFit)===JSON.stringify(first),'ground.fit lists the same options and changes nothing');
ok(listed.interpretation!.summary.length===first.options.length&&listed.interpretation!.summary[0].startsWith('current: '),'Options summarised for the agent');
// A stone-edge patch also needs lowEdge in the controller's design schema (owned by the lowEdge work); apply a non-edge option here.
const pick=first.options.slice(1).find(o=>o.kind!=='edge')!,applied=await api.execute({id:'gf-apply',commands:[{type:'ground.fit',featureId:'landing',optionId:pick.id}]}) as Extract<AgentResponse,{ok:true}>;
ok(applied.ok&&applied.changed&&commits===1,`ground.fit with optionId '${pick.id}' commits one change (${(applied as unknown as {error?:{message:string}}).error?.message??''})`);
const after=state.data.yardFeatures!.find(f=>f.id==='landing')!,want=pick.patch.yardFeatures!.find(f=>f.id==='landing')!;
ok(JSON.stringify(after)===JSON.stringify(want)&&JSON.stringify(state.data.stairTargets)===JSON.stringify(pick.patch.stairTargets)&&(pick.patch.stairOffset===undefined||state.data.stairOffset===pick.patch.stairOffset),'Applied design carries the option patch');
ok(Math.abs(applied.snapshot.pricing.subtotal-pick.subtotal)<.005,`Agent snapshot prices the applied option at its subtotal (${applied.snapshot.pricing.subtotal.toFixed(2)})`);
const stale=await api.preview({id:'gf-stale',commands:[{type:'ground.fit',featureId:'landing',optionId:'level:99'}]});
ok(!stale.ok&&(stale as Extract<AgentResponse,{ok:false}>).error.code==='stale_option','An option no longer offered is refused');
const bad=await api.preview({id:'gf-bad',commands:[{type:'ground.fit',featureId:'landing',levers:{level:true,roof:true}}]});
ok(!bad.ok&&(bad as Extract<AgentResponse,{ok:false}>).error.message.includes('roof'),'Unknown lever rejected by the schema');

console.log(`Ground fit options: ${checks} checks passed; Craighurst ${coldMs.toFixed(0)}/${warmMs.toFixed(0)} ms: ${first.options.map(o=>`${o.id} ${o.metrics.risers??'-'}×${o.metrics.riseIn?.toFixed(2)??'-'} @${o.metrics.landingIn} $${o.subtotal.toFixed(0)} (${o.deltaFromCurrent>=0?'+':''}${o.deltaFromCurrent.toFixed(0)})`).join('; ')}; baseline $${base.subtotal.toFixed(0)}; patio-only ${po.options.length-1} levels; 2000 shots ${run.ms.toFixed(0)} ms, longest stretch ${run.longest.toFixed(0)} ms (${over.length} past 250 ms, each a single engine call; longest call ${run.engine.toFixed(0)} ms), aborts land ${lates.map(v=>v.toFixed(0)).join('/')} ms late; traced ${tr.ms.toFixed(0)} ms.`);
