/**
 * S3 concept composer for the AI Site Designer: 2–3 distinct, complete, buildable and priced yard concepts for a
 * measured site, composed from the design moves of siteDesignMoves.ts. Deterministic and model-free: the AI later picks
 * a concept and adjusts its moves' params; it never invents geometry or prices.
 *
 * Each concept answers one goal ("Fit the slope for less", "Outdoor room", "Garden terraces"), carries its moves, one
 * merged `patch` for design.patch (one request, one undo step), its priced subtotal and the change from the design as
 * it stands (one baseline for every concept, lights settled the way the page settles them, as groundFit.ts prices), the
 * labels still to be quoted, scores (cost, execution, and trend only once DESIGN_TRENDS is approved), plain reasons in
 * the owner's voice citing the measured numbers, and a validation record: re-priced exactly through calculateEstimate,
 * a parseDesign round trip, every footprint on measured ground and clear of the others, and no new ground-contact,
 * clearance or guard message left unexplained. Honest ranking: concepts that add work priced only by quote come after
 * those that add none, and quoted work is never presented as a saving.
 *
 * Lazy: import it dynamically. The work runs in short slices between yields to the event loop (one before every estimate,
 * so no stretch holds more than one calculateEstimate run) and stops on the abort signal (as groundFit.ts does). What is
 * composed does not depend on the device's speed: every template, each with a fixed number of rounds; the time limit is
 * only a safety stop, and the result says when it stopped early.
 *
 * Two ground-fit patios whose graded banks would meet in an abrupt step (a raised patio beside the fire room's patio,
 * say) are not left as an invalid concept: the later patio is placed again with room round the other patio for the banks
 * to meet (BANK_GAPS), and only when no such place exists is the optional move left out.
 *
 * conceptFromChoice() rebuilds one concept from the AI designer's choice (a concept's template, the moves to keep, their
 * bounded params) through the same composer and the same pricing and checks, and returns findings for the AI's one
 * revision turn. Also deterministic.
 */
import type {DeckData} from './types';
import type {SiteBrief} from './siteBrief';
import type {PlanPoint} from './lib/deckGeometry';
import {calculateEstimate,type EstimateResult} from './calculations';
import {buildDeckTakeoff} from './deckTakeoff';
import {extrasLayout} from './extrasLayout';
import {syncAutoLighting} from './lightingSystem';
import {parseDesign,serializeDesign} from './designPersistence';
import {ensureLiveDesignExtensions} from './designExtensions';
import {DESIGN_TRENDS,DESIGN_TRENDS_STATUS} from './designTrends';
import {GUARD,RETAINING_WALL} from './designRules';
import {yardArea,yardClip} from './yardModel';
import {applyParts,designOccupants,featureRings,landingOf,loadSiteDesignRuntime,moveContext,siteDesignMove,withMove,type MoveContext,type MoveValue,type Occupant,type SiteMove,type SiteMoveKind} from './siteDesignMoves';
import {MOVE_INFO,MOVE_NEEDS,MOVE_PARAMS,SITE_MOVE_KINDS,moveParamAllowed} from './siteMoveParams';

export type SiteGoal='value'|'entertaining'|'garden';
export interface SiteConceptScores {
 /** 0–1, higher is cheaper: against the budget when one is given, else against the other concepts; each label it adds
  * to the quote list counts against it. */
 cost:number;
 /** 0–1, higher is simpler to build: wall heights (engineering and permit triggers), a guard, close tiers, earthwork,
  * quoted work and how close the work runs to the edge of the survey. */
 execution:number;
 /** 0–1 against DESIGN_TRENDS, or null until the owner approves them (DESIGN_TRENDS_STATUS). */
 trend:number|null;
}
export interface SiteConceptValidation {ok:boolean;
 /** {...design, ...patch} re-prices to exactly this subtotal and quote list. */
 priced:boolean;
 /** The patched design survives serializeDesign → parseDesign and prices the same. */
 roundTrip:boolean;
 /** Every footprint of every move is on measured ground. */
 insideCoverage:boolean;
 /** Footprints that overlap something they should not (none when valid). */
 overlaps:string[];
 /** Estimate and stair messages the concept adds (first clause). */
 newWarnings:string[];
 /** Of those, ground-contact, clearance or guard messages no move accounts for (none when valid). */
 unexplained:string[];
}
export interface SiteConcept {id:string;title:string;goal:SiteGoal;
 /** Feasible moves, in the order they were placed. */
 moves:SiteMove[];
 /** Moves the concept tried but could not place, and why ("Measure about N ft further …"). */
 skipped:{kind:SiteMoveKind;reason:string}[];
 patch:Partial<DeckData>;subtotal:number;
 /** subtotal less the baseline subtotal (the design as it stands). */
 delta:number;quotes:string[];
 /** Quote labels this concept adds to the design as it stands. */
 newQuotes:string[];
 scores:SiteConceptScores;reasons:string[];validation:SiteConceptValidation}
export interface SiteConceptsResult {status:'ready'|'pending';brief:SiteBrief|null;concepts:SiteConcept[];warnings:string[];baseline?:{subtotal:number;quotes:string[]};
 /** The safety time limit stopped the run before every template was composed (a warning says so). */
 stoppedEarly?:boolean}
/** `budget`: the most the owner wants to add to the design as it stands (CAD before HST); optional moves are dropped
 * to meet it. `goals`: the goals wanted, most wanted first (concepts follow that order). `northDeg`: the compass
 * bearing the back yard faces (siteBrief.ts); without it nothing is said about sun. `budgetMs`: a safety time limit
 * (default 120 s, at least 1 s), not a budget the concepts are cut to: every template is composed whatever the device's
 * speed, and only a run past this limit stops early and says so (ground fit gets up to 40 % of it, at most 6 s; its own
 * search is deterministic under its 20 s safety limit). */
export interface SiteConceptsRequest {budget?:number;goals?:SiteGoal[];northDeg?:number;budgetMs?:number;signal?:AbortSignal;onProgress?:(done:number,total:number)=>void;
 /** Called at each yield with the stretch of work before it: its length, and the estimate runs in it (calls, their
  * time, the longest): a check that no stretch holds more than one estimate (as groundFit.ts reports its own). */
 onYield?:(slice:{ms:number;engineMs:number;calls:number;longestMs:number})=>void}
/** What the AI designer chose (siteDesignerAiContract.ts DesignerAiChoice): build from concept `base`'s template, keep
 * the moves in `include`, with `params` overriding the moves' defaults inside MOVE_PARAMS bounds. `budget` overrides
 * the request's budget (null clears it). */
export interface SiteConceptChoice {base:string;include:SiteMoveKind[];params:Partial<Record<SiteMoveKind,Record<string,MoveValue>>>;goals?:SiteGoal[];budget?:number|null}
export interface ConceptFromChoiceResult {status:'ready'|'pending';
 /** The concept as chosen, built, checked and priced; null when nothing could be placed (see findings). */
 concept:SiteConcept|null;
 /** What is wrong with the choice, in plain words for the AI's one revision turn: unknown concepts or moves, params out
  * of bounds, moves that could not be placed (and why), validation failures, a budget overrun. Empty when it stands. */
 findings:string[];warnings:string[];brief:SiteBrief|null;baseline?:{subtotal:number;quotes:string[]}}

interface Step {kind:SiteMoveKind;anchor?:boolean;optional?:boolean;needs?:SiteMoveKind}
interface Template {id:string;goal:SiteGoal;steps:Step[]}
type Params=Partial<Record<SiteMoveKind,Record<string,MoveValue>>>;
type Skipped={kind:SiteMoveKind;reason:string};
/** One concept per goal. Anchors: the concept stands when any of them is feasible; it is named after the first.
 * The ids are siteMoveParams.ts SITE_CONCEPT_IDS (the AI designer's vocabulary): keep the two in step. */
const TEMPLATES:Template[]=[
 {id:'slope',goal:'value',steps:[{kind:'ground-fit',anchor:true},{kind:'planting',anchor:true,optional:true}]},
 {id:'room',goal:'entertaining',steps:[{kind:'fire-room',anchor:true},{kind:'seat-wall',needs:'fire-room'},{kind:'raised-patio',anchor:true,optional:true},{kind:'stone-steps',needs:'raised-patio',optional:true}]},
 {id:'garden',goal:'garden',steps:[{kind:'terraced-beds',anchor:true},{kind:'raised-beds',anchor:true,optional:true}]},
];
/** Kinds that can name and hold up a concept on their own (an anchor in some template). */
const ANCHORS=new Set(TEMPLATES.flatMap(t=>t.steps.filter(s=>s.anchor).map(s=>s.kind)));
const TITLES:Partial<Record<SiteMoveKind,string>>={'ground-fit':'Fit the slope for less','planting':'Planting along the slope','fire-room':'Outdoor room','raised-patio':'Raised patio off the landing','terraced-beds':'Garden terraces','raised-beds':'Raised garden beds'};
const SAFETY_MS=120000,SLICE_MS=40,MAX_CONCEPTS=3;
/** Moves that place a ground-fit patio, and the room (in) they are given round another ground-fit patio, in turn, when
 * their graded banks would meet in an abrupt step. */
const SPACED=new Set<SiteMoveKind>(['fire-room','raised-patio']),BANK_GAPS=[24,48,96];
/** The grading message for two graded surfaces meeting in a step (siteElevationChecks.ts). */
const STEPPED=/change elevation abruptly/;
const stepped=(c:SiteConcept)=>c.validation.unexplained.some(w=>STEPPED.test(w));
/** Messages that say the ground, a clearance or a guard is not resolved. */
const PROBLEM=/measured ground beside it is up to|finished surface stands up to|intersects|covers a deck|meets proposed ground|overlaps|not wholly on|ft from (the house|the deck)\. Keep|not on a level surface|outside (the )?measured survey|off (the )?measured (ground|survey)|runs past the measured ground|outside the measured ground|no holding wall or edging|not linked to an enabled|\bguard\b|clearance|treads intersect proposed ground|meets or falls below local proposed|abruptly|excluded until revised/i;
/** Of those, messages no move's note can account for: something excluded, off the survey, or in the way. */
const HARD=/excluded until revised|outside measured survey|outside the measured|runs past the measured ground|intersects|overlaps|covers a deck|not wholly on|ft from (the house|the deck)\. Keep|meets or falls below local proposed/i;
/** A patio's ground messages, where a larger number is worse. */
const CONTACT=/measured ground beside it is up to|finished surface stands up to/;
class Cancelled extends Error {}
function yieldNow():Promise<void>{
 const s=(globalThis as {scheduler?:{yield?:()=>Promise<void>}}).scheduler;if(typeof s?.yield==='function')return s.yield();
 if(typeof MessageChannel==='function')return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();resolve();};c.port2.postMessage(0);});
 return new Promise(resolve=>setTimeout(resolve,0));
}
const r1=(v:number)=>Math.round(v*10)/10+0,r2=(v:number)=>Math.round(v*100)/100+0,cents=(v:number)=>Math.round(v*100)/100+0;
const signed=(v:number)=>`${v>.04?'+':v<-.04?'−':''}${r1(Math.abs(v))}`;
const money=(v:number)=>`$${Math.round(Math.abs(v)).toLocaleString('en-CA')}`;
const first=(w:string)=>w.split(/(?<=\.)\s/)[0];
/** A message with its numbers taken out, to match a carried-over message whose figures changed. */
const shape=(w:string)=>w.replace(/[−-]?\d[\d.,]*/g,'#').replace(/at its [\w -]+ edge/,'at its # edge');
const figure=(w:string)=>Math.max(0,...(w.match(/\d+(?:\.\d+)?/g)??[]).map(Number));
const nums=(v:MoveValue|undefined)=>typeof v==='number'?v:Number(v);
/** Quote labels grouped by what they are for, as the panel shows them (SiteDesignerPanel.tsx quoteKinds, kept in step):
 * "Terrace wall 1: Geogrid installation" and "Terrace wall 2: Drain outlet fittings" are one item, "Terrace walls"; a
 * label without a feature name before ": " or " — " is an item of its own. */
export function quoteKindCount(labels:readonly string[]):number{
 return new Set(labels.map(l=>{const m=/^(.+?)(?::\s+|\s+—\s+)(.+)$/.exec(l),subject=(m?m[1]:l).trim();return ((m?subject.replace(/\s*#?\d+$/,''):subject)||subject).toLowerCase();})).size;
}
/** A stable cache-key part for a move's params ('' for none, so the composer's own keys are unchanged). */
const paramKey=(p:Record<string,MoveValue>|undefined)=>p&&Object.keys(p).length?JSON.stringify(Object.keys(p).sort().map(k=>[k,p[k]])):'';

/** The design with its post, stair and screen lights following the modelled mounts, as the page settles it before
 * pricing (the estimate itself is a separate step, so the caller can yield between them). */
function settledLights(design:DeckData):DeckData{
 const model=buildDeckTakeoff(design),ex=extrasLayout(design,model),items=syncAutoLighting(design,{posts:model.railing.posts.length,stairs:model.treads.length,privacy:ex.privacyMounts.length,border:ex.borderMounts.length});
 return JSON.stringify(items)===JSON.stringify(design.lightingSystem.selectedItems)?design:{...design,lightingSystem:{...design.lightingSystem,selectedItems:items}};
}
const messagesOf=(est:EstimateResult)=>[...est.yardModel.warnings,...est.model.issues];
/** A move's context with room kept round the design's other ground-fit patios: each is ringed by `gap` in that a new
 * patio's footprint must keep clear of, so the two graded banks have room to meet. The ring is a 'plant' occupant: it
 * blocks a footprint as plantings do, but it is not a structure, so a raised patio's guard still reads the ground there
 * as open ground. A raised patio starts from the stair landing, so the landing gets no ring for it. */
function spaced(ctx:MoveContext,gap:number,kind:SiteMoveKind):MoveContext{
 const landing=kind==='raised-patio'?landingOf(ctx)?.id:undefined,rings:Occupant[]=[];
 for(const f of ctx.data.yardFeatures??[]){
  if(!f.enabled||f.kind!=='patio'||!f.groundFit||typeof f.finishedElevationIn!=='number'||f.id===landing)continue;
  const pts=featureRings(f).flat();if(!pts.length)continue;
  const box={minX:Math.min(...pts.map(p=>p.x))-gap,maxX:Math.max(...pts.map(p=>p.x))+gap,minZ:Math.min(...pts.map(p=>p.y))-gap,maxZ:Math.max(...pts.map(p=>p.y))+gap};
  rings.push({id:`bank:${f.id}`,kind:'plant',label:`the graded bank round ${f.name}`,rings:[[{x:box.minX,y:box.minZ},{x:box.maxX,y:box.minZ},{x:box.maxX,y:box.maxZ},{x:box.minX,y:box.maxZ}]],box});
 }
 return rings.length?{...ctx,occupants:[...ctx.occupants,...rings]}:ctx;
}

type Built={moves:SiteMove[];skipped:Skipped[]};
/** What the composer and conceptFromChoice share for one design: its brief, the baseline, the move context, the
 * composing of a template's moves and the pricing and checking of a set of moves as one concept. */
interface Session {brief:SiteBrief;baseline:EstimateResult;warnings:string[];tick:(force?:boolean)=>Promise<void>;
 /** Past the safety time limit. */
 overdue():boolean;
 compose(t:Template,drop:Set<SiteMoveKind>,params?:Params,gap?:number):Promise<Built>;
 price(t:Template,moves:SiteMove[],skipped:Skipped[]):Promise<SiteConcept>;
 /** Composes and prices the template; when two ground-fit patios' banks then meet in an abrupt step, composes it again
  * with BANK_GAPS of room round the other patio until they do not. `gap` 0 tries; a gap already found is kept. The
  * concept is undefined when no anchor could be placed. */
 build(t:Template,drop:Set<SiteMoveKind>,params?:Params,gap?:number):Promise<{built:Built;concept?:SiteConcept;gap:number}>}
/** Opens a session, or returns why it cannot (a pending message). Throws Cancelled once the signal aborts. */
async function openSession(data:DeckData,request:SiteConceptsRequest,onBase?:()=>void):Promise<Session|string>{
 const signal=request.signal,budget=Math.max(1000,Number(request.budgetMs)||SAFETY_MS),start=performance.now(),deadline=start+budget;
 let last=start,engineMs=0,calls=0,longestMs=0;
 const tick=async(force=false)=>{const now=performance.now();if(force||now-last>SLICE_MS){request.onYield?.({ms:now-last,engineMs,calls,longestMs});engineMs=calls=longestMs=0;await yieldNow();last=performance.now();}if(signal?.aborted)throw new Cancelled();};
 /** calculateEstimate, timed for onYield. Every call has a forced yield before it. */
 const estimate=(design:DeckData)=>{const t=performance.now();try{return calculateEstimate(design);}finally{const ms=performance.now()-t;engineMs+=ms;calls++;longestMs=Math.max(longestMs,ms);}};
 await loadSiteDesignRuntime(data);await tick(true);
 const {siteBrief}=await import('./siteBrief');
 const brief=siteBrief(data,{maxBytes:4096,...(request.northDeg!==undefined?{northDeg:request.northDeg}:{})});
 if(!brief)return 'The site designer needs a measured site. Import or add survey points first.';
 await tick(true);
 const baseDesign=settledLights(data);await tick(true);
 const baseline=estimate(baseDesign),baseMessages=messagesOf(baseline),baseShapes=new Map<string,number>();
 for(const w of baseMessages){const k=shape(w);baseShapes.set(k,Math.max(baseShapes.get(k)??0,figure(w)));}
 onBase?.();await tick(true);
 const ctx0=moveContext(data,brief,{northDeg:request.northDeg,tick:()=>tick(),budgetMs:Math.min(6000,budget*.4),...(signal?{signal}:{})});
 await tick(true);
 const warnings:string[]=[];
 const cache=new Map<string,SiteMove>();

 /** The template's moves in order, each placed on the design with the ones before it; `drop` leaves kinds out; with a
  * `gap`, a move that places a ground-fit patio keeps that much room round the other ground-fit patios. */
 const compose=async(t:Template,drop:Set<SiteMoveKind>,params:Params={},gap=0):Promise<Built>=>{
  let ctx:MoveContext=ctx0;const moves:SiteMove[]=[],skipped:Skipped[]=[];
  for(const step of t.steps){
   if(drop.has(step.kind))continue;
   const anchor=step.needs?moves.find(m=>m.kind===step.needs):undefined;if(step.needs&&!anchor)continue;
   await tick();
   // The cache key names every move before this one as it was placed (with its room), so a move placed again with
   // room never reuses a later move built beside its first place.
   const room=(k:SiteMoveKind)=>gap&&SPACED.has(k)?`~${gap}`:'';
   const key=`${moves.map(m=>m.kind+paramKey(params[m.kind])+room(m.kind)).join('+')}>${step.kind}${paramKey(params[step.kind])}${room(step.kind)}`;let move=cache.get(key);
   if(!move){move=await siteDesignMove(step.kind,room(step.kind)?spaced(ctx,gap,step.kind):ctx,params[step.kind]??{},anchor);cache.set(key,move);}
   if(move.feasible){moves.push(move);ctx=withMove(ctx,move);}else skipped.push({kind:step.kind,reason:move.reason??'Not feasible here.'});
  }
  return {moves,skipped};
 };

 /** Prices a set of moves as one concept, and validates it. One yield before every estimate. */
 async function price(t:Template,moves:SiteMove[],skipped:Skipped[]):Promise<SiteConcept>{
  const raw={...data,...applyParts(data,moves.map(m=>m.parts))};
  await ensureLiveDesignExtensions(raw);await tick(true);
  const design=settledLights(raw);await tick(true);
  const est=estimate(design),patch:Partial<DeckData>={...applyParts(data,moves.map(m=>m.parts)),...(design.lightingSystem!==data.lightingSystem?{lightingSystem:design.lightingSystem}:{})};
  await tick(true);
  const patched={...data,...patch},again=estimate(patched),priced=again.subtotal===est.subtotal&&JSON.stringify(again.quoteRequired)===JSON.stringify(est.quoteRequired);
  await tick(true);
  let roundTrip=false;try{const parsed=parseDesign(serializeDesign(patched));await ensureLiveDesignExtensions(parsed);await tick(true);roundTrip=estimate(parsed).subtotal===est.subtotal;}catch(e){if(e instanceof Cancelled)throw e;roundTrip=false;}
  await tick(true);
  // Footprints: on measured ground, and clear of everything but what they stand on.
  const footprints=moves.flatMap(m=>m.footprints),insideCoverage=footprints.every(f=>ctx0.surface.extrema(f.rings,'existing').complete);
  const allowed=new Set<string>();for(const f of footprints)for(const o of f.on??[]){allowed.add(`${f.id}|${o}`);allowed.add(`${o}|${f.id}`);}
  const replaced=new Set(moves.flatMap(m=>m.parts.replaceYard.map(f=>f.id))),occupants=designOccupants(design,est.model),overlaps:string[]=[];
  for(const f of footprints)for(const o of occupants){const oid=o.id.replace(/^(yard|land):/,'');if(oid===f.id||allowed.has(`${f.id}|${oid}`)||o.kind==='stair'&&replaced.has(f.id))continue;
   if(o.box.maxX<Math.min(...f.rings.flat().map(p=>p.x))||o.box.minX>Math.max(...f.rings.flat().map(p=>p.x))||o.box.maxZ<Math.min(...f.rings.flat().map(p=>p.y))||o.box.minZ>Math.max(...f.rings.flat().map(p=>p.y)))continue;
   const a=yardArea(yardClip(yardClip(f.rings),yardClip(o.rings as PlanPoint[][]),'intersection'));if(a>.01){const name=nameOf(f.id,moves);const msg=`${name} overlaps ${o.label} (${r2(a)} sq ft)`;if(!overlaps.includes(msg)&&!overlaps.includes(`${o.label} overlaps ${name} (${r2(a)} sq ft)`))overlaps.push(msg);}}
  // Messages: new ones (a carried-over message whose figures changed is not new, unless a patio's ground got worse).
  const explains=moves.flatMap(m=>m.explains.map(x=>new RegExp(x,'i'))),newWarnings:string[]=[],unexplained:string[]=[];
  for(const w of messagesOf(est)){if(baseMessages.includes(w))continue;const k=shape(w),was=baseShapes.get(k);
   if(was!==undefined&&!(CONTACT.test(w)&&figure(w)>was+.5))continue;
   const line=first(w);if(!newWarnings.includes(line))newWarnings.push(line);
   if(PROBLEM.test(w)&&(HARD.test(w)||!explains.some(x=>x.test(w)))&&!unexplained.includes(line))unexplained.push(line);}
  const subtotal=est.subtotal,delta=cents(subtotal-baseline.subtotal),quotes=[...est.quoteRequired],baseQuotes=new Set(baseline.quoteRequired),newQuotes=quotes.filter(q=>!baseQuotes.has(q));
  // Named after the template's first anchor that made it in (template order, not placing order).
  const anchorMove=t.steps.filter(x=>x.anchor).map(x=>moves.find(m=>m.kind===x.kind)).find(Boolean)!;
  const concept:SiteConcept={id:t.id,title:TITLES[anchorMove.kind]??anchorMove.title,goal:t.goal,moves,skipped,patch,subtotal,delta,quotes,newQuotes,
   scores:{cost:1,execution:execution(moves,est,newQuotes.length,footprints),trend:trend(moves)},reasons:[],
   validation:{ok:priced&&roundTrip&&insideCoverage&&!overlaps.length&&!unexplained.length,priced,roundTrip,insideCoverage,overlaps,newWarnings,unexplained}};
  concept.reasons=reasons(concept,brief!);
  return concept;
 }
 /** 1 less: retaining walls (more for walls past the engineering 36 in or permit 39.4 in heights), a gas line, a guard,
  * close tiers, earthwork, quoted work, and work within a foot of the edge of the survey. */
 function execution(moves:SiteMove[],est:EstimateResult,quoted:number,footprints:{rings:PlanPoint[][]}[]){
  let s=1;const walls=moves.flatMap(m=>m.parts.addYard.filter(f=>f.kind==='retaining-wall'&&!f.wallConstruction?.freestanding)),tallest=Math.max(0,...walls.map(w=>w.heightIn));
  s-=Math.min(.2,.05*walls.length);
  if(tallest>RETAINING_WALL.permitAboveIn)s-=.3;else if(tallest>RETAINING_WALL.engineerRecommendedAboveIn)s-=.15;
  if(moves.some(m=>m.metrics.fuel==='gas'))s-=.05;
  if(moves.some(m=>m.metrics.guardRequired===true))s-=.15;
  if(moves.some(m=>m.metrics.separationOk===false))s-=.1;
  const cf=est.yardModel.siteCutFill,b=baseline.yardModel.siteCutFill,earth=cf&&b?Math.max(0,cf.cutYd3+cf.fillYd3-b.cutYd3-b.fillYd3):0;s-=Math.min(.2,earth*.02);
  s-=Math.min(.15,.005*quoted);
  if(footprints.some(f=>f.rings.flat().some(p=>[[12,0],[-12,0],[0,12],[0,-12]].some(([dx,dz])=>ctx0.surface.sample(p.x+dx,p.y+dz,'existing')===undefined))))s-=.05;
  return r2(Math.max(0,Math.min(1,s)));
 }
 /** Weighted share of the moves each trend favours; null until DESIGN_TRENDS is approved. */
 function trend(moves:SiteMove[]):number|null{
  if((DESIGN_TRENDS_STATUS as string)!=='approved')return null;
  const kinds=moves.map(m=>m.kind),weight=DESIGN_TRENDS.reduce((n,t)=>n+t.weight,0);
  return weight?r2(DESIGN_TRENDS.reduce((n,t)=>n+t.weight*kinds.filter(k=>t.favours.moves?.includes(k)).length/Math.max(1,kinds.length),0)/weight):null;
 }
 const anchored=(t:Template,moves:SiteMove[])=>moves.some(m=>t.steps.find(s=>s.kind===m.kind)?.anchor);
 async function build(t:Template,drop:Set<SiteMoveKind>,params:Params={},gap=0){
  let built=await compose(t,drop,params,gap);if(!anchored(t,built.moves))return {built,gap};
  let concept=await price(t,built.moves,built.skipped);await tick();
  if(!gap&&stepped(concept)&&built.moves.some(m=>SPACED.has(m.kind)))for(const g of BANK_GAPS){
   const again=await compose(t,drop,params,g);if(!anchored(t,again.moves))continue;
   const c=await price(t,again.moves,again.skipped);await tick();
   if(!stepped(c)){built=again;concept=c;gap=g;break;}
  }
  return {built,concept,gap};
 }
 return {brief,baseline,warnings,tick,overdue:()=>performance.now()>deadline,compose,price,build};
}

export async function siteConcepts(data:DeckData,request:SiteConceptsRequest={}):Promise<SiteConceptsResult>{
 const signal=request.signal,pending=(...warnings:string[]):SiteConceptsResult=>({status:'pending',brief:null,concepts:[],warnings});
 if(signal?.aborted)return pending('Site concepts were cancelled.');
 if(!data.siteModel)return pending('The site designer needs a measured site. Import or add survey points first.');
 try{
 const order=[...new Set([...(request.goals??[]).filter(g=>TEMPLATES.some(t=>t.goal===g)),...TEMPLATES.map(t=>t.goal)])],templates=order.map(g=>TEMPLATES.find(t=>t.goal===g)!);
 const total=templates.reduce((n,t)=>n+t.steps.length+1,1);let done=0;const progress=()=>request.onProgress?.(++done,total);
 const session=await openSession(data,request,progress);
 if(typeof session==='string')return pending(session);
 const {brief,baseline,warnings,overdue,build}=session;
 const concepts:SiteConcept[]=[];let stoppedEarly=false;
 // A fixed amount of work: every template, each in at most as many rounds as it has steps (one optional move left out
 // per round). The safety limit is checked between templates only, so what a template composes never depends on time.
 for(const t of templates){
  if(overdue()){stoppedEarly=true;break;}
  const drop=new Set<SiteMoveKind>();let concept:SiteConcept|undefined,built:Built={moves:[],skipped:[]},gap=0;
  for(let round=0;round<=t.steps.length;round++){
   ({built,concept,gap}=await build(t,drop,{},gap));if(!round)progress();
   if(!concept)break;
   // Over the budget: leave out the last optional move and compose again.
   const over=request.budget!==undefined&&concept.delta>request.budget,opt=[...built.moves].reverse().find(m=>t.steps.find(s=>s.kind===m.kind)?.optional);
   // A move that leaves the concept invalid is left out too, when it is optional: one its problems name, or the patio
   // whose bank still meets another in a step wherever it was placed.
   const c=concept,bad=!c.validation.ok&&[...built.moves].reverse().find(m=>t.steps.find(s=>s.kind===m.kind)?.optional&&(blames(c,m)||stepped(c)&&SPACED.has(m.kind)));
   const out=bad||(over?opt:undefined);if(!out)break;
   drop.add(out.kind);for(const s of t.steps)if(s.needs===out.kind)drop.add(s.kind);
   concept=undefined;
  }
  for(let i=0;i<t.steps.length;i++)progress();
  if(!concept){const why=built.skipped.filter(s=>t.steps.find(x=>x.kind===s.kind)?.anchor).map(s=>`${TITLES[s.kind]??s.kind}: ${s.reason}`);warnings.push(...why);continue;}
  if(request.budget!==undefined&&concept.delta>request.budget)warnings.push(`${concept.title}: ${money(concept.delta-request.budget)} over the ${money(request.budget)} budget even without its optional moves.`);
  // Distinct: a concept whose moves another already has is not repeated.
  const kinds=concept.moves.map(m=>m.kind).sort().join();if(concepts.some(c=>c.moves.map(m=>m.kind).sort().join()===kinds))continue;
  concepts.push(concept);
 }
 if(stoppedEarly){const limit=Math.max(1000,Number(request.budgetMs)||SAFETY_MS)/1000;warnings.push(`The site designer stopped early at its ${limit} s safety limit, so ${concepts.length} of the ${templates.length} concepts were composed; a faster device, or a smaller survey, composes them all.`);}
 const early=stoppedEarly?{stoppedEarly:true}:{};
 if(!concepts.length)return {status:'ready',brief,concepts:[],warnings:[...warnings,'No concept fits the measured ground yet.'],baseline:{subtotal:baseline.subtotal,quotes:[...baseline.quoteRequired]},...early};
 // Cost against the budget, or against each other; then honest ranking unless goals set the order.
 const deltas=concepts.map(c=>c.delta),lo=Math.min(...deltas),hi=Math.max(...deltas);
 for(const c of concepts){const rel=request.budget!==undefined?(c.delta<=0?1:Math.min(1,request.budget/c.delta)):hi>lo?1-(c.delta-lo)/(hi-lo):1;c.scores.cost=r2(Math.max(0,Math.min(1,rel-Math.min(.3,.01*c.newQuotes.length))));}
 if(!request.goals?.length)concepts.sort((a,b)=>(a.newQuotes.length?1:0)-(b.newQuotes.length?1:0)||a.delta-b.delta||order.indexOf(a.goal)-order.indexOf(b.goal));
 request.onProgress?.(total,total);
 if(signal?.aborted)return pending('Site concepts were cancelled.');
 return {status:'ready',brief,concepts:concepts.slice(0,MAX_CONCEPTS),warnings,baseline:{subtotal:baseline.subtotal,quotes:[...baseline.quoteRequired]},...early};
 } catch(e){if(e instanceof Cancelled)return pending('Site concepts were cancelled.');throw e;}
}
/** True when a validation problem names one of this move's features. */
function blames(c:SiteConcept,m:SiteMove){const names=[...m.parts.addYard.map(f=>f.name),...m.parts.addLandscape.map(o=>o.name)];return [...c.validation.unexplained,...c.validation.overlaps].some(w=>names.some(n=>w.includes(n)));}

const boundsText=(kind:SiteMoveKind,key:string)=>{const b=MOVE_PARAMS[kind][key];return typeof b[0]==='number'?`${b[0]}–${b[1]}`:(b as readonly string[]).join(', ');};
/**
 * Rebuilds one concept from the AI designer's choice exactly as the composer builds them: the base concept's template
 * with only the moves in `include` (in that order, but ground fit first and each dependent move after the move it
 * needs), each with its params inside MOVE_PARAMS, placed, priced and checked by the same code (calculateEstimate, a
 * save-and-reload round trip, measured ground, overlaps, unexplained ground and guard messages). Nothing is clamped
 * silently: a param out of bounds, an unknown move or concept, a move that cannot be placed, a validation failure or a
 * budget overrun becomes a finding for the AI's one revision turn. Deterministic: the same design and choice give the
 * same concept. The concept keeps the base concept's id and goal.
 */
export async function conceptFromChoice(data:DeckData,choice:SiteConceptChoice,request:SiteConceptsRequest={}):Promise<ConceptFromChoiceResult>{
 const signal=request.signal,pending=(...warnings:string[]):ConceptFromChoiceResult=>({status:'pending',concept:null,findings:[],warnings,brief:null});
 if(signal?.aborted)return pending('Site concepts were cancelled.');
 if(!data.siteModel)return pending('The site designer needs a measured site. Import or add survey points first.');
 const findings:string[]=[],template=TEMPLATES.find(t=>t.id===choice?.base);
 if(!template)return {status:'ready',concept:null,findings:[`There is no concept "${String(choice?.base).slice(0,40)}": choose one of ${TEMPLATES.map(t=>t.id).join(', ')}.`],warnings:[],brief:null};
 const asked:unknown[]=Array.isArray(choice.include)?choice.include:[],want:SiteMoveKind[]=[];
 for(const k of asked){if(!SITE_MOVE_KINDS.includes(k as SiteMoveKind)){findings.push(`There is no move "${String(k).slice(0,40)}": use ${SITE_MOVE_KINDS.join(', ')}.`);continue;}if(!want.includes(k as SiteMoveKind))want.push(k as SiteMoveKind);}
 // Params: only for the moves kept, each inside its bounds.
 const params:Params={};
 for(const k of want){const given=choice.params?.[k];if(!given||typeof given!=='object')continue;const kept:Record<string,MoveValue>={};
  for(const [key,value] of Object.entries(given)){
   if(!Object.hasOwn(MOVE_PARAMS[k],key)){findings.push(`${MOVE_INFO[k].title}: there is no "${key.slice(0,40)}" setting (use ${Object.keys(MOVE_PARAMS[k]).join(', ')}).`);continue;}
   if(!moveParamAllowed(k,key,value)){findings.push(`${MOVE_INFO[k].title}: ${key} ${String(JSON.stringify(value)).slice(0,40)} is outside ${boundsText(k,key)}.`);continue;}
   kept[key]=value;}
  if(Object.keys(kept).length)params[k]=kept;}
 // Order: ground fit first (it can change the landing the others start from), each dependent after what it needs.
 const order:SiteMoveKind[]=want.includes('ground-fit')?['ground-fit']:[];
 for(const k of want){if(order.includes(k))continue;const need=MOVE_NEEDS[k];
  if(need&&!want.includes(need)){findings.push(`${MOVE_INFO[k].title} needs the ${MOVE_INFO[need].title.toLowerCase()} in the same concept.`);continue;}
  if(need&&!order.includes(need))order.push(need);order.push(k);}
 if(!order.length){findings.push('Keep at least one move.');return {status:'ready',concept:null,findings,warnings:[],brief:null};}
 const t:Template={id:template.id,goal:template.goal,steps:order.map(kind=>({kind,...(ANCHORS.has(kind)?{anchor:true}:{}),...(MOVE_NEEDS[kind]?{needs:MOVE_NEEDS[kind]}:{})}))};
 try{
  const session=await openSession(data,request);
  if(typeof session==='string')return pending(session);
  const {brief,baseline,warnings,build}=session;
  // Built as the composer builds (a patio whose bank would meet another in a step is placed again with room round it).
  const {built,concept:made}=await build(t,new Set(),params);
  for(const s of built.skipped)findings.push(`${MOVE_INFO[s.kind].title}: ${s.reason}`);
  for(const k of order){const need=MOVE_NEEDS[k];if(need&&!built.moves.some(m=>m.kind===k)&&!built.skipped.some(s=>s.kind===k))findings.push(`${MOVE_INFO[k].title} was left out: the ${MOVE_INFO[need].title.toLowerCase()} could not be placed.`);}
  const baselineOut={subtotal:baseline.subtotal,quotes:[...baseline.quoteRequired]};
  if(!made)return {status:'ready',concept:null,findings:findings.length?findings:['None of the chosen moves can be placed here.'],warnings,brief,baseline:baselineOut};
  const concept=made;
  // Named as the base concept is when its anchor made it in.
  const named=template.steps.filter(s=>s.anchor).map(s=>built.moves.find(m=>m.kind===s.kind)).find(Boolean);if(named)concept.title=TITLES[named.kind]??named.title;
  const budget=choice.budget===null?undefined:typeof choice.budget==='number'?choice.budget:request.budget;
  concept.scores.cost=r2(Math.max(0,Math.min(1,(budget!==undefined?(concept.delta<=0?1:Math.min(1,budget/concept.delta)):1)-Math.min(.3,.01*concept.newQuotes.length))));
  const v=concept.validation;
  if(!v.priced)findings.push('The engine could not re-price this concept exactly: change a param.');
  if(!v.roundTrip)findings.push('This concept does not survive a save and reload: change a param.');
  if(!v.insideCoverage)findings.push('Part of a move stands off the measured ground: make it smaller or leave it out.');
  findings.push(...v.overlaps,...v.unexplained);
  if(budget!==undefined&&concept.delta>budget)findings.push(`It adds ${money(concept.delta)}, ${money(concept.delta-budget)} over the ${money(budget)} budget: leave out a move or make one smaller.`);
  if(signal?.aborted)return pending('Site concepts were cancelled.');
  return {status:'ready',concept,findings,warnings,brief,baseline:baselineOut};
 }catch(e){if(e instanceof Cancelled)return pending('Site concepts were cancelled.');throw e;}
}
const nameOf=(id:string,moves:SiteMove[])=>moves.flatMap(m=>[...m.parts.addYard,...m.parts.replaceYard,...m.parts.addLandscape]).find(f=>f.id===id)?.name??id;

/** Plain sentences for the homeowner, each citing the measured numbers behind it. */
function reasons(c:SiteConcept,brief:SiteBrief):string[]{
 const out:string[]=[],m=(k:SiteMoveKind)=>c.moves.find(x=>x.kind===k),st=brief.house.stairs[0];
 out.push(`Measured: ${brief.lines[0].charAt(0).toLowerCase()}${brief.lines[0].slice(1)}`);
 const gf=m('ground-fit');
 if(gf){const g=gf.metrics,earth=nums(g.bankCutYd3)+nums(g.bankFillYd3);out.push(`${st?.landing&&st.groundAtFootIn!==null?`The stair lands on the patio at ${signed(st.landing.finishedIn)} in over ground at ${signed(st.groundAtFootIn)} in. `:''}${gf.title}: ${g.risers===null?`the patio top at ${signed(nums(g.landingIn))} in`:`${g.risers} equal risers of ${g.riseIn} in from the deck at ${g.deckTopIn} in`}, ${nums(g.edgeLf)>0?`with a ${g.edgeLf} ft stone edge course (up to ${g.edgeMaxIn} in) instead of a fill bank`:earth<.01?'with almost no bank to grade':`with ${r2(earth)} yd³ of bank earthwork reaching ${g.bankRunIn} in`}.`);}
 const pl=m('planting');
 if(pl){const g=pl.metrics;out.push(`The high side is ${g.highSide}, where the measured ground reaches ${signed(brief.elevation.maxIn)} in at ${brief.elevation.highAt.label}: a ${g.lengthFt} ft bed follows the ${signed(nums(g.contourIn))} in contour there, with ${g.plants} shrubs and grasses.`);}
 const fr=m('fire-room');
 if(fr){const g=fr.metrics;out.push(`The flattest open ground within reach is the ${g.zoneKind} area${g.zone?` ${g.zone}`:''} (about ${g.zoneSqft} sq ft at ${g.zoneSlopePct} %), ${g.doorFt} ft from the door: the fire room patio sits there, level at ${signed(nums(g.levelIn))} in, where the ground varies ${g.reliefIn} in under it.`);
  out.push(g.fuel==='gas'?`Gas, not wood: Barrie needs no burn permit for gas, but an open wood fire needs a permit and 15 m from any building; the bowl stands ${g.houseGapFt} ft from the house and ${g.deckGapFt} ft from the deck (at least ${g.clearanceFt} ft).`:`The wood-burning ring stands ${g.houseGapFt} ft from the house and ${g.deckGapFt} ft from the deck (at least ${g.clearanceFt} ft, 4 m) and needs a yearly City of Barrie permit.`);}
 const sw=m('seat-wall');
 if(sw){const g=sw.metrics,up=nums(g.uphillGroundIn),lv=nums(g.patioLevelIn);out.push(`A ${g.builtHeightIn} in seat wall curves round the uphill side, ${r1(nums(g.radiusIn)/12)} ft from the fire${Number.isFinite(up)&&Number.isFinite(lv)?`, where the measured ground stands ${signed(up)} in, ${r1(up-lv)} in ${up>=lv?'above':'below'} the paving`:''}.`);}
 const rp=m('raised-patio');
 if(rp){const g=rp.metrics;out.push(`Beside the ${g.access} the measured ground falls to ${signed(nums(g.groundMinIn))} in, so a patio at its ${signed(nums(g.levelIn))} in level stands up to ${g.maxRiseIn} in above it: a ${g.wallLengthFt} ft wall (up to ${g.wallMaxIn} in) holds the side over ${g.threshold} in${g.guardRequired?`, and a guard is required past ${GUARD.requiredAboveIn} in`:`, under the ${GUARD.requiredAboveIn} in at which a guard is required`}.`);}
 const ss=m('stone-steps');
 if(ss){const g=ss.metrics;out.push(`${g.risers} stone step${nums(g.risers)>1?'s':''} of ${g.riseIn} in lead from the patio at ${signed(nums(g.topIn))} in down to the lawn at ${signed(nums(g.lowerIn))} in.`);}
 const tb=m('terraced-beds');
 if(tb){const g=tb.metrics;out.push(`The steepest open ground is in the ${g.zoneKind} area${g.zone?` ${g.zone}`:''} (about ${g.zoneSqft} sq ft at ${g.zoneSlopePct} %): there it falls ${g.fallIn} in at ${g.slopePct} %, so ${g.tiers} level beds step down it, held by ${g.wallHeightsIn} in walls${nums(g.plants)>0?` and planted with ${g.plants} shrubs and grasses`:''}.`);}
 const rb=m('raised-beds');
 if(rb){const g=rb.metrics;out.push(`${g.count} raised beds, ${g.raisedIn} in high${nums(g.plants)>0?` and planted with ${g.plants} low plants`:''}, sit ${g.houseGapFt} ft from the house on ${g.slopePct} % ground${g.sun?`; the midday sun is ${g.sun}`:''}.`);}
 // Counted as the card counts them: by what each quote line is for, not per wall or bed ("Terrace walls", not 32 lines).
 const added=quoteKindCount(c.newQuotes),q=added?` ${added} item${added>1?'s are':' is'} still to be quoted, so the price is not complete${c.delta<0?' and the saving is not final':''}.`:'';
 out.push(c.delta<-.005?`It prices ${money(c.delta)} less than the design as it stands (${money(c.subtotal)} before HST).${q}`:c.delta>.005?`It adds ${money(c.delta)} to the design as it stands (${money(c.subtotal)} before HST).${q}`:`It adds no priced work to the design as it stands (${money(c.subtotal)} before HST).${q}`);
 return out;
}
