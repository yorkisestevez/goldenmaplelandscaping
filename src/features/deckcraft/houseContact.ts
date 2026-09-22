import type {DeckData} from './types';
import {getFootprint,type EdgeContact,type EdgeName,type FootprintPlan,type PlanPoint} from './lib/deckGeometry';
import {getHousePlacement} from './housePlacement';
import {activeWrap} from './lib/wrapGeometry';

/**
 * Single source of truth for where the deck meets the house. Nothing else may find
 * the house by testing y≈0 or a 'Back' edge.
 *
 * Plan space (inches): +x along the deck width, +y toward the yard; y = 0 is the
 * house's deck-facing wall. Only the main deck level, in its own unshifted plan
 * coordinates, can touch the house; second levels, landings and winders never do.
 */
export type HouseWallId='front'|'left'|'right'|'far';
export interface ContactSegment{wall:HouseWallId;edgeIndex:number;a:PlanPoint;b:PlanPoint;lengthIn:number;
  /** Unit vector from the wall into the deck. */
  inward:PlanPoint}
export interface HouseContact extends EdgeContact{
  contacts:ContactSegment[];
  /** Total ledger length in feet (rounded to avoid float noise in quantities). */
  ledgerLf:number;
  /** True when a straight piece (e.g. a rim board) lies along a ledger contact. */
  onContact(a:PlanPoint,b:PlanPoint):boolean;
}

const TOL=0.5;
export const deckAttachesToHouse=(data:Pick<DeckData,'deckType'>)=>data.deckType==='Attached'||data.deckType==='Add-on';

function contactFrom(contacts:ContactSegment[],houseLine:number[]=contacts.map(c=>c.edgeIndex)):HouseContact{
  const edges=new Set(contacts.map(c=>c.edgeIndex)),line=new Set(houseLine);
  const along=(c:ContactSegment,p:PlanPoint)=>((p.x-c.a.x)*(c.b.x-c.a.x)+(p.y-c.a.y)*(c.b.y-c.a.y))/c.lengthIn;
  const off=(c:ContactSegment,p:PlanPoint)=>Math.abs((p.x-c.a.x)*(c.b.y-c.a.y)-(p.y-c.a.y)*(c.b.x-c.a.x))/c.lengthIn;
  return {
    contacts,
    ledgerLf:Math.round(contacts.reduce((n,c)=>n+c.lengthIn,0)/12*1e6)/1e6,
    isContactEdge:i=>edges.has(i),
    isFlushEdge:i=>line.has(i),
    onContact:(a,b)=>contacts.some(c=>[a,b].every(p=>off(c,p)<TOL&&along(c,p)>-TOL&&along(c,p)<c.lengthIn+TOL)),
  };
}
export const NO_HOUSE_CONTACT:HouseContact=contactFrom([]);

/** Back-line edges: on y = 0 and facing the house (run +x, outward −y). */
function houseLineEdges(fp:FootprintPlan){
  return fp.outline.map((a,i)=>({a,b:fp.outline[(i+1)%fp.outline.length],index:i}))
    .filter(({a,b})=>Math.abs(a.y)<TOL&&Math.abs(b.y)<TOL&&b.x-a.x>TOL);
}

/** Ledger contacts of the main deck level. An unpositioned house is treated as spanning the
 * whole back edge (the original behaviour); a positioned one only covers its own width. */
export function getHouseContact(data:DeckData,fp:FootprintPlan=getFootprint(data,1)):HouseContact{
  if(!deckAttachesToHouse(data))return NO_HOUSE_CONTACT;
  const wrapped=!!activeWrap(data),house=data.housePlacement||wrapped?getHousePlacement(data):null,line=houseLineEdges(fp);
  const contacts:ContactSegment[]=line
    .filter(({a,b})=>!house||(a.x>house.x0-TOL&&b.x<house.x1+TOL))
    .map(({a,b,index})=>({wall:'front',edgeIndex:index,a,b,lengthIn:b.x-a.x,inward:{x:0,y:1}}));
  // Wrap wings bear on the house side walls: the right wall (x = x1) faces +x, the left (x = x0) −x.
  if(house&&wrapped)fp.outline.forEach((a,index)=>{
    const b=fp.outline[(index+1)%fp.outline.length],onWall=(x:number)=>Math.abs(a.x-x)<TOL&&Math.abs(b.x-x)<TOL&&Math.min(a.y,b.y)>-house.depthIn-TOL&&Math.max(a.y,b.y)<TOL;
    if(onWall(house.x1)&&b.y<a.y-TOL)contacts.push({wall:'right',edgeIndex:index,a,b,lengthIn:a.y-b.y,inward:{x:1,y:0}});
    if(onWall(house.x0)&&b.y>a.y+TOL)contacts.push({wall:'left',edgeIndex:index,a,b,lengthIn:b.y-a.y,inward:{x:-1,y:0}});
  });
  // The picture-frame border stays flush along the whole back line (ledger or exposed stretch),
  // so the finished outline never jogs at a house corner.
  return contactFrom(contacts,line.map(e=>e.index));
}

/** Stretches of the deck's back line that are NOT against the house (deck wider than the
 * house). They need a rail, and a beam with posts instead of a ledger. [x0, x1] pairs, inches. */
export function exposedHouseLine(data:DeckData,fp:FootprintPlan,contact:EdgeContact):[number,number][]{
  if(!deckAttachesToHouse(data))return [];
  return houseLineEdges(fp).filter(e=>!contact.isContactEdge(e.index)).map(e=>[e.a.x,e.b.x] as [number,number]);
}

const SIDE_DIRECTIONS:Record<EdgeName,PlanPoint>={Front:{x:0,y:1},Left:{x:-1,y:0},Right:{x:1,y:0},Back:{x:0,y:-1}};
const outwardOf=(a:PlanPoint,b:PlanPoint)=>{const len=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:(b.y-a.y)/len,y:-(b.x-a.x)/len};};
const faces=(a:PlanPoint,b:PlanPoint,side:EdgeName)=>{const o=outwardOf(a,b),d=SIDE_DIRECTIONS[side];return o.x*d.x+o.y*d.y>.7;};

/** Exposed (non-house) outline edges facing a side, longest first. */
export function exposedEdges(fp:FootprintPlan,contact:EdgeContact,side:EdgeName){
  return fp.outline.map((a,i)=>({a,b:fp.outline[(i+1)%fp.outline.length],index:i}))
    .filter(e=>!contact.isContactEdge(e.index)&&faces(e.a,e.b,side))
    .map(e=>({...e,lengthIn:Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)}))
    .sort((p,q)=>q.lengthIn-p.lengthIn);
}
/** Deck sides with at least one exposed edge — where stairs and screens can go. */
export function exposedSides(fp:FootprintPlan,contact:EdgeContact):EdgeName[]{
  return (['Front','Left','Right','Back'] as const).filter(side=>exposedEdges(fp,contact,side).length>0);
}
/** Stair sides available on the main deck. */
export function availableStairSides(data:DeckData):EdgeName[]{
  const fp=getFootprint(data,1);return exposedSides(fp,getHouseContact(data,fp));
}
