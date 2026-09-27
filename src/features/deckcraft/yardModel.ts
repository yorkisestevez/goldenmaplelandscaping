import ClipperLib from 'clipper-lib';
import {PAVER_BRANDS} from '../../data/carrPrices';
import baseline from '../../data/engine-baseline.json';
import type {DeckData,YardFeature} from './types';
import type {Box,Member,DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {getTerrainConfig} from './yardSettings';
import {getHousePlacement} from './housePlacement';
import {hasHouseBlocks,houseOutline} from './houseFootprint';
import {yardFeatureOutline,yardWallPath,yardPathEnvelope,yardPathBackStrip,pathRun} from './yardPathGeometry';
import {yardShapeProblem} from './yardShapeEditing';
import {hardscapeSelection,hardscapeProblem,rectangularUnit} from './hardscapeCatalogue';
import {hardscapeBlanks} from './hardscapeLayout';
import {hardscapeProfile,hardscapeStockPolygons} from './hardscapeShapes';
import {yardWallCourses} from './yardElevations';
import {patioInlayPlans,patioInlayFeature} from './patioInlays';

export type YardRole='paver'|'base'|'bedding'|'wall-block'|'wall-cap'|'wall-drainage'|'backfill'|'liner'|'water'|'basin'|'pump'|'rock'|'drain-pipe'|'water-pipe';
export interface YardSurface {imageUrl:string;cx:number;cz:number;angle:number;lengthIn:number;widthIn:number;heightIn:number;kind:'paver'|'wall';sourceUrl:string}
export type YardBox=Box&{id:string;featureId:string;role:YardRole;color:string;illustrative?:boolean;unitId?:string;surface?:YardSurface;stockAreaSqft?:number;stockUnitId?:string;renderContours?:PlanPoint[][];renderDuplicate?:boolean};
export type YardMember=Member&{id:string;featureId:string;role:YardRole;color:string};
export interface YardFeatureModel {config:YardFeature;footprints:PlanPoint[][];topIn:number;boxes:YardBox[];members:YardMember[];warnings:string[];quantities:Record<string,number>;pavingZones?:{feature:YardFeature;areaSqft:number;stockAreaSqft:number;inlayId?:string}[];stockSchedule?:{unitId:string;widthMm:number;lengthMm:number;heightMm:number;pieces:number;productId?:string;inlayId?:string}[];sourceUrl?:string;excluded:boolean;supportClearances?:PlanPoint[][];quoteRequired?:boolean;exclusionReason?:'paver-budget'}
export interface YardExcavationRegion {featureId:string;polygon:PlanPoint[];bottomIn:number;volumeYd3:number}
const S=100000;
export const yardSignedArea=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
export const yardArea=(p:PlanPoint[][])=>Math.abs(p.reduce((n,x)=>n+yardSignedArea(x),0))/144;
export function yardClip(subject:PlanPoint[][],clip:PlanPoint[][]=[],operation:'union'|'difference'|'intersection'='union'):PlanPoint[][]{
 if(!subject.length)return [];if(!clip.length&&operation==='intersection')return [];
 const c=new ClipperLib.Clipper(),out=[];
 const path=(ps:PlanPoint[][])=>ps.map(p=>p.map(v=>({X:Math.round(v.x*S),Y:Math.round(v.y*S)})));
 c.AddPaths(path(subject),ClipperLib.PolyType.ptSubject,true);if(clip.length)c.AddPaths(path(clip),ClipperLib.PolyType.ptClip,true);
 c.Execute(operation==='union'?ClipperLib.ClipType.ctUnion:operation==='difference'?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctIntersection,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
 return out.map(p=>p.map(v=>({x:v.X/S,y:v.Y/S}))).filter(p=>Math.abs(yardSignedArea(p))>.0001);
}
/** Turn holes into exact non-overlapping trapezoids so generic polygon meshes
 * cannot accidentally cover a pond cut-out with the patio's outer contour. */
export function yardSolidCells(polys:PlanPoint[][]):PlanPoint[][]{
 const xs=[...new Set(polys.flat().map(p=>p.x))].sort((a,b)=>a-b),out:PlanPoint[][]=[];
 for(let i=0;i<xs.length-1;i++){
  const l=xs[i],r=xs[i+1],mid=(l+r)/2;if(r-l<.00001)continue;
  const edges:{a:PlanPoint;b:PlanPoint;y:number}[]=[];
  for(const poly of polys)for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];if((a.x<=mid&&b.x>mid)||(b.x<=mid&&a.x>mid))edges.push({a,b,y:a.y+(mid-a.x)*(b.y-a.y)/(b.x-a.x)});}
  edges.sort((a,b)=>a.y-b.y);
  const at=(e:typeof edges[number],x:number)=>e.a.y+(x-e.a.x)*(e.b.y-e.a.y)/(e.b.x-e.a.x);
  for(let j=0;j+1<edges.length;j+=2){const p=[{x:l,y:at(edges[j],l)},{x:r,y:at(edges[j],r)},{x:r,y:at(edges[j+1],r)},{x:l,y:at(edges[j+1],l)}];if(yardSignedArea(p)>.0001)out.push(p);}
 }
 return out;
}
function rectangle(x:number,z:number,w:number,d:number,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+c*u*w/2-s*v*d/2,y:z+s*u*w/2+c*v*d/2}));}
function centroid(p:PlanPoint[]){const a=yardSignedArea(p);let x=0,y=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],k=p[i].x*q.y-q.x*p[i].y;x+=(p[i].x+q.x)*k;y+=(p[i].y+q.y)*k;}return {x:x/(6*a),y:y/(6*a)};}
const profile=(url:string,rows:{depth:number;lengths:number[]}[],illustrative=false)=>({sourceUrl:`https://permacon.ca/en/product/${url}/`,rows:rows.map(r=>({depth:r.depth/25.4,lengths:r.lengths.map(n=>n/25.4)})),illustrative});
const profiles={
 'permacon-melville':profile('melville-slab-60',[{depth:190,lengths:[380]},{depth:380,lengths:[380,570]}]),
 'permacon-cassara':profile('cassara-slab-large-rectangle',[{depth:300,lengths:[700]}]),
 'permacon-vendome':profile('vendome-paver-60',[{depth:130,lengths:[197,262,327]}]),
 'permacon-mondrian-plus':profile('mondrian-plus-60-slabs',[{depth:165,lengths:[330]},{depth:330,lengths:[330,495]}]),
 'permacon-wilfred':profile('wilfrid-slab',[{depth:570,lengths:[380,570,950]}]),
 'permacon-rosebel':profile('rosebel-slabs',[{depth:389,lengths:[560,756]}],true),
 'permacon-mega-melville':profile('mega-melville-pavers',[{depth:570,lengths:[950]}]),
 'permacon-brooklyn':profile('brooklyn-paver',[{depth:76,lengths:[230]}]),
 'permacon-metrik':profile('metrik-slab',[{depth:70,lengths:[280]}]),
};
export const YARD_PAVER_BUDGET=20000;
/** Exact raw rectangular course count before clipping, without iterating units.
 * Reserving raw counts is intentionally conservative for cut-outs/overlaps. */
export function projectedYardPavers(f:YardFeature):number{
 if(f.kind!=='patio')return 0;
 const extra=patioInlayPlans(f).filter(p=>p.status==='ok').reduce((n,p)=>n+hardscapeBlanks(patioInlayFeature(f,p.inlay)).length,0);
 if(f.hardscape)return hardscapeBlanks(f).length+extra;
 const rows=profiles[f.productId as keyof typeof profiles]?.rows||[{depth:12,lengths:[24]}];
 const period=rows.length%2?rows.length*2:rows.length;
 const courses=Array.from({length:period},(_,i)=>{
  const r=rows[i%rows.length],span=Math.max(0,f.widthFt*12+(i%2?(r.lengths[0]+.125)/2:0)-.001),cycle=r.lengths.reduce((n,v)=>n+v+.125,0),whole=Math.floor(span/cycle);
  let remaining=span-whole*cycle,count=whole*r.lengths.length;
  for(const length of r.lengths){if(remaining<=1e-7)break;count++;remaining-=length+.125;}
  return {depth:r.depth+.125,count};
 });
 const depth=Math.max(0,f.depthFt*12-.001),cycleDepth=courses.reduce((n,r)=>n+r.depth,0),whole=Math.floor(depth/cycleDepth);
 let remaining=depth-whole*cycleDepth,count=whole*courses.reduce((n,r)=>n+r.count,0);
 for(const row of courses){if(remaining<=1e-7)break;count+=row.count;remaining-=row.depth;}
 return count+extra;
}
const SUPPORT_CLEARANCE_IN=1;
const circle=(x:number,z:number,r:number):PlanPoint[]=>Array.from({length:32},(_,i)=>({x:x+Math.cos(i*Math.PI/16)*r,y:z+Math.sin(i*Math.PI/16)*r}));
/** Cross-sections match the current footing/post model. The one-inch separation
 * is a planning clearance, not a geotechnical excavation setback. */
function supportSections(data:DeckData,deck:DeckTakeoff|undefined,low:number,high:number):PlanPoint[][]{
 if(!deck)return [];
 const out:PlanPoint[][]=[],depth=data.foundationDepthIn??48,overlaps=(a:number,b:number)=>low<=b&&high>=a;
 const postBase=data.foundation==='Deck Blocks'?6.5:4.5;
 for(const p of deck.levels.flatMap(l=>l.supports)){
  const square=(w:number)=>out.push(rectangle(p.x,p.z,w+2*SUPPORT_CLEARANCE_IN,w+2*SUPPORT_CLEARANCE_IN));
  const round=(r:number)=>out.push(circle(p.x,p.z,r+SUPPORT_CLEARANCE_IN));
  if(data.foundation==='Deck Blocks'){if(overlaps(0,6))square(12);}
  else if(data.foundation==='Helical Piles'){
   if(overlaps(-depth,3))round(1.5);
   if(overlaps(-depth+7.8125,-depth+12.1875))round(6);
   if(overlaps(2.7,3.3))square(8);
  }else{
   const topRadius=data.soilCondition==='Clay'||data.soilCondition==='Fill'?8:6;
   if(overlaps(-depth,3)){const y=Math.max(-depth,low);round(topRadius+(8-topRadius)*(3-y)/(depth+3));}
   if(overlaps(-depth,-depth+6)){const y=Math.max(-depth,low);round(12-(y+depth)/3);}
  }
  if(overlaps(postBase-.5,postBase+5.5))square(6.6);
  if(p.y>postBase&&overlaps(postBase,p.y))square(5.5);
 }
 return yardClip(out);
}
const treadFootprint=(b:Box)=>b.polygon||rectangle(b.x,b.z,b.w,b.d,-(b.angle||0));
export function buildYardModel(data:DeckData,deckModel?:DeckTakeoff){
 const terrain=getTerrainConfig(data),gradeAt=(z:number)=>terrain.elevationIn+z*terrain.slopePct/100;
 const warnings:string[]=[],features:YardFeatureModel[]=[],boxes:YardBox[]=[],members:YardMember[]=[],excavations:{featureId:string;polys:PlanPoint[][];bottom:number}[]=[];
 // The house with its bump-outs, wings and garage: attached blocks are unioned with the main block.
 const house=getHousePlacement(data),houseFootprint=data.houseVisible===false?[]:hasHouseBlocks(data)?houseOutline(data):[rectangle((house.x0+house.x1)/2,-house.depthIn/2,house.widthIn,house.depthIn)];
 let occupied:PlanPoint[][]=[...houseFootprint];
 const enabled=(data.yardFeatures||[]).filter(f=>f.enabled).sort((a,b)=>Number(a.kind==='patio')-Number(b.kind==='patio'));
 const ids=new Set<string>(),supportCutouts:PlanPoint[][]=[],budgetExcludedIds:string[]=[];let reservedPavers=0;
 const treadClearances=(deckModel?.treads||[]).map(t=>t.y+t.h/2-Math.max(...treadFootprint(t).map(p=>gradeAt(p.y))));
 const framingClearances=(deckModel?.levels||[]).flatMap(l=>[...l.joists,...l.beams,...(l.rim||[])]).flatMap(m=>[m.a.y-m.depth/2-gradeAt(m.a.z),m.b.y-m.depth/2-gradeAt(m.b.z)]);
 const minStairClearanceIn=treadClearances.length?Math.min(...treadClearances):null,minFramingClearanceIn=framingClearances.length?Math.min(...framingClearances):null;
 if(deckModel&&(terrain.elevationIn!==0||terrain.slopePct!==0)){
  warnings.push(`Deck elevations remain on their original zero datum. Selected terrain gives ${minStairClearanceIn===null?'no stair surface':`${minStairClearanceIn.toFixed(1)} in minimum stair walking-surface clearance`} and ${minFramingClearanceIn===null?'no framing measurement':`${minFramingClearanceIn.toFixed(1)} in minimum framing clearance`}; review foundation exposure, access and grading together.`);
  if(minStairClearanceIn!==null&&minStairClearanceIn<=0)warnings.push('Selected terrain intersects or covers a deck stair walking surface; revise grading or the stair design before construction.');
  if(minFramingClearanceIn!==null&&minFramingClearanceIn<=0)warnings.push('Selected terrain intersects deck framing; revise grading or deck elevations before construction.');
 }
 for(const f of enabled){
  if(ids.has(f.id)){warnings.push(`Duplicate yard feature id ${f.id} excluded.`);continue;}ids.add(f.id);
  if(![f.xFt,f.zFt,f.widthFt,f.depthFt,f.heightIn,f.rotationDeg,f.baseElevationIn??0].every(Number.isFinite)||f.widthFt<=0||f.depthFt<=0||f.baseElevationIn!==undefined&&(f.kind!=='retaining-wall'||Math.abs(f.baseElevationIn)>120)){warnings.push(`${f.name}: invalid dimensions excluded.`);continue;}
  const supplierProblem=hardscapeProblem(f);if(supplierProblem){warnings.push(`${f.name}: ${supplierProblem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[supplierProblem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}
  if(f.outline||f.wallPath){const problem=f.kind==='patio'&&f.wallPath||f.kind==='retaining-wall'&&f.outline||f.kind==='water-feature'?'The shape does not match this feature.':yardShapeProblem(f.kind as 'patio'|'retaining-wall',f.outline??f.wallPath);if(problem){warnings.push(`${f.name}: ${problem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[problem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}}
  const supplier=hardscapeSelection(f),capDepth=supplier?.cap?supplier.cap.lengthMm/25.4:f.depthFt*12+2;
  const w=f.widthFt*12,d=f.depthFt*12,x=f.xFt*12,z=f.zFt*12,a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),grade=gradeAt(z);
  const projectedPavers=projectedYardPavers(f);
  if(projectedPavers>YARD_PAVER_BUDGET-reservedPavers||!Number.isFinite(projectedPavers)){
   const message=`${f.name}: the raw layout needs ${Number.isFinite(projectedPavers)?projectedPavers.toLocaleString('en-CA'):'more than 20,000'} pavers and exceeds the remaining ${(YARD_PAVER_BUDGET-reservedPavers).toLocaleString('en-CA')} of the shared 20,000-paver model budget. The whole patio is excluded from geometry and installed quantities; quote required. Reduce its size or use larger pavers. This preflight conservatively counts the full rectangle before cut-outs.`;
   budgetExcludedIds.push(f.id);warnings.push(message);features.push({config:f,footprints:[],topIn:grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,paverAreaSqft:0,paverPieces:0},excluded:true,quoteRequired:true,exclusionReason:'paver-budget'});continue;
  }
  const original=yardFeatureOutline(f),wallPath=f.kind==='retaining-wall'?yardWallPath(f):[],envelope=f.kind==='retaining-wall'&&f.wallPath?yardClip([...yardPathEnvelope(wallPath,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathBackStrip(wallPath,d/2,d/2+24)]):f.kind==='retaining-wall'?[rectangle(x-s*9,z+c*9,w+12,Math.max(d,supplier?.cap?capDepth:d)+30,a)]:f.kind==='water-feature'?[rectangle(x,z,w+12,d+12,a)]:original,overlap=yardClip(envelope,occupied,'intersection'),localWarnings:string[]=[];
  if(yardArea(yardClip(envelope,houseFootprint,'intersection'))>.001)localWarnings.push(`${f.name}: construction overlaps the house footprint; patio area is clipped and conflicting wall/water features are excluded.`);
  if(envelope.flat().some(p=>Math.abs(p.x-data.width*6)>terrain.widthFt*6||Math.abs(p.y-data.length*6)>terrain.depthFt*6))localWarnings.push(`${f.name}: the construction envelope extends outside the selected terrain dimensions.`);
  const paverThickness=(supplier?.unit.heightMm??PAVER_BRANDS.find(p=>p.id===f.productId)?.thicknessMm??60)/25.4;
  const low=f.kind==='patio'?grade+f.heightIn-paverThickness-1-baseline.facts.baseDepthIn:f.kind==='retaining-wall'?yardWallCourses(f,grade).bottom-6:grade-(f.productId==='fountain'?24:Math.max(12,f.heightIn));
  const high=f.kind==='patio'?grade+f.heightIn:f.kind==='retaining-wall'?yardWallCourses(f,grade).top:grade+(f.productId==='fountain'?Math.max(1,f.heightIn):f.productId==='pondless-waterfall'?18:4);
  const supports=supportSections(data,deckModel,low,high),supportHit=yardArea(yardClip(envelope,supports,'intersection'))>.001;
  const stairs=(deckModel?.treads||[]).filter(t=>low<=t.y+t.h/2&&high>=t.y-t.h/2).map(treadFootprint),stairHit=f.kind!=='patio'&&yardArea(yardClip(envelope,stairs,'intersection'))>.001;
  let footprints=yardClip(original,occupied,'difference'),excluded=false;
  if(supportHit){
   if(f.kind==='patio'){const cut=yardClip(footprints,supports,'intersection');supportCutouts.push(...cut);footprints=yardClip(footprints,supports,'difference');localWarnings.push(`${f.name}: paving and base are cut around the deck support cross-sections with a ${SUPPORT_CLEARANCE_IN}-inch planning clearance. Coordinate excavation near foundations; this clearance is not an excavation setback.`);}
   else{footprints=[];excluded=true;localWarnings.push(`${f.name}: construction intersects a deck footing or support post and is excluded; reposition the feature.`);}
  }
  if(stairHit){footprints=[];excluded=true;localWarnings.push(`${f.name}: construction intersects a deck stair tread and is excluded; reposition the feature.`);}
  if(yardArea(overlap)>.001){localWarnings.push(`${f.name}: overlap resolved; earlier walls/water features and earlier patios take priority.`);if(f.kind!=='patio'){footprints=[];excluded=true;localWarnings.push('The conflicting wall/water feature is excluded until repositioned.');}}
  if(!footprints.length)excluded=true;
  const model:YardFeatureModel={config:f,footprints,topIn:grade+(f.kind==='patio'?f.heightIn:0),boxes:[],members:[],warnings:localWarnings,quantities:{areaSqft:yardArea(footprints)},excluded,supportClearances:supports};features.push(model);
  if(excluded){warnings.push(...localWarnings);continue;}
  reservedPavers+=projectedPavers;
  occupied=yardClip([...occupied,...(f.kind==='patio'?footprints:envelope)]);
  const add=(role:YardRole,p:PlanPoint[],top:number,h:number,color=f.color,illustrative=false)=>{if(h<=0)return;const xs=p.map(v=>v.x),zs=p.map(v=>v.y);const b:YardBox={id:`${f.id}-${role}-${model.boxes.length}`,featureId:f.id,role,color,x:(Math.min(...xs)+Math.max(...xs))/2,y:top-h/2,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),h,d:Math.max(...zs)-Math.min(...zs),polygon:p,illustrative};model.boxes.push(b);boxes.push(b);};
  const localRect=(u:number,v:number,l:number,t:number)=>rectangle(x+c*u-s*v,z+s*u+c*v,l,t,a);
  const pipe=(role:YardRole,u0:number,v0:number,u1:number,v1:number,y:number,diameter:number)=>{const m:YardMember={id:`${f.id}-${role}-${members.length}`,featureId:f.id,role,color:'#262e32',a:{x:x+c*u0-s*v0,y,z:z+s*u0+c*v0},b:{x:x+c*u1-s*v1,y,z:z+s*u1+c*v1},width:diameter,depth:diameter};members.push(m);model.members.push(m);};
  if(terrain.slopePct)localWarnings.push(`${f.name}: level feature placed at centre grade; earthwork follows the sloped terrain plane. Drainage and retaining transitions require site review.`);
  if(f.kind==='patio'){
   const product=PAVER_BRANDS.find(p=>p.id===f.productId),spec=profiles[f.productId as keyof typeof profiles];
   const thick=paverThickness,base=baseline.facts.baseDepthIn,top=model.topIn,area=model.quantities.areaSqft;
   if(!product)localWarnings.push(`${supplier?`${supplier.product.brand} ${supplier.product.name}`:'Unknown paver selection'}: supply and installation need a product-specific quote.`);
   model.sourceUrl=supplier?.product.sourceUrl??spec?.sourceUrl;
   localWarnings.push('Paver module dimensions follow the referenced family. Confirm the exact SKU, colour, laying-pattern mix, joints and supplier pack quantities before ordering.');
   if(spec?.illustrative)localWarnings.push('Rosebel has irregular interlocking edges: the rectangular module envelopes are illustrative, not production cut templates.');
   for(const p of yardSolidCells(footprints)){add('base',p,top-thick-1,base,'#8c8a7c');add('bedding',p,top-thick,1,'#c5bda4');}
   const plans=patioInlayPlans(f,footprints),valid=plans.filter(p=>p.status==='ok'),field=yardClip(footprints,valid.map(p=>p.outline),'difference');
   for(const p of plans.filter(p=>p.status!=='ok'))localWarnings.push(`${p.inlay.name}: ${p.message}`);
   const laySupplier=(zone:YardFeature,mask:PlanPoint[][],inlayId?:string)=>{const sel=hardscapeSelection(zone)!;const za=zone.rotationDeg*Math.PI/180,zc=Math.cos(za),zs=Math.sin(za),before=model.boxes.length;
    for(const blank of hardscapeBlanks(zone)){const centre={x:zone.xFt*12+zc*blank.cx-zs*blank.cy,y:zone.zFt*12+zs*blank.cx+zc*blank.cy},angle=za+blank.angle,stock=sel.finish.units.find(u=>u.id===blank.unitId)??sel.unit;
     const contours=yardClip(hardscapeStockPolygons(sel.product.id,stock,centre.x,centre.y,angle),mask,'intersection'),profile=hardscapeProfile(sel.product.id,stock);let fragment=0;for(const p of yardSolidCells(contours)){add('paver',p,top,stock.heightMm/25.4,zone.color,!rectangularUnit(stock)&&!profile);const b=model.boxes.at(-1)!;b.unitId=`${zone.id}-paver-${blank.id}`;b.stockAreaSqft=blank.length*blank.width/144;b.stockUnitId=stock.id;if(profile||valid.length){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}if(sel.color.imageUrl)b.surface={imageUrl:sel.color.imageUrl,cx:centre.x,cz:centre.y,angle,lengthIn:blank.length,widthIn:blank.width,heightIn:stock.heightMm/25.4,kind:'paver',sourceUrl:sel.product.sourceUrl};}
    }
    const recipe=sel.finish.patterns.find(p=>p.id===zone.hardscape!.patternId);if(inlayId&&recipe?.layout.installationJointMm!==undefined)localWarnings.push(`${zone.name}: supplier installation joint ${recipe.layout.installationJointMm} mm differs from nominal pattern modules; confirm installed spacing before ordering.`);
    const stock=[...new Map(model.boxes.slice(before).map(b=>[b.unitId,b])).values()],stockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);model.pavingZones??=[];model.pavingZones.push({feature:zone,areaSqft:yardArea(mask),stockAreaSqft,...(inlayId?{inlayId}:{})});
    model.stockSchedule??=[];model.stockSchedule.push(...sel.finish.units.flatMap(u=>{const pieces=stock.filter(b=>b.stockUnitId===u.id).length;return pieces?[{unitId:u.id,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces,...(inlayId?{productId:zone.productId,inlayId}:{})}]:[];}));
   };
   if(supplier){
    laySupplier(f,field);
    const recipe=supplier.finish.patterns.find(p=>p.id===f.hardscape!.patternId);if(recipe?.layout.installationJointMm!==undefined)localWarnings.push(`Manufacturer diagram uses nominal stock modules; the supplier specifies ${recipe.layout.installationJointMm} mm installation joints. Installed module spacing and pack quantities need confirmation; this diagram is not an installation joint schedule.`);localWarnings.push(recipe?`Manufacturer recipe ${recipe.name}: documented units and repeat coordinates retained. Nominal module pitch follows ${recipe.sourceUrl}; confirm actual supplied dimensions and joint tolerances before ordering.`:`Selected stock ${supplier.unit.widthMm} × ${supplier.unit.lengthMm} × ${supplier.unit.heightMm} mm; ${f.hardscape!.jointMm} mm joints are added to the module. The contractor pattern uses this single stock size; supplier multi-size recipes remain in the pattern library.`);
    if(!rectangularUnit(supplier.unit)&&['herringbone','basket-weave'].includes(f.hardscape!.patternId))localWarnings.push('Legacy rectangular envelope layout retained from the saved design; choose a compatible shaped bond or verified supplier recipe.');
    if(!rectangularUnit(supplier.unit))localWarnings.push(hardscapeProfile(supplier.product.id,supplier.unit)?'Stock outlines follow the manufacturer plan drawing at nominal dimensions; confirm joints and fabrication against the supplier technical guide.':'The supplier lists a shaped unit. Rectangular stock envelopes are illustrative; its exact mould profile has not been digitized.');
   }else{
   const rows=spec?.rows||[{depth:12,lengths:[24]}],gap=.125;let row=0;
   for(let v=-d/2;v<d/2-.001;){const r=rows[row%rows.length],depth=r.depth;let col=0;
    for(let u=-w/2-(row%2?(r.lengths[0]+gap)/2:0);u<w/2-.001;){const len=r.lengths[col%r.lengths.length],contours=yardClip([localRect(u+len/2,v+depth/2,len,depth)],field,'intersection');let fragment=0;for(const p of yardSolidCells(contours)){add('paver',p,top,thick,f.color,spec?.illustrative||!spec);const b=model.boxes.at(-1)!;b.unitId=`${f.id}-paver-${row}-${col}`;if(valid.length){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}}u+=len+gap;col++;}
    v+=depth+gap;row++;
   }
   }
   if(!supplier&&valid.length)model.pavingZones=[{feature:f,areaSqft:yardArea(field),stockAreaSqft:yardArea(field)}];
   for(const p of valid){laySupplier(patioInlayFeature(f,p.inlay),[p.outline],p.inlay.id);localWarnings.push(`${p.inlay.name}: custom inlay cutting, setting and waste require a builder quote; this is a cut-paver design, not a manufactured medallion kit.`);}
   model.quantities={...model.quantities,paverPieces:new Set(model.boxes.filter(b=>b.role==='paver').map(b=>b.unitId)).size,baseYd3:area*base/324,beddingYd3:area/324,paverAreaSqft:area};
   if(supplier||valid.length){const stock=[...new Map(model.boxes.filter(b=>b.role==='paver').map(b=>[b.unitId,b])).values()];model.quantities.paverStockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);}
   const formation=top-thick-1-base;let fill=footprints;
   if(terrain.slopePct){const z0=(formation-terrain.elevationIn)/(terrain.slopePct/100),lo=terrain.slopePct>0?-1e7:z0,hi=terrain.slopePct>0?z0:1e7;fill=yardClip(fill,[[{x:-1e7,y:lo},{x:1e7,y:lo},{x:1e7,y:hi},{x:-1e7,y:hi}]],'intersection');}
   else if(formation<=terrain.elevationIn)fill=[];
   model.quantities.raisedFillYd3=yardSolidCells(fill).reduce((n,p)=>n+Math.abs(yardSignedArea(p))*Math.max(0,formation-gradeAt(centroid(p).y))/46656,0);
   if(model.quantities.raisedFillYd3>.001)localWarnings.push('Additional engineered fill below the patio base is required by the selected elevation; fill supply, compaction and containment need a quote.');
   excavations.push({featureId:f.id,polys:footprints,bottom:top-thick-1-base});
  }else if(f.kind==='retaining-wall'){
   const h=Math.max(1,f.heightIn),armour=f.productId==='armour-stone',{course,cap,bottom,top,count,burialIn}=yardWallCourses(f,grade),length=supplier?supplier.unit.widthMm/25.4:armour?36:18,capLength=supplier?.cap?supplier.cap.widthMm/25.4:24,retainedDepth=top-cap-bottom;
   const stockSchedule=()=>{if(!supplier)return;for(const b of model.boxes){if(b.role==='wall-block')b.stockUnitId=supplier.unit.id;else if(b.role==='wall-cap')b.stockUnitId=supplier.cap?.id;}model.stockSchedule=[supplier.unit,...(supplier.cap?[supplier.cap]:[])].map(u=>({unitId:u.id,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces:new Set(model.boxes.filter(b=>b.stockUnitId===u.id).map(b=>b.unitId)).size}));model.quantities.wallCourses=count;localWarnings.push(`${count} body courses at ${course.toFixed(3)} in each; ${burialIn.toFixed(3)} in buried to retain full stock height at the requested top.`);};
   if(f.baseElevationIn)localWarnings.push(`Wall front-grade datum is shifted ${f.baseElevationIn} in from natural terrain. Added fill or excavation, containment and grading are site-specific quote items.`);
   model.sourceUrl=supplier?.product.sourceUrl;
   if(f.wallPath){
    model.topIn=top;const run=pathRun(wallPath),zones=yardPathBackStrip(wallPath,-d/2,d/2),capZones=yardPathBackStrip(wallPath,-capDepth/2,capDepth/2);
    const lay=(role:'wall-block'|'wall-cap',top:number,height:number,unitLength:number,row:number)=>{
     let occupiedUnits:PlanPoint[][]=[];
     for(let seg=0;seg+1<wallPath.length;seg++){
      const p=wallPath[seg],q=wallPath[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,angle=Math.atan2(uy,ux),zone=role==='wall-cap'?yardClip([capZones[seg]]):yardClip([zones[seg]],footprints,'intersection');
      const along=zone.flat().map(v=>(v.x-p.x)*ux+(v.y-p.y)*uy);if(!along.length)continue;
      const start=Math.min(...along),end=Math.max(...along);let slot=0;
      for(let u=start-(row%2&&f.hardscape?.patternId!=='stack-bond'?unitLength/2:0);u<end-.001;u+=unitLength,slot++){
       const left=Math.max(start,u),right=Math.min(end,u+unitLength);if(right-left<=.05)continue;
       const centre=(left+right)/2,blank=rectangle(p.x+ux*centre,p.y+uy*centre,right-left-(supplier?0:.05),role==='wall-cap'?capDepth:d,angle),cuts=yardClip(yardClip([blank],zone,'intersection'),occupiedUnits,'difference');
       for(const cut of yardSolidCells(cuts)){add(role,cut,top,height,f.color,!supplier||!rectangularUnit(supplier.unit));const b=model.boxes.at(-1)!;b.unitId=`${f.id}-${role}-${row}-${seg}-${slot}`;if(supplier?.color.imageUrl)b.surface={imageUrl:supplier.color.imageUrl,cx:p.x+ux*(u+unitLength/2),cz:p.y+uy*(u+unitLength/2),angle,lengthIn:unitLength,widthIn:role==='wall-cap'?capDepth:d,heightIn:role==='wall-cap'?height:course,kind:role==='wall-cap'?'paver':'wall',sourceUrl:supplier.product.sourceUrl};}
       occupiedUnits=yardClip([...occupiedUnits,...cuts]);
      }
     }
    };
    let row=0;for(let y=bottom;y<top-cap-.001;y+=course)lay('wall-block',y+Math.min(course,top-cap-y),Math.min(course,top-cap-y)-(supplier?0:.03),length,row++);
    if(cap)lay('wall-cap',top,cap,capLength,0);
    const drainage=yardClip(yardPathBackStrip(wallPath,d/2,d/2+12)),backfill=yardClip(yardPathBackStrip(wallPath,d/2+12,d/2+24)),baseFootprint=yardClip([...yardPathEnvelope(wallPath,d+12),...yardPathBackStrip(wallPath,d/2,d/2+12)]);
    for(const p of yardSolidCells(drainage))add('wall-drainage',p,top-cap,Math.max(1,retainedDepth),'#989a91',true);
    for(const p of yardSolidCells(backfill))add('backfill',p,top-cap,Math.max(1,retainedDepth),'#765e42',true);
    for(const p of yardSolidCells(baseFootprint))add('base',p,bottom,6,'#8c8a7c',true);
    for(let seg=0;seg+1<wallPath.length;seg++){const p=wallPath[seg],q=wallPath[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),nx=-(q.y-p.y)/span,ny=(q.x-p.x)/span,offset=d/2+6,m:YardMember={id:`${f.id}-drain-pipe-${seg}`,featureId:f.id,role:'drain-pipe',color:'#262e32',a:{x:p.x+nx*offset,y:bottom+2,z:p.y+ny*offset},b:{x:q.x+nx*offset,y:bottom+2,z:q.y+ny*offset},width:4,depth:4};members.push(m);model.members.push(m);}
    excavations.push({featureId:f.id,polys:baseFootprint,bottom:bottom-6});
    model.quantities={...model.quantities,wallLengthLf:run/12,wallFaceSqft:run*h/144,wallBlocks:new Set(model.boxes.filter(b=>b.role==='wall-block').map(b=>b.unitId)).size,wallCaps:new Set(model.boxes.filter(b=>b.role==='wall-cap').map(b=>b.unitId)).size,drainPipeLf:run/12,wallBaseYd3:yardArea(baseFootprint)*6/324,drainageYd3:yardArea(drainage)*retainedDepth/324,backfillYd3:yardArea(backfill)*retainedDepth/324};
    stockSchedule();
    localWarnings.push('Wall path follows the drawn centreline, including its turns. Corner cuts, buried courses, batter, geogrid, bearing, outlet and surcharge engineering require the selected system and builder review.');
    if(supplier)localWarnings.push(`Documented body unit ${supplier.unit.widthMm} mm face × ${supplier.unit.lengthMm} mm depth × ${supplier.unit.heightMm} mm course. ${supplier.cap?`Selected cap ${supplier.cap.widthMm} × ${supplier.cap.lengthMm} × ${supplier.cap.heightMm} mm.`:'Cap selection remains pending.'} Corners and geogrid need a system-specific selection and quote; no generic cap is substituted.`);
    warnings.push(...localWarnings);continue;
   }
   model.topIn=top;let courses=0;
   for(let y=bottom;y<top-cap-.001;y+=course){const ch=Math.min(course,top-cap-y);for(let u=-w/2-(courses%2&&f.hardscape?.patternId!=='stack-bond'?length/2:0);u<w/2;u+=length){const l=Math.max(-w/2,u),r=Math.min(w/2,u+length);if(r-l>.01){add('wall-block',localRect((l+r)/2,0,r-l-(supplier?0:.05),d),y+ch,ch-(supplier?0:.03),f.color,!supplier||!rectangularUnit(supplier.unit));const b=model.boxes.at(-1)!;b.unitId=`${f.id}-wall-${courses}-${u}`;if(supplier?.color.imageUrl)b.surface={imageUrl:supplier.color.imageUrl,cx:x+c*(u+length/2),cz:z+s*(u+length/2),angle:a,lengthIn:length,widthIn:d,heightIn:course,kind:'wall',sourceUrl:supplier.product.sourceUrl};}}courses++;}
   if(cap)for(let u=-w/2;u<w/2;u+=capLength){const len=Math.min(capLength,w/2-u);add('wall-cap',localRect(u+len/2,0,len-(supplier?0:.05),capDepth),top,cap,f.color,!supplier||!rectangularUnit(supplier.cap!));const b=model.boxes.at(-1)!;b.unitId=`${f.id}-cap-${u}`;if(supplier?.color.imageUrl)b.surface={imageUrl:supplier.color.imageUrl,cx:x+c*(u+capLength/2),cz:z+s*(u+capLength/2),angle:a,lengthIn:capLength,widthIn:capDepth,heightIn:cap,kind:'paver',sourceUrl:supplier.product.sourceUrl};}
   const drainage=localRect(0,d/2+6,w,12),backfill=localRect(0,d/2+18,w,12);
   add('wall-drainage',drainage,top-cap,Math.max(1,retainedDepth),'#989a91',true);add('backfill',backfill,top-cap,Math.max(1,retainedDepth),'#765e42',true);
   add('base',localRect(0,6,w+12,d+24),bottom,6,'#8c8a7c',true);pipe('drain-pipe',-w/2,d/2+6,w/2,d/2+6,bottom+2,4);
   excavations.push({featureId:f.id,polys:[localRect(0,6,w+12,d+24)],bottom:bottom-6});
   model.quantities={...model.quantities,wallLengthLf:w/12,wallFaceSqft:w*h/144,wallBlocks:model.boxes.filter(b=>b.role==='wall-block').length,wallCaps:model.boxes.filter(b=>b.role==='wall-cap').length,drainPipeLf:w/12,wallBaseYd3:(w+12)*(d+24)*6/46656,drainageYd3:w*12*retainedDepth/46656,backfillYd3:w*12*retainedDepth/46656};
   stockSchedule();
   localWarnings.push(supplier?`Documented wall body units ${supplier.unit.widthMm} × ${supplier.unit.lengthMm} × ${supplier.unit.heightMm} mm. ${supplier.cap?`Selected cap ${supplier.cap.widthMm} × ${supplier.cap.lengthMm} × ${supplier.cap.heightMm} mm.`:'Cap selection remains pending.'} Corners, batter, geogrid and outlet need a system-specific quote.`:'Generic wall courses, buried course, cap and drainage are design envelopes; manufacturer unit, batter, geogrid, bearing, outlet and surcharge engineering remain unselected. The existing wall band is an assembly allowance, not a block unit price.');
  }else{
   const pondless=f.productId==='pondless-waterfall',fountain=f.productId==='fountain',depth=fountain?24:Math.max(12,f.heightIn),bottom=grade-depth,liner=.08;
   model.topIn=grade;for(const p of yardSolidCells(footprints))add('liner',p,bottom+liner,liner,'#1e2426',true);
   for(const [u,v,l,t]of [[0,-d/2,w,.15],[0,d/2,w,.15],[-w/2,0,.15,d],[w/2,0,.15,d]])add('liner',localRect(u,v,l,t),grade,depth,'#1e2426',true);
   add('basin',localRect(0,0,Math.max(4,w-2),Math.max(4,d-2)),bottom+4,4,'#414a4b',true);
   const waterTop=pondless?grade-8:grade-2;for(const p of yardSolidCells(footprints))add('water',p,waterTop,Math.max(.1,waterTop-bottom-4),'#39727a',true);
   add('pump',localRect(-w/4,0,8,6),bottom+10,6,'#28312d',true);pipe('water-pipe',-w/4,0,w/3,0,bottom+7,1.5);
   if(fountain){const height=Math.max(1,f.heightIn);add('rock',localRect(0,0,Math.min(18,w/2),Math.min(18,d/2)),grade+height,height,'#8e938b',true);localWarnings.push('Fountain height controls the visible column. A separate 24-inch-deep conceptual basin is shown pending the selected reservoir specification.');}
   if(pondless)for(let i=0;i<3;i++)add('rock',localRect(w/3,(-d/3)+i*d/6,Math.max(6,w/3),Math.max(6,d/4)),grade+6*(3-i),6,'#8e938b',true);
   const perimeter=2*(w+d);for(let n=0;n<Math.ceil(perimeter/12);n++){const t=n/Math.ceil(perimeter/12)*perimeter;let u:number,v:number;if(t<w){u=-w/2+t;v=-d/2;}else if(t<w+d){u=w/2;v=-d/2+t-w;}else if(t<2*w+d){u=w/2-(t-w-d);v=d/2;}else{u=-w/2;v=d/2-(t-2*w-d);}add('rock',localRect(u,v,11,9),grade+4,6,'#8e938b',true);}
   excavations.push({featureId:f.id,polys:footprints,bottom});model.quantities={...model.quantities,basinDepthIn:depth,waterVolumeGal:yardArea(footprints)*(waterTop-bottom-4)/12*7.48052,linerSqft:(w+2*depth+24)*(d+2*depth+24)/144,pumps:1,rockPieces:model.boxes.filter(b=>b.role==='rock').length};
   localWarnings.push('Water depth, rectangular basin, liner allowance, rocks and pump envelope are conceptual. Pump head/flow, filtration, reservoir capacity, electrical supply, overflow and winterization require a supplier design and quote.');
  }
  warnings.push(...localWarnings);
 }
 // Deepest formation owns shared excavation. Clip against the sloped grade
 // first, then subtract previously counted formation areas, including holes.
 const excavationRegions:YardExcavationRegion[]=[];let dug:PlanPoint[][]=[];
 for(const e of excavations.sort((a,b)=>a.bottom-b.bottom)){
  let cut=e.polys;
  if(terrain.slopePct){const z0=(e.bottom-terrain.elevationIn)/(terrain.slopePct/100),lo=terrain.slopePct>0?z0:-1e7,hi=terrain.slopePct>0?1e7:z0;cut=yardClip(cut,[[{x:-1e7,y:lo},{x:1e7,y:lo},{x:1e7,y:hi},{x:-1e7,y:hi}]],'intersection');}
  else if(e.bottom>=terrain.elevationIn)cut=[];
  const unique=yardClip(cut,dug,'difference');dug=yardClip([...dug,...cut]);
  for(const p of yardSolidCells(unique)){const center=centroid(p),volume=Math.abs(yardSignedArea(p))*Math.max(0,gradeAt(center.y)-e.bottom)/46656;excavationRegions.push({featureId:e.featureId,polygon:p,bottomIn:e.bottom,volumeYd3:volume});}
 }
 const active=features.filter(f=>!f.excluded),sum=(key:string)=>active.reduce((n,f)=>n+(f.quantities[key]||0),0),patioUnion=yardClip(active.filter(f=>f.config.kind==='patio').flatMap(f=>f.footprints));
 const perimeter=patioUnion.reduce((n,p)=>n+p.reduce((m,v,i)=>{const q=p[(i+1)%p.length];return m+Math.hypot(v.x-q.x,v.y-q.y);},0),0)/12;
 return {features,boxes,members,warnings,terrain,excavationRegions,patioUnion,quoteRequired:budgetExcludedIds.length>0,paverBudget:{limit:YARD_PAVER_BUDGET,reservedPieces:reservedPavers,remainingPieces:YARD_PAVER_BUDGET-reservedPavers,excludedFeatureIds:budgetExcludedIds},deckClearance:{clearanceIn:SUPPORT_CLEARANCE_IN,supportCutouts:yardClip(supportCutouts),minStairClearanceIn,minFramingClearanceIn,checked:!!deckModel},quantities:{patioAreaSqft:sum('paverAreaSqft'),patioPerimeterLf:perimeter,wallFaceSqft:sum('wallFaceSqft'),wallLengthLf:sum('wallLengthLf'),paverPieces:sum('paverPieces'),wallBlocks:sum('wallBlocks'),wallCaps:sum('wallCaps'),baseYd3:sum('baseYd3'),wallBaseYd3:sum('wallBaseYd3'),raisedFillYd3:sum('raisedFillYd3'),beddingYd3:sum('beddingYd3'),drainageYd3:sum('drainageYd3'),backfillYd3:sum('backfillYd3'),waterVolumeGal:sum('waterVolumeGal'),linerSqft:sum('linerSqft'),excavationYd3:excavationRegions.reduce((n,e)=>n+e.volumeYd3,0)}};
}
export type YardModel=ReturnType<typeof buildYardModel>;
