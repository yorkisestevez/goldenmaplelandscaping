import type {DeckData} from './types';
import type {PublicYardSection} from './yardTakeoff';
import {registerFenceRuntime,type Fence,type FenceGate,type FencePoint,type FenceRateId,type FenceStyle} from './fences';

/**
 * Standard fence and gate rates (owner, 2026-11-03: "use standard rates for what we haven't defined … that should be
 * customisable"). Installed prices per linear foot and per gate, the midpoint of each range in HomeStars, "How Much Does
 * Fence Installation Cost in Canada in 2026?", updated 2026-08-21 (mid-sized Canadian urban markets):
 * https://www.homestars.com/gardening-outdoors/price-guides/fence-installation-cost
 * Chain link $15–25, pressure-treated wood $27–45, cedar $45–85, vinyl $35–65, aluminum $45–90 per lf; single walk-through
 * gate $400–1,500, double swing gate $800–3,500. Horizontal cedar has no row of its own and uses cedar's. All are
 * unconfirmed (`npm run deck:rates` lists them) and editable per user (DeckData.hardscapeLabour.fenceRates). They are installed
 * prices, so no markup applies.
 */
export const FENCE_RATES:Record<FenceRateId,number>={pressureTreated:36,cedar:65,horizontalCedar:65,vinyl:50,aluminum:67.5,chainLink:20,singleGate:950,doubleGate:2150};
export const FENCE_RATE_SOURCE='HomeStars Canada fence installation cost guide, updated 2026-08-21 (range midpoints)';
/** The guide's ranges are for the usual 5–6 ft fence; each foot of height changes the price 8–15%. 6 ft is the base and
 * each foot shorter takes the midpoint, 11.5%, off the run (an unconfirmed assumption: the guide gives the step upward). */
export const FENCE_HEIGHT_STEP=.115;
export const GATE_WIDTH_IN:Record<FenceGate['kind'],number>={single:48,double:120};

export const FENCE_STYLES:readonly {id:FenceStyle;name:string}[]=[
 {id:'wood-privacy',name:'Wood privacy'},{id:'horizontal-cedar',name:'Horizontal cedar'},{id:'vinyl-privacy',name:'Vinyl privacy'},
 {id:'aluminum-picket',name:'Black aluminum picket'},{id:'chain-link',name:'Chain link'}];
export const FENCE_LIMITS={fences:20,points:64,gates:20,coordinateIn:120000,minSegmentIn:12} as const;

export const fenceRateId=(f:Pick<Fence,'style'|'wood'>):FenceRateId=>f.style==='wood-privacy'?(f.wood==='cedar'?'cedar':'pressureTreated'):({'horizontal-cedar':'horizontalCedar','vinyl-privacy':'vinyl','aluminum-picket':'aluminum','chain-link':'chainLink'} as const)[f.style];
export const fenceStyleName=(f:Pick<Fence,'style'|'wood'>)=>f.style==='wood-privacy'?`${f.wood==='cedar'?'Cedar':'Pressure-treated'} wood privacy`:FENCE_STYLES.find(s=>s.id===f.style)!.name;

/** Each segment's start distance along the run, and the whole run, in inches. */
export function fenceStations(points:readonly FencePoint[]){
 const stations=[0];for(let i=1;i<points.length;i++)stations.push(stations[i-1]+Math.hypot(points[i].xIn-points[i-1].xIn,points[i].zIn-points[i-1].zIn));
 return {stations,lengthIn:stations.at(-1)!};
}
/** The segment a gate stands in, or -1 when it does not fit inside one straight segment. */
export function gateSegment(points:readonly FencePoint[],gate:Pick<FenceGate,'kind'|'atIn'>){
 const {stations}=fenceStations(points),half=GATE_WIDTH_IN[gate.kind]/2;
 for(let i=0;i+1<stations.length;i++)if(gate.atIn-half>=stations[i]-1e-6&&gate.atIn+half<=stations[i+1]+1e-6)return i;
 return -1;
}

/** Line-post spacing: 8 ft for wood and vinyl sections, 6 ft aluminum panels, 10 ft chain link. */
export const POST_SPACING_IN:Record<FenceStyle,number>={'wood-privacy':96,'horizontal-cedar':96,'vinyl-privacy':96,'aluminum-picket':72,'chain-link':120};

export interface FenceSpan {start:FencePoint;end:FencePoint}
/** Where a fence stands: its fence spans (gate openings left out), its gates (span and leaf count) and every post (each
 * end and corner, both sides of each gate, and line posts at most the style's spacing apart). */
export function fenceLayout(f:Fence){
 const spans:FenceSpan[]=[],gates:(FenceSpan&{gate:FenceGate})[]=[],posts:FencePoint[]=[],{stations}=fenceStations(f.points),spacing=POST_SPACING_IN[f.style];
 const post=(p:FencePoint)=>{if(!posts.some(q=>Math.hypot(q.xIn-p.xIn,q.zIn-p.zIn)<1))posts.push(p);};
 for(let i=0;i+1<f.points.length;i++){
  const a=f.points[i],b=f.points[i+1],length=stations[i+1]-stations[i],at=(s:number):FencePoint=>({xIn:a.xIn+(b.xIn-a.xIn)*s/length,zIn:a.zIn+(b.zIn-a.zIn)*s/length});
  const openings=f.gates.filter(g=>gateSegment(f.points,g)===i).map(g=>({gate:g,from:g.atIn-stations[i]-GATE_WIDTH_IN[g.kind]/2,to:g.atIn-stations[i]+GATE_WIDTH_IN[g.kind]/2})).sort((x,y)=>x.from-y.from);
  let from=0;
  for(const o of [...openings,{gate:undefined,from:length,to:length}]){
   if(o.from-from>.5){spans.push({start:at(from),end:at(o.from)});const n=Math.ceil((o.from-from)/spacing);for(let k=0;k<=n;k++)post(at(from+(o.from-from)*k/n));}
   if(o.gate){gates.push({gate:o.gate,start:at(o.from),end:at(o.to)});post(at(o.from));post(at(o.to));}
   from=o.to;
  }
 }
 return {spans,gates,posts};
}

/** The point on a run nearest p, as a distance along it. */
export function runStationAt(points:readonly FencePoint[],p:FencePoint){
 const {stations}=fenceStations(points);let best={d:Infinity,s:0};
 for(let i=0;i+1<points.length;i++){
  const a=points[i],b=points[i+1],dx=b.xIn-a.xIn,dz=b.zIn-a.zIn,l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((p.xIn-a.xIn)*dx+(p.zIn-a.zIn)*dz)/l2)):0,d=Math.hypot(a.xIn+dx*t-p.xIn,a.zIn+dz*t-p.zIn);
  if(d<best.d)best={d,s:stations[i]+t*Math.sqrt(l2)};
 }
 return best.s;
}
/** The point a distance along a run (a zero-length part, mid-drag, gives its start). */
export function runPointAt(points:readonly FencePoint[],s:number):FencePoint{
 const {stations}=fenceStations(points);
 for(let i=0;i+1<points.length;i++)if(s<=stations[i+1]||i+2===points.length){const len=stations[i+1]-stations[i],t=len?(s-stations[i])/len:0;return {xIn:points[i].xIn+(points[i+1].xIn-points[i].xIn)*t,zIn:points[i].zIn+(points[i+1].zIn-points[i].zIn)*t};}
 return points[0];
}
/** The fence on new corners, each gate kept where it stands on the ground (re-measured along the new run), so moving
 * one corner never slides the gates past it. */
export function fenceWithPoints(f:Fence,points:FencePoint[]):Fence{
 return {...f,points,gates:f.gates.map(g=>({...g,atIn:Math.round(runStationAt(points,runPointAt(f.points,g.atIn)))}))};
}

/** A new straight run across the yard, 15 ft past the deck's front and 10 ft past each side, named for its number. */
export function newFence(data:Pick<DeckData,'width'|'length'|'fences'>):Fence{
 const z=Math.round((data.length+15)*12),taken=new Set(data.fences?.map(f=>f.name));let n=(data.fences?.length??0)+1;while(taken.has(`Fence ${n}`))n++;
 return {id:`fence-${crypto.randomUUID().slice(0,8)}`,name:`Fence ${n}`,style:'wood-privacy',heightFt:6,points:[{xIn:-120,zIn:z},{xIn:Math.round(data.width*12)+120,zIn:z}],gates:[]};
}

const fail=(m:string):never=>{throw Error(m);};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>Object.keys(v).every(k=>required.includes(k)||optional.includes(k))&&required.every(k=>k in v);
const id=(v:unknown)=>typeof v==='string'&&/^[\w:.-]{1,100}$/.test(v);
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=max;

/** Checks saved fences: plain values, known styles and heights, straight segments at least 1 ft long, and gates that
 * each fit inside one segment without overlapping. Returns a copy. */
export function validateFences(raw:unknown):Fence[]{
 if(!Array.isArray(raw)||raw.length>FENCE_LIMITS.fences)fail(`A design can have up to ${FENCE_LIMITS.fences} fences.`);
 const fences=raw as unknown[],ids=new Set<string>();
 for(const f of fences){
  if(!plain(f)||!exact(f,['id','name','style','heightFt','points','gates'],['wood']))fail('Fence settings must be plain saved values.');
  const fence=f as unknown as Fence,label=typeof fence.name==='string'?fence.name:'A fence';
  if(!id(fence.id)||ids.has(fence.id))fail('Each fence needs its own identifier.');ids.add(fence.id);
  if(typeof fence.name!=='string'||!fence.name.trim()||fence.name.length>80)fail('Each fence needs a name of up to 80 characters.');
  if(!FENCE_STYLES.some(s=>s.id===fence.style))fail(`${label}: choose a fence style.`);
  if(fence.wood!==undefined&&(fence.style!=='wood-privacy'||!['pressure-treated','cedar'].includes(fence.wood)))fail(`${label}: only a wood privacy fence takes pressure-treated or cedar.`);
  if(![4,5,6].includes(fence.heightFt))fail(`${label}: fences are 4, 5 or 6 ft high.`);
  if(!Array.isArray(fence.points)||fence.points.length<2||fence.points.length>FENCE_LIMITS.points)fail(`${label}: a run has 2 to ${FENCE_LIMITS.points} points.`);
  for(const p of fence.points)if(!plain(p)||!exact(p,['xIn','zIn'])||!finite(p.xIn,FENCE_LIMITS.coordinateIn)||!finite(p.zIn,FENCE_LIMITS.coordinateIn))fail(`${label}: each point needs a position across and out.`);
  for(let i=1;i<fence.points.length;i++)if(Math.hypot(fence.points[i].xIn-fence.points[i-1].xIn,fence.points[i].zIn-fence.points[i-1].zIn)<FENCE_LIMITS.minSegmentIn)fail(`${label}: each straight part must be at least 1 ft long.`);
  if(!Array.isArray(fence.gates)||fence.gates.length>FENCE_LIMITS.gates)fail(`${label}: up to ${FENCE_LIMITS.gates} gates.`);
  const placed:[number,number][]=[];
  for(const g of fence.gates){
   if(!plain(g)||!exact(g,['id','kind','atIn'])||!id(g.id)||ids.has(g.id)||!['single','double'].includes(g.kind as string)||!finite(g.atIn,FENCE_LIMITS.coordinateIn*4))fail(`${label}: each gate needs its own identifier, a kind and a position.`);
   ids.add(g.id);
   if(gateSegment(fence.points,g)<0)fail(`${label}: a ${g.kind} gate must fit inside one straight part of the fence.`);
   const half=GATE_WIDTH_IN[g.kind]/2,span:[number,number]=[g.atIn-half,g.atIn+half];
   if(placed.some(([a,b])=>span[0]<b-1e-6&&span[1]>a+1e-6))fail(`${label}: gates cannot overlap.`);placed.push(span);
  }
 }
 return structuredClone(fences) as Fence[];
}

/** The rates in use: the job's or owner's own (hardscapeLabour.fenceRates), else the standard ones. */
export const fenceRates=(data:Pick<DeckData,'hardscapeLabour'>):Record<FenceRateId,number>=>({...FENCE_RATES,...data.hardscapeLabour?.fenceRates});

/** What a fence prices: the run less its gate openings, at its style's rate stepped for height, plus each gate. */
export function fenceQuantities(f:Fence,rates:Record<FenceRateId,number>){
 const {lengthIn}=fenceStations(f.points),openingsIn=f.gates.reduce((n,g)=>n+GATE_WIDTH_IN[g.kind],0),fenceLf=Math.max(0,lengthIn-openingsIn)/12;
 const factor=1-FENCE_HEIGHT_STEP*(6-f.heightFt),single=f.gates.filter(g=>g.kind==='single').length,double=f.gates.length-single;
 const runCents=Math.round(fenceLf*rates[fenceRateId(f)]*factor*100),gateCents=Math.round((single*rates.singleGate+double*rates.doubleGate)*100);
 return {lengthLf:lengthIn/12,fenceLf,factor,single,double,runCents,gateCents};
}

const usd=(v:number)=>`$${v%1?v.toFixed(2):v.toLocaleString('en-CA')}`;

/** Each fence's priced Yard rows: the run, then its gates. */
export function fenceTakeoff(data:Pick<DeckData,'fences'|'hardscapeLabour'>):PublicYardSection[]{
 const rates=fenceRates(data),rows:PublicYardSection[]=[];
 for(const f of data.fences??[]){
  const q=fenceQuantities(f,rates),lf=Math.round(q.fenceLf*10)/10;
  rows.push({id:`fence-${f.id}`,label:`${f.name}: ${fenceStyleName(f)} fence, ${f.heightFt} ft`,amountCents:q.runCents,quantity:lf,unit:'lf',featureIds:[f.id],note:`Installed at ${usd(rates[fenceRateId(f)])}/lf${f.heightFt<6?` less ${Math.round((1-q.factor)*1000)/10}% for ${f.heightFt} ft`:''}; gate openings not counted. Standard rate (${FENCE_RATE_SOURCE}), unconfirmed: posts below frost, slope, removal and permits confirmed at the site visit.`});
  if(f.gates.length)rows.push({id:`fence-gates-${f.id}`,label:`${f.name}: ${[q.single&&`${q.single} single`,q.double&&`${q.double} double`].filter(Boolean).join(' and ')} gate${f.gates.length>1?'s':''}`,amountCents:q.gateCents,quantity:f.gates.length,unit:f.gates.length>1?'gates':'gate',featureIds:[f.id],note:`Installed manual gates at ${usd(rates.singleGate)} single (4 ft) and ${usd(rates.doubleGate)} double (10 ft), deeper gate posts included. Standard rate (${FENCE_RATE_SOURCE}), unconfirmed.`});
 }
 return rows;
}

registerFenceRuntime({validateFences,fenceTakeoff});
