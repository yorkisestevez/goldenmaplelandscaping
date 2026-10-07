import type {DeckData,YardFeature} from './types';
import {GROUND_FIT_LIMITS} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {designSiteSurface,siteDeckClearances} from './siteSurface';
import {ensureLiveDesignExtensions} from './designExtensions';
import {loadAdvancedYardRuntime} from './yardModel';
import {buildDeckTakeoff,type DeckTakeoff} from './deckTakeoff';
import {previewStairRefit} from './stairRefit';
import {STAIR_TARGET_LIMITS,stairTargetId} from './stairTargets';
import {calculateEstimate,type EstimateResult} from './calculations';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {editYardFinished} from './yardFinishedEdits';
import {validateDesign} from './designPersistence';
import {GROUND_FIT_RATES} from './groundFitRates';
import {yardFeatureOutline} from './yardPathGeometry';
import {extrasLayout} from './extrasLayout';
import {syncAutoLighting} from './lightingSystem';

/**
 * Ground fit options (G3): ways to make a patio, its stair and the deck meet the measured ground, each priced the way the
 * estimate prices the design. Read-only: an option is applied by sending its `patch` through the revision-guarded
 * controller (one request, one undo step). Lazy: loaded by the Ground fit panel and the `ground.fit` agent command only.
 * Every price reads against one baseline, the design as it stands now (`result.baseline`). The work runs in short slices
 * between yields to the event loop and within a time budget, so a big survey never freezes the page.
 */
export type GroundFitLever='level'|'stair'|'deck'|'edge';
export interface GroundFitMetrics {
 /** The patio's finished top at its centre (project datum, in). */
 landingIn:number;
 /** Equal risers down to the patio, and their rise (in); null when no stair lands on it. */
 risers:number|null;riseIn:number|null;
 deckTopIn:number;
 /** The stair's position along its deck edge (percent, as data.stairOffset); null when no stair lands on the patio. */
 stairOffsetPct:number|null;
 bankCutYd3:number;bankFillYd3:number;bankAreaSqft:number;
 /** Farthest the graded bank reaches from the patio edge (in). */
 bankRunIn:number;
 /** Stone edge course on a raised side (lowEdge 'stone'): its length (ft) and tallest exposed face (in, at most 16). */
 edgeLf:number;edgeMaxIn:number;
 status:'ready'|'partial';
}
export interface GroundFitOption {
 /** Stable within one result: 'current', 'level:3', 'stair:3', 'deck:2', 'edge', … */
 id:string;
 /** Which lever(s) this option pulls; 'current' is the design as it is, graded round the patio. */
 kind:'current'|GroundFitLever;
 /** Short owner-voice title, e.g. "Raise the landing to +7.5 in: 3 steps instead of 4". */
 title:string;
 /** Plain lines for the card: risers, levels, cut/fill, the bank's reach, quotes. */
 lines:string[];
 /** The design change, ready for design.patch (yardFeatures, stairTargets and, when moved, stairOffset/height). */
 patch:Partial<DeckData>;
 metrics:GroundFitMetrics;
 /** Priced subtotal (before HST) of the design with this option. */
 subtotal:number;
 /** subtotal less result.baseline.subtotal: the change from the design as it stands now. The same baseline for every
  * option, 'current' included (its delta is what grading round the patio adds), so baseline + delta = subtotal. */
 deltaFromCurrent:number;
 /** Lines still to be quoted with this option (labels), so a price is never read as complete when it is not. */
 quotes:string[];
}
/** The design as it stands now: the patio as saved (not fitted), lights settled as the page settles them. */
export interface GroundFitBaseline {subtotal:number;quotes:string[]}
/** `options` holds 'current' first, then the alternatives: those that add no work priced only by quote (a stone edge
 * course, or more bank earthwork while its rates are unset) before those that do, each group best priced first.
 * `baseline` (present when ready) is what every price reads against. */
export interface GroundFitResult {status:'ready'|'pending';featureId:string;options:GroundFitOption[];warnings:string[];baseline?:GroundFitBaseline}
/** `budgetMs`: the time limit (default 4000 ms); the search stops at 45 % of it and pricing at all of it, each keeping
 * what it has and saying so in a warning. `onYield` (instrumentation): at each yield to the event loop, the work since
 * the last one (ms), how much of it went to engine calls (a surface, an estimate, a stair refit), how many ran and the
 * longest of them. A slice holds at most about 40 ms of work besides its longest call. */
export interface GroundFitRequest {featureId:string;levers?:Partial<Record<GroundFitLever,boolean>>;maxOptions?:number;budgetMs?:number;signal?:AbortSignal;onProgress?:(done:number,total:number)=>void;onYield?:(slice:{ms:number;engineMs:number;calls:number;longestMs:number})=>void}

/** Level grid, slide step along the deck edge, search span beyond the ground under the patio, and the fill reach past
 * which a stone edge is offered (all in). */
const GRID=.25,STEP_IN=3,SPAN=6,EDGE_REACH_IN=36,FULL_RUNS=12,MID_RISE=6.3125;
/** Tallest exposed face (in) a stone edge course holds: two courses. Taller is a retaining wall, so it is not offered. */
const EDGE_MAX_IN=16;
/** Time: the whole budget, the search's share of it (each lever stops at its share of that), and the work between yields. */
const BUDGET_MS=4000,SEARCH_SHARE=.45,SLICE_MS=40,LEVER_SHARE={level:.45,stair:.7,deck:.85,edge:1} as const;
/** The patio's own ground messages (G1): the ground beside it above its top (cut side), or its top standing up (fill side). */
const CONTACT=/^(?:the measured ground beside it is up to ([\d.]+) in above|its finished surface stands up to ([\d.]+) in above)/;
const JUMP=/^(\d+) proposed grading boundary span\(s\) change elevation abruptly \(maximum ([\d.]+) in\)/;
const CLEARANCE=/intersects|covers a deck|meets proposed ground/i,STAIR_ISSUE=/\brises?\b|\btreads?\b/i;
const snapUp=(v:number)=>Math.ceil(v/GRID-1e-9)*GRID,snapDown=(v:number)=>Math.floor(v/GRID+1e-9)*GRID,r4=(v:number)=>Math.round(v*1e4)/1e4,r6=(v:number)=>Math.round(v*1e6)/1e6;
const num=(v:number)=>String(+v.toFixed(2)),lvl=(v:number)=>`${v<-.004?'−':'+'}${num(Math.abs(v))} in`,yd=(v:number)=>v<.005&&v>0?'under 0.01':v.toFixed(2);
const reach=(inches:number)=>inches>=24?`${num(inches/12)} ft`:`${num(inches)} in`;
interface Bank {status:'ready'|'partial';cut:number;fill:number;area:number;run:number;fillRun:number}
type Goal='earth'|'balance'|'area';
const earth=(b:Bank)=>b.cut+b.fill;
/** Ready (inside measured ground) first, then the goal, then less earthwork, then a shorter bank. */
const key=(b:Bank,goal:Goal)=>[b.status==='ready'?0:1,goal==='earth'?r4(earth(b)):goal==='balance'?r4(Math.abs(b.cut-b.fill)):Math.round(b.area*100)/100,r4(earth(b)),Math.round(b.run*100)/100];
const compare=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
/** A fill bank too wide to leave: one reaching past 3 ft. */
const wideBank=(b:Bank)=>b.fill>.0005&&b.fillRun>EDGE_REACH_IN;
/** Bank earthwork the estimate cannot price yet (yd³): the cut or the fill whose company rate is not set. */
const unpricedEarth=(m:GroundFitMetrics)=>(GROUND_FIT_RATES.cutHaulPerYd3===null?m.bankCutYd3:0)+(GROUND_FIT_RATES.fillCompactionPerYd3===null?m.bankFillYd3:0);
const inLimits=(rise:number)=>rise>=STAIR_TARGET_LIMITS.minRiseIn-1e-6&&rise<=STAIR_TARGET_LIMITS.maxRiseIn+1e-6;
interface Spot {key:string;dx:number;dz:number;offset:number|null;n:number|null;gmin:number;gmax:number}
/** `from`: for a stone-edge variant, the lever of the option it adds the edge to (undefined: the current design). */
interface Candidate {id:string;kind:GroundFitLever;from?:GroundFitLever;pick?:Goal;spot:Spot;n:number|null;e:number;deckTop:number;edge:boolean;bank:Bank}
class Cancelled extends Error {}
/** Hand the event loop a turn: scheduler.yield where the browser has it, else a message (not throttled in a hidden
 * tab the way timers are), else a timer. */
function yieldNow():Promise<void>{
 const s=(globalThis as {scheduler?:{yield?:()=>Promise<void>}}).scheduler;if(typeof s?.yield==='function')return s.yield();
 if(typeof MessageChannel==='function')return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();resolve();};c.port2.postMessage(0);});
 return new Promise(resolve=>setTimeout(resolve,0));
}

/** Every lever is on by default; at most `maxOptions` (default 4) options besides 'current', each distinct in what it
 * changes and none beaten on price, quotes, earthwork and survey coverage by another. */
export async function groundFitOptions(data:DeckData,request:GroundFitRequest):Promise<GroundFitResult>{
 const id=request.featureId,signal=request.signal,on=(l:GroundFitLever)=>request.levers?.[l]!==false,max=Math.max(1,Math.min(8,Math.floor(Number(request.maxOptions??4))||4));
 const pending=(...warnings:string[]):GroundFitResult=>({status:'pending',featureId:id,options:[],warnings});
 const cancelled=()=>pending('Ground fit options were cancelled.');
 if(signal?.aborted)return cancelled();
 if(!data.siteModel)return pending('Ground fit needs a measured site. Import or add survey points first.');
 const patio=data.yardFeatures?.find(f=>f.id===id);
 if(!patio||patio.kind!=='patio'||!patio.enabled)return pending('Choose an enabled patio to fit to the measured ground.');
 if(patio.stoneSteps||patio.stepAssembly)return pending('Steps keep their own ground. Ground fit works on a flat patio.');
 await ensureLiveDesignExtensions(data);await loadAdvancedYardRuntime();
 if(signal?.aborted)return cancelled();
 // Time: the search stops at its share of the budget (each lever at its own share of that) and pricing at the whole
 // budget. Expensive calls (a surface, an estimate, a stair refit) run one at a time after a yield, and the abort
 // signal is checked at every yield.
 const budget=Math.max(200,Number(request.budgetMs)||BUDGET_MS),start=performance.now(),deadline=start+budget,searchEnd=(l:keyof typeof LEVER_SHARE)=>start+budget*SEARCH_SHARE*LEVER_SHARE[l];
 let last=start,heavy=0,engineMs=0,calls=0,longestMs=0;
 const tick=async(force=false)=>{const now=performance.now();if(force||now-last+heavy>SLICE_MS){request.onYield?.({ms:now-last,engineMs,calls,longestMs});engineMs=0;calls=0;longestMs=0;await yieldNow();last=performance.now();}if(signal?.aborted)throw new Cancelled();};
 const timed=async<T>(f:()=>T):Promise<T>=>{await tick();const t=performance.now();try{return f();}finally{const d=performance.now()-t;heavy=Math.max(heavy/2,d);engineMs+=d;calls++;longestMs=Math.max(longestMs,d);}};
 try{
 await tick(true);
 let fitted:YardFeature;
 try{fitted=patio.groundFit&&typeof patio.finishedElevationIn==='number'?patio:editYardFinished(data,patio,{action:'groundFit',slopeRatio:GROUND_FIT_LIMITS.defaultRatio});}catch(e){return pending((e as Error).message);}
 const withPatio=(f:YardFeature,extra:Partial<DeckData>={}):DeckData=>({...data,...extra,yardFeatures:data.yardFeatures!.map(x=>x.id===id?f:x)});
 const current=withPatio(fitted),surface0=await timed(()=>designSiteSurface(current));
 if(!surface0)return pending('Ground fit needs a measured site. Import or add survey points first.');
 const e0=fitted.finishedElevationIn!,ratio=fitted.groundFit!.slopeRatio,baseEdge=fitted.groundFit!.lowEdge==='stone',warnings:string[]=[];
 const outline0=yardFeatureOutline(fitted),targets=(data.stairTargets??[]).filter(t=>t.surface==='patio'&&t.patioId===id);
 if(targets.length>1)warnings.push('More than one stair lands on this patio, so its level and place stay as they are.');
 const target=targets.length===1?targets[0]:undefined;

 // The stair that lands on the patio: its foot, the deck top it leaves from, and where its foot goes for other counts.
 const group=(tk:DeckTakeoff,fid:string)=>tk.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===fid);
 const footOf=(tk:DeckTakeoff,fid:string)=>{const g=group(tk,fid);if(!g.length)return;const low=Math.min(...g.map(f=>f.end.y)),t=g.filter(f=>Math.abs(f.end.y-low)<1e-5),f=t[0],len=Math.hypot(f.end.x-f.start.x,f.end.z-f.start.z)||1;
  return {x:t.reduce((n,f)=>n+f.end.x,0)/t.length,z:t.reduce((n,f)=>n+f.end.z,0)/t.length,upper:Math.max(...g.map(f=>f.start.y)),outward:f.outward??{x:(f.end.x-f.start.x)/len,y:(f.end.z-f.start.z)/len}};};
 const tk0=await timed(()=>buildDeckTakeoff(current)),foot0=target?footOf(tk0,target.flightId):undefined;
 if(target&&!foot0)warnings.push('The stair that lands on this patio is not in the current layout, so only the patio level is fitted.');
 const stair=target&&foot0?{fid:target.flightId,n:target.riserCount,foot:foot0,upper:foot0.upper,
  depth:Math.min(120,Math.max(36,snapDown(Math.max(...outline0.flat().map(p=>(p.x-foot0.x)*foot0.outward.x+(p.y-foot0.z)*foot0.outward.y))-.05)))}:undefined;
 const n0=stair?.n??null,D0=stair?.upper??data.height,sill=data.houseConfig?.floorHeightIn;
 const feet=new Map<number,{x:number;z:number}|null>();
 const footFor=(n:number)=>{if(!stair)return null;if(n===stair.n)return stair.foot;if(feet.has(n))return feet.get(n)!;const f=footOf(buildDeckTakeoff({...current,stairTargets:data.stairTargets!.map(t=>t.flightId===stair.fid?{...t,riserCount:n,elevationIn:stair.upper-n*MID_RISE}:t)}),stair.fid)??null;feet.set(n,f);return f;};
 const offset0=data.stairOffset??50;let travel:{x:number;z:number;len:number}|undefined;
 if(stair&&on('stair')&&!data.stairPath){const a=footOf(await timed(()=>buildDeckTakeoff({...current,stairOffset:0})),stair.fid),b=footOf(await timed(()=>buildDeckTakeoff({...current,stairOffset:100})),stair.fid);
  if(a&&b){const v={x:b.x-a.x,z:b.z-a.z,len:Math.hypot(b.x-a.x,b.z-a.z)};if(v.len>=STEP_IN&&Math.hypot(a.x+v.x*offset0/100-stair.foot.x,a.z+v.z*offset0/100-stair.foot.z)<.5)travel=v;}}

 // Where the patio sits for a stair position and riser count, and the measured ground under it there.
 const spots=new Map<string,Spot|null>();
 const shifted=(dx:number,dz:number)=>outline0.map(r=>r.map(p=>({x:p.x+dx,y:p.y+dz})));
 const spot=(offset:number|null,n:number|null):Spot|null=>{const k=`${offset}|${n}`;if(spots.has(k))return spots.get(k)!;let dx=0,dz=0;
  if(stair&&n!==null){const f=footFor(n);if(!f){spots.set(k,null);return null;}dx=f.x-stair.foot.x;dz=f.z-stair.foot.z;if(offset!==null&&travel){dx+=travel.x*(offset-offset0)/100;dz+=travel.z*(offset-offset0)/100;}}
  dx=(r6(fitted.xFt+dx/12)-fitted.xFt)*12;dz=(r6(fitted.zFt+dz/12)-fitted.zFt)*12;
  const g=surface0.extrema(shifted(dx,dz),'existing'),s=g.complete&&Number.isFinite(g.min)&&Number.isFinite(g.max)?{key:k,dx,dz,offset,n,gmin:g.min,gmax:g.max}:null;spots.set(k,s);return s;};
 const patioAt=(s:Spot,e:number,edge:boolean):YardFeature=>({...fitted,xFt:r6(fitted.xFt+s.dx/12),zFt:r6(fitted.zFt+s.dz/12),finishedElevationIn:e,groundFit:{...fitted.groundFit!,...(edge?{lowEdge:'stone' as const}:{})}});

 // Bank metrics straight from the design surface (cached). Past a lever's share of the search time an evaluation not
 // yet made returns null, so the search keeps what it has found.
 const banks=new Map<string,Bank|null>();let exhausted=false;
 const bank=async(s:Spot,e:number,edge=false,until=Infinity):Promise<Bank|null>=>{const k=`${s.key}|${e}|${edge}`;if(banks.has(k))return banks.get(k)!;if(performance.now()>until){exhausted=true;return null;}
  const m=(await timed(()=>designSiteSurface(withPatio(patioAt(s,e,edge)))?.featurePadModels))?.find(m=>m.featureId===id),b=m&&m.status!=='pending'?{status:m.status,cut:m.cutYd3,fill:m.fillYd3,area:m.areaSqft,run:m.runIn,fillRun:(m as {fillRunIn?:number}).fillRunIn??m.runIn}:null;banks.set(k,b);return b;};
 /** Levels on the 0.25 in grid in [lo, hi] (within SPAN of the ground under the patio), 1 in apart (2 in on a wide
  * range), nearest the middle of that ground first. */
 const coarse=(s:Spot,lo:number,hi:number)=>{lo=snapUp(Math.max(lo,s.gmin-SPAN));hi=snapDown(Math.min(hi,s.gmax+SPAN));if(lo>hi+1e-9)return;
  const step=hi-lo>24?2:1,levels=new Set([lo,hi]);for(let v=Math.ceil(lo/step)*step;v<hi;v+=step)if(v>lo)levels.add(v);
  const mid=(s.gmin+s.gmax)/2;return {lo,hi,step,levels:[...levels].sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid)||a-b)};};
 /** The best level on the grid: every coarse level, then refined round the best; `probe` tries only the first. The
  * pick never depends on the order levels are tried in (ties go to the level nearer the current one, then the lower). */
 const bestLevel=async(s:Spot,lo:number,hi:number,goal:Goal='earth',until=Infinity,probe=false)=>{
  const c=coarse(s,lo,hi);if(!c)return;let best:{e:number;bank:Bank}|undefined;
  const consider=async(e:number)=>{e=r4(e);if(e<c.lo-1e-9||e>c.hi+1e-9)return;const b=await bank(s,e,false,until);if(!b)return;const k=best?compare(key(b,goal),key(best.bank,goal)):-1;if(k<0||k===0&&(Math.abs(e-e0)<Math.abs(best!.e-e0)||Math.abs(e-e0)===Math.abs(best!.e-e0)&&e<best!.e))best={e,bank:b};};
  for(const v of probe?c.levels.slice(0,1):c.levels)await consider(v);
  if(!best||probe)return best;const at=best.e;for(let d=GRID;d<c.step;d+=GRID){await consider(at-d);await consider(at+d);}return best;};
 /** Several searches: each one's likeliest level first (so a search cut short still has one for every riser count),
  * then each in full. */
 const searchAll=async(plans:{s:Spot;lo:number;hi:number;goal?:Goal}[],until:number)=>{for(const p of plans)await bestLevel(p.s,p.lo,p.hi,p.goal,until,true);const out:({e:number;bank:Bank}|undefined)[]=[];for(const p of plans)out.push(await bestLevel(p.s,p.lo,p.hi,p.goal,until));return out;};
 const rise=(n:number,D:number)=>[D-STAIR_TARGET_LIMITS.maxRiseIn*n,D-STAIR_TARGET_LIMITS.minRiseIn*n] as const;
 const g0=spot(null,n0);if(!g0)return pending('The patio is not wholly inside the measured ground. Extend the survey under it first.');
 const currentBank=await bank(g0,e0);
 /** Riser counts worth trying at a stair position: the fewest that reach a landing near the ground, up to one past the
 * count that lands at the ground's middle (at most four). */
 const counts=async(offset:number|null,D:number)=>{const out:Spot[]=[];let first:number|undefined,mid:number|undefined;
  for(let n=Math.max(1,Math.ceil((D-g0.gmax-SPAN-12)/STAIR_TARGET_LIMITS.maxRiseIn));n<=STAIR_TARGET_LIMITS.maxRisers;n++){await tick();
   const [a,b]=rise(n,D);if(a>g0.gmax+SPAN+12)continue;if(b<g0.gmin-SPAN-12)break;const s=spot(offset,n);if(!s)continue;if(a>s.gmax+SPAN)continue;if(b<s.gmin-SPAN)break;
   if(snapUp(Math.max(a,s.gmin-SPAN))>snapDown(Math.min(b,s.gmax+SPAN)))continue;first??=n;out.push(s);const gm=(s.gmin+s.gmax)/2;if(mid===undefined&&a<=gm&&gm<=b)mid=n;if(n>=first+3||mid!==undefined&&n>=mid+1)break;}
  return out;};
 let counted:Spot[]|undefined;const countsNow=async()=>counted??=await counts(null,D0);
 const candidates:Candidate[]=[],seen=new Set<string>();
 const add=(c:Omit<Candidate,'edge'>&{edge?:boolean})=>{const k=JSON.stringify([c.n,c.e,c.spot.offset,c.deckTop,!!c.edge]);if(seen.has(k)||!c.edge&&c.spot.key===g0.key&&c.e===e0&&c.deckTop===D0)return;seen.add(k);candidates.push({...c,edge:!!c.edge});};
 const riseWindow=(s:Spot,D:number)=>{const [lo,hi]=rise(s.n!,D);return {s,lo,hi};};

 // Level lever: the landing (with the stair's riser count) or the patio alone.
 if(on('level')&&targets.length<=1){
  if(stair){const ss=await countsNow(),found=await searchAll(ss.map(s=>riseWindow(s,D0)),searchEnd('level'));
   ss.forEach((s,i)=>{const best=found[i];if(best)add({id:`level:${s.n}`,kind:'level',spot:s,n:s.n,e:best.e,deckTop:D0,bank:best.bank});});}
  else{const goals=['earth','balance','area'] as const,found=await searchAll(goals.map(goal=>({s:g0,lo:-Infinity,hi:Infinity,goal})),searchEnd('level'));
   goals.forEach((goal,i)=>{const best=found[i];if(best)add({id:`level:${goal}`,kind:'level',pick:goal,spot:g0,n:null,e:best.e,deckTop:D0,bank:best.bank});});}
 }
 // Stair lever: slide the stair (and its landing) along the deck edge, ~3 in at a time; prune by the ground under it.
 if(stair&&travel&&targets.length===1){
  const step=STEP_IN/travel.len*100,offsets:number[]=[];for(let k=-Math.floor(offset0/step);offset0+k*step<=100+1e-9;k++)if(k)offsets.push(Math.min(100,Math.max(0,Math.round((offset0+k*step)*100)/100)));
  const plans:{n:number;picks:Spot[]}[]=[];
  for(const n of (await countsNow()).map(s=>s.n!)){
   const ranked:{s:Spot;o:number;proxy:number[]}[]=[];
   for(const o of offsets){await tick();const s=spot(o,n);if(!s)continue;const [a,b]=rise(n,D0),lo=Math.max(a,s.gmin-SPAN),hi=Math.min(b,s.gmax+SPAN);if(lo>hi)continue;
    const e=Math.min(hi,Math.max(lo,(s.gmin+s.gmax)/2)),h=Math.max(s.gmax-e,e-s.gmin),r=Math.min(GROUND_FIT_LIMITS.maxBankRunIn,h*ratio),xs=shifted(s.dx,s.dz).flat(),box=[{x:Math.min(...xs.map(p=>p.x))-r,y:Math.min(...xs.map(p=>p.y))-r},{x:Math.max(...xs.map(p=>p.x))+r,y:Math.min(...xs.map(p=>p.y))-r},{x:Math.max(...xs.map(p=>p.x))+r,y:Math.max(...xs.map(p=>p.y))+r},{x:Math.min(...xs.map(p=>p.x))-r,y:Math.max(...xs.map(p=>p.y))+r}] as PlanPoint[];
    ranked.push({s,o,proxy:[surface0.extrema([box],'existing').complete?0:1,r4(h),Math.abs(o-offset0)]});}
   ranked.sort((a,b)=>compare(a.proxy,b.proxy));
   const picked:typeof ranked=[];for(const r of ranked){if(picked.length>=2)break;if(picked.every(p=>Math.abs(p.o-r.o)*travel!.len/100>=12-1e-6))picked.push(r);}
   plans.push({n,picks:picked.map(p=>p.s)});
  }
  const found=await searchAll(plans.flatMap(p=>p.picks.map(s=>riseWindow(s,D0))),searchEnd('stair'));let k=0;
  for(const p of plans){let best:Candidate|undefined;for(const s of p.picks){const b=found[k++];if(b&&(!best||compare(key(b.bank,'earth'),key(best.bank,'earth'))<0))best={id:`stair:${p.n}`,kind:'stair',spot:s,n:p.n,e:b.e,deckTop:D0,bank:b.bank,edge:false};}if(best)add(best);}
 }
 // Deck lever: a deck top 1–4 in below the door sill that lets a riser count reach its least-earthwork landing. Other
 // stairs that keep a set riser count follow the deck top, so only tops that keep their rise within limits are tried.
 if(stair&&on('deck')&&typeof sill==='number'&&Number.isFinite(sill)&&(data.levels??1)===1&&Math.abs(stair.upper-data.height)<1e-6&&targets.length===1){
  const others=(data.stairTargets??[]).filter(t=>t.flightId!==stair.fid&&t.riserCount>0&&group(tk0,t.flightId).some(f=>Math.abs(f.start.y-D0)<1e-6)&&inLimits((D0-t.elevationIn)/t.riserCount));
  const tops:number[]=[];for(let D=snapUp(sill-4);D<=snapDown(sill-1)+1e-9;D=r4(D+GRID))if(Math.abs(D-D0)>1e-9&&others.every(t=>inLimits((D-t.elevationIn)/t.riserCount)))tops.push(D);
  if(tops.length){
   const ss=await countsNow(),stars=await searchAll(ss.map(s=>({s,lo:-Infinity,hi:Infinity})),searchEnd('deck')),plans:{s:Spot;n:number;D:number}[]=[];
   ss.forEach((s,i)=>{const n=s.n!,star=stars[i];if(!star)return;const [a,b]=rise(n,D0);if(star.e>=a-1e-9&&star.e<=b+1e-9)return;
    const gap=(D:number)=>{const [lo,hi]=rise(n,D);return star.e<lo?lo-star.e:star.e>hi?star.e-hi:0;};plans.push({s,n,D:[...tops].sort((p,q)=>gap(p)-gap(q)||Math.abs(p-D0)-Math.abs(q-D0))[0]});});
   const found=await searchAll(plans.map(p=>riseWindow(p.s,p.D)),searchEnd('deck'));
   plans.forEach((p,i)=>{const best=found[i];if(best)add({id:`deck:${p.n}`,kind:'deck',spot:p.s,n:p.n,e:best.e,deckTop:p.D,bank:best.bank});});
  }
 }
 // Stone edge lever: where a fill bank reaches past 3 ft or runs off the survey, a stone edge holds the raised side, as
 // long as its face stays within two courses (16 in); taller is a retaining wall and is not offered.
 const cappedEdge:{h:number;exact:boolean}[]=[];
 if(on('edge')&&!baseEdge){
  const wantsEdge=(b:Bank|null)=>!!b&&b.fill>.0005&&(b.fillRun>EDGE_REACH_IN||b.status==='partial'),bases=[...(currentBank?[{id:'current',kind:undefined,spot:g0,n:n0,e:e0,deckTop:D0,bank:currentBank}]:[]),...candidates.slice()].filter(b=>wantsEdge(b.bank));
  let edgeOk=false;try{validateYardFinishedSettings({...fitted,groundFit:{...fitted.groundFit!,lowEdge:'stone'}});edgeOk=true;}catch{/* this build has no stone edge yet */}
  if(!edgeOk&&bases.length)warnings.push('A stone edge instead of the fill bank is not available in this version yet.');
  // The top stands at least (top − highest ground under it) over the ground somewhere on its edge: past two courses
  // that is certainly a wall (a sloped patio is measured when priced instead).
  const flat=!fitted.patioSlope||!fitted.patioSlope.xPct&&!fitted.patioSlope.zPct;
  // Only where the edge takes fill out of the bank (a build that accepts lowEdge but still banks offers nothing).
  if(edgeOk)for(const b of bases){if(flat&&b.e-b.spot.gmax>EDGE_MAX_IN){cappedEdge.push({h:b.e-b.spot.gmax,exact:false});continue;}
   const eb=await bank(b.spot,b.e,true,searchEnd('edge'));if(eb&&eb.fill<b.bank.fill-1e-4)add({id:b.id==='current'?'edge':`${b.id}+edge`,kind:'edge',from:b.kind,spot:b.spot,n:b.n,e:b.e,deckTop:b.deckTop,bank:eb,edge:true});}
 }

 // Shortlist: round-robin over the levers (each by least bank, then fewer risers), then price each in full.
 const byLever=(['level','stair','edge','deck'] as const).map(l=>candidates.filter(c=>c.kind===l).sort((a,b)=>compare([a.bank.status==='ready'?0:1,a.n??0,Math.round(a.bank.area*100)/100,r4(earth(a.bank))],[b.bank.status==='ready'?0:1,b.n??0,Math.round(b.bank.area*100)/100,r4(earth(b.bank))])||a.id.localeCompare(b.id)));
 const shortlist:Candidate[]=[];for(let i=0;shortlist.length<FULL_RUNS&&byLever.some(l=>l.length>i);i++)for(const l of byLever)if(l[i]&&shortlist.length<FULL_RUNS)shortlist.push(l[i]);
 const total=shortlist.length+2;request.onProgress?.(1,total);await tick(true);
 /** Priced the way the page settles a design: post, stair and screen lights follow the modelled mounts first (the
  * estimate's own model is this takeoff, so one estimate prices the settled design). */
 const settle=async(design:DeckData)=>{const model=await timed(()=>buildDeckTakeoff(design)),ex=extrasLayout(design,model),items=syncAutoLighting(design,{posts:model.railing.posts.length,stairs:model.treads.length,privacy:ex.privacyMounts.length,border:ex.borderMounts.length});
  const next=JSON.stringify(items)===JSON.stringify(design.lightingSystem.selectedItems)?design:{...design,lightingSystem:{...design.lightingSystem,selectedItems:items}};return {design:next,est:await timed(()=>calculateEstimate(next))};};
 const lit=(design:DeckData,patch:Partial<DeckData>)=>design.lightingSystem===data.lightingSystem?patch:{...patch,lightingSystem:design.lightingSystem};
 const settledNow=await settle(data),settledFit=patio===fitted?settledNow:await settle(current),baseline=settledNow.est,fittedNow=settledFit.est;
 request.onProgress?.(2,total);
 const quoteRates=GROUND_FIT_RATES.cutHaulPerYd3===null||GROUND_FIT_RATES.fillCompactionPerYd3===null;
 const clearance=(est:EstimateResult)=>est.yardModel.warnings.filter(w=>CLEARANCE.test(w));
 const clearance0=new Set(clearance(fittedNow));
 /** This patio's own ground messages, tallest by side; another patio's never count. */
 const contactOf=(est:EstimateResult)=>{const out={above:-Infinity,below:-Infinity};for(const w of est.yardModel.warnings){if(!w.startsWith(`${patio.name}: `))continue;const m=CONTACT.exec(w.slice(patio.name.length+2));if(m){if(m[1]!==undefined)out.above=Math.max(out.above,Number(m[1]));else out.below=Math.max(out.below,Number(m[2]));}}return out;};
 /** Grading boundaries that jump in level: how many and the largest jump (in). */
 const jumpOf=(est:EstimateResult)=>{let count=0,most=0;for(const w of est.yardModel.warnings){const m=JUMP.exec(w);if(m){count+=Number(m[1]);most=Math.max(most,Number(m[2]));}}return {count,most};};
 const contact0=contactOf(fittedNow),jump0=jumpOf(fittedNow);
 /** True when the option leaves this patio's ground worse than the fitted current design: ground beside it above its top
  * (cut side) and, unless a stone edge holds it, its top standing up (fill side), each new or taller than now. */
 const worseContact=(est:EstimateResult,edge:boolean)=>{const c=contactOf(est);return c.above>contact0.above+.05||!edge&&c.below>contact0.below+.05;};
 /** Stair messages about rises or treads, and flights whose rise is outside the limits, in the design as it starts. */
 const tkStart=patio===fitted?tk0:await timed(()=>buildDeckTakeoff(data)),stairIssues0=new Set(tkStart.issues.filter(i=>STAIR_ISSUE.test(i)));
 const offRise=(tk:DeckTakeoff)=>tk.flights.filter(f=>f.risers>0&&!inLimits(f.rise)).map(f=>f.id),offRise0=new Set(offRise(tkStart));
 let clearBefore:Set<string>|undefined;
 const edgeOf=(est:EstimateResult)=>{const q=est.yardModel.features.find(f=>f.config.id===id)?.quantities??{};return {lf:Number(q.edgeCourseLf)||0,maxIn:Number(q.edgeCourseMaxIn)||0};};
 const metricsOf=(c:{n:number|null;e:number;deckTop:number;offset:number|null;bank:Bank;riseIn:number|null},est:EstimateResult):GroundFitMetrics=>{const edge=edgeOf(est);
  return {landingIn:c.e,risers:c.n,riseIn:c.riseIn,deckTopIn:c.deckTop,stairOffsetPct:stair?c.offset:null,bankCutYd3:c.bank.cut,bankFillYd3:c.bank.fill,bankAreaSqft:c.bank.area,bankRunIn:c.bank.run,edgeLf:edge.lf,edgeMaxIn:edge.maxIn,status:c.bank.status};};
 const bankLine=(b:Bank,edge=false)=>earth(b)<.0005&&b.area<.05?(edge?'No bank to grade: the stone edge holds the raised side.':'The measured ground already meets the patio edge; no bank to grade.'):`Bank: ${yd(b.cut)} yd³ cut and ${yd(b.fill)} yd³ fill, reaching ${reach(b.run)} from the patio edge${b.status==='partial'?'; part of it runs past the measured ground, so extend the survey there':''}.`;
 const quoteLine=(b:Bank,edge:{lf:number;maxIn:number})=>[...(edge.lf>0?[`Stone edge course: ${num(edge.lf)} ft, up to ${num(edge.maxIn)} in exposed (builder quote).`]:[]),...(earth(b)>=.0005&&quoteRates?['Earthwork priced by quote until your rates are set.']:[])];
 const what=stair?'landing':'patio',riseOf=(n:number|null,e:number,D:number)=>n?(D-e)/n:null;

 const curRise=stair?riseOf(n0,target!.elevationIn,D0):null,curMetrics=metricsOf({n:n0,e:e0,deckTop:D0,offset:stair?offset0:null,bank:currentBank??{status:'partial',cut:0,fill:0,area:0,run:0,fillRun:0},riseIn:curRise},fittedNow),curEdge=edgeOf(fittedNow);
 if(!currentBank)warnings.push('The ground round the patio as it stands could not be graded; extend the survey round it.');
 const cents=(v:number)=>Math.round(v*100)/100;
 const currentOption:GroundFitOption={id:'current',kind:'current',
  title:patio===fitted?`Keep the ${what} at ${lvl(e0)} as it is graded now`:`Keep the ${what} at ${lvl(e0)} and grade the ground round it`,
  lines:[...(stair?[`${n0} risers of ${num(curRise!)} in from the deck at ${num(D0)} in.`]:[`Patio top at ${lvl(e0)}.`]),...(currentBank?[bankLine(currentBank)]:[]),...(currentBank?quoteLine(currentBank,curEdge):[])].slice(0,4),
  patch:lit(settledFit.design,patio===fitted?{}:{yardFeatures:current.yardFeatures}),metrics:curMetrics,subtotal:fittedNow.subtotal,deltaFromCurrent:cents(fittedNow.subtotal-baseline.subtotal),quotes:[...fittedNow.quoteRequired]};

 const options:GroundFitOption[]=[],bankOf=new Map<string,Bank>([['current',currentBank??{status:'partial',cut:0,fill:0,area:0,run:0,fillRun:0}]]);let done=2,pricingCut=0;
 for(const [i,c] of shortlist.entries()){
  // Past the budget, keep what is priced (pricing on a little while nothing at all has come through).
  if(performance.now()>deadline&&(options.length||performance.now()>deadline+budget/4)){pricingCut=shortlist.length-i;break;}
  await tick();
  try{
   const f=validateYardFinishedSettings(patioAt(c.spot,c.e,c.edge)),moved=c.spot.offset!==null&&c.spot.offset!==offset0,extra:Partial<DeckData>={...(moved?{stairOffset:c.spot.offset!}:{}),...(c.deckTop!==D0?{height:c.deckTop}:{})};
   let design=withPatio(f,extra),riseIn:number|null=null;const patch:Partial<DeckData>={yardFeatures:design.yardFeatures,...extra};
   // The design's ground first, on its own (the refit, takeoff and estimate below then find it cached).
   const surface=(await timed(()=>designSiteSurface(design)))!;
   if(stair&&c.n!==null){
    const seeded={...design,stairTargets:data.stairTargets!.map(t=>t.flightId===stair.fid?{...t,elevationIn:c.e,riserCount:c.n!}:t)},refit=await timed(()=>previewStairRefit(seeded,{flightId:stair.fid,surface:'patio',patioId:id,landingDepthIn:stair.depth})),p=refit.proposals[0];
    if(refit.status!=='ready'||!p||p.target.riserCount!==c.n||Math.abs(p.target.elevationIn-c.e)>.01)continue;
    patch.stairTargets=refit.patch.stairTargets;design={...design,stairTargets:refit.patch.stairTargets};riseIn=p.riseIn;
   }
   if(c.deckTop!==D0){const tk=await timed(()=>buildDeckTakeoff(design));if(tk.foundationSupports.some(s=>tk.levels[s.levelIndex]?.kind==='deck'&&s.status==='clearance-pending'))continue;
    clearBefore??=new Set(await timed(()=>siteDeckClearances(surface0,tk0,current).warnings));const after=await timed(()=>siteDeckClearances(surface,tk,design).warnings);if(after.some(w=>/framing|stringer/i.test(w)&&!clearBefore!.has(w)))continue;}
   validateDesign(design);
   const settled=await settle(design),est=settled.est,model=est.yardModel.features.find(m=>m.config.id===id);
   if(!model||model.excluded||worseContact(est,c.edge)||clearance(est).some(w=>!clearance0.has(w)))continue;
   // No new jump in the grading, and no stair (this one or another) left with a rise or tread out of the limits.
   const jump=jumpOf(est);if(jump.count>jump0.count||jump.most>jump0.most+.005)continue;
   if(est.model.issues.some(i=>STAIR_ISSUE.test(i)&&!stairIssues0.has(i))||offRise(est.model).some(f=>!offRise0.has(f)))continue;
   const metrics=metricsOf({n:c.n,e:c.e,deckTop:c.deckTop,offset:stair?c.spot.offset??offset0:null,bank:c.bank,riseIn},est),edge=edgeOf(est);
   // A stone edge is offered only once the estimate carries its course (measured, and a priced or quoted yard row), never
   // as free work, and only up to two courses.
   if(c.edge&&(edge.lf<=0||!est.yardTakeoff.sections.some(s=>/edge.?course|stone edge/i.test(`${s.id} ${s.label}`))))continue;
   if(c.edge&&edge.maxIn>EDGE_MAX_IN+1e-9){cappedEdge.push({h:edge.maxIn,exact:true});continue;}
   const steps=c.n!==null&&n0!==null?(c.n===n0?`same ${c.n} steps`:`${c.n} steps instead of ${n0}`):'',verb=c.e>e0+1e-9?'Raise':c.e<e0-1e-9?'Lower':'Keep',to=verb==='Keep'?'at':'to';
   const slide=moved&&travel?(()=>{const along=(c.spot.offset!-offset0)/100,d=Math.abs(along)*travel.len,dir=Math.abs(travel.x)>=Math.abs(travel.z)?(travel.x*along>0?'right':'left'):(travel.z*along>0?'away from the house':'toward the house');return {d,dir};})():undefined;
   const gain=earth(c.bank)<(currentBank?earth(currentBank):Infinity)-.0005?'less earthwork':c.bank.area<(currentBank?.area??Infinity)-.05?'a smaller bank':'a better fit',lever=c.edge?c.from:c.kind;
   const head=lever==='stair'&&slide?`Slide the stair ${num(slide.d)} in ${slide.dir}: ${what} at ${lvl(c.e)}, ${steps}`
    :lever==='deck'?`${c.deckTop>D0?'Raise':'Lower'} the deck to ${num(c.deckTop)} in (${num(sill!-c.deckTop)} in below the door): ${what} at ${lvl(c.e)}, ${steps}`
    :c.n===null?`${verb} the patio ${to} ${lvl(c.e)}${c.edge?'':`: ${c.pick==='balance'?'dig and fill balance on site':c.pick==='area'?'the smallest bank to restore':'the least digging and fill'}`}`
    :`${verb} the ${what} ${to} ${lvl(c.e)}: ${c.n===n0?`${steps}, ${gain}`:steps}`;
   const title=c.id==='edge'?'Stone edge on the raised side instead of a fill bank':c.edge?`${head}, with a stone edge instead of the fill bank`:head;
   const lines=[...(c.n!==null?[`${c.n} equal risers of ${num(riseIn!)} in from the deck at ${num(c.deckTop)} in down to the landing at ${lvl(c.e)}.`]:[c.e===e0?`Patio top stays at ${lvl(e0)}.`:`Patio top at ${lvl(c.e)} (now ${lvl(e0)}).`]),
    ...(slide?[`The stair and its landing slide ${num(slide.d)} in ${slide.dir} (stair at ${num(c.spot.offset!)} % along the edge).`]:c.deckTop!==D0?[`Deck top at ${num(c.deckTop)} in, ${num(sill!-c.deckTop)} in below the door sill (now ${num(D0)} in).`]:Math.hypot(c.spot.dx,c.spot.dz)>.05?[`The landing moves ${num(Math.hypot(c.spot.dx,c.spot.dz))} in ${c.n!==null&&n0!==null&&c.n<n0?'closer to':'farther from'} the deck with the stair's foot.`]:[]),
    bankLine(c.bank,c.edge),...quoteLine(c.bank,edge)].slice(0,4);
   options.push({id:c.id,kind:c.kind,title,lines,patch:lit(settled.design,patch),metrics,subtotal:est.subtotal,deltaFromCurrent:cents(est.subtotal-baseline.subtotal),quotes:[...est.quoteRequired]});bankOf.set(c.id,c.bank);
  }catch(e){if(e instanceof Cancelled)throw e;/* an option that fails a validator is never offered */}
  finally{request.onProgress?.(++done,total);}
 }
 if(exhausted||pricingCut)warnings.push(`The search stopped at its time limit, so only the nearest variations were tried${pricingCut?` and ${shortlist.length-pricingCut} of the ${shortlist.length} closest were priced`:''}; a large survey takes longer to search in full.`);
 if(pricingCut)request.onProgress?.(total,total);
 // Options that add work priced only by quote (a stone edge course, or more bank earthwork while its rates are unset)
 // come after those that add none; each group best priced first. Drop any option that the current design or another
 // option pulling no more levers beats on every count (quoted work, price, quotes, earthwork, survey coverage), or
 // matches while pulling fewer.
 const curQuotes=new Set(currentOption.quotes),quoted=(o:GroundFitOption)=>o.quotes.some(q=>!curQuotes.has(q))||unpricedEarth(o.metrics)>unpricedEarth(currentOption.metrics)+.01?1:0;
 const ready=(o:GroundFitOption)=>o.metrics.status==='ready'?1:0,dirt=(o:GroundFitOption)=>o.metrics.bankCutYd3+o.metrics.bankFillYd3;
 const pulls=(o:GroundFitOption)=>{const lever=o.id.includes('+')?o.id.split('+')[0].split(':')[0]:o.kind;return ({current:0,level:1,stair:2,deck:2,edge:1} as Record<string,number>)[lever]+(o.kind==='edge'&&o.id!=='edge'?1:0);};
 const beats=(p:GroundFitOption,o:GroundFitOption)=>pulls(p)<=pulls(o)&&quoted(p)<=quoted(o)&&p.subtotal<=o.subtotal+.005&&p.quotes.length<=o.quotes.length&&dirt(p)<=dirt(o)+1e-4&&ready(p)>=ready(o)&&(quoted(p)<quoted(o)||p.subtotal<o.subtotal-.005||p.quotes.length<o.quotes.length||dirt(p)<dirt(o)-1e-4||ready(p)>ready(o)||pulls(p)<pulls(o));
 options.sort((a,b)=>quoted(a)-quoted(b)||a.subtotal-b.subtotal||a.quotes.length-b.quotes.length||dirt(a)-dirt(b)||a.id.localeCompare(b.id));
 const signature=(o:GroundFitOption)=>JSON.stringify([o.metrics.risers,o.metrics.landingIn,o.metrics.stairOffsetPct,o.metrics.deckTopIn,o.kind==='edge']),kept:GroundFitOption[]=[],sigs=new Set([signature(currentOption)]);
 for(const o of options){if(kept.length>=max)break;if(sigs.has(signature(o))||[currentOption,...options].some(p=>p!==o&&beats(p,o)))continue;sigs.add(signature(o));kept.push(o);}
 if(!kept.length)warnings.push(stair?'No other landing level, stair position or deck height fits the measured ground for less.':'No other patio level fits the measured ground for less.');
 // Say so when a stone edge was the only way left to avoid a wide fill bank but would have stood taller than two courses.
 if(cappedEdge.length&&[currentOption,...kept].every(o=>wideBank(bankOf.get(o.id)!))){const low=cappedEdge.reduce((a,b)=>b.h<a.h?b:a);
  warnings.push(`A stone edge on the raised side would stand ${low.exact?'up to':'more than'} ${num(low.h)} in, past two courses (${EDGE_MAX_IN} in): that is a retaining wall, which needs its own quote, so it is not offered here.`);}
 if(signal?.aborted)return cancelled();
 return {status:'ready',featureId:id,options:[currentOption,...kept],warnings,baseline:{subtotal:baseline.subtotal,quotes:[...baseline.quoteRequired]}};
 }catch(e){if(e instanceof Cancelled)return cancelled();throw e;}
}
