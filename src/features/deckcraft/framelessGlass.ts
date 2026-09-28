import type {Box,DeckLevel,Member,RailRun,V3} from './deckTakeoff';
import type {DeckData,GlassFinish,GlassMount} from './types';
import {finishedFasciaOffset,pictureFrameOverhang} from './lib/finishedFootprint';

/**
 * Frameless glass railing: glass panels held by a continuous base shoe (on the deck or on the rim face) or by
 * spigots, with no posts and no top rail. Pure data and maths (no three.js), laid out on the guard runs the takeoff
 * already found for every railing type, so the guard goes exactly where a framed railing would.
 * - Panels are at most 48 in wide, 0.5 in apart and 0.25 in short of each run end. Glass is 1/2 in.
 * - The glass top is the walking surface plus the railing height (36 or 42 in, the takeoff's rule). The mount sets where
 *   the glass starts: in a top-mount shoe 0.5 in above the deck, in a fascia shoe 4.75 in below it, on spigots 2 in above.
 * - Stairs have no flat edge for a shoe, so their raked panels stand in a shoe (or on standoffs) on the outer stringer,
 *   and every sloped run carries a round 1.66 in handrail on glass brackets, 35 in above the nosings.
 * Nothing here is priced: the estimate lists the glass, shoe or spigots and handrail as a supplier quote.
 */
export const GLASS_MOUNTS:readonly GlassMount[]=['Top-mount base shoe','Fascia-mount base shoe','Spigots'];
export const GLASS_FINISHES:readonly GlassFinish[]=['Black','Silver'];
export const GLASS_FINISH_NAMES:Record<GlassFinish,string>={Black:'Black powder coat',Silver:'Clear anodized / 316 stainless'};
/** Screen colours for the hardware (3D and the proposal's colour chip); illustrative. */
export const GLASS_FINISH_HEX:Record<GlassFinish,string>={Black:'#1f2325',Silver:'#c3c8cc'};
export const glassMountOf=(data:DeckData):GlassMount=>data.glassMount&&GLASS_MOUNTS.includes(data.glassMount)?data.glassMount:'Top-mount base shoe';
export const glassFinishOf=(data:DeckData):GlassFinish=>data.glassFinish&&GLASS_FINISHES.includes(data.glassFinish)?data.glassFinish:'Black';
/** The railing's name in summaries and the proposal. */
export const glassRailingName=(data:DeckData)=>{const m=glassMountOf(data);return `Frameless glass railing ${m==='Spigots'?'on spigots':`on a ${m.toLowerCase()}`}`;};

export const GLASS={thick:.5,maxPanel:48,gap:.5,endGap:.25,minPanel:12} as const;
/** Base shoe profile: 2.5 in wide, 4.25 in tall, glass set 3.75 in deep. */
export const SHOE={w:2.5,h:4.25,embed:3.75} as const;
/** Spigot: a 2 in post with a 4 in base plate; the glass is clamped 2 in above the deck. Stairs take side standoffs. */
export const SPIGOT={d:2,h:9,plate:4,glassLift:2,standoff:1.25} as const;
export const HANDRAIL={d:1.66,heightIn:35,standoff:2.5} as const;

type P2={x:number;y:number};
export interface GlassRun{a:V3;b:V3;
  /** Plan unit vector a→b, and the plan unit vector pointing away from the walking surface. */
  u:P2;out:P2;sloped:boolean;planLength:number}
/** One glass panel: its bottom edge runs a→b (the glass mid-plane), `height` straight up; sloped panels are raked. */
export interface GlassPanel{run:number;a:V3;b:V3;width:number;height:number}
/** A straight piece of base shoe: its top edge runs a→b on the shoe's centre line; it hangs `h` below that. */
export interface GlassShoe{run:number;a:V3;b:V3;out:P2;raked:boolean;fascia:boolean}
export interface GlassSpigot{run:number;at:V3;out:P2;side:boolean}
export interface GlassHandrail{run:number;a:V3;b:V3}
export interface FramelessGlassLayout{
  mount:GlassMount;finish:GlassFinish;height:number;
  runs:GlassRun[];panels:GlassPanel[];shoes:GlassShoe[];spigots:GlassSpigot[];handrails:GlassHandrail[];brackets:{run:number;at:V3}[];
  quantities:{panels:number;glassSqft:number;panelSizes:{widthIn:number;heightIn:number;count:number}[];shoeLf:number;shoeEndCaps:number;spigots:number;handrailLf:number;handrailBrackets:number};
  issues:string[];
}

const len2=(p:P2)=>Math.hypot(p.x,p.y);
const shift=(p:V3,o:P2,d:number,dy=0):V3=>({x:p.x+o.x*d,y:p.y+dy,z:p.z+o.y*d});
const round8=(n:number)=>Math.round(n*8)/8;
function inside(p:P2,poly:P2[]){
  let odd=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}
  return odd;
}
/** A tread's plan outline (winders carry their own polygon). */
function treadOutline(t:Box):P2[]{
  if(t.polygon)return t.polygon;
  const o={x:Math.sin(t.angle??0),y:Math.cos(t.angle??0)},u={x:o.y,y:-o.x};
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,r])=>({x:t.x+u.x*s*t.w/2+o.x*r*t.d/2,y:t.z+u.y*s*t.w/2+o.y*r*t.d/2}));
}

/** The walking side of each guard run, found by probing 3 in either side of its middle over the levels and treads. */
export function glassRuns(runs:RailRun[],levels:DeckLevel[],treads:Box[]):GlassRun[]{
  const surfaces=[...levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...treads.map(treadOutline)];
  const walkable=(p:P2)=>surfaces.some(poly=>inside(p,poly));
  return runs.flatMap(r=>{
    const d={x:r.b.x-r.a.x,y:r.b.z-r.a.z},planLength=len2(d);if(planLength<1)return [];
    const u={x:d.x/planLength,y:d.y/planLength},hint={x:u.y,y:-u.x},m={x:(r.a.x+r.b.x)/2,y:(r.a.z+r.b.z)/2};
    const probe=(s:number)=>walkable({x:m.x+hint.x*3*s,y:m.y+hint.y*3*s});
    // The outline winds so that (u.y, -u.x) points out; trust the probe when it is decisive.
    const flip=probe(1)&&!probe(-1);
    return [{a:r.a,b:r.b,u,out:flip?{x:-hint.x,y:-hint.y}:hint,sloped:Math.abs(r.a.y-r.b.y)>.01,planLength}];
  });
}

/** Across the run (along `out`), where the glass mid-plane sits relative to the guard line, per mount. */
function glassOffset(data:DeckData,mount:GlassMount,sloped:boolean){
  if(sloped)return mount==='Spigots'?SPIGOT.standoff+GLASS.thick/2:SHOE.w/2;
  if(mount==='Fascia-mount base shoe')return finishedFasciaOffset(data)+SHOE.w/2;
  if(mount==='Spigots')return -SPIGOT.d/2-.5;
  return -SHOE.w/2;
}
/** How far the glass bottom sits above (+) or below (−) the walking surface. */
function glassBottom(mount:GlassMount,sloped:boolean){
  if(sloped)return mount==='Spigots'?-4:-1-SHOE.embed;
  return mount==='Fascia-mount base shoe'?-1-SHOE.embed:mount==='Spigots'?SPIGOT.glassLift:SHOE.h-SHOE.embed;
}

export function framelessGlassLayout(data:DeckData,railRuns:RailRun[],ctx:{levels:DeckLevel[];treads:Box[];railHeight:number}):FramelessGlassLayout{
  const mount=glassMountOf(data),finish=glassFinishOf(data),height=ctx.railHeight,runs=glassRuns(railRuns,ctx.levels,ctx.treads);
  const panels:GlassPanel[]=[],shoes:GlassShoe[]=[],spigots:GlassSpigot[]=[],handrails:GlassHandrail[]=[],brackets:{run:number;at:V3}[]=[],issues:string[]=[];
  // Flat runs that meet end to end turn a corner: offset lines are extended or trimmed to meet (offset·tan(θ/2)).
  const key=(p:V3)=>`${p.x.toFixed(1)}:${p.y.toFixed(1)}:${p.z.toFixed(1)}`;
  const ends=new Map<string,{run:number;end:'a'|'b'}[]>();
  runs.forEach((r,i)=>{if(r.sloped)return;for(const end of ['a','b'] as const){const k=key(r[end]);ends.set(k,[...(ends.get(k)??[]),{run:i,end}]);}});
  const trim=(i:number,end:'a'|'b',off:number)=>{
    const other=(ends.get(key(runs[i][end]))??[]).find(e=>e.run!==i);if(!other)return 0;
    const r=runs[i],q=runs[other.run],dir=end==='b'?r.u:{x:-r.u.x,y:-r.u.y},next=other.end==='a'?q.u:{x:-q.u.x,y:-q.u.y};
    // Lines p0 + dir·t (this run's offset line) and p0' + next·s (the other's) meet where the corner is.
    const p0={x:r[end].x+r.out.x*off,y:r[end].z+r.out.y*off},p1={x:q[other.end].x+q.out.x*off,y:q[other.end].z+q.out.y*off};
    const den=dir.x*next.y-dir.y*next.x;if(Math.abs(den)<1e-6)return 0;
    const w={x:p1.x-p0.x,y:p1.y-p0.y};return (w.x*next.y-w.y*next.x)/den;
  };
  let freeEnds=0;
  runs.forEach((r,i)=>{
    const off=glassOffset(data,mount,r.sloped),bottom=glassBottom(mount,r.sloped);
    const ta=r.sloped?0:trim(i,'a',off),tb=r.sloped?0:trim(i,'b',off);
    // Glass line along the run, moved across by the mount's offset and lengthened or shortened at corners.
    const a0=shift(r.a,r.out,off),b0=shift(r.b,r.out,off),L=r.planLength,start=-ta,stop=L+tb,span=stop-start;
    const pt=(t:number):V3=>{const f=t/L;return {x:a0.x+(b0.x-a0.x)*f,y:a0.y+(b0.y-a0.y)*f,z:a0.z+(b0.z-a0.z)*f};};
    const room=span-2*GLASS.endGap,k=Math.max(1,Math.ceil((room+GLASS.gap)/(GLASS.maxPanel+GLASS.gap))),w=(room-(k-1)*GLASS.gap)/k;
    if(room<1)return;
    if(w<GLASS.minPanel)issues.push(`A ${Math.round(span)} in stretch of frameless glass takes a ${round8(w)} in panel, narrower than ${GLASS.minPanel} in: have the supplier make it to size.`);
    const panelHeight=height-bottom;
    for(let j=0;j<k;j++){
      const t0=start+GLASS.endGap+j*(w+GLASS.gap),t1=t0+w,pa=pt(t0),pb=pt(t1);
      panels.push({run:i,a:{...pa,y:pa.y+bottom},b:{...pb,y:pb.y+bottom},width:w,height:panelHeight});
      if(mount==='Spigots')for(const f of [.25,.75]){const s=pt(t0+w*f);spigots.push({run:i,at:shift(s,r.out,r.sloped?-SPIGOT.standoff-GLASS.thick/2:0,r.sloped?-3:0),out:r.out,side:r.sloped});}
      if(r.sloped)brackets.push(...(k===1?[.25,.75]:[.5]).map(f=>{const c=pt(t0+w*f);return {run:i,at:shift(c,r.out,-GLASS.thick/2-HANDRAIL.standoff,HANDRAIL.heightIn)};}));
    }
    if(mount!=='Spigots'){
      // The shoe runs the whole glass line, and past a joined corner by half its width so the two pieces meet.
      const ext=(t:number)=>t?SHOE.w/2:0,sa=pt(start-(ta?ext(ta):0)),sb=pt(stop+(tb?ext(tb):0));
      const fascia=r.sloped||mount==='Fascia-mount base shoe',top=r.sloped||fascia?-1:SHOE.h;
      shoes.push({run:i,a:{...sa,y:sa.y+top},b:{...sb,y:sb.y+top},out:r.out,raked:r.sloped,fascia});
      freeEnds+=(ta?0:1)+(tb?0:1);
    }
    if(r.sloped){const ha=shift(pt(start),r.out,-GLASS.thick/2-HANDRAIL.standoff,HANDRAIL.heightIn),hb=shift(pt(stop),r.out,-GLASS.thick/2-HANDRAIL.standoff,HANDRAIL.heightIn);handrails.push({run:i,a:ha,b:hb});}
  });
  if(mount==='Fascia-mount base shoe'&&(data.pictureFrameRows||data.pattern==='Picture Frame')&&pictureFrameOverhang(data)>SHOE.w/2-GLASS.thick/2)
    issues.push(`Fascia-mounted glass: the picture-frame boards overhang the fascia by ${pictureFrameOverhang(data)} in and would reach the glass. Cut the overhang back to ${SHOE.w/2-GLASS.thick/2} in along the glass before construction.`);
  const sizes=new Map<string,{widthIn:number;heightIn:number;count:number}>();
  for(const p of panels){const w=round8(p.width),h=round8(p.height),k=`${w}x${h}`;const s=sizes.get(k)??{widthIn:w,heightIn:h,count:0};s.count++;sizes.set(k,s);}
  const dist=(a:V3,b:V3)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  return {mount,finish,height,runs,panels,shoes,spigots,handrails,brackets,issues,
    quantities:{panels:panels.length,glassSqft:panels.reduce((n,p)=>n+p.width*p.height/144,0),panelSizes:[...sizes.values()].sort((p,q)=>q.count-p.count||q.widthIn-p.widthIn),
      shoeLf:shoes.reduce((n,s)=>n+dist(s.a,s.b)/12,0),shoeEndCaps:freeEnds,spigots:spigots.length,handrailLf:handrails.reduce((n,h)=>n+dist(h.a,h.b)/12,0),handrailBrackets:brackets.length}};
}

/** Panels as members (mid-height centre line, glass thickness × panel height) for the takeoff's `glass` list and exports. */
export function glassPanelMembers(layout:FramelessGlassLayout):Member[]{
  return layout.panels.map(p=>({a:{...p.a,y:p.a.y+p.height/2},b:{...p.b,y:p.b.y+p.height/2},width:GLASS.thick,depth:p.height}));
}
/** The shoe, handrail, spigots and brackets as solid pieces (for exports): members run along their centre lines. */
export function glassHardwarePieces(layout:FramelessGlassLayout){
  const shoes:Member[]=layout.shoes.map(s=>({a:{...s.a,y:s.a.y-SHOE.h/2},b:{...s.b,y:s.b.y-SHOE.h/2},width:SHOE.w,depth:SHOE.h}));
  const handrails:Member[]=layout.handrails.map(h=>({a:h.a,b:h.b,width:HANDRAIL.d,depth:HANDRAIL.d}));
  const spigots:Box[]=layout.spigots.map(p=>p.side?{x:p.at.x,y:p.at.y,z:p.at.z,w:SPIGOT.d,h:SPIGOT.d,d:SPIGOT.d}:{x:p.at.x,y:p.at.y+SPIGOT.h/2,z:p.at.z,w:SPIGOT.d,h:SPIGOT.h,d:SPIGOT.d});
  const brackets:Box[]=layout.brackets.map(({at:p})=>({x:p.x,y:p.y-1,z:p.z,w:1,h:2,d:1}));
  return {shoes,handrails,spigots,brackets};
}
