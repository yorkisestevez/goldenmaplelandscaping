import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {PoolFeature} from './poolTypes';
import type {PlanPoint} from './lib/deckGeometry';
import type {FixturePlacement} from './extrasLayout';
import {insidePolygon} from './lib/polygonCuts';
import {getLightingRuntimeProduct} from './lightingRuntimeCatalogue';
import {POOL_LENS_IN,POOL_LIGHT_ID} from './poolLightSpec';

/**
 * Where professionals put outdoor lights, as auto-placement and as design-checker flags (the Golden Maple lighting
 * best practices: Jandy, Hayward and Hydrel pool guides, CEC Section 68 and ESA 68-7-16, FX Luminaire, In-Lite and
 * Techo-Bloc). Pure geometry in model inches; no three and no clipper, so the eager layout can use it.
 * Pool water is read as its outline's rectangle (the rounded corners are ignored), which is close enough for these
 * distances.
 */
export const LIGHTING_RULES={
 /** Top of an underwater lens below the normal water level: 18 in (450 mm) up to 600 mm. */
 poolLensTopBelowWaterIn:18,poolLensTopMaxBelowWaterIn:23.6,
 /** Water at least this deep where an underwater light sits. */
 poolLightMinWaterIn:30,
 /** About one full-size niche light per 12 ft of lit wall. */
 poolLightSpacingFt:12,
 /** Fixtures and supports within 3 m of the pool wall need a GFCI-protected supply; a transformer stays outside it. */
 poolClearanceIn:120,
 /** A flush light this close to the coping's outer edge throws glare across the water. */
 copingMarkerClearIn:36,
 /** Flush pool-deck markers in the whole pool deck. */
 maxPoolDeckMarkers:4,
 /** A gathering floor is its furniture plus this much all round. */
 floorPadIn:24,firePadIn:36,
 /** A stair wider than this takes 2 under-step lights per tread. */
 singleStairLightMaxWidthIn:60,
} as const;

type Place={x:number;z:number;y:number;angle:number};
const local=(p:Pick<PoolFeature,'xIn'|'zIn'|'rotationDeg'>)=>{const a=p.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {world:(u:number,v:number)=>({x:p.xIn+c*u-s*v,z:p.zIn+s*u+c*v}),dir:(u:number,v:number)=>({x:c*u-s*v,z:s*u+c*v})};};
const bounds=(p:Pick<PoolFeature,'outline'>)=>{const xs=p.outline.map(q=>q.x),ys=p.outline.map(q=>q.y);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};};
/** The water outline's rectangle in world inches. */
export function poolWaterRing(p:Pick<PoolFeature,'xIn'|'zIn'|'rotationDeg'|'outline'>):PlanPoint[]{
 const b=bounds(p),t=local(p);return [[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]].map(([u,v])=>{const w=t.world(u,v);return {x:w.x,y:w.z};});
}
export const poolWaterLevel=(p:Pick<PoolFeature,'copingTopElevationIn'|'waterOffsetIn'>)=>p.copingTopElevationIn-(p.waterOffsetIn??6);
const deepest=(p:Pick<PoolFeature,'depthProfile'>)=>Math.max(0,...(p.depthProfile??[]).map(d=>d.depthIn));

/** Distance from a point to a ring's edges. */
export function ringDistance(x:number,z:number,ring:PlanPoint[]){
 let best=Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dy)/l2));best=Math.min(best,Math.hypot(x-(a.x+dx*t),z-(a.y+dy*t)));}
 return best;
}

/**
 * Underwater lights for one pool (P2, P4, P5): in the wall nearest the house, shining away from it, one per 12 ft of
 * that wall, evenly spaced with the end lights half a space from the corners, all at one depth (lens top 18 in below
 * the water). When the pool runs end-on to the house, the nearest wall is a short end, so the lights go in the two
 * long side walls instead, facing across the pool. Each place faces into the water along its local +z.
 */
export function poolLightPlaces(pool:PoolFeature,houseRings:PlanPoint[][]):Place[]{
 const b=bounds(pool),t=local(pool),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
 // The four walls: a point on each, its inward normal (local), and the run along it.
 const walls=[
  {u:cx,v:b.minY,n:[0,1],along:[1,0],len:b.maxX-b.minX},
  {u:cx,v:b.maxY,n:[0,-1],along:[1,0],len:b.maxX-b.minX},
  {u:b.minX,v:cy,n:[1,0],along:[0,1],len:b.maxY-b.minY},
  {u:b.maxX,v:cy,n:[-1,0],along:[0,1],len:b.maxY-b.minY},
 ];
 const centre=t.world(cx,cy);
 let house:{x:number;z:number}|undefined,far=Infinity;
 for(const ring of houseRings)for(const q of ring){const d=Math.hypot(q.x-centre.x,q.y-centre.z);if(d<far){far=d;house={x:q.x,z:q.y};}}
 // Without a house, the walls along local −y (the default house side) carry the lights.
 const toHouse=house?{x:house.x-centre.x,z:house.z-centre.z}:t.dir(0,-1);
 const facing=(w:typeof walls[number])=>{const o=t.dir(-w.n[0],-w.n[1]);return o.x*toHouse.x+o.z*toHouse.z;};
 const nearest=[...walls].sort((a,c)=>facing(c)-facing(a))[0];
 const long=Math.max(...walls.map(w=>w.len));
 const lit=nearest.len>=long-1?[nearest]:walls.filter(w=>w.len>=long-1);
 const y=poolWaterLevel(pool)-LIGHTING_RULES.poolLensTopBelowWaterIn-POOL_LENS_IN/2;
 const out:Place[]=[];
 for(const w of lit){
  const n=Math.max(1,Math.ceil(w.len/12/LIGHTING_RULES.poolLightSpacingFt-1e-6));
  for(let i=0;i<n;i++){
   const s=-w.len/2+w.len*(i+.5)/n,p=t.world(w.u+w.along[0]*s+w.n[0]*.1,w.v+w.along[1]*s+w.n[1]*.1),d=t.dir(w.n[0],w.n[1]);
   out.push({x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10,y:Math.round(y*10)/10,angle:Math.atan2(d.x,d.z)});
  }
 }
 return out;
}

const STANDING=new Set(['bollard','spot']);
function rect(x:number,z:number,w:number,d:number,angle:number,pad:number):PlanPoint[]{
 const c=Math.cos(angle),s=Math.sin(angle),W=w+2*pad,D=d+2*pad;
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+c*u*W/2-s*v*D/2,y:z+s*u*W/2+c*v*D/2}));
}
const geometryOf=(id:string)=>getLightingRuntimeProduct(id)?.geometry;
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;

/**
 * Design-checker flags for light placement. Nothing is flagged when the design has no fixtures.
 * - pool: an enabled pool with no underwater light; a pool light shallower than 18 in or deeper than 600 mm, in water
 *   under 30 in deep, or aimed toward the house; flush lights in the coping or within 36 in of it; over 4 pool-deck markers.
 * - floors: a flush light inside a dining, lounge or fire-seating floor.
 * - steps: fewer under-step lights than treads (2 a tread on a stair over 60 in wide).
 * - paths: a path light or stake light outside a planting bed.
 * - pool clearance: fixtures within 3 m of the pool (GFCI supply, LEC/ESA); a transformer within 3 m.
 */
export function lightingPlacementIssues(data:DeckData,model:Pick<DeckTakeoff,'treads'>,fixtures:FixturePlacement[],opts:{treadWidths?:number[];houseRings?:PlanPoint[][]}={}):string[]{
 const lights=fixtures.filter(f=>{const g=geometryOf(f.productId);return !!g&&!['cable','accessory'].includes(g);});
 const lit=lights.filter(f=>geometryOf(f.productId)!=='transformer');
 if(!lit.length)return [];
 const issues:string[]=[];
 const pools=(data.pools??[]).filter(p=>p.enabled);
 const poolLights=lit.filter(f=>f.productId===POOL_LIGHT_ID);
 for(const pool of pools){
  const ring=poolWaterRing(pool),inWall=poolLights.filter(f=>ringDistance(f.x,f.z,ring)<3);
  if(!inWall.length){issues.push(`${pool.name} has no underwater light. Set 12 V niche lights in the wall nearest the house, shining away from it, lens top 18 in below the water.`);continue;}
  const water=poolWaterLevel(pool);
  for(const f of inWall){
   const below=water-(f.y+POOL_LENS_IN/2);
   if(below<LIGHTING_RULES.poolLensTopBelowWaterIn-.5||below>LIGHTING_RULES.poolLensTopMaxBelowWaterIn+.5){issues.push(`${pool.name}: an underwater light's lens top is ${below.toFixed(0)} in below the water. Set it 18 in down (no deeper than 600 mm unless it is rated deeper).`);break;}
  }
  if(deepest(pool)<LIGHTING_RULES.poolLightMinWaterIn)issues.push(`${pool.name} is under 30 in deep. Underwater lights need 30 in of water; use a light listed for shallow water.`);
  // Aimed toward the house: the beam has to point away from it (P2, P3).
  const houseRings=opts.houseRings??[];
  if(houseRings.length&&inWall.some(f=>{let best:{x:number;y:number}|undefined,d=Infinity;for(const r of houseRings)for(const q of r){const e=Math.hypot(q.x-f.x,q.y-f.z);if(e<d){d=e;best=q;}}
   return !!best&&d>0&&(Math.sin(f.angle)*(best.x-f.x)+Math.cos(f.angle)*(best.y-f.z))/d>.3;}))issues.push(`${pool.name}: an underwater light shines toward the house. Put the lights in the wall nearest the house, aimed away from it and from the main seating.`);
 }
 // Flush lights in or by the coping.
 const recessed=lit.filter(f=>geometryOf(f.productId)==='recessed'&&f.zone!=='posts'&&f.zone!=='stairs');
 let inCoping=0,nearCoping=0;
 for(const pool of pools){
  const ring=poolWaterRing(pool),cope=(pool.coping?.widthIn??12)-(pool.coping?.overhangIn??1);
  for(const f of recessed){if(insidePolygon({x:f.x,y:f.z},ring))continue;const d=ringDistance(f.x,f.z,ring);if(d<cope+.5)inCoping++;else if(d<cope+LIGHTING_RULES.copingMarkerClearIn)nearCoping++;}
 }
 if(inCoping)issues.push(`${plural(inCoping,'flush light')} ${inCoping===1?'sits':'sit'} in the pool coping. Coping is not lit: the underwater lights light the pool, and a light on the edge glares across the water.`);
 if(nearCoping)issues.push(`${plural(nearCoping,'flush light')} ${nearCoping===1?'is':'are'} within 36 in of the pool coping. Keep pool-deck markers 36–48 in out, at the entry and the corners of the walk.`);
 const deckMarkers=recessed.filter(f=>f.zone==='pool-deck').length;
 if(deckMarkers>LIGHTING_RULES.maxPoolDeckMarkers)issues.push(`The pool deck has ${deckMarkers} flush markers. Four or fewer read as a walk; more read as a runway.`);
 // Flush lights in the middle of a gathering floor.
 const floors:{name:string;ring:PlanPoint[]}[]=[];
 for(const o of data.landscapeObjects??[])if(o.enabled!==false&&o.kind==='furniture')floors.push({name:o.name,ring:rect(o.xIn,o.zIn,o.widthIn,o.depthIn,(o.rotationDeg??0)*Math.PI/180,LIGHTING_RULES.floorPadIn)});
 for(const f of data.yardFeatures??[])if(f.enabled!==false&&f.kind==='fire-feature')floors.push({name:f.name,ring:rect(f.xFt*12,f.zFt*12,f.widthFt*12,f.depthFt*12,(f.rotationDeg??0)*Math.PI/180,LIGHTING_RULES.firePadIn)});
 const onFloor=recessed.filter(f=>floors.some(r=>insidePolygon({x:f.x,y:f.z},r.ring)));
 if(onFloor.length){const names=[...new Set(onFloor.map(f=>floors.find(r=>insidePolygon({x:f.x,y:f.z},r.ring))!.name))].slice(0,3).join(', ');issues.push(`${plural(onFloor.length,'flush light')} ${onFloor.length===1?'sits':'sit'} in the middle of a seating floor (${names}). Light floors from above, the walls and the edges; keep in-ground lights to the borders.`);}
 // Step lights: one per tread, two on a wide stair.
 const treads=model.treads.length;
 if(treads){
  const widths=opts.treadWidths??[];
  const need=Array.from({length:treads},(_,i)=>(widths[i]??data.stairWidth??0)>LIGHTING_RULES.singleStairLightMaxWidthIn?2:1).reduce((n,k)=>n+k,0);
  const have=lit.filter(f=>f.zone==='stairs'&&geometryOf(f.productId)!=='recessed').length;
  if(have<need)issues.push(`The stairs have ${plural(have,'under-step light')} for ${plural(treads,'tread')}. Light every tread${need>treads?', two a tread on a stair over 60 in wide':''} (${need}).`);
 }
 // Path lights and stake lights stand in planting beds.
 const beds:PlanPoint[][]=(data.landscapeObjects??[]).filter(o=>o.enabled!==false&&o.kind==='bed').map(o=>o.polygon&&o.polygon.length>=3?o.polygon.map(p=>({x:p.x,y:p.z})):rect(o.xIn,o.zIn,o.widthIn,o.depthIn,(o.rotationDeg??0)*Math.PI/180,0));
 if(beds.length){
  const loose=lit.filter(f=>STANDING.has(geometryOf(f.productId)??'')&&!beds.some(b=>insidePolygon({x:f.x,y:f.z},b))).length;
  if(loose)issues.push(`${plural(loose,'path or stake light')} ${loose===1?'stands':'stand'} outside a planting bed. Set them in the bed, 12–18 in back from the walk.`);
 }
 // Within 3 m of the pool.
 if(pools.length){
  const near=(f:FixturePlacement)=>pools.some(p=>{const ring=poolWaterRing(p);return insidePolygon({x:f.x,y:f.z},ring)||ringDistance(f.x,f.z,ring)<LIGHTING_RULES.poolClearanceIn;});
  const hubs=lights.filter(f=>geometryOf(f.productId)==='transformer'&&near(f)).length;
  if(hubs)issues.push('A lighting transformer is within 3 m (10 ft) of the pool. Mount it at least 10 ft from the inside pool wall (CEC 68-062).');
  const close=lit.filter(f=>f.productId!==POOL_LIGHT_ID&&near(f)).length;
  if(close)issues.push(`${plural(close,'fixture')} ${close===1?'is':'are'} within 3 m of the pool. Use a GFCI-protected 12 V supply and fixtures not marked against pool use; a licensed electrical contractor files the ESA permit (CEC 68-066/068, ESA 68-7-16).`);
 }
 return issues;
}
