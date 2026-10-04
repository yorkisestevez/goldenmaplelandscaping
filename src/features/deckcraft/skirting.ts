import type {DeckTakeoff} from './deckTakeoff';
import type {ColourRef,DeckData,SkirtingConfig,SkirtingStyle} from './types';
import {getHouseContact} from './houseContact';
import {getTerrainConfig} from './yardSettings';
import {edgeFacing,type EdgeName,type PlanPoint} from './lib/deckGeometry';
import {accentAllowed,colourName,deckColourRef,parseColourRef} from './boardFinishes';
import {mitredRunCaps,type SlabCap} from './lib/mitredSlabs';
import {hasEffectiveDrainage} from './underDeckOptions';

/**
 * Skirting under the deck: boards or lattice closing in the space between each deck edge's rim and the ground.
 * Pure data and maths (no three.js), worked out from the finished takeoff:
 * - The edges are the levels' rim pieces. On the main deck, the edges the house covers are left alone, and
 *   houseContact.ts (onContact) is the only judge of which those are: nothing here finds the house by its position.
 * - Where two levels meet or overlap, and across every stair and level-connection opening (its width plus 1 in each
 *   side), the skirting stops. Winder treads belong to the stair and are not skirted.
 * - The face runs from the underside of the rim down to the ground (getTerrainConfig, so it follows a slope) plus
 *   the chosen clearance. A stretch with less than 3 in of face is left open.
 * - Styles: horizontal boards on studs at 16 in, vertical boards on rails no more than 24 in apart, or lattice in
 *   4 × 8 ft panels with a rail at each 4 ft joint. Access panels are framed into the longest runs.
 * Nothing here is priced: the estimate lists the face, backing, access panels and labour for a builder quote, never
 * at $0. Nothing runs for a design without `skirting`, so existing designs are unchanged.
 */
export const SKIRTING_STYLES:readonly SkirtingStyle[]=['Horizontal boards','Vertical boards','Lattice'];
export const SKIRTING_STYLE_NAMES:Record<SkirtingStyle,string>={'Horizontal boards':'Horizontal boards on studs','Vertical boards':'Vertical boards on rails','Lattice':'Lattice panels (4 ft)'};
/** Editor ranges; loading a design enforces the same ones. */
export const SKIRTING_LIMITS={clearanceIn:[1,12] as const,accessPanels:[0,6] as const,openEdges:24};
/** A deck side the design can leave open: 'deck1'…'deck3' or 'landing1'…, then the side it faces. */
export const SKIRTING_EDGE=/^(deck[1-3]|landing[1-9]\d?)-(front|back|left|right)$/;
export const newSkirting=():SkirtingConfig=>({style:'Horizontal boards',clearanceIn:2,accessPanels:1});
/** Solid edge means an ungrooved edge, not necessarily a solid core: these known scalloped boards are excluded.
 * Other composite/PVC collections remain custom fabrication candidates, subject to exact stock confirmation. */
export function foldedBoardCandidate(colour:ColourRef){
  const m=parseColourRef(colour)?.material;return !!m?.isComposite&&!['tt_prime_plus','tt_prime','tt_terrain','tt_terrain_plus'].includes(m.id);
}

const STYLE_WORDS:Record<SkirtingStyle,string>={'Horizontal boards':'horizontal boards','Vertical boards':'vertical boards','Lattice':'lattice'};
const LEVEL_NAMES=['Main deck','Second level','Third level'];
const SIDE_WORDS:Partial<Record<EdgeName,string>>={Front:'front',Left:'left side',Right:'right side'};
const GAP=.25,FACE=1,TRIM=.75;
/** The rim is 1.5 in thick, centred on the deck outline: its outer face is this far out. */
const RIM_FACE=.75;
/** 2×4 backing: 1.5 × 3.5 in. */
const STOCK={w:1.5,d:3.5};
const PAD=1,MIN_FACE=3,MIN_RUN=6,FRAMED=8;
const LATTICE={w:96,h:48};
const ACCESS={w:30,h:30,min:12,trim:1.5};
const FRAMING:Record<SkirtingStyle,{studIn:number;railIn?:number;words:string}>={
  'Horizontal boards':{studIn:16,words:'studs at 16 in centres between a top nailer and a bottom rail'},
  'Vertical boards':{studIn:48,railIn:24,words:'rails no more than 24 in apart, on studs at 48 in centres'},
  'Lattice':{studIn:24,railIn:LATTICE.h,words:'a frame with studs at 24 in centres and a rail at every 4 ft panel joint'},
};

/** A flat piece of skirting (face, backing or trim) in world plan inches (y is the 3D z, toward the yard). Its middle
 * plane runs a→b, `out` points away from the deck, and its bottom and top are given at each end: a trapezoid on a slope. */
export interface SkirtingSlab{a:PlanPoint;b:PlanPoint;out:PlanPoint;thick:number;bottomA:number;topA:number;bottomB:number;topB:number;capA?:SlabCap;capB?:SlabCap;grainAnchor?:PlanPoint;grainOffset?:number}
/** One straight stretch of skirting along a rim. Its face runs from `top` (the rim's underside) down to the ground plus
 * the clearance, `bottomA` and `bottomB` at its ends. */
export interface SkirtingRun{edge:string;level:number;a:PlanPoint;b:PlanPoint;lengthIn:number;out:PlanPoint;top:number;bottomA:number;bottomB:number;faceSqft:number}
/** A deck side the skirting can close in, for the editor's list: `open` when the design leaves it open. */
export interface SkirtingEdge{id:string;label:string;lengthFt:number;open:boolean}
export interface SkirtingPlan{
  style:SkirtingStyle;colour:ColourRef;clearanceIn:number;
  foldedCorners:boolean;
  edges:SkirtingEdge[];runs:SkirtingRun[];
  /** Face boards or lattice panels; the 2×4 backing (studs and rails); the trim round each access panel. */
  faces:SkirtingSlab[];backing:SkirtingSlab[];frames:SkirtingSlab[];
  /** Corner trim for lattice; board skirting meets in actual mitres instead (drawn only, quantities unchanged). */
  corners:SkirtingSlab[];
  lengthFt:number;faceSqft:number;backingLf:number;latticePanels:number;
  accessPanels:{requested:number;placed:number;widthIn:number;heightsIn:number[]};
  /** Ventilation, access and drainage, and anything left open: confirm-before-construction notes. */
  notes:string[];
}

type Span=[number,number];
const cut=(spans:Span[],lo:number,hi:number):Span[]=>spans.flatMap(([s,e]):Span[]=>hi<=s||lo>=e?[[s,e]]:[...(lo>s?[[s,lo] as Span]:[]),...(hi<e?[[hi,e] as Span]:[])]);
function inside(p:PlanPoint,poly:PlanPoint[]){
  let odd=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}
  return odd;
}
/** Stretches of the segment a + u·t (0 ≤ t ≤ len) inside a polygon (more than half an inch in from its edges). */
function insideSpans(a:PlanPoint,u:PlanPoint,len:number,poly:PlanPoint[]):Span[]{
  const ts=[0,len];
  poly.forEach((p,i)=>{
    const q=poly[(i+1)%poly.length],d={x:q.x-p.x,y:q.y-p.y},den=u.x*d.y-u.y*d.x;if(Math.abs(den)<1e-9)return;
    const w={x:p.x-a.x,y:p.y-a.y},t=(w.x*d.y-w.y*d.x)/den,s=(w.x*u.y-w.y*u.x)/den;
    if(t>0&&t<len&&s>=0&&s<=1)ts.push(t);
  });
  ts.sort((x,y)=>x-y);
  const clear=(m:PlanPoint)=>poly.every((p,i)=>{const q=poly[(i+1)%poly.length],l=Math.hypot(q.x-p.x,q.y-p.y)||1,t=Math.max(0,Math.min(1,((m.x-p.x)*(q.x-p.x)+(m.y-p.y)*(q.y-p.y))/(l*l)));return Math.hypot(m.x-p.x-(q.x-p.x)*t,m.y-p.y-(q.y-p.y)*t)>.5;});
  const spans:Span[]=[];
  for(let i=0;i+1<ts.length;i++){
    const m=(ts[i]+ts[i+1])/2,point={x:a.x+u.x*m,y:a.y+u.y*m};
    if(ts[i+1]-ts[i]>.01&&inside(point,poly)&&clear(point))spans.push([ts[i],ts[i+1]]);
  }
  return spans;
}
/** Where along a run (0…L) a straight bottom line, bottomA + k·t, stays below `level`. */
function below(bottomA:number,k:number,L:number,level:number):Span|null{
  if(Math.abs(k)<1e-9)return bottomA<level?[0,L]:null;
  const t=(level-bottomA)/k,s=k>0?0:Math.max(0,t),e=k>0?Math.min(L,t):L;
  return e-s>.01?[s,e]:null;
}
const round1=(n:number)=>Math.round(n*10)/10;
const inches=(n:number)=>`${round1(n)}`;

/** The skirting a design asks for, laid out on its finished takeoff; null when the design has none. */
export function skirtingPlan(data:DeckData,model:DeckTakeoff):SkirtingPlan|null{
  const config=data.skirting;if(!config)return null;
  const style=SKIRTING_STYLES.includes(config.style)?config.style:'Horizontal boards';
  const [cmin,cmax]=SKIRTING_LIMITS.clearanceIn,clearanceIn=Math.min(cmax,Math.max(cmin,Number(config.clearanceIn)||2));
  const colour=config.colour&&accentAllowed(data,config.colour)?config.colour:deckColourRef(data);
  const foldedCorners=config.cornerTreatment==='Folded solid boards'&&style==='Horizontal boards'&&foldedBoardCandidate(colour);
  const terrain=getTerrainConfig(data),ground=(y:number)=>terrain.elevationIn+y*terrain.slopePct/100;
  const contact=getHouseContact(data,model.levels[0].footprint),open=new Set(config.openEdges??[]);
  const outlines=model.levels.map(l=>l.kind==='winder'?null:l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})));
  const edges=new Map<string,SkirtingEdge>(),runs:SkirtingRun[]=[];
  let lowIn=0,landings=0;
  model.levels.forEach((level,li)=>{
    if(level.kind==='winder')return;
    const landing=level.kind==='landing',key=landing?`landing${++landings}`:`deck${(level.index??0)+1}`;
    const name=landing?`Stair landing ${landings}`:LEVEL_NAMES[level.index??0]??'Deck level';
    for(const m of level.rim??[]){
      const a={x:m.a.x,y:m.a.z},b={x:m.b.x,y:m.b.z},len=Math.hypot(b.x-a.x,b.y-a.y);if(len<MIN_RUN)continue;
      // The house covers some of the main deck's edges; houseContact.ts alone decides which.
      if(li===0&&contact.onContact({x:a.x-level.offset.x,y:a.y-level.offset.z},{x:b.x-level.offset.x,y:b.y-level.offset.z}))continue;
      const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},out={x:u.y,y:-u.x};
      const along=(p:PlanPoint)=>(p.x-a.x)*u.x+(p.y-a.y)*u.y,across=(p:PlanPoint)=>Math.abs((p.x-a.x)*u.y-(p.y-a.y)*u.x);
      let spans:Span[]=[[0,len]];
      // Where another level meets or overlaps this edge, the space under the deck carries on: no skirting there.
      outlines.forEach((poly,oi)=>{
        if(!poly||oi===li)return;
        poly.forEach((p,i)=>{
          const q=poly[(i+1)%poly.length],el=Math.hypot(q.x-p.x,q.y-p.y);
          if(el>.5&&Math.abs((q.x-p.x)*u.y-(q.y-p.y)*u.x)<.01*el&&across(p)<1){const t0=along(p),t1=along(q);spans=cut(spans,Math.min(t0,t1),Math.max(t0,t1));}
        });
        for(const [s,e] of insideSpans(a,u,len,poly))spans=cut(spans,s,e);
      });
      // Stairs and level connections: a flight leaving or landing on this level at this edge opens it, 1 in past each side.
      for(const f of model.flights)for(const p of [f.start,f.end]){
        const q={x:p.x,y:p.z};if(Math.abs(p.y-level.top)>.6||across(q)>3)continue;
        const t=along(q),half=f.width/2+PAD;spans=cut(spans,t-half,t+half);
      }
      const facing=edgeFacing(out),id=`${key}-${facing.toLowerCase()}`;
      const edge=edges.get(id)??{id,label:`${name}, ${SIDE_WORDS[facing]??'back'}`,lengthFt:0,open:open.has(id)};edges.set(id,edge);
      const top=m.a.y-m.depth/2,bottom=(t:number)=>ground(a.y+u.y*t)+clearanceIn,at=(t:number)=>({x:a.x+u.x*t,y:a.y+u.y*t});
      for(const [s0,e0] of spans){
        // Keep what has room for a face: the ground can rise under the deck on a slope.
        const h0=top-bottom(s0),h1=top-bottom(e0),where=(h:number)=>s0+(h-h0)/(h1-h0)*(e0-s0);
        const s=h0>=MIN_FACE?s0:h1>=MIN_FACE?where(MIN_FACE):e0,e=h1>=MIN_FACE?e0:h0>=MIN_FACE?where(MIN_FACE):s0,kept=Math.max(0,e-s);
        if(!edge.open)lowIn+=e0-s0-kept;
        if(kept<MIN_RUN)continue;
        edge.lengthFt+=kept/12;
        if(edge.open)continue;
        const bA=bottom(s),bB=bottom(e);
        runs.push({edge:id,level:li,a:at(s),b:at(e),lengthIn:kept,out,top,bottomA:bA,bottomB:bB,faceSqft:kept*(2*top-bA-bB)/2/144});
      }
    }
  });

  const faces:SkirtingSlab[]=[],backing:SkirtingSlab[]=[],frames:SkirtingSlab[]=[],frame=FRAMING[style],bw=data.boardWidth;
  const caps=style==='Lattice'?[]:mitredRunCaps(runs.map(r=>({...r,inner:RIM_FACE,outer:RIM_FACE+FACE,group:r.level})));
  let backingIn=0,latticePanels=0;
  const piece=(r:SkirtingRun,t0:number,t1:number,shift:number,thick:number,bottomA:number,topA:number,bottomB:number,topB:number):SkirtingSlab=>{
    const u={x:(r.b.x-r.a.x)/r.lengthIn,y:(r.b.y-r.a.y)/r.lengthIn},at=(t:number)=>({x:r.a.x+u.x*t+r.out.x*shift,y:r.a.y+u.y*t+r.out.y*shift});
    const joined=style!=='Lattice'&&thick===FACE&&shift===RIM_FACE+FACE/2,c=caps[runs.indexOf(r)];
    return {a:at(t0),b:at(t1),out:r.out,thick,bottomA,topA,bottomB,topB,
      ...(joined&&c?.a&&t0<.01?{capA:c.a}:{}),
      ...(joined&&c?.b&&r.lengthIn-t1<=GAP+.01?{capB:c.b}:{})};
  };
  for(const r of runs){
    const L=r.lengthIn,k=(r.bottomB-r.bottomA)/L,bot=(t:number)=>r.bottomA+k*t,low=Math.min(r.bottomA,r.bottomB),faceAt=RIM_FACE+FACE/2;
    if(style==='Vertical boards')for(let t=0;t<L-.5;t+=bw+GAP){const t1=Math.min(L,t+bw);faces.push(piece(r,t,t1,faceAt,FACE,bot(t),r.top,bot(t1),r.top));}
    else{
      // Rows from the top down (boards, or 4 ft lattice panels), each cut along the ground line where it meets it.
      const rowH=style==='Lattice'?LATTICE.h:bw,gap=style==='Lattice'?0:GAP;
      for(let y1=r.top;y1>low+.5;y1-=rowH+gap){
        const y0=y1-rowH,range=below(r.bottomA,k,L,y1-.5);if(!range)continue;
        const stops=[...range];
        if(Math.abs(k)>1e-9){const t=(y0-r.bottomA)/k;if(t>range[0]+.01&&t<range[1]-.01)stops.push(t);}
        if(style==='Lattice')for(let x=LATTICE.w;x<L;x+=LATTICE.w)if(x>range[0]+.01&&x<range[1]-.01)stops.push(x);
        stops.sort((p,q)=>p-q);
        for(let i=0;i+1<stops.length;i++){
          const p=stops[i],q=stops[i+1];if(q-p<.25)continue;
          const flat=bot((p+q)/2)<=y0;faces.push(piece(r,p,q,faceAt,FACE,flat?y0:Math.max(y0,bot(p)),y1,flat?y0:Math.max(y0,bot(q)),y1));
        }
      }
      if(style==='Lattice')latticePanels+=Math.ceil(L/LATTICE.w)*Math.ceil((r.top-low)/LATTICE.h);
    }
    // Backing: a top nailer under the rim, a bottom rail on the ground line, studs between and (vertical boards and
    // lattice) rails across them. A face under 8 in tall hangs from the nailer alone.
    const railAt=RIM_FACE-STOCK.w/2,studAt=RIM_FACE-STOCK.d/2;
    backing.push(piece(r,0,L,railAt,STOCK.w,r.top-STOCK.d,r.top,r.top-STOCK.d,r.top));backingIn+=L;
    if(Math.min(r.top-r.bottomA,r.top-r.bottomB)<FRAMED)continue;
    backing.push(piece(r,0,L,railAt,STOCK.w,r.bottomA,r.bottomA+STOCK.d,r.bottomB,r.bottomB+STOCK.d));backingIn+=Math.hypot(L,r.bottomB-r.bottomA);
    if(frame.railIn)for(let y=r.top-frame.railIn;y-STOCK.d*1.5>low;y-=frame.railIn){
      const range=below(r.bottomA,k,L,y-STOCK.d*1.5);if(!range)continue;
      backing.push(piece(r,range[0],range[1],railAt,STOCK.w,y-STOCK.d/2,y+STOCK.d/2,y-STOCK.d/2,y+STOCK.d/2));backingIn+=range[1]-range[0];
    }
    const stations=[STOCK.w/2];for(let t=frame.studIn;t<L-3;t+=frame.studIn)stations.push(t);stations.push(L-STOCK.w/2);
    for(const t of stations){
      const t0=t-STOCK.w/2,t1=t+STOCK.w/2,top=r.top-STOCK.d;if(top-(bot(t)+STOCK.d)<1)continue;
      backing.push(piece(r,t0,t1,studAt,STOCK.d,bot(t0)+STOCK.d,top,bot(t1)+STOCK.d,top));backingIn+=top-bot(t)-STOCK.d;
    }
  }

  // A folded solid-board corner is a custom-fabricated return, not a thin fascia panel. Split the visual course
  // into short corner returns and field pieces so the two legs of a fold share one grain strip and phase.
  // The return length is a preview convention, not a fabrication dimension or a change to the takeoff.
  if(foldedCorners){
    const outside=new Set<SlabCap>();
    runs.forEach((r,i)=>runs.forEach((s,j)=>{
      if(i===j)return;const cap=caps[i]?.b;
      if(cap&&cap===caps[j]?.a&&Math.abs(r.out.x*s.out.x+r.out.y*s.out.y)<1e-5&&s.out.x*(r.b.x-r.a.x)+s.out.y*(r.b.y-r.a.y)>.01)outside.add(cap);
    }));
    const joined:SkirtingSlab[]=[];
    for(const s of faces){
      const L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),u={x:(s.b.x-s.a.x)/L,y:(s.b.y-s.a.y)/L};
      const a=s.capA&&outside.has(s.capA)?s.capA:undefined,b=s.capB&&outside.has(s.capB)?s.capB:undefined;
      if(!a&&!b){joined.push(s);continue;}
      const returnIn=Math.min(12,L/3),stops=[0,...(a?[returnIn]:[]),...(b?[L-returnIn]:[]),L];
      const at=(t:number)=>({x:s.a.x+u.x*t,y:s.a.y+u.y*t}),height=(p:number,q:number,t:number)=>p+(q-p)*t/L;
      for(let k=0;k+1<stops.length;k++){
        const from=stops[k],to=stops[k+1],anchor=k===0?a:k===stops.length-2?b:undefined;
        const p=at(from),q=at(to),grainAnchor=anchor?{x:anchor.outer.x+s.topA*.01,y:anchor.outer.y}:undefined;
        joined.push({...s,a:p,b:q,bottomA:height(s.bottomA,s.bottomB,from),bottomB:height(s.bottomA,s.bottomB,to),
          topA:height(s.topA,s.topB,from),topB:height(s.topA,s.topB,to),
          capA:k===0?s.capA:undefined,capB:k===stops.length-2?s.capB:undefined,
          ...(grainAnchor?{grainAnchor,grainOffset:-((anchor!.outer.x-p.x)*u.x+(anchor!.outer.y-p.y)*u.y)}:{})});
      }
    }
    faces.splice(0,faces.length,...joined);
  }

  // Access panels: framed openings on the longest runs, where there is room for at least 12 in of opening between the
  // bottom rail and the nailer.
  const [pmin,pmax]=SKIRTING_LIMITS.accessPanels,requested=Math.round(Math.min(pmax,Math.max(pmin,Number(config.accessPanels)||0)));
  const panelsOn=(r:SkirtingRun,n:number)=>{
    const L=r.lengthIn,k=(r.bottomB-r.bottomA)/L;if(L/n<ACCESS.w+2*ACCESS.trim+12)return null;
    const list:{t:number;lo:number;hi:number}[]=[];
    for(let j=0;j<n;j++){
      const t=L*(j+.5)/n,lo=Math.max(r.bottomA+k*(t-ACCESS.w/2),r.bottomA+k*(t+ACCESS.w/2))+STOCK.d,hi=Math.min(lo+ACCESS.h,r.top-STOCK.d);
      if(hi-lo<ACCESS.min)return null;list.push({t,lo,hi});
    }
    return list;
  };
  const perRun=runs.map(()=>0),heightsIn:number[]=[];
  for(let i=0;i<requested;i++){
    const best=runs.map((r,ri)=>({ri,room:r.lengthIn/(perRun[ri]+1)})).filter(c=>panelsOn(runs[c.ri],perRun[c.ri]+1)).sort((p,q)=>q.room-p.room)[0];
    if(!best)break;perRun[best.ri]++;
  }
  runs.forEach((r,ri)=>{
    if(!perRun[ri])return;
    const at=RIM_FACE+FACE+TRIM/2,w=ACCESS.w/2,tr=ACCESS.trim;
    for(const {t,lo,hi} of panelsOn(r,perRun[ri])!){
      frames.push(piece(r,t-w-tr,t+w+tr,at,TRIM,hi,hi+tr,hi,hi+tr),piece(r,t-w-tr,t+w+tr,at,TRIM,lo-tr,lo,lo-tr,lo),piece(r,t-w-tr,t-w,at,TRIM,lo,hi,lo,hi),piece(r,t+w,t+w+tr,at,TRIM,lo,hi,lo,hi));
      heightsIn.push(Math.round(hi-lo));
    }
  });
  const placed=heightsIn.length;
  // Outside corners: the faces stand off the rim, so two runs meeting at a corner leave a slot between their ends. A
  // corner trim board a little proud of both faces closes it, as a built skirting's corner trim does.
  const corners:SkirtingSlab[]=[],seen=new Set<string>(),proud=RIM_FACE+FACE+.1;
  // Lattice retains solid trim; board courses now wrap the corner themselves without a vertical cover block.
  if(style==='Lattice')
  runs.forEach((r1,i)=>runs.forEach((r2,j)=>{
    if(i===j)return;
    const u1={x:(r1.b.x-r1.a.x)/r1.lengthIn,y:(r1.b.y-r1.a.y)/r1.lengthIn};
    for(const [end1,end2] of [['b','a'],['b','b'],['a','a'],['a','b']] as const){
      const c=r1[end1],d=r2[end2];if(Math.hypot(c.x-d.x,c.y-d.y)>1)continue;
      const key=`${Math.round(c.x)}:${Math.round(c.y)}`;if(seen.has(key))continue;
      const past=end1==='b'?u1:{x:-u1.x,y:-u1.y},u2={x:(r2.b.x-r2.a.x)/r2.lengthIn,y:(r2.b.y-r2.a.y)/r2.lengthIn},away2=end2==='a'?u2:{x:-u2.x,y:-u2.y};
      // Outside corner: the next run's face looks along the way this run was going.
      const turnsOut=r2.out.x*past.x+r2.out.y*past.y;if(turnsOut<=.01)continue;
      seen.add(key);
      const turn=Math.acos(Math.max(-1,Math.min(1,past.x*away2.x+past.y*away2.y))),ext=proud*Math.tan(turn/2);
      const at=(t:number)=>({x:c.x+past.x*t+r1.out.x*(RIM_FACE+proud)/2,y:c.y+past.y*t+r1.out.y*(RIM_FACE+proud)/2});
      const bottom=Math.min(end1==='b'?r1.bottomB:r1.bottomA,end2==='a'?r2.bottomA:r2.bottomB),top=Math.min(r1.top,r2.top);
      // Slab geometry wants `out` on the right of a→b, as the faces have it.
      const [p,q]=end1==='b'?[at(0),at(ext)]:[at(ext),at(0)];
      if(top-bottom>=MIN_FACE)corners.push({a:p,b:q,out:r1.out,thick:proud-RIM_FACE,bottomA:bottom,topA:top,bottomB:bottom,topB:top});
    }
  }));

  const listed=[...edges.values()].filter(e=>e.lengthFt>=.5),notes:string[]=[];
  if(!runs.length)notes.push(listed.length&&listed.every(e=>e.open)?'Skirting: every side is left open, so none is listed.':'Skirting: no deck edge has room for it: the framing sits too close to the ground.');
  else{
    if(foldedCorners)notes.push('Skirting corners: folded solid deck-board returns at square outside corners are shown as custom fabrication; inside and angled corners retain mitred joins. Solid-profile stock is required; the builder must confirm the selected product, backing, movement allowances and fabrication method. Heat-folding approval and warranty coverage are not assumed. Corner fabrication remains in the builder quote.');
    else if(config.cornerTreatment)notes.push('Folded corners require horizontal composite or PVC solid-board skirting; wood, lattice, vertical boards and known scalloped profiles are excluded. This design uses standard corner joins instead.');
    notes.push(`Skirting ventilation: the skirting stops ${inches(clearanceIn)} in above the ground${style==='Lattice'?' and the lattice is open':', with 1/4 in gaps between its boards'}, so air moves under the deck. Confirm the airflow the decking manufacturer requires under its boards before the deck is closed in.`);
    notes.push(placed?`Skirting access: ${placed} framed access panel${placed===1?'':'s'}, ${ACCESS.w} in wide, to reach the footings and framing under the deck${placed<requested?` (${requested} asked for; the rest do not fit where the skirting is tall enough)`:''}.`
      :requested?'Skirting access: no access panel fits (one needs about 20 in of skirting height). Plan another way to reach the space under the deck.'
      :'Skirting access: no access panel is included, so the space under the deck is reached only by taking skirting off. One is recommended.');
    notes.push(`Skirting drainage: grade the ground under the deck so water runs out from under it; the ${inches(clearanceIn)} in gap at the bottom lets it out${terrain.slopePct?', and on this sloped yard the skirting follows the ground':''}.${hasEffectiveDrainage(data)?' Keep the under-deck drainage outlet clear of the skirting.':''}`);
    if(style==='Lattice'&&runs.some(r=>r.top-Math.min(r.bottomA,r.bottomB)>LATTICE.h+.5))notes.push('Skirting: lattice comes in 4 ft panels, so skirting taller than 4 ft is two panels high, with a rail at the joint.');
    if(lowIn>=6)notes.push(`Skirting: ${round1(lowIn/12)} ft of deck edge sits too close to the ground for skirting (under ${MIN_FACE} in of face above the ${inches(clearanceIn)} in clearance) and is left open.`);
  }
  const opened=listed.filter(e=>e.open);
  if(opened.length&&runs.length)notes.push(`Skirting left open by choice: ${opened.map(e=>e.label.toLowerCase()).join('; ')}.`);
  if(config.colour&&colour!==config.colour)notes.push('The chosen skirting colour does not suit this decking, so the skirting is shown and listed in the deck colour.');
  return {style,colour,clearanceIn,foldedCorners,edges:listed,runs,faces,backing,frames,corners,
    lengthFt:runs.reduce((n,r)=>n+r.lengthIn,0)/12,faceSqft:runs.reduce((n,r)=>n+r.faceSqft,0),backingLf:backingIn/12,latticePanels,
    accessPanels:{requested,placed,widthIn:ACCESS.w,heightsIn},notes};
}

/** The estimate's "Deck skirting" rows: every one a quote (cost null), never $0, and none when nothing is skirted. */
export function skirtingRows(plan:SkirtingPlan):{name:string;spec:string;qty:number;unit:string;cost:null}[]{
  if(!plan.runs.length)return [];
  const lf=round1(plan.lengthFt),n=plan.accessPanels.placed;
  return [
    {name:'Skirting face',spec:`${SKIRTING_STYLE_NAMES[plan.style]} in ${colourName(plan.colour)}${plan.style==='Lattice'?`, about ${plan.latticePanels} panels of 4 × 8 ft, colour matched as closely as the supplier's lattice allows`:''}, from the rim to ${inches(plan.clearanceIn)} in above the ground.${plan.foldedCorners?' Folded solid-board corner returns: custom fabrication, selected solid-profile product and method to be confirmed.':''} Supplier quote required.`,qty:round1(plan.faceSqft),unit:'sq ft',cost:null},
    {name:'Skirting backing',spec:`Pressure-treated 2×4: ${FRAMING[plan.style].words}. Builder quote required.`,qty:round1(plan.backingLf),unit:'lf',cost:null},
    ...(n?[{name:'Skirting access panels',spec:`Framed, removable panels ${ACCESS.w} in wide, trimmed to match the skirting. Builder quote required.`,qty:n,unit:n===1?'panel':'panels',cost:null}]:[]),
    {name:'Skirting labour',spec:`Builder quote required: framing and fitting ${lf} ft of skirting has no rate in the price book yet.`,qty:lf,unit:'lf',cost:null},
  ];
}

/** One line for the design facts, the proposal and a sent design, e.g. "Skirting: lattice in Kona (…), 38.0 ft on 3 sides, …". */
export function skirtingWords(plan:SkirtingPlan):string{
  if(!plan.runs.length)return 'Skirting: asked for, but no deck edge is skirted (see the notes)';
  const sides=new Set(plan.runs.map(r=>r.edge)).size,n=plan.accessPanels.placed,opened=plan.edges.filter(e=>e.open);
  return `Skirting: ${STYLE_WORDS[plan.style]} in ${colourName(plan.colour)}, ${plan.lengthFt.toFixed(1)} ft on ${sides} side${sides===1?'':'s'}, ${inches(plan.clearanceIn)} in above the ground${n?`, ${n} access panel${n===1?'':'s'}`:''}${plan.foldedCorners?'; folded solid-board corners (custom fabrication)':''}${opened.length?`; left open: ${opened.map(e=>e.label.toLowerCase()).join('; ')}`:''}`;
}
