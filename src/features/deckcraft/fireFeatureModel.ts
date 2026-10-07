import type {DeckData,YardFeature} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {yardArea,yardClip,yardRectangle,yardSignedArea,type YardBox,type YardFeatureModel,type YardRole} from './yardModel';
import {planeAt} from './yardElevationGeometry';
import {fireFeatureProblem,fireProduct} from './fireFeatures';
import {FIRE_CLEARANCE} from './designRules';

/** Clearance from the house, the deck and its stairs, ft, from the draft local rules (designRules.ts FIRE_CLEARANCE): 4 m for a
 * fire-wood-ring, taken to be an approved enclosed wood appliance (confirmed), and 48 in for gas (an unconfirmed
 * default). Warnings carry FIRE_CLEARANCE.confirmedValues so an unconfirmed figure always says so. */
export const FIRE_MIN_CLEARANCE_FT={wood:FIRE_CLEARANCE.woodFt,gas:FIRE_CLEARANCE.gasFt} as const;

/**
 * Fire features in the yard model (advanced runtime only: needsAdvancedYard sends every design with one there).
 * Each stands on the patio it names when its body is wholly on that patio's paving, at the highest point of the paving
 * under it; otherwise on its own 4 in gravel pad, 6 in wider than the body all round, set level at the highest ground
 * under the pad. Boxes (feature-only, not in the model's shared list, so the generic yard renderer and exports leave
 * them alone): 'fire-pad', 'fire-body' (the stone body), and a 'fire-ring' steel insert (wood) or a 'fire-burner' pan
 * (gas). Warnings: clearance from the house, the deck and its stairs (and standing on a stair), a patio sloping more than 2 %, ground varying more than 1 in under
 * a pad. The pad's excavation and gravel are inside the fire pit allowance, so no earthwork is added here.
 */
export const FIRE_PAD_IN=4,FIRE_PAD_MARGIN_IN=6,FIRE_LEVEL_PAD_IN=1,FIRE_LEVEL_SLOPE_PCT=2;
export const fireCircle=(x:number,z:number,r:number,n=32):PlanPoint[]=>Array.from({length:n},(_,i)=>({x:x+Math.cos(i*2*Math.PI/n)*r,y:z+Math.sin(i*2*Math.PI/n)*r}));
/** Plan outline of a fire feature's body, or of its pad when `margin` is the pad's overhang, world inches. */
export function fireOutline(f:YardFeature,margin=0):PlanPoint[]{
 const x=f.xFt*12,z=f.zFt*12;
 return fireProduct(f)?.round?fireCircle(x,z,f.widthFt*6+margin):yardRectangle(x,z,f.widthFt*12+2*margin,f.depthFt*12+2*margin,f.rotationDeg*Math.PI/180);
}
const segmentGap=(p:PlanPoint,a:PlanPoint,b:PlanPoint)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
/** Shortest plan distance between two outlines, inches; 0 where they overlap. */
export function planGapIn(a:PlanPoint[],b:PlanPoint[]):number{
 if(yardArea(yardClip([a],[b],'intersection'))>1e-4)return 0;
 let best=Infinity;
 for(const [s,t] of [[a,b],[b,a]])for(const p of s)for(let i=0;i<t.length;i++)best=Math.min(best,segmentGap(p,t[i],t[(i+1)%t.length]));
 return best;
}
/** A stair flight's plan footprint, world inches: from its top to its foot at its width (a tapered foot at endWidth). */
export function flightFootprint(f:DeckTakeoff['flights'][number]):PlanPoint[]{
 const dx=f.end.x-f.start.x,dz=f.end.z-f.start.z,len=Math.hypot(dx,dz)||1,a=f.along??{x:-dz/len,y:dx/len},w=(f.width||36)/2,we=(f.endWidth??f.width??36)/2;
 return [{x:f.start.x-a.x*w,y:f.start.z-a.y*w},{x:f.start.x+a.x*w,y:f.start.z+a.y*w},{x:f.end.x+a.x*we,y:f.end.z+a.y*we},{x:f.end.x-a.x*we,y:f.end.z-a.y*we}];
}
/** A tread's plan footprint, world inches (its own polygon for winders and path treads), as the site plan draws it. */
export function treadFootprint(t:DeckTakeoff['treads'][number]):PlanPoint[]{
 const angle=-(t.angle||0);
 return t.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:t.x+(u*t.w/2)*Math.cos(angle)-(v*t.d/2)*Math.sin(angle),y:t.z+(u*t.w/2)*Math.sin(angle)+(v*t.d/2)*Math.cos(angle)}));
}
const validRing=(r:PlanPoint[])=>r.length>=3&&r.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&Math.abs(yardSignedArea(r))>1e-6;
/** Every stair of the deck in plan: each flight and each tread. Wood stairs are structures for the fire clearances
 * (FIRE_CLEARANCE: 4 m for a wood ring, 48 in for gas), and nothing may stand on them. */
export function stairFootprints(model:Pick<DeckTakeoff,'flights'|'treads'>|undefined):PlanPoint[][]{
 return model?[...model.flights.map(flightFootprint),...model.treads.map(treadFootprint)].filter(validRing):[];
}
export interface FireContext {gradeAt:(z:number,x?:number)=>number;houseFootprint:PlanPoint[][];deckModel?:DeckTakeoff;ids:Set<string>}
/** Models every enabled fire feature after the patios, walls and water features (`features`) are built. */
export function fireFeatureModels(data:DeckData,features:YardFeatureModel[],ctx:FireContext):YardFeatureModel[]{
 const out:YardFeatureModel[]=[],deck=(ctx.deckModel?.levels??[]).map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),stairs=stairFootprints(ctx.deckModel);
 for(const f of (data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='fire-feature')){
  if(ctx.ids.has(f.id)){out.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[`Duplicate yard feature id ${f.id} excluded.`],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}
  ctx.ids.add(f.id);
  const exclude=(why:string,coverage=false)=>out.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[`${f.name}: ${why}`],quantities:{areaSqft:0},excluded:true,quoteRequired:true,...(coverage?{exclusionReason:'site-coverage' as const}:{})});
  const problem=![f.xFt,f.zFt,f.widthFt,f.depthFt,f.heightIn,f.rotationDeg].every(Number.isFinite)?'Invalid dimensions.':fireFeatureProblem(f);
  if(problem){exclude(`${problem} Excluded until revised.`);continue;}
  const product=fireProduct(f)!,x=f.xFt*12,z=f.zFt*12,body=fireOutline(f),warnings:string[]=[];
  const support=f.supportFeatureId?features.find(m=>m.config.id===f.supportFeatureId&&m.config.kind==='patio'):undefined;
  const onPatio=!!support&&!support.excluded&&support.footprints.length>0&&yardArea(yardClip([body],support.footprints,'difference'))<.01;
  if(f.supportFeatureId&&!onPatio)warnings.push(support&&!support.excluded?`${f.name} is not wholly on ${support.config.name}, so it is shown on its own gravel pad. Move it onto the patio to set it there.`:`${f.name}: the patio it stood on is not in the design, so it is shown on its own gravel pad.`);
  let base:number,pad:PlanPoint[]|undefined,variation=0;
  if(onPatio){
   const plane=support!.topPlane,slope=plane?Math.hypot(plane.x,plane.z)*100:0;
   base=plane?Math.max(...body.map(p=>planeAt(plane,p.x,p.y))):support!.topIn;
   if(slope>FIRE_LEVEL_SLOPE_PCT)warnings.push(`${f.name}: not on a level surface. ${support!.config.name} slopes ${slope.toFixed(1)} % under it (more than 2 %); set it on a level, shimmed base before it is built.`);
  }else{
   pad=fireOutline(f,FIRE_PAD_MARGIN_IN);
   const ground=[...pad,{x,y:z}].map(p=>ctx.gradeAt(p.y,p.x));
   if(!ground.every(Number.isFinite)){exclude('its pad is outside the measured survey. Extend the survey or move it.',true);continue;}
   const high=Math.max(...ground);variation=high-Math.min(...ground);base=Math.ceil(high*4)/4+.5;
   if(variation>FIRE_LEVEL_PAD_IN)warnings.push(`${f.name}: the ground under it varies ${variation.toFixed(1)} in, so it needs a level pad. Its 4 in gravel pad is levelled by cut and fill before it is built.`);
   const others=[...features,...out].filter(m=>!m.excluded).flatMap(m=>m.footprints);
   if(others.length&&yardArea(yardClip([pad],others,'intersection'))>.01)warnings.push(`${f.name}: its pad overlaps another yard feature. Move it clear, or stand it on the patio it overlaps.`);
  }
  const wood=product.fuel==='wood',clearance=FIRE_MIN_CLEARANCE_FT[product.fuel],confirmed=FIRE_CLEARANCE.confirmedValues[wood?'woodFt':'gasFt'];
  // The house, the deck (every level and landing) and its stairs, a wood stair being a structure like the deck.
  const keep=`Keep ${wood?'an enclosed wood-burning appliance':'a gas fire feature'} at least ${clearance} ft from the house, the deck and its stairs (${confirmed?'City of Barrie rule, confirmed':'unconfirmed default; confirm with Barrie Fire'}).`;
  for(const [label,outlines] of [['the house',ctx.houseFootprint],['the deck',deck],['the stair',stairs]] as const){
   if(!outlines.length)continue;
   const gap=Math.min(...outlines.map(o=>planGapIn(body,o)))/12;
   if(label==='the stair'){
    // Standing on a stair is a conflict, not a clearance: the body or its pad over any flight or tread.
    if(outlines.some(o=>yardArea(yardClip([pad??body],[o],'intersection'))>.01))warnings.push(`${f.name}: overlaps the stair. Move it off the stair. ${keep}`);
    else if(gap<clearance)warnings.push(`${f.name}: ${gap.toFixed(1)} ft from the stair, inside its ${clearance} ft clearance. ${keep}`);
   }else if(gap<clearance)warnings.push(`${f.name}: ${gap.toFixed(1)} ft from ${label}. ${keep}`);
  }
  // The fire-wood-ring is taken to be an approved enclosed appliance (4 m); an open pit would need 15 m and a permit.
  warnings.push(wood?`${f.name}: Open wood fire pits need a City of Barrie permit and ${Math.round(FIRE_CLEARANCE.openWoodFireFt*.3048)} m from any building; this assumes an approved enclosed wood-burning appliance — confirm with Barrie Fire.`
   :`${f.name}: Gas hook-up and gas line by a licensed (TSSA-registered) gas contractor. Keep it ${Math.round(FIRE_CLEARANCE.gasFt*12)} in from combustibles (${confirmed?'confirmed':'unconfirmed default; confirm with Barrie Fire and the unit manual'}).`);
  const top=base+f.heightIn,boxes:YardBox[]=[];
  const add=(role:YardRole,polygon:PlanPoint[],boxTop:number,h:number,color:string)=>{const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.y);boxes.push({id:`${f.id}-${role}`,featureId:f.id,role,color,x:(Math.min(...xs)+Math.max(...xs))/2,y:boxTop-h/2,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),h,d:Math.max(...zs)-Math.min(...zs),polygon});};
  if(pad)add('fire-pad',pad,base,FIRE_PAD_IN+variation,'#8f8b82');
  add('fire-body',body,top,f.heightIn,f.color);
  // A 1/2 in steel lip on top of a 10 in insert (wood); a 3 in burner pan of fire glass set 1 in down (gas).
  if(product.fuel==='wood')add('fire-ring',fireCircle(x,z,f.widthFt*6-4),top+.5,10.5,'#2c2c2b');
  else add('fire-burner',product.round?fireCircle(x,z,f.widthFt*6-4):yardRectangle(x,z,f.widthFt*12-8,f.depthFt*12-8,f.rotationDeg*Math.PI/180),top-1,3,'#202326');
  const padSqft=pad?yardArea([pad]):0;
  out.push({config:f,footprints:[pad??body],topIn:top,boxes,members:[],warnings,quantities:{areaSqft:yardArea([body]),fireBodyHeightIn:f.heightIn,...(pad?{firePadSqft:padSqft,firePadGravelYd3:padSqft*FIRE_PAD_IN/12/27,fireGroundVariationIn:variation}:{})},excluded:false});
 }
 return out;
}
