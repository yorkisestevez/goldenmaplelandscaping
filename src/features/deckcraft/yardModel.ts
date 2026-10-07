import {localPolygonClip} from './lib/localPolygonClip';
import {PAVER_BRANDS} from '../../data/carrPrices';
import baseline from '../../data/engine-baseline.json';
import type {DeckData,YardFeature} from './types';
import type {Box,Member,DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {getTerrainConfig} from './yardSettings';
import {getHousePlacement} from './housePlacement';
import {hasHouseBlocks,houseOutline} from './houseFootprint';
import {yardFeatureOutline,yardWallPath,yardPathEnvelope,yardPathBackStrip,pathRun} from './yardPathGeometry';
import {yardShapeProblem} from './yardShapeGeometry';
import {hardscapeSelection,hardscapeProblem,hardscapeSwatchKey,rectangularUnit} from './hardscapeCatalogue';
import type {HardscapeUnit} from './hardscapeCatalogue';
import {hardscapeBlanks} from './hardscapeLayout';
import {hardscapeProfile,hardscapeStockPolygons} from './hardscapeShapes';
import {yardWallCourses} from './yardElevations';
import {wallConstructionProblem} from './wallConstruction';
import {wallCoursePath,wallFoundationSections,wallSectionMask,wallConstructionForPath} from './wallFoundation';
import {patioInlayPlans,patioInlayFeature} from './patioInlays';
import {createSiteSurface,integrateSiteExcavation,integrateSiteFeatureFill,siteSurfaceSnapshot,siteMaterialBand,sitePolygonsBelowGround,siteRetainedSideArea,sitePlaneHeight,siteDeckClearances} from './siteSurface';
import type {SitePlane} from './siteSurface';

export type YardRole='stone-step'|'geogrid'|'paver'|'base'|'bedding'|'wall-block'|'wall-cap'|'wall-drainage'|'backfill'|'liner'|'water'|'basin'|'pump'|'rock'|'drain-pipe'|'water-pipe'|'fire-pad'|'fire-body'|'fire-ring'|'fire-burner';
/** `swatchKey` names the manufacturer photo; the lazily loaded 3D view resolves it (hardscape-swatches.json). */
export interface YardSurface {swatchKey:string;cx:number;cz:number;angle:number;lengthIn:number;widthIn:number;heightIn:number;kind:'paver'|'wall';sourceUrl:string}
export type YardBox=Box&{id:string;featureId:string;role:YardRole;color:string;illustrative?:boolean;unitId?:string;stonePart?:'tread'|'support-step'|'filler'|'riser-block'|'support-block'|'landing';stepFlightId?:string;stepRow?:number;surface?:YardSurface;stockAreaSqft?:number;stockUnitId?:string;renderContours?:PlanPoint[][];renderDuplicate?:boolean;topPlane?:SitePlane;bottomPlane?:SitePlane;bottomIn?:number;normalThicknessIn?:number};
export type YardMember=Member&{id:string;featureId:string;role:YardRole;color:string};
export interface YardFeatureModel {assemblyQuoteScopes?:import('./yardTakeoff').PublicYardSection[];config:YardFeature;footprints:PlanPoint[][];topIn:number;topPlane?:SitePlane;boxes:YardBox[];members:YardMember[];warnings:string[];quantities:Record<string,number>;pavingZones?:{feature:YardFeature;areaSqft:number;stockAreaSqft:number;inlayId?:string}[];stockSchedule?:{unitId:string;widthMm:number;lengthMm:number;heightMm:number;pieces:number;productId?:string;inlayId?:string;assemblyPart?:YardBox['stonePart'];cuts?:number}[];sourceUrl?:string;excluded:boolean;supportClearances?:PlanPoint[][];quoteRequired?:boolean;exclusionReason?:'paver-budget'|'wall-budget'|'site-coverage'}
export interface YardExcavationRegion {featureId:string;polygon:PlanPoint[];bottomIn:number;volumeYd3:number;formationPlane?:SitePlane}
const S=100000;
export const yardSignedArea=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
export const yardArea=(p:PlanPoint[][])=>Math.abs(p.reduce((n,x)=>n+yardSignedArea(x),0))/144;
/** One stock unit's coverage face, for order areas: its digitized manufacturer outline where there is one
 * (a rhombus covers half its rectangular envelope), otherwise the nominal rectangle. An internal
 * opening, such as Aquastorm's drainage void, stays part of the ground the unit covers. */
export const yardStockFaceSqft=(productId:string,unit:HardscapeUnit,lengthIn:number,widthIn:number)=>{if(!hardscapeProfile(productId,unit))return lengthIn*widthIn/144;return Math.max(...hardscapeStockPolygons(productId,unit,0,0,0).map(p=>Math.abs(yardSignedArea(p))))/144;};
export function yardClip(subject:PlanPoint[][],clip:PlanPoint[][]=[],operation:'union'|'difference'|'intersection'='union'):PlanPoint[][]{
 return localPolygonClip(subject,clip,operation,S).filter(p=>Math.abs(yardSignedArea(p))>.0001);
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
export function yardRectangle(x:number,z:number,w:number,d:number,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+c*u*w/2-s*v*d/2,y:z+s*u*w/2+c*v*d/2}));}
export function yardCentroid(p:PlanPoint[]){const a=yardSignedArea(p);let x=0,y=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],k=p[i].x*q.y-q.x*p[i].y;x+=(p[i].x+q.x)*k;y+=(p[i].y+q.y)*k;}return {x:x/(6*a),y:y/(6*a)};}
const profile=(url:string,rows:{depth:number;lengths:number[]}[],illustrative=false)=>({sourceUrl:`https://permacon.ca/en/product/${url}/`,rows:rows.map(r=>({depth:r.depth/25.4,lengths:r.lengths.map(n=>n/25.4)})),illustrative});
export const yardPaverProfiles={
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
 if(f.kind!=='patio'||f.stepAssembly)return 0;
 const extra=patioInlayPlans(f).filter(p=>p.status==='ok').reduce((n,p)=>n+hardscapeBlanks(patioInlayFeature(f,p.inlay)).length,0);
 if(f.hardscape)return hardscapeBlanks(f).length+extra;
 const rows=yardPaverProfiles[f.productId as keyof typeof yardPaverProfiles]?.rows||[{depth:12,lengths:[24]}];
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
  const square=(w:number)=>out.push(yardRectangle(p.x,p.z,w+2*SUPPORT_CLEARANCE_IN,w+2*SUPPORT_CLEARANCE_IN));
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
const treadFootprint=(b:Box)=>b.polygon||yardRectangle(b.x,b.z,b.w,b.d,-(b.angle||0));
function buildLegacyYardModel(data:DeckData,deckModel?:DeckTakeoff){
 const terrain={...getTerrainConfig(data),elevationIn:0,slopePct:0},site=undefined as ReturnType<typeof createSiteSurface>|undefined,gradeAt=(_z:number,_x=0)=>0;
 const warnings:string[]=[],features:YardFeatureModel[]=[],boxes:YardBox[]=[],members:YardMember[]=[],excavations:{featureId:string;polys:PlanPoint[][];bottom:number}[]=[];
 // The house with its bump-outs, wings and garage: attached blocks are unioned with the main block.
 const house=getHousePlacement(data),houseFootprint=data.houseVisible===false?[]:hasHouseBlocks(data)?houseOutline(data):[yardRectangle((house.x0+house.x1)/2,-house.depthIn/2,house.widthIn,house.depthIn)];
 let occupied:PlanPoint[][]=[...houseFootprint];
 // Fire features route a design to the advanced runtime (needsAdvancedYard), which models them; never here.
 const enabled=(data.yardFeatures||[]).filter(f=>f.enabled&&f.kind!=='fire-feature').sort((a,b)=>Number(a.kind==='patio')-Number(b.kind==='patio'));
 const ids=new Set<string>(),supportCutouts:PlanPoint[][]=[],budgetExcludedIds:string[]=[];let reservedPavers=0;
 const measuredDeck=site&&deckModel?siteDeckClearances(site,deckModel):undefined,stairCoverageComplete=measuredDeck?.stairCoverageComplete??true,framingCoverageComplete=measuredDeck?.framingCoverageComplete??true;
 const treadClearances=(deckModel?.treads||[]).map(t=>t.y+t.h/2-Math.max(...treadFootprint(t).map(p=>gradeAt(p.y,p.x))));
 const framingClearances=(deckModel?.levels||[]).flatMap(l=>[...l.joists,...l.beams,...(l.rim||[])]).flatMap(m=>[m.a.y-m.depth/2-gradeAt(m.a.z,m.a.x),m.b.y-m.depth/2-gradeAt(m.b.z,m.b.x)]);
 const minStairClearanceIn=measuredDeck?measuredDeck.minStairClearanceIn:treadClearances.length?Math.min(...treadClearances):null,minFramingClearanceIn=measuredDeck?measuredDeck.minFramingClearanceIn:framingClearances.length?Math.min(...framingClearances):null;
 if(measuredDeck)warnings.push(...measuredDeck.warnings);
 if(site&&!site.cutFill.complete)warnings.push(`Grading extends beyond survey coverage by ${site.cutFill.uncoveredAreaSqft.toFixed(1)} sq ft; cut/fill quantities cover only measured terrain and remain incomplete.`);
 if(deckModel&&(site||0!==0||0!==0)){
  warnings.push(`Deck elevations remain on their original zero datum. Selected terrain gives ${minStairClearanceIn===null?'no stair surface':`${minStairClearanceIn.toFixed(1)} in minimum stair walking-surface clearance`} and ${minFramingClearanceIn===null?'no framing measurement':`${minFramingClearanceIn.toFixed(1)} in minimum framing clearance`}; review foundation exposure, access and grading together.`);
  if(!site&&minStairClearanceIn!==null&&minStairClearanceIn<=0)warnings.push('Selected terrain intersects or covers a deck stair walking surface; revise grading or the stair design before construction.');
  if(!site&&minFramingClearanceIn!==null&&minFramingClearanceIn<=0)warnings.push('Selected terrain intersects deck framing; revise grading or deck elevations before construction.');
 }
 for(const f of enabled){
  if(ids.has(f.id)){warnings.push(`Duplicate yard feature id ${f.id} excluded.`);continue;}ids.add(f.id);
  if(![f.xFt,f.zFt,f.widthFt,f.depthFt,f.heightIn,f.rotationDeg,f.baseElevationIn??0].every(Number.isFinite)||f.widthFt<=0||f.depthFt<=0||f.baseElevationIn!==undefined&&(f.kind!=='retaining-wall'||Math.abs(f.baseElevationIn)>120)){warnings.push(`${f.name}: invalid dimensions excluded.`);continue;}
  const supplierProblem=hardscapeProblem(f)||wallConstructionProblem(f);if(supplierProblem){warnings.push(`${f.name}: ${supplierProblem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[supplierProblem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}
  if(f.outline||f.wallPath){const problem=f.kind==='patio'&&f.wallPath||f.kind==='retaining-wall'&&f.outline||f.kind==='water-feature'?'The shape does not match this feature.':yardShapeProblem(f.kind as 'patio'|'retaining-wall',f.outline??f.wallPath);if(problem){warnings.push(`${f.name}: ${problem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[problem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}}
  const supplier=hardscapeSelection(f),capDepth=supplier?.cap?supplier.cap.lengthMm/25.4:f.depthFt*12+2;
  const w=f.widthFt*12,d=f.depthFt*12,x=f.xFt*12,z=f.zFt*12,a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),grade=gradeAt(z,x);
  if(site&&!Number.isFinite(grade)){const message=`${f.name}: its elevation datum is outside measured survey coverage. Geometry and construction quantities are pending; extend the survey or reposition the feature.`;warnings.push(message);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,siteCoveragePending:1},excluded:true,quoteRequired:true,exclusionReason:'site-coverage'});continue;}
  const projectedPavers=projectedYardPavers(f);
  if(projectedPavers>YARD_PAVER_BUDGET-reservedPavers||!Number.isFinite(projectedPavers)){
   const message=`${f.name}: the raw layout needs ${Number.isFinite(projectedPavers)?projectedPavers.toLocaleString('en-CA'):'more than 20,000'} pavers and exceeds the remaining ${(YARD_PAVER_BUDGET-reservedPavers).toLocaleString('en-CA')} of the shared 20,000-paver model budget. The whole patio is excluded from geometry and installed quantities; quote required. Reduce its size or use larger pavers. This preflight conservatively counts the full rectangle before cut-outs.`;
   budgetExcludedIds.push(f.id);warnings.push(message);features.push({config:f,footprints:[],topIn:grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,paverAreaSqft:0,paverPieces:0},excluded:true,quoteRequired:true,exclusionReason:'paver-budget'});continue;
  }
  const wallPath=f.kind==='retaining-wall'?yardWallPath(f):[],construction=f.kind==='retaining-wall'?wallConstructionForPath(f,grade,wallPath,gradeAt,site):undefined,coursePaths=construction?Array.from({length:construction.count},(_,row)=>wallCoursePath(wallPath,row*construction.setbackPerCourseIn)):[],original=construction?yardClip(coursePaths.flatMap(path=>yardPathEnvelope(path,d))):yardFeatureOutline(f),reinforcedEnvelope=construction?yardClip([...yardPathEnvelope(wallPath,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathEnvelope(coursePaths.at(-1)!,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathBackStrip(wallPath,d/2,Math.max(d/2+construction.drainageDepthIn+12,-d/2+construction.lengthIn)+construction.maxSetbackIn)]):[],envelope=construction?reinforcedEnvelope:f.kind==='retaining-wall'&&f.wallPath?yardClip([...yardPathEnvelope(wallPath,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathBackStrip(wallPath,d/2,d/2+24)]):f.kind==='retaining-wall'?[yardRectangle(x-s*9,z+c*9,w+12,Math.max(d,supplier?.cap?capDepth:d)+30,a)]:f.kind==='water-feature'?[yardRectangle(x,z,w+12,d+12,a)]:original,overlap=yardClip(envelope,occupied,'intersection'),localWarnings:string[]=[];
  if(site&&!site.extrema(envelope,'existing').complete){const message=`${f.name}: its full construction envelope is outside measured survey coverage. Geometry and installed/excavation quantities are pending; include the foundation, drainage and reinforcement envelope in the survey.`;warnings.push(message);features.push({config:f,footprints:[],topIn:grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,siteCoveragePending:1},excluded:true,quoteRequired:true,exclusionReason:'site-coverage'});continue;}
  if(yardArea(yardClip(envelope,houseFootprint,'intersection'))>.001)localWarnings.push(`${f.name}: construction overlaps the house footprint; patio area is clipped and conflicting wall/water features are excluded.`);
  if(envelope.flat().some(p=>Math.abs(p.x-data.width*6)>terrain.widthFt*6||Math.abs(p.y-data.length*6)>terrain.depthFt*6))localWarnings.push(`${f.name}: the construction envelope extends outside the selected terrain dimensions.`);
  const paverThickness=(supplier?.unit.heightMm??PAVER_BRANDS.find(p=>p.id===f.productId)?.thicknessMm??60)/25.4;
  const low=f.kind==='patio'?grade+f.heightIn-paverThickness-1-baseline.facts.baseDepthIn:f.kind==='retaining-wall'?construction!.bottom-construction!.baseDepthIn:grade-(f.productId==='fountain'?24:Math.max(12,f.heightIn));
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
  const localRect=(u:number,v:number,l:number,t:number)=>yardRectangle(x+c*u-s*v,z+s*u+c*v,l,t,a);
  const pipe=(role:YardRole,u0:number,v0:number,u1:number,v1:number,y:number,diameter:number)=>{const m:YardMember={id:`${f.id}-${role}-${members.length}`,featureId:f.id,role,color:'#262e32',a:{x:x+c*u0-s*v0,y,z:z+s*u0+c*v0},b:{x:x+c*u1-s*v1,y,z:z+s*u1+c*v1},width:diameter,depth:diameter};members.push(m);model.members.push(m);};
  if(site||0)localWarnings.push(`${f.name}: level feature placed at centre grade; earthwork follows ${site?'measured terrain and explicit grading':'the sloped terrain plane'}. Drainage and retaining transitions require site review.`);
  if(f.kind==='patio'){
   const product=PAVER_BRANDS.find(p=>p.id===f.productId),spec=yardPaverProfiles[f.productId as keyof typeof yardPaverProfiles];
   const thick=paverThickness,base=baseline.facts.baseDepthIn,top=model.topIn,area=model.quantities.areaSqft;
   if(!product)localWarnings.push(`${supplier?`${supplier.product.brand} ${supplier.product.name}`:'Unknown paver selection'}: supply and installation need a product-specific quote.`);
   model.sourceUrl=supplier?.product.sourceUrl??spec?.sourceUrl;
   localWarnings.push('Referenced paver modules: confirm SKU, colour, pattern mix, joints and supplier packs before ordering.');
   if(spec?.illustrative)localWarnings.push('Rosebel interlocking edges: rectangular modules are illustrative; exact cut templates remain pending.');
   for(const p of yardSolidCells(footprints)){add('base',p,top-thick-1,base,'#8c8a7c');add('bedding',p,top-thick,1,'#c5bda4');}
   const plans=patioInlayPlans(f,footprints),valid=plans.filter(p=>p.status==='ok'),field=yardClip(footprints,valid.map(p=>p.outline),'difference');
   for(const p of plans.filter(p=>p.status!=='ok'))localWarnings.push(`${p.inlay.name}: ${p.message}`);
   const laySupplier=(zone:YardFeature,mask:PlanPoint[][],inlayId?:string)=>{const sel=hardscapeSelection(zone)!;const za=zone.rotationDeg*Math.PI/180,zc=Math.cos(za),zs=Math.sin(za),before=model.boxes.length;
    for(const blank of hardscapeBlanks(zone)){const centre={x:zone.xFt*12+zc*blank.cx-zs*blank.cy,y:zone.zFt*12+zs*blank.cx+zc*blank.cy},angle=za+blank.angle,stock=sel.finish.units.find(u=>u.id===blank.unitId)??sel.unit;
     const contours=yardClip(hardscapeStockPolygons(sel.product.id,stock,centre.x,centre.y,angle),mask,'intersection'),profile=hardscapeProfile(sel.product.id,stock);
     // a stone split into several solid cells (any off-axis angle) is drawn once from its whole cut contour, never as seamed pieces
     const cells=yardSolidCells(contours),whole=!!profile||valid.length>0||cells.length>1;let fragment=0;for(const p of cells){add('paver',p,top,stock.heightMm/25.4,zone.color,!rectangularUnit(stock)&&!profile);const b=model.boxes.at(-1)!;b.unitId=`${zone.id}-paver-${blank.id}`;b.stockAreaSqft=yardStockFaceSqft(sel.product.id,stock,blank.length,blank.width);b.stockUnitId=stock.id;if(whole){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}if(sel.color.swatch)b.surface={swatchKey:hardscapeSwatchKey(sel.product.id,sel.finish.id,sel.color.id),cx:centre.x,cz:centre.y,angle,lengthIn:blank.length,widthIn:blank.width,heightIn:stock.heightMm/25.4,kind:'paver',sourceUrl:sel.product.sourceUrl};}
    }
    const recipe=sel.finish.patterns.find(p=>p.id===zone.hardscape!.patternId);if(inlayId&&recipe?.layout.installationJointMm!==undefined)localWarnings.push(`${zone.name}: supplier installation joint ${recipe.layout.installationJointMm} mm differs from nominal pattern modules; confirm installed spacing before ordering.`);
    const stock=[...new Map(model.boxes.slice(before).map(b=>[b.unitId,b])).values()],stockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);model.pavingZones??=[];model.pavingZones.push({feature:zone,areaSqft:yardArea(mask),stockAreaSqft,...(inlayId?{inlayId}:{})});
    model.stockSchedule??=[];model.stockSchedule.push(...sel.finish.units.flatMap(u=>{const pieces=stock.filter(b=>b.stockUnitId===u.id).length;return pieces?[{unitId:u.id,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces,...(inlayId?{productId:zone.productId,inlayId}:{})}]:[];}));
   };
   if(supplier){
    laySupplier(f,field);
    const recipe=supplier.finish.patterns.find(p=>p.id===f.hardscape!.patternId);if(recipe?.layout.installationJointMm!==undefined)localWarnings.push(`Nominal stock diagram; supplier installation joints ${recipe.layout.installationJointMm} mm. Confirm installed spacing and packs; this is not a joint schedule.`);localWarnings.push(recipe?`Manufacturer recipe ${recipe.name}: documented units/repeat coordinates; nominal pitch ${recipe.sourceUrl}. Confirm supplied dimensions and joint tolerances.`:`Selected stock ${supplier.unit.widthMm} × ${supplier.unit.lengthMm} × ${supplier.unit.heightMm} mm; ${f.hardscape!.jointMm} mm joints are added to the module. The contractor pattern uses this single stock size; supplier multi-size recipes remain in the pattern library.`);
    if(!rectangularUnit(supplier.unit)&&['herringbone','basket-weave'].includes(f.hardscape!.patternId))localWarnings.push('Legacy rectangular envelope layout retained from the saved design; choose a compatible shaped bond or verified supplier recipe.');
    if(!rectangularUnit(supplier.unit))localWarnings.push(hardscapeProfile(supplier.product.id,supplier.unit)?'Stock outlines follow the manufacturer plan drawing at nominal dimensions; confirm joints and fabrication against the supplier technical guide.':'The supplier lists a shaped unit. Rectangular stock envelopes are illustrative; its exact mould profile has not been digitized.');
   }else{
   const rows=spec?.rows||[{depth:12,lengths:[24]}],gap=.125;let row=0;
   for(let v=-d/2;v<d/2-.001;){const r=rows[row%rows.length],depth=r.depth;let col=0;
    for(let u=-w/2-(row%2?(r.lengths[0]+gap)/2:0);u<w/2-.001;){const len=r.lengths[col%r.lengths.length],contours=yardClip([localRect(u+len/2,v+depth/2,len,depth)],field,'intersection'),cells=yardSolidCells(contours),whole=valid.length>0||cells.length>1;let fragment=0;for(const p of cells){add('paver',p,top,thick,f.color,spec?.illustrative||!spec);const b=model.boxes.at(-1)!;b.unitId=`${f.id}-paver-${row}-${col}`;if(whole){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}}u+=len+gap;col++;}
    v+=depth+gap;row++;
   }
   }
   if(!supplier&&valid.length)model.pavingZones=[{feature:f,areaSqft:yardArea(field),stockAreaSqft:yardArea(field)}];
   for(const p of valid){laySupplier(patioInlayFeature(f,p.inlay),[p.outline],p.inlay.id);localWarnings.push(`${p.inlay.name}: custom inlay cutting, setting and waste require a builder quote; this is a cut-paver design, not a manufactured medallion kit.`);}
   model.quantities={...model.quantities,paverPieces:new Set(model.boxes.filter(b=>b.role==='paver').map(b=>b.unitId)).size,baseYd3:area*base/324,beddingYd3:area/324,paverAreaSqft:area};
   if(supplier||valid.length){const stock=[...new Map(model.boxes.filter(b=>b.role==='paver').map(b=>[b.unitId,b])).values()];model.quantities.paverStockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);}
   const formation=top-thick-1-base;let fill=footprints;
   if(site)fill=[]; // Dedicated site fill is integrated against every proposed face below.
   else if(0){const z0=(formation-0)/(0/100),lo=0>0?-1e7:z0,hi=0>0?z0:1e7;fill=yardClip(fill,[[{x:-1e7,y:lo},{x:1e7,y:lo},{x:1e7,y:hi},{x:-1e7,y:hi}]],'intersection');}
   else if(formation<=0)fill=[];
   model.quantities.raisedFillYd3=site?integrateSiteFeatureFill(site,footprints,formation):yardSolidCells(fill).reduce((n,p)=>n+Math.abs(yardSignedArea(p))*Math.max(0,formation-gradeAt(yardCentroid(p).y,yardCentroid(p).x))/46656,0);
   if(model.quantities.raisedFillYd3>.001)localWarnings.push('Additional engineered fill below the patio base is required by the selected elevation; fill supply, compaction and containment need a quote.');
   excavations.push({featureId:f.id,polys:footprints,bottom:top-thick-1-base});
  }else if(f.kind==='retaining-wall'){
   const h=Math.max(1,f.heightIn),armour=f.productId==='armour-stone',{course,cap,bottom,top,count}=construction!,length=supplier?supplier.unit.widthMm/25.4:armour?36:18,capLength=supplier?.cap?supplier.cap.widthMm/25.4:24,retainedDepth=top-cap-bottom;
   const {baseDepthIn,drainageDepthIn,lengthIn}=construction!;
   const drainageEnd=d/2+drainageDepthIn,backEnd=Math.max(drainageEnd+12,-d/2+lengthIn),run=pathRun(wallPath);
   const sections=wallFoundationSections(wallPath,construction!,d,gradeAt,f.baseElevationIn??0,site),sectionMasks=sections.map(section=>[wallSectionMask(wallPath,section)]);
   const zoneCache=new Map<PlanPoint[],Map<string,PlanPoint[][][]>>();
   const zonesFor=(path:PlanPoint[],from:number,to:number,mask?:PlanPoint[][])=>{const key=`${from}:${to}:${mask?'bounded-body':'strip'}`,cache=zoneCache.get(path)??new Map<string,PlanPoint[][][]>();zoneCache.set(path,cache);const saved=cache.get(key);if(saved)return saved;let claimed:PlanPoint[][]=[];const bounded=mask??yardClip(yardPathBackStrip(path,from,to));const result=yardPathBackStrip(path,from,to,Infinity).map(strip=>{const zone=yardClip(yardClip([strip],bounded,'intersection'),claimed,'difference');claimed=yardClip([...claimed,...zone]);return zone;});cache.set(key,result);return result;};
   // A corner's bounded mitre and batter can extend below the centreline
   // grade. Lower the local bench by full courses until its entire body
   // footprint has the specified burial; never silently leave it exposed.
   for(let i=0;i<sections.length;i++){const section=sections[i];for(let attempt=0;attempt<count;attempt++){const row=Math.max(0,Math.round((section.bottomIn-bottom)/course)),path=coursePaths[row],body=yardClip(zonesFor(path,-d/2,d/2,yardPathEnvelope(path,d))[section.segment],sectionMasks[i],'intersection'),lowGrade=(site?site.extrema(body).min:Math.min(...body.flat().map(v=>gradeAt(v.y,v.x))))+(f.baseElevationIn??0);if(!Number.isFinite(lowGrade)||lowGrade-section.bottomIn>=construction!.minimumBurialIn-1e-5||section.bottomIn<=bottom+1e-5)break;section.bottomIn-=course;}}
   const scopeCache=new Map<string,PlanPoint[][]>(),scope=(seg:number,elevation:number)=>{const key=`${seg}:${elevation}`,saved=scopeCache.get(key);if(saved)return saved;const value=yardClip(sections.flatMap((section,i)=>section.segment===seg&&section.bottomIn<elevation-1e-6?sectionMasks[i]:[]));scopeCache.set(key,value);return value;};
   // Mesh facets on an arc share a stock schedule. Real control corners keep
   // separate cut units; a tessellation boundary is not a new purchased block.
   const curveStarts:number[]=[];if(f.curves?.length){const controls=f.wallPath??[{x:-w/2,y:0},{x:w/2,y:0}];let searchFrom=0;for(const control of controls){const point={x:x+c*control.x-s*control.y,y:z+s*control.x+c*control.y},index=wallPath.findIndex((p,i)=>i>=searchFrom&&Math.hypot(p.x-point.x,p.y-point.y)<1e-5);if(index>=0){curveStarts.push(index);searchFrom=index+1;}}}
   const lay=(role:'wall-block'|'wall-cap',path:PlanPoint[],elevation:number,height:number,unitLength:number,row:number)=>{
    const width=role==='wall-cap'?capDepth:d,zones=zonesFor(path,-width/2,width/2,yardPathEnvelope(path,width)),curved=curveStarts.length>=2,stations=[0],curvePieces=new Map<string,YardBox[]>();for(let seg=0;seg+1<path.length;seg++)stations.push(stations.at(-1)!+Math.hypot(path[seg+1].x-path[seg].x,path[seg+1].y-path[seg].y));
    let controlEdge=0;for(let seg=0;seg+1<path.length;seg++){
     while(curved&&controlEdge+1<curveStarts.length-1&&seg>=curveStarts[controlEdge+1])controlEdge++;

     const p=path[seg],q=path[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,angle=Math.atan2(uy,ux),zone=yardClip(zones[seg],scope(seg,elevation),'intersection'),along=zone.flat().map(v=>(v.x-p.x)*ux+(v.y-p.y)*uy);if(!along.length)continue;
     const start=Math.min(...along),end=Math.max(...along),stagger=row%2&&f.hardscape?.patternId!=='stack-bond'?unitLength/2:0,station=curved?stations[seg]-stations[curveStarts[controlEdge]]:0;let slot=curved?Math.floor((station+start+stagger)/unitLength):0;
     for(let u=curved?slot*unitLength-stagger-station:start-stagger;u<end-.001;u+=unitLength,slot++){
      const left=Math.max(start,u),right=Math.min(end,u+unitLength);if(right-left<=.05)continue;
      const leftGap=curved&&!supplier&&Math.abs(left-u)<1e-6?.025:0,rightGap=curved&&!supplier&&Math.abs(right-u-unitLength)<1e-6?.025:0,centre=(left+leftGap+right-rightGap)/2,blank=yardRectangle(p.x+ux*centre,p.y+uy*centre,right-left-(curved?leftGap+rightGap:supplier?0:.05),width,angle),cuts=yardClip([blank],zone,'intersection');
      let textureX=p.x+ux*(u+unitLength/2),textureZ=p.y+uy*(u+unitLength/2),textureAngle=angle;if(curved){const target=stations[curveStarts[controlEdge]]+slot*unitLength-stagger+unitLength/2;let lo=curveStarts[controlEdge],hi=curveStarts[controlEdge+1]-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(stations[mid]<=target)lo=mid;else hi=mid-1;}const begin=path[lo],finish=path[lo+1],length=Math.hypot(finish.x-begin.x,finish.y-begin.y),distance=target-stations[lo];textureX=begin.x+(finish.x-begin.x)*distance/length;textureZ=begin.y+(finish.y-begin.y)*distance/length;textureAngle=Math.atan2(finish.y-begin.y,finish.x-begin.x);}
      let fragment=0;for(const cut of yardSolidCells(cuts)){add(role,cut,elevation,height,f.color,!supplier||!rectangularUnit(supplier.unit));const b=model.boxes.at(-1)!;b.unitId=`${f.id}-${role}-${row}-${curved?controlEdge:seg}-${slot}`;if(fragment++===0)b.renderContours=cuts;else b.renderDuplicate=true;if(curved){const pieces=curvePieces.get(b.unitId)??[];pieces.push(b);curvePieces.set(b.unitId,pieces);}if(supplier?.color.swatch)b.surface={swatchKey:hardscapeSwatchKey(supplier.product.id,supplier.finish.id,supplier.color.id),cx:textureX,cz:textureZ,angle:textureAngle,lengthIn:unitLength,widthIn:width,heightIn:role==='wall-cap'?height:course,kind:role==='wall-cap'?'paver':'wall',sourceUrl:supplier.product.sourceUrl};}
     }
    }
    for(const pieces of curvePieces.values()){pieces[0].renderContours=yardClip(pieces.map(b=>b.polygon!));delete pieces[0].renderDuplicate;for(const b of pieces.slice(1))b.renderDuplicate=true;}
   };
   model.topIn=top;let drainageYd3=0,backfillYd3=0,gridArea=0,gridGrossArea=0,actualGridLayers=0,aboveGroundGridArea=0,planningGridArea=0,planningGridGrossArea=0;
   for(let row=0;row<count;row++){
    const rowBottom=bottom+row*course,elevation=rowBottom+course,path=coursePaths[row];
    lay('wall-block',path,elevation,course-(supplier?0:.03),length,row);
    for(const [role,from,to,color]of [['wall-drainage',d/2,drainageEnd,'#989a91'],['backfill',drainageEnd,backEnd,'#765e42']] as const){
     const zones=zonesFor(path,from,to);for(let seg=0;seg<zones.length;seg++){const cut=yardClip(zones[seg],scope(seg,elevation),'intersection');let volume=0;if(site){const band=siteMaterialBand(site,cut,rowBottom,elevation);volume=band.volumeYd3;for(const region of band.regions){const maxTop=Math.max(...region.polygon.map(v=>sitePlaneHeight(region.topPlane,v.x,v.y)));add(role,region.polygon,maxTop,maxTop-rowBottom,color,true);const box=model.boxes.at(-1)!;box.topPlane=region.topPlane;box.bottomIn=rowBottom;}}else{for(const poly of yardSolidCells(cut))add(role,poly,elevation,course,color,true);volume=yardArea(cut)*course/324;}if(role==='wall-drainage')drainageYd3+=volume;else backfillYd3+=volume;}

    }
   }
   if(cap)lay('wall-cap',coursePaths.at(-1)!,top,cap,capLength,0);
   const sectionLayers=sections.map(section=>{const elevations:number[]=[];for(let y=section.bottomIn+course;y<top-cap-1e-6;y+=course*construction!.everyCourses)elevations.push(y);if(!elevations.length)elevations.push(top-cap);return elevations;}),gridElevations=[...new Set(sectionLayers.flat().map(y=>Number(y.toFixed(7))))].sort((a,b)=>a-b),sectionGridCounts=sections.map(()=>0);
   for(const elevation of gridElevations){
    const row=Math.max(0,Math.min(count-1,Math.round((elevation-bottom)/course)-1)),path=coursePaths[row],raw=yardPathBackStrip(path,-d/2+1,-d/2+lengthIn),requestedStrips=raw.map((poly,seg)=>yardClip([poly],yardClip(sections.flatMap((section,i)=>section.segment===seg&&sectionLayers[i].some(y=>Math.abs(y-elevation)<1e-5)?sectionMasks[i]:[])),'intersection')),strips=site?requestedStrips.map(polys=>sitePolygonsBelowGround(site,polys,elevation)):requestedStrips,installed=yardClip(strips.flat());
    const requestedArea=yardArea(yardClip(requestedStrips.flat()));planningGridArea+=requestedArea;planningGridGrossArea+=Math.max(requestedArea,requestedStrips.reduce((n,p)=>n+yardArea(p),0));
    if(site){aboveGroundGridArea+=Math.max(0,requestedArea-yardArea(installed));for(let i=0;i<sections.length;i++)if(sectionLayers[i].some(y=>Math.abs(y-elevation)<1e-5)&&yardArea(yardClip(installed,sectionMasks[i],'intersection'))>.001)sectionGridCounts[i]++;}
    if(!installed.length)continue;actualGridLayers++;gridArea+=yardArea(installed);gridGrossArea+=Math.max(yardArea(installed),strips.reduce((n,p)=>n+yardArea(p),0));for(const poly of yardSolidCells(installed))add('geogrid',poly,elevation,.04,'#27352c',true);
   }
   let baseYd3=0,minBurial=Infinity,maxBurial=-Infinity,filterArea=0,drainPipeLengthIn=0;
   const baseZonesByRow=new Map<number,PlanPoint[][][]>(),excavationZones=zonesFor(wallPath,d/2,backEnd+construction!.maxSetbackIn);
   for(let i=0;i<sections.length;i++){
    const section=sections[i],row=Math.round((section.bottomIn-bottom)/course),path=coursePaths[row],seg=section.segment;
    if(!baseZonesByRow.has(row))baseZonesByRow.set(row,zonesFor(path,-d/2-6,drainageEnd));
    const base=yardClip(baseZonesByRow.get(row)![seg],sectionMasks[i],'intersection'),body=yardClip(zonesFor(path,-d/2,d/2,yardPathEnvelope(path,d))[seg],sectionMasks[i],'intersection'),drainage=yardClip(zonesFor(path,d/2,drainageEnd)[seg],sectionMasks[i],'intersection');
    for(const poly of yardSolidCells(base))add('base',poly,section.bottomIn,baseDepthIn,'#8c8a7c',true);
    baseYd3+=yardArea(base)*baseDepthIn/324;
    excavations.push({featureId:f.id,polys:base,bottom:section.bottomIn-baseDepthIn});excavations.push({featureId:f.id,polys:yardClip(excavationZones[seg],sectionMasks[i],'intersection'),bottom:section.bottomIn});
    const bodyGrades=site?site.extrema(body):{min:Math.min(...body.flat().map(v=>gradeAt(v.y,v.x))),max:Math.max(...body.flat().map(v=>gradeAt(v.y,v.x)))};minBurial=Math.min(minBurial,bodyGrades.min+(f.baseElevationIn??0)-section.bottomIn);maxBurial=Math.max(maxBurial,bodyGrades.max+(f.baseElevationIn??0)-section.bottomIn);
    const p=wallPath[seg],q=wallPath[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),start=Math.max(0,section.startIn),end=Math.min(span,section.endIn),sectionRun=Math.max(0,end-start),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,offset=d/2+drainageDepthIn/2+row*construction!.setbackPerCourseIn;
    // Horizontal toe drains follow level benches. Vertical drops are included
    // in supply only; the final junction/outlet route remains a site decision.
    const m:YardMember={id:`${f.id}-drain-pipe-${i}`,featureId:f.id,role:'drain-pipe',color:'#262e32',a:{x:p.x+ux*start-uy*offset,y:section.bottomIn+2,z:p.y+uy*start+ux*offset},b:{x:p.x+ux*end-uy*offset,y:section.bottomIn+2,z:p.y+uy*end+ux*offset},width:4,depth:4};members.push(m);model.members.push(m);drainPipeLengthIn+=sectionRun;
    if(site){const band=siteMaterialBand(site,drainage,section.bottomIn,top-cap),side=siteRetainedSideArea(site,{x:m.a.x,y:m.a.z},{x:m.b.x,y:m.b.z},section.bottomIn,top-cap);filterArea+=band.planAreaSqft+band.topAreaSqft+side.areaSqft+sectionRun*drainageDepthIn*2/144;}else filterArea+=yardArea(drainage)*2+sectionRun*(top-cap-section.bottomIn+drainageDepthIn*2)/144;
   }
   const stepChanges=sections.slice(1).reduce((n,section,i)=>n+Math.round(Math.abs(section.bottomIn-sections[i].bottomIn)/course),0);
   drainPipeLengthIn+=stepChanges*course;
   const minDrainCollectionInvertIn=Math.min(...model.members.filter(m=>m.role==='drain-pipe').flatMap(m=>[m.a.y-m.depth/2,m.b.y-m.depth/2])),outletElevation=f.wallConstruction?.drainOutletElevationIn,outletFall=f.wallConstruction?.drainOutletFallPct,checkableOutlet=construction!.drainOutletCount===1&&construction!.drainOutletLengthFt>0&&outletElevation!==undefined&&outletFall!==undefined,outletCheck:Record<string,number>=checkableOutlet?{drainOutletAvailableFallIn:minDrainCollectionInvertIn-outletElevation!,drainOutletRequiredFallIn:construction!.drainOutletLengthFt*12*outletFall!/100,drainOutletMaxElevationIn:minDrainCollectionInvertIn-construction!.drainOutletLengthFt*12*outletFall!/100}:{},drainOutletCheckPassed=checkableOutlet&&outletCheck.drainOutletAvailableFallIn!+1e-6>=outletCheck.drainOutletRequiredFallIn!;
   if(!drainOutletCheckPassed){model.quoteRequired=true;localWarnings.push(construction!.drainOutletCount!==1?'Outlet elevation check pending: multiple outlets need per-route surveyed inverts, lengths and required fall.':!checkableOutlet?'Outlet elevation check pending: enter surveyed discharge invert, required fall and positive solid route length.':'Entered outlet invert cannot provide the specified fall from the lowest modeled collection invert; revise the route or discharge elevation.');}
   else localWarnings.push(`Entered outlet drop ${outletCheck.drainOutletAvailableFallIn!.toFixed(2)} in meets the ${outletCheck.drainOutletRequiredFallIn!.toFixed(2)} in specified fall. Collection grade, fittings and discharge remain pending.`);
   const constructionQuantities={minDrainCollectionInvertIn,drainOutletElevationPending:drainOutletCheckPassed?0:1,drainOutletCheckPassed:drainOutletCheckPassed?1:0,...outletCheck,geogridLayers:actualGridLayers,geogridMaxLayersPerBench:site?Math.max(0,...sectionGridCounts):Math.max(...sectionLayers.map(layers=>layers.length)),geogridAboveGroundSqft:aboveGroundGridArea,geogridPlanningSqft:planningGridArea,geogridPlanningOrderSqft:planningGridGrossArea*1.1,geogridPlacementPending:aboveGroundGridArea>.001?1:0,geogridSqft:gridArea,geogridGrossSqft:gridGrossArea,geogridCornerOverlapSqft:Math.max(0,gridGrossArea-gridArea),geogridOrderSqft:gridGrossArea*1.1,geogridLengthIn:lengthIn,geogridCourseInterval:construction!.everyCourses,minWallBurialIn:Number.isFinite(minBurial)?Number(minBurial.toFixed(5)):construction!.minBurialIn,maxWallBurialIn:Number.isFinite(maxBurial)?Number(maxBurial.toFixed(5)):construction!.maxBurialIn,maxExposedHeightIn:construction!.maxExposedHeightIn,wallFoundationSteps:stepChanges,wallSetbackIn:construction!.maxSetbackIn,wallBatterAngleDeg:construction!.batterAngleDeg,drainOutletCount:construction!.drainOutletCount,drainOutletPipeLf:construction!.drainOutletLengthFt,wallCapBondLf:cap?run/12:0};
   model.quantities={...model.quantities,wallLengthLf:run/12,wallFaceSqft:run*h/144,wallBlocks:new Set(model.boxes.filter(b=>b.role==='wall-block').map(b=>b.unitId)).size,wallCaps:new Set(model.boxes.filter(b=>b.role==='wall-cap').map(b=>b.unitId)).size,drainPipeLf:drainPipeLengthIn/12,wallBaseYd3:baseYd3,drainageYd3,backfillYd3,wallFilterFabricSqft:filterArea,...constructionQuantities};
   if(site){const retained=site.extrema(yardPathBackStrip(wallPath,d/2,backEnd+construction!.maxSetbackIn));model.quantities.retainedGradeMinIn=retained.min;model.quantities.retainedGradeMaxIn=retained.max;if(aboveGroundGridArea>.001||retained.min<top-cap-.01||retained.max>top-cap+.01){model.quantities.wallRetainedGradePending=1;model.quoteRequired=true;localWarnings.push(`Proposed retained ground ${retained.min.toFixed(1)}–${retained.max.toFixed(1)} in versus body top ${(top-cap).toFixed(1)} in. Drainage/backfill are clipped to measured proposed ground; ${aboveGroundGridArea.toFixed(1)} sq ft of planned grid has no measured buried placement. Confirm retained grading, reinforcement cover/connections and exposed wall design.`);}}
   if(supplier){
    for(const b of model.boxes){if(b.role==='wall-block')b.stockUnitId=supplier.unit.id;else if(b.role==='wall-cap'){b.stockUnitId=supplier.cap?.stockUnitId;b.color=supplier.cap?.colorHex??f.color;if(supplier.cap?.swatchKey)b.surface={swatchKey:supplier.cap.swatchKey,cx:b.surface?.cx??b.x,cz:b.surface?.cz??b.z,angle:b.surface?.angle??a,lengthIn:capLength,widthIn:capDepth,heightIn:cap,kind:'paver',sourceUrl:supplier.cap.sourceUrl};else delete b.surface;}}
    model.stockSchedule=[supplier.unit,...(supplier.cap?[supplier.cap]:[])].map(u=>{const stock=u===supplier.cap?supplier.cap!.stockUnitId:u.id;return {unitId:stock,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces:new Set(model.boxes.filter(b=>b.stockUnitId===stock).map(b=>b.unitId)).size,...(u===supplier.cap?{productId:supplier.cap!.sourceProductId}:{})};});
    if(supplier.cap)localWarnings.push(`${supplier.cap.name}; ${supplier.cap.widthMm} × ${supplier.cap.lengthMm} × ${supplier.cap.heightMm} mm cap; ${model.quantities.wallCapBondLf.toFixed(1)} ft bond. Cuts retain thickness; verify adhesive coverage, ends/packaging. ${supplier.cap.sourceUrl}`);
   }
   model.quantities.wallCourses=count;model.sourceUrl=supplier?.product.sourceUrl;
   const assemblyPrerequisite=f.productId==='techo-sandstonethinsetveneer-wall'?'Sandstone veneer: structural backing, foundation, waterproofing/bond and grid connection pending; no assembled order.':f.productId==='techo-skyscraper-wall'?'Skyscraper: select native base/middle/top/extender, connectors/infill and compatible coping; no assembled order.':f.productId==='oaks-modeco-one'?`Modeco: native top units, adhesive every row; ${(retainedDepth*25.4).toFixed(0)} mm total versus 445 mm garden-wall limit. Tapered stock, availability and grid connection pending; no assembled order.`:'';
   if(assemblyPrerequisite){model.quoteRequired=true;model.quantities.wallAssemblyPending=1;model.quantities.wallConceptualBlocks=model.quantities.wallBlocks;model.quantities.wallConceptualCaps=model.quantities.wallCaps;model.quantities.wallBlocks=0;model.quantities.wallCaps=0;delete model.stockSchedule;localWarnings.push(assemblyPrerequisite);}
   if(f.productId==='oaks-modeco-one'){model.quantities.wallTopCourseNative=1;model.quantities.wallCourseBondLf=Math.max(0,model.boxes.filter(b=>b.role==='wall-block').reduce((n,b)=>n+yardArea([b.polygon!]),0)/(d/12)-run/12);if(retainedDepth*25.4>445+1e-5||construction!.maxExposedHeightIn-construction!.minExposedHeightIn>1e-5)localWarnings.push('Modeco garden-wall height/slope exceeded; select an approved retaining assembly. Extra grid does not extend this system limit.');}

   localWarnings.push(`${count} maximum body courses × ${course.toFixed(3)} in; ${constructionQuantities.minWallBurialIn.toFixed(1)} in minimum burial. ${construction!.foundationMode==='stepped'?`${stepChanges} full-course foundation steps`:'One deepest level foundation'}. Survey, bench bearing/run and stock joints pending.`);
   if(site||0)localWarnings.push(`Exposed height ${construction!.minExposedHeightIn.toFixed(1)}–${construction!.maxExposedHeightIn.toFixed(1)} in; stepped foundations use full courses.`);
   localWarnings.push(`Setback ${construction!.setbackPerCourseIn.toFixed(3)} in/course, ${construction!.batterAngleDeg.toFixed(1)}° batter, ${construction!.maxSetbackIn.toFixed(1)} in maximum. Stock fixed; verify connector position and corners/radius.`);
   localWarnings.push(`Grid allowance every wall: ${(planningGridGrossArea*1.1).toFixed(1)} sq ft planning order including 10% cuts; ${actualGridLayers} measured elevations/${gridArea.toFixed(1)} installed sq ft; ${lengthIn.toFixed(1)} in length, ${construction!.everyCourses} course interval. Strength/direction, buried cover, connections, gaps/turns and stability pending.`);
   localWarnings.push(`Toe pipe ${(drainPipeLengthIn/12).toFixed(1)} ft including step drops; ${construction!.drainOutletCount} outlets; ${construction!.drainOutletLengthFt?`${construction!.drainOutletLengthFt.toFixed(1)} ft solid run`:'outlet run pending'}. Confirm fall, fittings/cleanouts and discharge.`);
   if(!supplier||/tandem|u-cara|thinset/.test(f.productId))localWarnings.push('Structural assembly and grid connection pending; face/stone envelopes are conceptual.');
   if(f.baseElevationIn)localWarnings.push(`Wall front-grade shift ${f.baseElevationIn} in; fill/cut, containment and grading pending.`);
   warnings.push(...localWarnings);continue;
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
 if(!site)for(const e of excavations.sort((a,b)=>a.bottom-b.bottom)){
  let cut=e.polys;
  if(0){const z0=(e.bottom-0)/(0/100),lo=0>0?z0:-1e7,hi=0>0?1e7:z0;cut=yardClip(cut,[[{x:-1e7,y:lo},{x:1e7,y:lo},{x:1e7,y:hi},{x:-1e7,y:hi}]],'intersection');}
  else if(e.bottom>=0)cut=[];
  const unique=yardClip(cut,dug,'difference');dug=yardClip([...dug,...cut]);
  for(const p of yardSolidCells(unique)){const center=yardCentroid(p),volume=Math.abs(yardSignedArea(p))*Math.max(0,gradeAt(center.y,center.x)-e.bottom)/46656;excavationRegions.push({featureId:e.featureId,polygon:p,bottomIn:e.bottom,volumeYd3:volume});}
 }
 const siteEarthwork=site?integrateSiteExcavation(site,excavations.map(e=>({featureId:e.featureId,polygons:e.polys,bottomIn:e.bottom}))):undefined;if(siteEarthwork)excavationRegions.push(...siteEarthwork.regions);
 const sharedExcavationYd3=excavationRegions.reduce((n,e)=>n+e.volumeYd3,0);
 const active=features.filter(f=>!f.excluded),sum=(key:string)=>active.reduce((n,f)=>n+(f.quantities[key]||0),0),patioUnion=yardClip(active.filter(f=>f.config.kind==='patio').flatMap(f=>f.footprints));
 const perimeter=patioUnion.reduce((n,p)=>n+p.reduce((m,v,i)=>{const q=p[(i+1)%p.length];return m+Math.hypot(v.x-q.x,v.y-q.y);},0),0)/12;
 return {formationRegions:excavations.flatMap(e=>e.polys.map(polygon=>({featureId:e.featureId,polygon,bottomIn:e.bottom}))),sharedExcavationRegions:excavationRegions,sharedExcavationYd3,deckFoundationExcavationYd3:0,foundationExcavationPending:false,features,boxes,members,warnings,terrain,...(site?{siteSurface:siteSurfaceSnapshot(site),siteCutFill:site.cutFill,siteEarthwork:{complete:site.cutFill.complete&&!features.some(f=>f.exclusionReason==='site-coverage'),uncoveredGradingAreaSqft:site.cutFill.uncoveredAreaSqft,pendingFeatureIds:features.filter(f=>f.exclusionReason==='site-coverage').map(f=>f.config.id)}}:{}),excavationRegions,patioUnion,quoteRequired:budgetExcludedIds.length>0||features.some(f=>f.quoteRequired)||!!site&&!site.cutFill.complete,paverBudget:{limit:YARD_PAVER_BUDGET,reservedPieces:reservedPavers,remainingPieces:YARD_PAVER_BUDGET-reservedPavers,excludedFeatureIds:budgetExcludedIds},deckClearance:{clearanceIn:SUPPORT_CLEARANCE_IN,supportCutouts:yardClip(supportCutouts),minStairClearanceIn,minFramingClearanceIn,checked:!!deckModel,stairCoverageComplete,framingCoverageComplete,...(measuredDeck?{minLandingClearanceIn:measuredDeck.minLandingClearanceIn,minStringerEnvelopeClearanceIn:measuredDeck.minStringerEnvelopeClearanceIn,stringerCoverageComplete:measuredDeck.stringerCoverageComplete,stairTerminations:measuredDeck.stairTerminations}:{})},quantities:{sharedExcavationYd3,deckFoundationExcavationYd3:0,patioAreaSqft:sum('paverAreaSqft'),patioPerimeterLf:perimeter,wallFaceSqft:sum('wallFaceSqft'),wallLengthLf:sum('wallLengthLf'),paverPieces:sum('paverPieces'),wallBlocks:sum('wallBlocks'),wallCaps:sum('wallCaps'),geogridSqft:sum('geogridSqft'),geogridOrderSqft:sum('geogridOrderSqft'),geogridPlanningSqft:sum('geogridPlanningSqft'),geogridPlanningOrderSqft:sum('geogridPlanningOrderSqft'),wallFilterFabricSqft:sum('wallFilterFabricSqft'),baseYd3:sum('baseYd3'),wallBaseYd3:sum('wallBaseYd3'),raisedFillYd3:sum('raisedFillYd3'),siteEarthworkFillYd3:siteEarthwork?.fillYd3??0,beddingYd3:sum('beddingYd3'),drainageYd3:sum('drainageYd3'),backfillYd3:sum('backfillYd3'),waterVolumeGal:sum('waterVolumeGal'),linerSqft:sum('linerSqft'),excavationYd3:sharedExcavationYd3}};
}


type AdvancedYardRuntime=typeof import('./yardModelAdvancedRuntime');
export type YardModel=ReturnType<AdvancedYardRuntime['buildYardModel']>;
let advanced:AdvancedYardRuntime|undefined,loading:Promise<void>|undefined;
export function registerAdvancedYardRuntime(value:AdvancedYardRuntime){advanced=value;}
export const advancedYardRuntimeReady=()=>!!advanced;
export async function loadAdvancedYardRuntime(){if(advanced)return;loading??=import('./yardModelAdvancedRuntime').then(value=>{advanced=value;},error=>{loading=undefined;throw error;});await loading;}
/** New physical geometry is derived only after its optional runtime is ready. Seat (freestanding) walls are modelled there. */
export function needsAdvancedYard(data:Pick<DeckData,'siteModel'|'terrainConfig'|'yardFeatures'|'stairTargets'|'pools'>){return !!data.pools?.length||!!data.siteModel||!!data.stairTargets?.length||!!data.terrainConfig&&(data.terrainConfig.elevationIn!==0||data.terrainConfig.slopePct!==0)||!!data.yardFeatures?.some(f=>f.kind==='fire-feature'||f.finishedElevationIn!==undefined||f.patioSlope!==undefined||f.wallTopSteps!==undefined||!!f.wallConstruction?.freestanding);}
export function buildYardModel(data:DeckData,deckModel?:DeckTakeoff):YardModel{if(needsAdvancedYard(data)){if(!advanced)throw Error('Geometry is loading. Retry shortly.');return advanced.buildYardModel(data,deckModel);}return buildLegacyYardModel(data,deckModel) as YardModel;}
