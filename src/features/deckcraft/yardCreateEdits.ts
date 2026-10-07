import type {DeckData,YardFeature} from './types';
import {newYardFeature} from './yardSettings';
import {FIRE_PRODUCTS,fireProduct} from './fireFeatures';
import {designSiteSurface} from './siteSurface';
import {yardShapeEdit} from './yardShapeEditing';
import {yardShapeCurveWorldPoints} from './yardShapeGeometry';
import {yardWallPath,yardPathEnvelope} from './yardPathGeometry';
import {yardArea,yardClip,yardRectangle} from './yardModel';
import {buildDeckTakeoff} from './deckTakeoff';
import {getHousePlacement} from './housePlacement';
import {hasHouseBlocks,houseOutline} from './houseFootprint';
import {fireOutline,stairFootprints,FIRE_PAD_MARGIN_IN} from './fireFeatureModel';

/**
 * The agent's yard.create and yard.update (designer/deckAgentController.ts): a patio, a retaining or seat wall, or a
 * fire feature, built by the editor's own constructors (newYardFeature with fitNewPatio, newFireFeature) so defaults and
 * ground fit match the Backyard panel. Feet for position and size, inches for heights and elevations, world plan inches
 * for wallPath. New elements stand only on measured ground when the design has a survey, and never on the house, the deck
 * or its stairs. A fire feature on a patio stands wholly on it, one on its own pad clear of every patio; a seat wall whose
 * path lies on a patio stands on its paving (the yard model's rule), so its whole cap must lie on that patio and its top
 * follows the paving to the asked height. Lazy: deckAgentEdits loads it.
 * Errors are plain language; the release parser then validates the whole design (sizes per product, ranges, supplier units).
 */
type P={x:number;y:number};
export interface YardFields {name?:string;xFt?:number;zFt?:number;widthFt?:number;depthFt?:number;rotationDeg?:number;productId?:string;heightIn?:number;finishedElevationIn?:number;
 /** Retaining walls: an open centreline in world plan inches. */
 wallPath?:P[];
 /** Retaining walls: a seat wall, both faces finished, no drainage, backfill or grid. */
 freestanding?:boolean;
 /** A fire feature stands on this patio. A seat wall given one must lie on it and then follows its paving (no link is saved). */
 supportFeatureId?:string;
 groundFit?:YardFeature['groundFit'];hardscape?:YardFeature['hardscape']}
export type YardCreate=YardFields&{kind:'patio'|'retaining-wall'|'fire-feature';id?:string};
export type YardUpdate=YardFields&{id:string;unset?:('groundFit'|'supportFeatureId'|'hardscape')[]};

const NUMBERS=['xFt','zFt','widthFt','depthFt','rotationDeg','heightIn','finishedElevationIn'] as const,GEOMETRY=['xFt','zFt','widthFt','depthFt','rotationDeg','wallPath','productId'] as const;
const inside=(p:P,ring:P[])=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(a.y>p.y!==b.y>p.y&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;};
const outline=(f:YardFeature)=>yardShapeCurveWorldPoints(f.kind==='fire-feature'?{...f,kind:'patio'}:f);
const fireName=(id:string)=>{const p=fireProduct({productId:id});return p?p.round?p.fuel==='gas'?'Fire bowl':'Fire ring':'Fire table':'';};
const flatPatio=(g:YardFeature)=>g.kind==='patio'&&g.enabled&&!g.stoneSteps&&!g.stepAssembly;
/** What the feature occupies in plan: a fire's body (or its pad), a wall's capped course envelope, a patio's outline. */
const footprint=(f:YardFeature):P[][]=>f.kind==='fire-feature'?[fireOutline(f,f.supportFeatureId?0:FIRE_PAD_MARGIN_IN)]:f.kind==='retaining-wall'?yardPathEnvelope(yardWallPath(f),f.depthFt*12+2):[outline(f)];
const overlaps=(a:P[][],b:P[][],tolSqft=.01)=>b.some(r=>r.length>=3&&yardArea(yardClip(a,[r],'intersection'))>tolSqft);
/** The house, deck level or stair the feature would stand on, as the yard model places them ('' when clear). A patio
 * may meet a stair's foot (its landing) by up to half a square foot. */
function structureUnder(data:DeckData,f:YardFeature):string{
 const rings=footprint(f);if(!rings.length)return '';
 if(data.houseVisible!==false){let house:P[][]=[];try{const h=getHousePlacement(data);house=hasHouseBlocks(data)?houseOutline(data):[yardRectangle((h.x0+h.x1)/2,-h.depthIn/2,h.widthIn,h.depthIn)];}catch{house=[];}if(overlaps(rings,house))return 'the house';}
 let tk:ReturnType<typeof buildDeckTakeoff>;try{tk=buildDeckTakeoff(data);}catch{return '';}
 if(overlaps(rings,tk.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})))))return 'the deck';
 if(overlaps(rings,stairFootprints(tk),f.kind==='patio'?.5:.01))return 'the stair';
 return '';
}

function apply(data:DeckData,base:YardFeature,c:YardFields,created:boolean,unset=false):YardFeature{
 const kind=base.kind,wall=kind==='retaining-wall',fire=kind==='fire-feature';
 if(c.name!==undefined&&(typeof c.name!=='string'||!c.name.trim()||c.name.length>80))throw Error('Give a name of 1 to 80 characters.');
 for(const k of NUMBERS)if(c[k]!==undefined&&!(typeof c[k]==='number'&&Number.isFinite(c[k])))throw Error(`${k} must be a finite number.`);
 if(!wall&&(c.wallPath||c.freestanding!==undefined))throw Error('wallPath and freestanding belong to retaining walls.');
 if(kind!=='patio'&&c.groundFit)throw Error('Only a patio has a ground fit.');
 if(kind==='patio'&&c.supportFeatureId!==undefined)throw Error('A patio stands on the ground, not on another feature.');
 if(fire&&(c.hardscape||c.finishedElevationIn!==undefined))throw Error('A fire feature takes a product, size, height, position and the patio it stands on.');
 if(c.wallPath&&c.rotationDeg)throw Error('wallPath is in world inches: leave rotationDeg out.');
 let f:YardFeature={...base};
 if(c.name!==undefined)f.name=c.name.trim();
 if(c.xFt!==undefined)f.xFt=c.xFt;
 if(c.zFt!==undefined)f.zFt=c.zFt;
 if(c.rotationDeg!==undefined)f.rotationDeg=(Math.round(c.rotationDeg*100)/100%360+360)%360;
 if(fire&&(c.productId!==undefined||c.widthFt!==undefined||c.depthFt!==undefined)){
  // A product change refits the size to it: a round product is as deep as it is wide, a linear table 18 to 24 in deep.
  const p=fireProduct({productId:c.productId??f.productId});if(!p)throw Error(`Choose a fire product: ${FIRE_PRODUCTS.map(p=>p.id).join(', ')}.`);
  const w=c.widthFt!==undefined?c.widthFt*12:Math.min(p.max,Math.max(p.min,f.widthFt*12)),d=c.depthFt!==undefined?c.depthFt*12:p.round?w:Math.min(24,Math.max(18,f.depthFt*12));
  if(c.name===undefined&&(created||f.name===fireName(f.productId)))f.name=fireName(p.id);
  f={...f,productId:p.id,widthFt:w/12,depthFt:d/12};
 }else{
  if(c.widthFt!==undefined||c.depthFt!==undefined){if(f.outline)throw Error('This patio has a drawn outline: resize it with yard.dimension or yard.set.');if(c.widthFt!==undefined&&f.wallPath)throw Error('This wall follows a drawn path: change its wallPath instead.');}
  if(c.widthFt!==undefined)f.widthFt=c.widthFt;
  if(c.depthFt!==undefined)f.depthFt=c.depthFt;
  if(c.productId!==undefined&&c.productId!==f.productId){f.productId=c.productId;if(!c.hardscape)delete f.hardscape;}
 }
 // A fixed top keeps its height over the ground it was set from: a new height moves it by the difference.
 if(c.heightIn!==undefined){if(f.finishedElevationIn!==undefined&&c.finishedElevationIn===undefined)f.finishedElevationIn=Math.round((f.finishedElevationIn+c.heightIn-f.heightIn)*100)/100;f.heightIn=c.heightIn;}
 if(c.finishedElevationIn!==undefined)f.finishedElevationIn=c.finishedElevationIn;
 if(c.hardscape)f.hardscape=structuredClone(c.hardscape);
 if(c.groundFit)f.groundFit=structuredClone(c.groundFit);
 if(c.freestanding!==undefined){const rest={...f.wallConstruction};delete rest.freestanding;const kept=c.freestanding?{...(rest.foundationMode?{foundationMode:rest.foundationMode}:{}),freestanding:true}:rest;if(Object.keys(kept).length)f.wallConstruction=kept;else delete f.wallConstruction;}
 if(c.wallPath){if(!Array.isArray(c.wallPath))throw Error('wallPath is a list of world-inch points.');f=yardShapeEdit(f,c.wallPath);}
 if(c.supportFeatureId!==undefined){
  const patio=data.yardFeatures?.find(g=>g.id===c.supportFeatureId&&g.kind==='patio');if(!patio)throw Error('Stand it on a current patio: copy its exact id.');
  const ring=outline(patio);
  if(fire){if(!inside({x:f.xFt*12,y:f.zFt*12},ring))throw Error(`Place it on ${patio.name}: its centre is off the patio.`);f.supportFeatureId=patio.id;}
  else{if(!f.wallConstruction?.freestanding)throw Error('Only a seat (freestanding) wall stands on a patio.');if(!yardShapeCurveWorldPoints(f).every(p=>inside(p,ring)))throw Error(`Keep the seat wall inside ${patio.name} so it stands on the paving.`);}
 }
 const moved=created||unset||GEOMETRY.some(k=>c[k]!==undefined)||c.supportFeatureId!==undefined||c.freestanding!==undefined||c.heightIn!==undefined;
 if(moved&&fire){
  // On a patio the whole body stands on its paving (else the yard model sets it on a pad of its own, half over the
  // patio); on its own pad it keeps clear of every patio.
  const body=fireOutline(f),support=f.supportFeatureId?data.yardFeatures?.find(g=>g.id===f.supportFeatureId&&flatPatio(g)):undefined;
  if(support){if(yardArea(yardClip([body],[outline(support)],'difference'))>.01)throw Error(`Place it wholly on ${support.name}: its ${Math.round(f.widthFt*12)} in body runs off the patio. Move it in from the edge or choose a smaller size.`);}
  else{const under=(data.yardFeatures??[]).find(g=>g.id!==f.id&&flatPatio(g)&&overlaps(footprint(f),[outline(g)]));if(under)throw Error(`It overlaps ${under.name}: stand it on that patio (supportFeatureId ${under.id}) or move it clear.`);}
 }
 if(moved&&wall&&f.wallConstruction?.freestanding){
  // A seat wall whose path lies on a patio stands on its paving (the yard model's rule): its whole capped course must
  // lie on that patio, and its top follows the paving in whole courses to the asked height, so a finished level taken
  // from the ground (newYardFeature's) is dropped.
  const path=yardWallPath(f),on=c.supportFeatureId!==undefined?data.yardFeatures?.find(g=>g.id===c.supportFeatureId):(data.yardFeatures??[]).find(g=>g.id!==f.id&&flatPatio(g)&&path.every(p=>inside(p,outline(g))));
  if(on){const envelope=footprint(f),off=yardArea(yardClip(envelope,[outline(on)],'difference'));
   if(off>.01)throw Error(`Keep the seat wall wholly inside ${on.name}: ${off.toFixed(1)} sq ft of its ${Math.round(f.depthFt*12+2)} in cap would hang past the patio's edge over the ground. Move it in from the edge or off the patio.`);
   if(c.finishedElevationIn===undefined)delete f.finishedElevationIn;}
 }
 if(data.siteModel&&(created||GEOMETRY.some(k=>c[k]!==undefined))){
  const surface=designSiteSurface(data),ring=outline(f);
  if(!surface||(wall?![...ring,{x:f.xFt*12,y:f.zFt*12}].every(p=>Number.isFinite(surface.sample(p.x,p.y,'existing')??NaN)):!surface.extrema([ring],'existing').complete))throw Error(`${f.name} would stand off the measured survey. Place it inside the surveyed ground (siteBrief.coverage) or extend the survey.`);
 }
 if(moved){const on=structureUnder(data,f);if(on)throw Error(`${f.name} would stand on ${on}. Place it clear of the house, the deck and its stairs.`);}
 return f;
}

/** A new feature at xFt/zFt (or round its wallPath), with the Backyard panel's defaults for anything not given. */
export function createYardFeature(data:DeckData,c:YardCreate):YardFeature{
 if(!['patio','retaining-wall','fire-feature'].includes(c.kind))throw Error('Create a patio, retaining-wall or fire-feature.');
 const taken=new Set([...(data.yardFeatures??[]),...(data.pools??[]),...(data.landscapeObjects??[]),...(data.siteModel?.transitions??[])].map(o=>o.id));
 const id=c.id??Array.from({length:taken.size+1},(_,i)=>`${c.kind}-${i+1}`).find(i=>!taken.has(i))!;
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(id)||taken.has(id))throw Error('Use a new id of 1 to 64 letters, digits, _ or -.');
 const path=Array.isArray(c.wallPath)&&c.wallPath.length?c.wallPath:undefined,xs=path?.map(p=>p.x)??[],zs=path?.map(p=>p.y)??[];
 const xFt=c.xFt??(path?(Math.min(...xs)+Math.max(...xs))/24:undefined),zFt=c.zFt??(path?(Math.min(...zs)+Math.max(...zs))/24:undefined);
 if(!Number.isFinite(xFt)||!Number.isFinite(zFt))throw Error('Give xFt and zFt (feet), or a wallPath.');
 if(data.siteModel&&!Number.isFinite(designSiteSurface(data)?.sample(xFt!*12,zFt!*12,'existing')??NaN))throw Error(`(${xFt} ft, ${zFt} ft) is off the measured survey. Place new elements on surveyed ground (siteBrief.coverage).`);
 const seat=c.kind==='retaining-wall'&&c.freestanding===true,base=newYardFeature(c.kind,data,{xFt:xFt!,zFt:zFt!});
 return apply(data,{...base,id,...(seat?{name:'Seat wall'}:{})},{...c,xFt:undefined,zFt:undefined,...(seat&&c.heightIn===undefined?{heightIn:18}:{})},true);
}

/** Bounded changes to one patio, wall or fire feature; `unset` removes its ground fit, patio support or supplier units. */
export function updateYardFeature(data:DeckData,c:YardUpdate):YardFeature{
 const f=data.yardFeatures?.find(f=>f.id===c.id);if(!f)throw Error('That yard feature is not present. Read the current design.');
 if(f.kind==='water-feature'||f.stoneSteps||f.stepAssembly)throw Error('yard.update edits patios, walls and fire features; use the step commands for stairs.');
 if(c.unset?.some(k=>!['groundFit','supportFeatureId','hardscape'].includes(k)||c[k]!==undefined))throw Error('unset names groundFit, supportFeatureId or hardscape, each absent from the update.');
 // Unset first, so the checks see the feature as it will be (a fire taken off its patio stands on its own pad).
 const base={...f};for(const k of c.unset??[])delete base[k];
 return apply(data,base,c,false,!!c.unset?.length);
}
