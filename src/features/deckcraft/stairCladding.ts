import type {DeckTakeoff,DeckLevel} from './deckTakeoff';
import type {RiserBoard} from './stairConstruction';
import type {DeckData} from './types';
import type {SkirtingSlab} from './skirting';
import type {PlanPoint} from './lib/deckGeometry';
import {getTerrainConfig} from './yardSettings';
import {finishedFasciaOffset} from './lib/finishedFootprint';
import {levelJunctions,worldOutline} from './lib/levelJunctions';

/**
 * The finish boards that make stairs and level joins look built, not framed (owner decision 2026-09-25). Pure data,
 * worked out from the takeoff, never stored in it:
 * - Stair sides: a stepped fascia panel over each outer stringer, from the ground (or the deck the step stands on) up
 *   to the underside of each tread, 0.25 in proud of the tread and riser ends, so no raw stringer shows.
 * - Level drops: where a higher level meets a lower one, the face between the lower deck's surface and the underside of
 *   the higher level's rim is boarded, flush under its fascia, outside the step openings.
 * - Rim corners: the outer corner square the two rim pieces leave open at every outside corner is filled (drawn only).
 * - The top riser: drawn on the rim's face, never inside the rim or in its plane (drawnRiserBoards).
 * Quantities are listed for a builder quote (calculations.ts), never priced at $0.
 */
export type CladdingPart='level-drop'|'step-end'|'stair-side';
export type CladdingSlab=SkirtingSlab&{part:CladdingPart};
export interface CladdingPlan{slabs:CladdingSlab[];fillers:SkirtingSlab[];sqft:Record<CladdingPart,number>;notes:string[]}

const THICK=.75,PROUD=.25,MIN_FACE=.25,RIM_FACE=.75;
const area=(s:SkirtingSlab)=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)*((s.topA-s.bottomA)+(s.topB-s.bottomB))/2/144;
function inside(p:PlanPoint,poly:PlanPoint[]){
  let odd=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}
  return odd;
}
/** The rim's underside along a level (its rim pieces all share one depth). */
const rimUnderside=(l:DeckLevel)=>{const r=l.rim?.[0];return r?r.a.y-r.depth/2:l.top-10.25;};

/** Skirting3D's slab geometry winds a face toward (b−a)×up, i.e. with `out` on the LEFT of a→b in plan. Skirting draws
 * both sides so it doesn't mind; the fascia material draws front faces only, so every piece here is turned that way. */
function facing<T extends SkirtingSlab>(s:T):T{
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
  return dx*s.out.y-dy*s.out.x>=0?s:{...s,a:s.b,b:s.a,bottomA:s.bottomB,bottomB:s.bottomA,topA:s.topB,topB:s.topA};
}
export function claddingPlan(data:DeckData,model:DeckTakeoff):CladdingPlan{
  const terrain=getTerrainConfig(data),ground=(p:PlanPoint)=>terrain.elevationIn+p.y*terrain.slopePct/100;
  const slabs:CladdingSlab[]=[],notes:string[]=[];
  const decks=model.levels.map((l,i)=>({l,i,poly:l.kind==='winder'?null:worldOutline(l)})).filter(d=>d.poly);
  // 1. Stair sides and step ends, per going.
  for(const f of model.flights){
    if(!f.outward||!f.along||f.risers<2)continue;
    const o=f.outward,u=f.along,half=f.width/2+(f.endExtend??0),start={x:f.start.x,y:f.start.z};
    const at=(t:number,side:number,across:number)=>({x:start.x+o.x*t+u.x*side*(half+across),y:start.y+o.y*t+u.y*side*(half+across)});
    // A step that stands on a deck level is boarded down to that deck; any other flight down to the ground.
    const mid=at((f.risers-1)*f.run/2,0,0),deck=decks.find(d=>Math.abs(d.l.top-f.end.y)<.6&&inside(mid,d.poly!));
    const part:CladdingPart=f.kind==='connection'?'step-end':'stair-side';
    for(const side of [-1,1])for(let i=1;i<f.risers;i++){
      const t0=(i-1)*f.run,t1=i*f.run,top=f.start.y-i*f.rise-1,a=at(t0,side,PROUD-THICK/2),b=at(t1,side,PROUD-THICK/2);
      const bottomA=deck?deck.l.top:ground(a),bottomB=deck?deck.l.top:ground(b);
      if(top-Math.max(bottomA,bottomB)<MIN_FACE)continue;
      slabs.push({part,a,b,out:{x:u.x*side,y:u.y*side},thick:THICK,bottomA,topA:top,bottomB,topB:top});
    }
  }
  if(model.flights.some(f=>f.type==='Winder'))notes.push('Winder stair: the curved stringer sides are left for the builder to board on site.');
  // 2. Level drops: the face under the higher level's rim, down to the lower deck, outside the step openings.
  const fo=finishedFasciaOffset(data);
  for(const j of levelJunctions(model.levels)){
    const upper=model.levels[j.upper],lower=model.levels[j.lower],top=rimUnderside(upper),bottom=lower.top;
    if(top-bottom<MIN_FACE)continue;
    const along=(p:PlanPoint)=>(p.x-j.a.x)*j.u.x+(p.y-j.a.y)*j.u.y,across=(p:PlanPoint)=>Math.abs((p.x-j.a.x)*j.u.y-(p.y-j.a.y)*j.u.x);
    let spans:[number,number][]=[[-fo,j.length+fo]];
    for(const f of model.flights){
      const s={x:f.start.x,y:f.start.z};if(f.kind!=='connection'||across(s)>3||Math.abs(f.start.y-upper.top)>.6)continue;
      const c=along(s),w=f.width/2+(f.endExtend??0);
      spans=spans.flatMap(([p,q]):[number,number][]=>q<=c-w||p>=c+w?[[p,q]]:[...(p<c-w?[[p,c-w] as [number,number]]:[]),...(q>c+w?[[c+w,q] as [number,number]]:[])]);
    }
    for(const [p,q] of spans){
      if(q-p<1)continue;
      const shift=fo-THICK/2,pt=(t:number)=>({x:j.a.x+j.u.x*t+j.out.x*shift,y:j.a.y+j.u.y*t+j.out.y*shift});
      slabs.push({part:'level-drop',a:pt(p),b:pt(q),out:j.out,thick:THICK,bottomA:bottom,topA:top,bottomB:bottom,topB:top});
    }
  }
  // 3. Rim corners: the outer square two rim pieces leave at an outside corner (drawn only; framing is unchanged).
  const fillers:SkirtingSlab[]=[];
  for(const {l,poly} of decks){
    const r=l.rim?.[0];if(!r)continue;const P=poly!,top=r.a.y+r.depth/2,bottom=r.a.y-r.depth/2;
    P.forEach((v,i)=>{
      const p=P[(i+P.length-1)%P.length],q=P[(i+1)%P.length],l1=Math.hypot(v.x-p.x,v.y-p.y),l2=Math.hypot(q.x-v.x,q.y-v.y);if(l1<1||l2<1)return;
      const d1={x:(v.x-p.x)/l1,y:(v.y-p.y)/l1},d2={x:(q.x-v.x)/l2,y:(q.y-v.y)/l2},n1={x:d1.y,y:-d1.x},turn=Math.acos(Math.max(-1,Math.min(1,d1.x*d2.x+d1.y*d2.y)));
      // An outside corner turns away from the outward normal (outlines wind so that (u.y, −u.x) points out).
      if(d2.x*n1.x+d2.y*n1.y>=-1e-6||turn<1e-3)return;
      const ext=RIM_FACE*Math.tan(turn/2),a={x:v.x+n1.x*RIM_FACE/2,y:v.y+n1.y*RIM_FACE/2};
      fillers.push({a,b:{x:a.x+d1.x*ext,y:a.y+d1.y*ext},out:n1,thick:RIM_FACE,bottomA:bottom,topA:top,bottomB:bottom,topB:top});
    });
  }
  const sqft={'level-drop':0,'step-end':0,'stair-side':0} as Record<CladdingPart,number>;
  slabs.splice(0,slabs.length,...slabs.map(facing));fillers.splice(0,fillers.length,...fillers.map(facing));
  for(const s of slabs)sqft[s.part]+=area(s);
  return {slabs,fillers,sqft,notes};
}

/**
 * The riser boards as drawn and exported. The top riser of a flight that leaves a deck's edge stands on the rim's face
 * (its back against the rim), so it never sits inside the rim or in the plane of its face. The takeoff's own riser boards
 * (schedule, stock and counts) are unchanged.
 */
export function drawnRiserBoards(data:DeckData,model:DeckTakeoff):RiserBoard[]{
  const start=(data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0;
  const afterWinder=new Set(model.flights.filter(f=>f.type==='Winder').map(f=>f.id.replace(/-winders$/,'-lower')));
  return model.riserBoards.map(b=>{
    const f=model.flights.find(x=>x.id===b.flightId);
    if(b.riserIndex!==0||!f?.outward||afterWinder.has(f.id))return b;
    const shift=Math.max(0,RIM_FACE-start)+b.d;
    return {...b,x:b.x+f.outward.x*shift,z:b.z+f.outward.y*shift};
  });
}
