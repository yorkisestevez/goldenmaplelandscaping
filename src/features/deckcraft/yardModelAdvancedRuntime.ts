import {patioEdgeSpans,patioGroundGaps,patioEdgeWords,insideAny,insideRings,patioRaisedEdge} from './patioGroundContact';
import {raisedPatioGuard} from './raisedPatio';
import {GUARD} from './designRules';
import {outsideFeaturePads} from './siteElevationChecks';
import {hardscapeAssemblyQuoteScopes} from './yardAssembliesRuntime';
import './physicalQuoteRuntime';
import './yardTakeoffRuntime';
import {buildStepAssemblyModel} from './stepAssemblyRegistry';
import {buildStoneStepModel} from './stoneStepModel';
import {reconcileWallPaving} from './wallPavingConnections';
import './wallFoundationStepsRuntime';
import './foundationDatumsRuntime';
import {PAVER_BRANDS} from '../../data/carrPrices';
import baseline from '../../data/engine-baseline.json';
import type {DeckData,YardFeature} from './types';
import type {Box,Member,DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {getTerrainConfig} from './yardSettings';
import {getHousePlacement} from './housePlacement';
import {hasHouseBlocks,houseOutline} from './houseFootprint';
import {yardFeatureOutline,yardWallPath,yardWallStationPath,yardPathEnvelope,yardPathBackStrip,pathRun} from './yardPathGeometry';
import {yardShapeProblem} from './yardShapeGeometry';
import {hardscapeSelection,hardscapeProblem,hardscapeSwatchKey,rectangularUnit} from './hardscapeCatalogue';
import type {HardscapeUnit} from './hardscapeCatalogue';
import {hardscapeBlanks} from './hardscapeLayout';
import {hardscapeProfile,hardscapeStockPolygons} from './hardscapeShapes';
import {yardWallCourses} from './yardElevations';
import {patioTopPlane,planeNormalScale,planeAt,belowPlane,tiltStockPoint,untiltStockPoint,abovePlane,planeVolume,subtractPlanes,reversePlane,applyPlaneFormation} from './yardElevationGeometry';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {wallConstructionProblem} from './wallConstruction';
import {wallCoursePath,wallFoundationSections,wallSectionMask,wallConstructionForPath} from './wallFoundation';
import {patioInlayPlans,patioInlayFeature} from './patioInlays';
import {createSiteSurface,designSiteModel,integrateSiteExcavation,integrateSiteFeatureFill,siteSurfaceSnapshot,siteMaterialBand,sitePolygonsBelowGround,siteRetainedSideArea,sitePlaneHeight,siteDeckClearances,siteElevationWarnings} from './siteSurface';
import type {SitePlane,SiteSurface} from './siteSurface';
import {foundationSolids} from './foundationSolids';
import {getPoolModels,reconcilePoolMaterials} from './poolModel';
import {fireFeatureModels,stairFootprints} from './fireFeatureModel';

import {registerAdvancedYardRuntime,yardSignedArea,yardArea,yardClip,yardSolidCells,projectedYardPavers,YARD_PAVER_BUDGET,yardRectangle as rectangle,yardCentroid as centroid,yardPaverProfiles as profiles,yardStockFaceSqft as stockFaceSqft} from './yardModel';
import type {YardBox,YardRole,YardFeatureModel,YardMember,YardExcavationRegion} from './yardModel';
const SUPPORT_CLEARANCE_IN=1;
const circle=(x:number,z:number,r:number):PlanPoint[]=>Array.from({length:32},(_,i)=>({x:x+Math.cos(i*Math.PI/16)*r,y:z+Math.sin(i*Math.PI/16)*r}));
/** Cross-sections match the current footing/post model. The one-inch separation
 * is a planning clearance, not a geotechnical excavation setback. */
function supportSections(data:DeckData,deck:DeckTakeoff|undefined,low:number,high:number,bottomPlane?:SitePlane,topPlane?:SitePlane):PlanPoint[][]{
 if(!deck)return [];
 const out:PlanPoint[][]=[],depth=data.foundationDepthIn??48,overlaps=(a:number,b:number)=>low<=b&&high>=a;
 if(data.siteModel||data.terrainConfig){const local=(p:PlanPoint[],lo:number,hi:number)=>{let cut=p;if(topPlane)cut=abovePlane(cut,{...topPlane,constant:topPlane.constant-lo});if(bottomPlane)cut=abovePlane(cut,{x:-bottomPlane.x,z:-bottomPlane.z,constant:hi-bottomPlane.constant});if(cut.length)out.push(cut);};for(const datum of deck.foundationSupports){const solids=foundationSolids(datum);for(const b of solids.boxes)if(overlaps(b.y-b.h/2,b.y+b.h/2))local(rectangle(b.x,b.z,b.w+2*SUPPORT_CLEARANCE_IN,b.d+2*SUPPORT_CLEARANCE_IN),b.y-b.h/2,b.y+b.h/2);for(const cylinder of solids.cylinders)if(overlaps(cylinder.bottom,cylinder.top))local(circle(cylinder.x,cylinder.z,cylinder.radius+SUPPORT_CLEARANCE_IN),cylinder.bottom,cylinder.top);}return yardClip(out);}
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
declare module './yardModel' {
 interface YardFeatureModel {
  /** Set only on a patio at a fixed level that needs a guard (OBC 9.8.8.1, raisedPatioGuard): its length (ft), the open
   * edges it runs along as seen from the house, the most the paving stands over the lowest ground within 1.2 m (in),
   * whether that ground falls away steeper than 1 in 2, and the guard height asked for (in). */
  guard?:{lf:number;edges:string[];dropIn:number;steep:boolean;heightIn:number};
 }
}
/** The patio a seat wall stands on: one whose outline holds the wall's whole base course (its full course width, not
 * only its centreline), else one whose edge the course straddles, which leaves the wall on the ground. Stair flights are
 * never a seat wall's patio. */
function seatWallPatio(f:YardFeature,outlines:Map<YardFeature,PlanPoint[][]>):{on?:YardFeature;straddles?:YardFeature}|undefined{
 const course=yardPathEnvelope(yardWallPath(f),f.depthFt*12);if(!course.length)return undefined;
 let straddles:YardFeature|undefined;
 for(const [g,o] of outlines){if(g.stoneSteps||g.stepAssembly)continue;
  if(yardArea(yardClip(course,o,'difference'))<1e-3)return {on:g};
  if(!straddles&&yardArea(yardClip(course,o,'intersection'))>1e-3)straddles=g;}
 return straddles&&{straddles};
}
/** Structures a guard reading stops at (raisedPatioGuard's `open`), with their plan bounds for a quick reject. */
type GuardBlock={rings:PlanPoint[][];minX:number;maxX:number;minZ:number;maxZ:number};
const guardBlock=(rings:PlanPoint[][]):GuardBlock=>{const p=rings.flat(),xs=p.map(v=>v.x),zs=p.map(v=>v.y);return {rings,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};};
/** The side of the yard an outward normal faces, as seen from the house (at the back, -z). */
const guardSide=(out:PlanPoint)=>Math.abs(out.y)>=Math.abs(out.x)?(out.y>0?'front':'back'):(out.x>0?'right':'left');
/**
 * Where a patio at a fixed level needs a guard (designRules GUARD, OBC 9.8.8.1): raisedPatioGuard over each ring of its
 * outline against the proposed ground, a reading stopping at `blocks` (the house, the deck, its stairs, other paving,
 * pools and ponds), so edges against those need none. A sloped patio is read against its own plane: each reading is
 * taken from the paving level at the point of the edge nearest it (where the reading leaves the edge). Undefined where
 * no guard is required. The drop is rounded up to 0.1 in, so a required guard never reads as 23.6 in or less.
 */
function patioGuard(rings:PlanPoint[][],plane:SitePlane,surface:SiteSurface,blocks:GuardBlock[]){
 const open=(x:number,z:number)=>!blocks.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&insideRings(b.rings,x,z));
 const runs=rings.flatMap(ring=>{
  if(!plane.x&&!plane.z)return raisedPatioGuard(ring,plane.constant,surface,open).runs;
  const level=(x:number,z:number)=>{let best=Infinity,at=ring[0];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.y-a.y,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/l)):0,px=a.x+t*dx,pz=a.y+t*dz,d=(x-px)**2+(z-pz)**2;if(d<best){best=d;at={x:px,y:pz};}}return planeAt(plane,at.x,at.y);};
  return raisedPatioGuard(ring,0,{sample:(x,z,kind)=>{const g=surface.sample(x,z,kind);return g===undefined?undefined:g-level(x,z);}},open).runs;
 });
 if(!runs.length)return undefined;
 const order=['front','right','left','back'],bySide=new Map<string,number>();for(const r of runs)bySide.set(guardSide(r.out),(bySide.get(guardSide(r.out))??0)+r.lengthIn);
 const sides=order.filter(s=>bySide.has(s)).map(side=>({side,lf:Math.round(bySide.get(side)!/1.2)/10})).sort((a,b)=>b.lf-a.lf||order.indexOf(a.side)-order.indexOf(b.side));
 const lf=Math.round(runs.reduce((n,r)=>n+r.lengthIn,0)/1.2)/10,dropIn=Math.ceil(Math.max(...runs.map(r=>r.dropIn))*10-1e-6)/10,steep=runs.some(r=>r.steep),heightIn=dropIn>71?GUARD.heightAbove71InIn:GUARD.heightIn;
 const along=sides.length>1?sides.map(s=>`${s.side} edge (${s.lf.toFixed(1)} ft)`).join(', ').replace(/, ([^,]*)$/,' and $1'):`${sides[0].side} edge`;
 return {guard:{lf,edges:sides.map(s=>s.side),dropIn,steep,heightIn},warning:(name:string)=>`${name}: a guard is required along ${lf.toFixed(1)} ft of its ${along}: it stands up to ${dropIn.toFixed(1)} in above the lowest ground within 1.2 m (${GUARD.adjacentWithinIn} in) of it${steep?', or that ground falls away steeper than 1 in 2':''}, past the 600 mm (${GUARD.requiredAboveIn} in) of OBC 9.8.8.1. A ${heightIn} in guard there is not priced: builder quote.`};
}
/** Build order: walls and water, then seat walls (one on a patio checks only what stands on the paving), then patios. */
const rank=(f:YardFeature)=>f.kind==='patio'?2:+!!f.wallConstruction?.freestanding;
function buildUncachedYardModel(data:DeckData,deckModel?:DeckTakeoff){
 const terrain=getTerrainConfig(data),site=data.siteModel?createSiteSurface(designSiteModel(data),terrain):undefined,gradeAt=(z:number,x=0)=>site?site.sample(x,z)??NaN:terrain.elevationIn+z*terrain.slopePct/100,siteAll=site,gradeAll=gradeAt;
 const warnings:string[]=[],features:YardFeatureModel[]=[],boxes:YardBox[]=[],members:YardMember[]=[],excavations:{featureId:string;polys:PlanPoint[][];bottom:number;formationPlane?:SitePlane}[]=[];
 // The house with its bump-outs, wings and garage: attached blocks are unioned with the main block.
 const house=getHousePlacement(data),houseFootprint=data.houseVisible===false?[]:hasHouseBlocks(data)?houseOutline(data):[rectangle((house.x0+house.x1)/2,-house.depthIn/2,house.widthIn,house.depthIn)];
 const pools=getPoolModels(data,deckModel),poolExclusions=yardClip(pools.flatMap(p=>p.permanentExclusionFootprints));
 warnings.push(...pools.flatMap(p=>p.warnings.map(w=>`${p.config.name}: ${w}`)));
 for(const pool of pools)for(const formation of pool.formationRegions)excavations.push({featureId:formation.featureId,polys:[formation.polygon],bottom:formation.bottomIn,formationPlane:formation.formationPlane});
 let occupied:PlanPoint[][]=[...houseFootprint],pavingOccupied:PlanPoint[][]=[...houseFootprint];
 // Fire features are modelled after everything else (fireFeatureModel.ts): they stand on a patio or their own pad.
 const enabled=(data.yardFeatures||[]).filter(f=>f.enabled&&f.kind!=='fire-feature').sort((a,b)=>rank(a)-rank(b));
 const ids=new Set<string>(),supportCutouts:PlanPoint[][]=[],budgetExcludedIds:string[]=[];let reservedPavers=0,guardStructures:GuardBlock[]|undefined;
 // Every patio's outline, so one patio's edge never reads the ground under another's paving as the lawn beside it.
 const patioOutlines=new Map<YardFeature,PlanPoint[][]>();for(const g of enabled)if(g.kind==='patio')try{patioOutlines.set(g,yardFeatureOutline(g));}catch{/* an unreadable shape is excluded below */}
 const measuredDeck=site&&deckModel?siteDeckClearances(site,deckModel,data):undefined,stairCoverageComplete=measuredDeck?.stairCoverageComplete??true,framingCoverageComplete=measuredDeck?.framingCoverageComplete??true;
 const treadClearances=(deckModel?.treads||[]).map(t=>t.y+t.h/2-Math.max(...treadFootprint(t).map(p=>gradeAt(p.y,p.x))));
 const framingClearances=(deckModel?.levels||[]).flatMap(l=>[...l.joists,...l.beams,...(l.rim||[])]).flatMap(m=>[m.a.y-m.depth/2-gradeAt(m.a.z,m.a.x),m.b.y-m.depth/2-gradeAt(m.b.z,m.b.x)]);
 const minStairClearanceIn=measuredDeck?measuredDeck.minStairClearanceIn:treadClearances.length?Math.min(...treadClearances):null,minFramingClearanceIn=measuredDeck?measuredDeck.minFramingClearanceIn:framingClearances.length?Math.min(...framingClearances):null;
 if(measuredDeck)warnings.push(...measuredDeck.warnings);
 // A ground-fit bank that is not complete says so itself; the generic coverage line stays for grading and transitions.
 const padWarnings=(site?.featurePadModels??[]).filter(m=>m.status!=='ready').flatMap(m=>m.warnings),padsOnly=!!padWarnings.length&&(site?.transitionModels??[]).every(m=>m.status==='ready')&&(site?.cutFill.uncoveredAreaSqft??0)<.05;
 if(site&&!site.cutFill.complete&&!padsOnly)warnings.push(`Grading extends beyond survey coverage by ${site.cutFill.uncoveredAreaSqft.toFixed(1)} sq ft; cut/fill quantities cover only measured terrain and remain incomplete.`);
 for(const w of padWarnings)if(!warnings.includes(w))warnings.push(w);
 if(deckModel&&(site||terrain.elevationIn!==0||terrain.slopePct!==0)){
  warnings.push(`Deck elevations remain on their original zero datum. Selected terrain gives ${minStairClearanceIn===null?'no stair surface':`${minStairClearanceIn.toFixed(1)} in minimum stair walking-surface clearance`} and ${minFramingClearanceIn===null?'no framing measurement':`${minFramingClearanceIn.toFixed(1)} in minimum framing clearance`}; review foundation exposure, access and grading together.`);
  if(!site&&minStairClearanceIn!==null&&minStairClearanceIn<=0)warnings.push('Selected terrain intersects or covers a deck stair walking surface; revise grading or the stair design before construction.');
  if(!site&&minFramingClearanceIn!==null&&minFramingClearanceIn<=0)warnings.push('Selected terrain intersects deck framing; revise grading or deck elevations before construction.');
 }
 for(const f of enabled){
  if(ids.has(f.id)){warnings.push(`Duplicate yard feature id ${f.id} excluded.`);continue;}ids.add(f.id);
  if(![f.xFt,f.zFt,f.widthFt,f.depthFt,f.heightIn,f.rotationDeg,f.baseElevationIn??0].every(Number.isFinite)||f.widthFt<=0||f.depthFt<=0||f.baseElevationIn!==undefined&&(f.kind!=='retaining-wall'||Math.abs(f.baseElevationIn)>120)){warnings.push(`${f.name}: invalid dimensions excluded.`);continue;}
  let finishedProblem='';try{validateYardFinishedSettings(f);}catch(error){finishedProblem=error instanceof Error?error.message:'Invalid finished levels.';}
  const supplierProblem=finishedProblem||hardscapeProblem(f)||wallConstructionProblem(f);if(supplierProblem){warnings.push(`${f.name}: ${supplierProblem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[supplierProblem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}
  if(f.outline||f.wallPath){const problem=f.kind==='patio'&&f.wallPath||f.kind==='retaining-wall'&&f.outline||f.kind==='water-feature'?'The shape does not match this feature.':yardShapeProblem(f.kind as 'patio'|'retaining-wall',f.outline??f.wallPath);if(problem){warnings.push(`${f.name}: ${problem} Excluded until revised.`);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[problem],quantities:{areaSqft:0},excluded:true,quoteRequired:true});continue;}}
  const paverThickness=(hardscapeSelection(f)?.unit.heightMm??PAVER_BRANDS.find(p=>p.id===f.productId)?.thicknessMm??60)/25.4;
  const supplier=hardscapeSelection(f),capDepth=supplier?.cap?supplier.cap.lengthMm/25.4:f.depthFt*12+2;
  // A seat wall stands on a patio's paving only when its whole base course lies on that patio (seatWallPatio): the
  // patio's top is then its ground (no survey, no dig), and it builds to its own seat height over the paving whatever
  // finished level the ground gave it (wf). One straddling a patio's edge is built on the ground: a base, burial, a note.
  const seat=f.wallConstruction?.freestanding&&!f.wallTopSteps?.length?seatWallPatio(f,patioOutlines):undefined,pad=seat?.on,padPlane=pad&&patioTopPlane(pad,gradeAll(pad.zFt*12,pad.xFt*12)),site=padPlane?undefined:siteAll,gradeAt=padPlane?(z:number,x=0)=>planeAt(padPlane,x,z):gradeAll;
  const wf:YardFeature=padPlane&&f.finishedElevationIn!==undefined?(({finishedElevationIn:_ground,...paved})=>paved)(f):f;
  const w=f.widthFt*12,d=f.depthFt*12,x=f.xFt*12,z=f.zFt*12,a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),grade=gradeAt(z,x);
  if(site&&!Number.isFinite(grade)){const message=`${f.name}: its elevation datum is outside measured survey coverage. Geometry and construction quantities are pending; extend the survey or reposition the feature.`;warnings.push(message);features.push({config:f,footprints:[],topIn:0,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,siteCoveragePending:1},excluded:true,quoteRequired:true,exclusionReason:'site-coverage'});continue;}
  const patioPlane=patioTopPlane(f,grade),slopeScale=planeNormalScale(patioPlane),sloped=f.kind==='patio'&&slopeScale>1+1e-12,stockOrigin={x,y:z},tilt=(p:PlanPoint)=>sloped?tiltStockPoint(p,patioPlane,stockOrigin):p;
  const projectedPavers=Math.ceil(projectedYardPavers(f)*slopeScale*slopeScale);
  if(projectedPavers>YARD_PAVER_BUDGET-reservedPavers||!Number.isFinite(projectedPavers)){
   const message=`${f.name}: the raw layout needs ${Number.isFinite(projectedPavers)?projectedPavers.toLocaleString('en-CA'):'more than 20,000'} pavers and exceeds the remaining ${(YARD_PAVER_BUDGET-reservedPavers).toLocaleString('en-CA')} of the shared 20,000-paver model budget. The whole patio is excluded from geometry and installed quantities; quote required. Reduce its size or use larger pavers. This preflight conservatively counts the full rectangle before cut-outs.`;
   budgetExcludedIds.push(f.id);warnings.push(message);features.push({config:f,footprints:[],topIn:grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,paverAreaSqft:0,paverPieces:0},excluded:true,quoteRequired:true,exclusionReason:'paver-budget'});continue;
  }
  const wallPath=f.kind==='retaining-wall'?yardWallPath(f):[],construction=f.kind==='retaining-wall'?wallConstructionForPath(wf,grade,wallPath,gradeAt,site,!!padPlane):undefined;
  const wallRawStock=construction?construction.count*(Math.ceil(pathRun(wallPath)/(supplier?supplier.unit.widthMm/25.4:f.productId==='armour-stone'?36:18))+(f.wallPath?.length??2)*2):0;
  if(construction&&(construction.count>256||wallRawStock>20000)){const message=`${f.name}: finished/ground elevation difference exceeds the wall geometry budget (256 courses or 20,000 raw stock pieces). Confirm the project datum and wall levels; construction quantities remain pending.`;warnings.push(message);features.push({config:f,footprints:[],topIn:construction.top,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,wallGeometryPending:1},excluded:true,quoteRequired:true,exclusionReason:'wall-budget'});continue;}
  const coursePaths=construction?Array.from({length:construction.count},(_,row)=>wallCoursePath(wallPath,row*construction.setbackPerCourseIn)):[],original=construction?yardClip(coursePaths.flatMap(path=>yardPathEnvelope(path,d))):yardFeatureOutline(f),reinforcedEnvelope=construction?yardClip([...yardPathEnvelope(wallPath,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathEnvelope(coursePaths.at(-1)!,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathBackStrip(wallPath,d/2,Math.max(d/2+construction.drainageDepthIn+12,-d/2+construction.lengthIn)+construction.maxSetbackIn)]):[],envelope=construction?reinforcedEnvelope:f.kind==='retaining-wall'&&f.wallPath?yardClip([...yardPathEnvelope(wallPath,Math.max(d,supplier?.cap?capDepth:d)+12),...yardPathBackStrip(wallPath,d/2,d/2+24)]):f.kind==='retaining-wall'?[rectangle(x-s*9,z+c*9,w+12,Math.max(d,supplier?.cap?capDepth:d)+30,a)]:f.kind==='water-feature'?[rectangle(x,z,w+12,d+12,a)]:sloped?yardClip([...original,...original.map(p=>p.map(v=>({x:v.x+patioPlane.x*(paverThickness+1+baseline.facts.baseDepthIn)/slopeScale,y:v.y+patioPlane.z*(paverThickness+1+baseline.facts.baseDepthIn)/slopeScale}))) ]):original,overlap=yardClip(padPlane?original:envelope,f.kind==='patio'||padPlane?pavingOccupied:occupied,'intersection'),localWarnings:string[]=[];
  const pendingFoundationHit=!!deckModel&&(data.siteModel||data.terrainConfig)&&yardArea(yardClip(envelope,deckModel.foundationSupports.filter(p=>p.status==='coverage-pending').map(p=>rectangle(p.x,p.z,12+2*SUPPORT_CLEARANCE_IN,12+2*SUPPORT_CLEARANCE_IN)),'intersection'))>.001;
  if(pendingFoundationHit){const message=`${f.name}: overlaps a deck foundation with incomplete survey coverage. Foundation clearance and construction quantities remain pending.`;warnings.push(message);features.push({config:f,footprints:[],topIn:wf.finishedElevationIn??grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,siteCoveragePending:1},excluded:true,quoteRequired:true,exclusionReason:'site-coverage'});continue;}
  if(site&&!site.extrema(envelope,'existing').complete){const message=`${f.name}: its full construction envelope is outside measured survey coverage. Geometry and installed/excavation quantities are pending; include the foundation, drainage and reinforcement envelope in the survey.`;warnings.push(message);features.push({config:f,footprints:[],topIn:grade+f.heightIn,boxes:[],members:[],warnings:[message],quantities:{areaSqft:0,siteCoveragePending:1},excluded:true,quoteRequired:true,exclusionReason:'site-coverage'});continue;}
  if(yardArea(yardClip(envelope,houseFootprint,'intersection'))>.001)localWarnings.push(`${f.name}: construction overlaps the house footprint; patio area is clipped and conflicting wall/water features are excluded.`);
  if(envelope.flat().some(p=>Math.abs(p.x-data.width*6)>terrain.widthFt*6||Math.abs(p.y-data.length*6)>terrain.depthFt*6))localWarnings.push(`${f.name}: the construction envelope extends outside the selected terrain dimensions.`);
  const patioTops=original.flat().map(p=>planeAt(patioPlane,p.x,p.y));
  const assemblyModel=f.stepAssembly?buildStepAssemblyModel(f,site,{x:0,z:terrain.slopePct/100,constant:terrain.elevationIn}):undefined;
  const step=f.stoneSteps,stepSupport=step?.support,stepSupportThickness=stepSupport?.kind==='filler'?stepSupport.stockThicknessIn:step?.stockThicknessIn;
  const low=assemblyModel?Math.min(...assemblyModel.formations.map(e=>e.bottom)):step?Math.min(...Array.from({length:step.riserCount},(_,row)=>step.lowerElevationIn+(row+1)*(f.finishedElevationIn!-step.lowerElevationIn)/step.riserCount-step.stockThicknessIn-(stepSupport?.courses[row]??0)*stepSupportThickness!-step.settingBedIn-step.baseDepthIn)):f.kind==='patio'?Math.min(...patioTops)-(paverThickness+1+baseline.facts.baseDepthIn)*slopeScale:f.kind==='retaining-wall'?construction!.bottom-construction!.baseDepthIn:grade-(f.productId==='fountain'?24:Math.max(12,f.heightIn));
  const high=f.kind==='patio'?Math.max(...patioTops):f.kind==='retaining-wall'?construction!.top:grade+(f.productId==='fountain'?Math.max(1,f.heightIn):f.productId==='pondless-waterfall'?18:4);
  const supports=supportSections(data,deckModel,low,high,...(sloped?[belowPlane(patioPlane,paverThickness+1+baseline.facts.baseDepthIn),patioPlane] as const:[])),supportHit=yardArea(yardClip(envelope,supports,'intersection'))>.001;
  const stairs=(deckModel?.treads||[]).filter(t=>low<=t.y+t.h/2&&high>=t.y-t.h/2).map(treadFootprint),stairHit=f.kind!=='patio'&&yardArea(yardClip(envelope,stairs,'intersection'))>.001;
  let footprints=yardClip(original,[...(f.kind==='patio'||padPlane?pavingOccupied:occupied),...(f.kind==='patio'?poolExclusions:[])],'difference'),excluded=false;
  if(f.kind==='patio'&&yardArea(yardClip(original,poolExclusions,'intersection'))>.001)localWarnings.push('Pool structure, coping and the specified transition joint remove paving and construction layers; excavation working clearance does not enlarge the permanent paving deduction.');
  if(supportHit){
   if(f.kind==='patio'){const cut=yardClip(footprints,supports,'intersection');supportCutouts.push(...cut);footprints=yardClip(footprints,supports,'difference');localWarnings.push(`${f.name}: paving and base are cut around the deck support cross-sections with a ${SUPPORT_CLEARANCE_IN}-inch planning clearance. Coordinate excavation near foundations; this clearance is not an excavation setback.`);}
   else{footprints=[];excluded=true;localWarnings.push(`${f.name}: construction intersects a deck footing or support post and is excluded; reposition the feature.`);}
  }
  if(stairHit){footprints=[];excluded=true;localWarnings.push(`${f.name}: construction intersects a deck stair tread and is excluded; reposition the feature.`);}
  if(yardArea(overlap)>.001){localWarnings.push(`${f.name}: overlap resolved; earlier walls/water features and earlier patios take priority.`);if(f.kind!=='patio'){footprints=[];excluded=true;localWarnings.push('The conflicting wall/water feature is excluded until repositioned.');}}
  if((f.stoneSteps||f.stepAssembly)&&yardArea(footprints)<yardArea(original)-.000001){excluded=true;footprints=[];localWarnings.push('The stone-stair flight intersects another structure. Revise its complete footprint; partial treads are not generated.');}
  if(!footprints.length)excluded=true;
  const model:YardFeatureModel={config:f,footprints,topIn:f.kind==='patio'?planeAt(patioPlane,x,z):grade,...(sloped?{topPlane:patioPlane}:{}),boxes:[],members:[],warnings:localWarnings,quantities:{areaSqft:yardArea(footprints)},excluded,supportClearances:supports};features.push(model);
  if(excluded){warnings.push(...localWarnings);continue;}
  reservedPavers+=projectedPavers;
  occupied=yardClip([...occupied,...(f.kind==='patio'?footprints:envelope)]);
  const finishEnvelope=padPlane?[]:f.pavingInterface&&construction?yardClip([...coursePaths.flatMap(path=>yardPathEnvelope(path,d+2*f.pavingInterface!.jointIn)),...yardPathEnvelope(coursePaths.at(-1)!,Math.max(d,capDepth)+2*f.pavingInterface.jointIn)]):envelope;
  pavingOccupied=yardClip([...pavingOccupied,...(f.kind==='patio'?footprints:finishEnvelope)]);
  const add=(role:YardRole,p:PlanPoint[],top:number,h:number,color=f.color,illustrative=false)=>{if(h<=0)return;if(sloped&&['base','bedding'].includes(role)){const shift=(model.topIn-top)/slopeScale;p=p.map(v=>({x:v.x+patioPlane.x*shift,y:v.y+patioPlane.z*shift}));}const xs=p.map(v=>v.x),zs=p.map(v=>v.y);const b:YardBox={id:`${f.id}-${role}-${model.boxes.length}`,featureId:f.id,role,color,x:(Math.min(...xs)+Math.max(...xs))/2,y:top-h/2,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),h,d:Math.max(...zs)-Math.min(...zs),polygon:p,illustrative};if(sloped&&['paver','base','bedding'].includes(role)){const normalOffset=(model.topIn-top),plane=belowPlane(patioPlane,normalOffset);b.topPlane=plane;b.normalThicknessIn=h;b.y=planeAt(plane,b.x,b.z)-h/(2*slopeScale);}
   model.boxes.push(b);boxes.push(b);};
  const localRect=(u:number,v:number,l:number,t:number)=>rectangle(x+c*u-s*v,z+s*u+c*v,l,t,a);
  const pipe=(role:YardRole,u0:number,v0:number,u1:number,v1:number,y:number,diameter:number)=>{const m:YardMember={id:`${f.id}-${role}-${members.length}`,featureId:f.id,role,color:'#262e32',a:{x:x+c*u0-s*v0,y,z:z+s*u0+c*v0},b:{x:x+c*u1-s*v1,y,z:z+s*u1+c*v1},width:diameter,depth:diameter};members.push(m);model.members.push(m);};
  if((site||terrain.slopePct)&&f.finishedElevationIn===undefined)localWarnings.push(`${f.name}: level feature placed at centre grade; earthwork follows ${site?'measured terrain and explicit grading':'the sloped terrain plane'}. Drainage and retaining transitions require site review.`);
  if(assemblyModel){
   model.boxes.push(...assemblyModel.boxes);boxes.push(...assemblyModel.boxes);excavations.push(...assemblyModel.formations);model.quantities={...model.quantities,...assemblyModel.quantities};model.stockSchedule=assemblyModel.stockSchedule;model.quoteRequired=true;localWarnings.push(...assemblyModel.warnings);
   if(assemblyModel.quantities.buriedTreadAreaSqft>.001)localWarnings.push('Advanced stair treads intersect proposed ground. Adjust grading explicitly; finished levels remain fixed.');
  }else if(f.stoneSteps){
   const stairs=buildStoneStepModel(f,site,{x:0,z:terrain.slopePct/100,constant:terrain.elevationIn});model.boxes.push(...stairs.boxes);boxes.push(...stairs.boxes);excavations.push(...stairs.formations);model.quantities={...model.quantities,...stairs.quantities};model.quoteRequired=true;
   if(stairs.quantities.buriedTreadAreaSqft>.001)localWarnings.push(`${stairs.quantities.buriedTreadAreaSqft.toFixed(2)} sq ft of exposed stone treads intersect proposed ground. Enter a grading or landing adjustment; fixed stair levels have not moved.`);
   localWarnings.push(...stairs.warnings);
   const stock=f.stoneSteps;
   model.stockSchedule=[{unitId:stock.productName,widthMm:stock.stockWidthIn*25.4,lengthMm:stock.stockDepthIn*25.4,heightMm:stock.stockThicknessIn*25.4,pieces:stairs.quantities.stoneStepPieces,cuts:stairs.quantities.stoneStepCuts,assemblyPart:'tread'}];
   if(stairs.quantities.stoneSupportStepPieces)model.stockSchedule.push({unitId:stock.productName,widthMm:stock.stockWidthIn*25.4,lengthMm:stock.stockDepthIn*25.4,heightMm:stock.stockThicknessIn*25.4,pieces:stairs.quantities.stoneSupportStepPieces,cuts:stairs.quantities.stoneSupportStepCuts,assemblyPart:'support-step'});
   if(stock.support?.kind==='filler'&&stairs.quantities.stoneFillerPieces){const filler=stock.support;model.stockSchedule.push({unitId:filler.productName,widthMm:filler.stockWidthIn*25.4,lengthMm:filler.stockDepthIn*25.4,heightMm:filler.stockThicknessIn*25.4,pieces:stairs.quantities.stoneFillerPieces,cuts:stairs.quantities.stoneFillerCuts,assemblyPart:'filler'});}
   localWarnings.push(`${f.stoneSteps.productName}: ${stairs.quantities.stoneStepRisers} equal risers at ${stairs.quantities.stoneStepRiseIn.toFixed(3)} in; ${stairs.quantities.stoneStepPieces} solid units, ${stairs.quantities.stoneStepCuts} cut units. Full bearing, frost/soil support, drainage, landing transitions, tolerances, lifting and local stair requirements remain pending${f.stoneSteps.supportNote?`: ${f.stoneSteps.supportNote}`:'. Record a support specification.'}`);
  }else if(f.kind==='patio'){
   const product=PAVER_BRANDS.find(p=>p.id===f.productId),spec=profiles[f.productId as keyof typeof profiles];
   const thick=paverThickness,base=baseline.facts.baseDepthIn,top=model.topIn,planArea=model.quantities.areaSqft,area=planArea*slopeScale;
   if(!product)localWarnings.push(`${supplier?`${supplier.product.brand} ${supplier.product.name}`:'Unknown paver selection'}: supply and installation need a product-specific quote.`);
   model.sourceUrl=supplier?.product.sourceUrl??spec?.sourceUrl;
   localWarnings.push('Paver module dimensions follow the referenced family. Confirm the exact SKU, colour, laying-pattern mix, joints and supplier pack quantities before ordering.');
   if(spec?.illustrative)localWarnings.push('Rosebel has irregular interlocking edges: the rectangular module envelopes are illustrative, not production cut templates.');
   for(const p of yardSolidCells(footprints)){add('base',p,top-thick-1,base,'#8c8a7c');add('bedding',p,top-thick,1,'#c5bda4');}
   const inlayValidationFootprints=pools.length?yardClip([...footprints,...yardClip(original,poolExclusions,'intersection')]):footprints;
   const plans=patioInlayPlans(f,inlayValidationFootprints),valid=plans.filter(p=>p.status==='ok'),field=yardClip(footprints,valid.map(p=>p.outline),'difference');
   for(const p of plans.filter(p=>p.status!=='ok'))localWarnings.push(`${p.inlay.name}: ${p.message}`);
   const laySupplier=(zone:YardFeature,mask:PlanPoint[][],inlayId?:string)=>{const sel=hardscapeSelection(zone)!;const za=zone.rotationDeg*Math.PI/180,zc=Math.cos(za),zs=Math.sin(za),before=model.boxes.length;
    const patternZone=sloped?{...zone,outline:mask.flat().map(p=>{const q=untiltStockPoint(p,patioPlane,stockOrigin),dx=q.x-zone.xFt*12,dz=q.y-zone.zFt*12;return {x:zc*dx+zs*dz,y:-zs*dx+zc*dz};})}:zone;
    for(const blank of hardscapeBlanks(patternZone)){const centre={x:zone.xFt*12+zc*blank.cx-zs*blank.cy,y:zone.zFt*12+zs*blank.cx+zc*blank.cy},angle=za+blank.angle,stock=sel.finish.units.find(u=>u.id===blank.unitId)??sel.unit;
     const contours=yardClip(hardscapeStockPolygons(sel.product.id,stock,centre.x,centre.y,angle).map(p=>p.map(tilt)),mask,'intersection'),profile=hardscapeProfile(sel.product.id,stock);
     // a stone split into several solid cells (any off-axis angle) is drawn once from its whole cut contour, never as seamed pieces
     const cells=yardSolidCells(contours),whole=!!profile||valid.length>0||cells.length>1;let fragment=0;for(const p of cells){add('paver',p,top,stock.heightMm/25.4,zone.color,!rectangularUnit(stock)&&!profile);const b=model.boxes.at(-1)!;b.unitId=`${zone.id}-paver-${blank.id}`;b.stockAreaSqft=stockFaceSqft(sel.product.id,stock,blank.length,blank.width);b.stockUnitId=stock.id;if(whole){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}if(sel.color.swatch)b.surface={swatchKey:hardscapeSwatchKey(sel.product.id,sel.finish.id,sel.color.id),cx:tilt(centre).x,cz:tilt(centre).y,angle,lengthIn:blank.length,widthIn:blank.width,heightIn:stock.heightMm/25.4,kind:'paver',sourceUrl:sel.product.sourceUrl};}
    }
    const recipe=sel.finish.patterns.find(p=>p.id===zone.hardscape!.patternId);if(inlayId&&recipe?.layout.installationJointMm!==undefined)localWarnings.push(`${zone.name}: supplier installation joint ${recipe.layout.installationJointMm} mm differs from nominal pattern modules; confirm installed spacing before ordering.`);
    const stock=[...new Map(model.boxes.slice(before).map(b=>[b.unitId,b])).values()],stockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);model.pavingZones??=[];model.pavingZones.push({feature:zone,areaSqft:yardArea(mask)*slopeScale,stockAreaSqft,...(inlayId?{inlayId}:{})});
    model.stockSchedule??=[];model.stockSchedule.push(...sel.finish.units.flatMap(u=>{const pieces=stock.filter(b=>b.stockUnitId===u.id).length;return pieces?[{unitId:u.id,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces,...(inlayId?{productId:zone.productId,inlayId}:{})}]:[];}));
   };
   if(supplier){
    laySupplier(f,field);
    const recipe=supplier.finish.patterns.find(p=>p.id===f.hardscape!.patternId);if(recipe?.layout.installationJointMm!==undefined)localWarnings.push(`Manufacturer diagram uses nominal stock modules; the supplier specifies ${recipe.layout.installationJointMm} mm installation joints. Installed module spacing and pack quantities need confirmation; this diagram is not an installation joint schedule.`);localWarnings.push(recipe?`Manufacturer recipe ${recipe.name}: documented units and repeat coordinates retained. Nominal module pitch follows ${recipe.sourceUrl}; confirm actual supplied dimensions and joint tolerances before ordering.`:`Selected stock ${supplier.unit.widthMm} Ã— ${supplier.unit.lengthMm} Ã— ${supplier.unit.heightMm} mm; ${f.hardscape!.jointMm} mm joints are added to the module. The contractor pattern uses this single stock size; supplier multi-size recipes remain in the pattern library.`);
    if(!rectangularUnit(supplier.unit)&&['herringbone','basket-weave'].includes(f.hardscape!.patternId))localWarnings.push('Legacy rectangular envelope layout retained from the saved design; choose a compatible shaped bond or verified supplier recipe.');
    if(!rectangularUnit(supplier.unit))localWarnings.push(hardscapeProfile(supplier.product.id,supplier.unit)?'Stock outlines follow the manufacturer plan drawing at nominal dimensions; confirm joints and fabrication against the supplier technical guide.':'The supplier lists a shaped unit. Rectangular stock envelopes are illustrative; its exact mould profile has not been digitized.');
   }else{
   const rows=spec?.rows||[{depth:12,lengths:[24]}],gap=.125;let row=0;const rw=w*slopeScale,rd=d*slopeScale;
   for(let v=-rd/2;v<rd/2-.001;){const r=rows[row%rows.length],depth=r.depth;let col=0;
    for(let u=-rw/2-(row%2?(r.lengths[0]+gap)/2:0);u<rw/2-.001;){const len=r.lengths[col%r.lengths.length],contours=yardClip([localRect(u+len/2,v+depth/2,len,depth).map(tilt)],field,'intersection'),cells=yardSolidCells(contours),whole=valid.length>0||cells.length>1;let fragment=0;for(const p of cells){add('paver',p,top,thick,f.color,spec?.illustrative||!spec);const b=model.boxes.at(-1)!;b.unitId=`${f.id}-paver-${row}-${col}`;if(whole){if(fragment++===0)b.renderContours=contours;else b.renderDuplicate=true;}}u+=len+gap;col++;}
    v+=depth+gap;row++;
   }
   }
   if(!supplier&&valid.length)model.pavingZones=[{feature:f,areaSqft:yardArea(field)*slopeScale,stockAreaSqft:yardArea(field)*slopeScale}];
   for(const p of valid){const mask=pools.length?yardClip([p.outline],footprints,'intersection'):[p.outline];if(mask.length)laySupplier(patioInlayFeature(f,p.inlay),mask,p.inlay.id);if(pools.length&&yardArea(mask)<yardArea([p.outline])-.001)localWarnings.push(`${p.inlay.name}: the pool cuts this inlay; only the remaining paving is installed and ordered. Its saved outline is preserved.`);localWarnings.push(`${p.inlay.name}: custom inlay cutting, setting and waste require a builder quote; this is a cut-paver design, not a manufactured medallion kit.`);}
   model.quantities={...model.quantities,planAreaSqft:planArea,surfaceAreaSqft:area,paverPieces:new Set(model.boxes.filter(b=>b.role==='paver').map(b=>b.unitId)).size,baseYd3:area*base/324,beddingYd3:area/324,paverAreaSqft:area};
   if(supplier||valid.length){const stock=[...new Map(model.boxes.filter(b=>b.role==='paver').map(b=>[b.unitId,b])).values()];model.quantities.paverStockAreaSqft=stock.reduce((n,b)=>n+(b.stockAreaSqft??0),0);}
   const formation=top-thick-1-base,formationPlane=belowPlane(patioPlane,thick+1+base),formationPolys=yardClip(sloped?footprints.map(p=>p.map(v=>({x:v.x+patioPlane.x*(thick+1+base)/slopeScale,y:v.y+patioPlane.z*(thick+1+base)/slopeScale}))):footprints,poolExclusions,'difference');let fill=formationPolys;
   if(site)fill=[]; // Dedicated site fill is integrated against every proposed face below.
   else if(terrain.slopePct){const z0=(formation-terrain.elevationIn)/(terrain.slopePct/100),lo=terrain.slopePct>0?-1e7:z0,hi=terrain.slopePct>0?z0:1e7;fill=yardClip(fill,[[{x:-1e7,y:lo},{x:1e7,y:lo},{x:1e7,y:hi},{x:-1e7,y:hi}]],'intersection');}
   else if(formation<=terrain.elevationIn)fill=[];
   model.quantities.raisedFillYd3=sloped&&!site?yardSolidCells(formationPolys).reduce((n,p)=>{const delta=subtractPlanes(formationPlane,{x:0,z:terrain.slopePct/100,constant:terrain.elevationIn}),positive=abovePlane(p,delta);return n+Math.max(0,planeVolume(positive,delta))/46656;},0):site?integrateSiteFeatureFill(site,formationPolys,sloped?formationPlane:formation):yardSolidCells(fill).reduce((n,p)=>n+Math.abs(yardSignedArea(p))*Math.max(0,formation-gradeAt(centroid(p).y,centroid(p).x))/46656,0);
   if(model.quantities.raisedFillYd3>.001)localWarnings.push('Additional engineered fill below the patio base is required by the selected elevation; fill supply, compaction and containment need a quote.');
   excavations.push({featureId:f.id,polys:formationPolys,bottom:formation,...(sloped?{formationPlane}:{})});
   // Ground and paving have to agree at the patio's edge: say where they don't, and by how much (the 3D shows it too).
   // Pieces whose outside is not open lawn are left out: the patio's own outline (deck-post and pool cut-outs), other
   // paving, pools, ponds, deck supports and walls capped at the paving (a raised patio's retaining wall holds that side).
   if(site&&!f.stoneSteps&&!f.stepAssembly&&footprints.length){const notLawn=insideAny([original,supports,poolExclusions,...features.filter(m=>!m.excluded&&(m.config.kind==='water-feature'||m.config.kind==='retaining-wall'&&Math.abs(m.topIn-model.topIn)<=thick+1)).flatMap(m=>[m.footprints,m.boxes.flatMap(b=>b.role==='wall-cap'?[b.polygon!]:[])]),...[...patioOutlines].filter(([g])=>g!==f).map(([,o])=>o)]),spans=patioEdgeSpans(footprints,patioPlane,(px,pz)=>site.sample(px,pz,'proposed'),{probeIn:.5,skip:notLawn}),contact=patioGroundGaps(spans);
    if(contact.aboveIn>=.5)localWarnings.push(`${f.name}: the measured ground beside it is up to ${contact.aboveIn.toFixed(1)} in above its finished surface at its ${patioEdgeWords(footprints,contact.above!)} edge. That ground has to be dug back and graded down to the paving, or the patio set higher; the 3D shows the dig until it is.`);
    // A stone edge course holds the raised side: measured here, in place of the exposed-base warning.
    if(f.groundFit?.lowEdge==='stone'){const course=patioRaisedEdge(spans,thick+.5),lf=Math.round(course.lengthIn/1.2)/10,high=lf?Math.round(course.maxIn*10)/10:0;model.quantities.edgeCourseLf=lf;model.quantities.edgeCourseMaxIn=high;if(lf>0)localWarnings.push(`${f.name}: stone edge course on its raised side, ${lf.toFixed(1)} ft, up to ${high.toFixed(1)} in high.`);}
    else if(contact.belowIn>=thick+.5)localWarnings.push(`${f.name}: its finished surface stands up to ${contact.belowIn.toFixed(1)} in above the measured ground at its ${patioEdgeWords(footprints,contact.below!)} edge. Its base is exposed there until the ground is filled and graded up to it or it gets an edge course; the 3D shows the exposed base.`);}
   // A guard where the patio, at a fixed level, stands more than 600 mm over the ground beside an open edge (patioGuard).
   // Absent unless one is required, so designs without such a patio keep their quantities, warnings and price exactly.
   if(site&&f.finishedElevationIn!==undefined&&!f.stoneSteps&&!f.stepAssembly&&footprints.length){
    guardStructures??=[...houseFootprint,...(deckModel?.levels??[]).map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...stairFootprints(deckModel)].filter(r=>r.length>2).map(r=>guardBlock([r]));
    const blocks=[...guardStructures,...[...patioOutlines].filter(([g,o])=>g!==f&&o.length).map(([,o])=>guardBlock(o)),...(poolExclusions.length?[guardBlock(poolExclusions)]:[]),...features.filter(m=>!m.excluded&&m.config.kind==='water-feature'&&m.footprints.length).map(m=>guardBlock(m.footprints))];
    const guard=patioGuard(original,patioPlane,site,blocks);
    if(guard){model.guard=guard.guard;model.quantities.guardLf=guard.guard.lf;model.quantities.guardDropIn=guard.guard.dropIn;model.quoteRequired=true;localWarnings.push(guard.warning(f.name));}
   }
  }else if(f.kind==='retaining-wall'){
   const h=Math.max(1,f.heightIn),armour=f.productId==='armour-stone',{course,cap,bottom,top,count}=construction!,length=supplier?supplier.unit.widthMm/25.4:armour?36:18,capLength=supplier?.cap?supplier.cap.widthMm/25.4:24,retainedDepth=top-cap-bottom;
   const {baseDepthIn,drainageDepthIn,lengthIn,freestanding:free}=construction!;
   const drainageEnd=d/2+drainageDepthIn,backEnd=Math.max(drainageEnd+12,-d/2+lengthIn),run=pathRun(wallPath);
   const sections=wallFoundationSections(wallPath,construction!,d,gradeAt,f.baseElevationIn??0,site),wallStations=yardWallStationPath(f).stations;
   const segmentTop=(seg:number)=>{const station=(wallStations[seg]+wallStations[seg+1])/2;let value=pad?top:f.finishedElevationIn??top;for(const step of f.wallTopSteps??[]){if(station<step.stationIn)break;value=step.elevationIn;}return value;};
   for(const section of sections){section.topIn=segmentTop(section.segment);section.bottomIn=Math.min(section.bottomIn,section.topIn-cap-course);}
   const sectionMasks=sections.map(section=>[wallSectionMask(wallPath,section)]);
   const zoneCache=new Map<PlanPoint[],Map<string,PlanPoint[][][]>>();
   const zonesFor=(path:PlanPoint[],from:number,to:number,mask?:PlanPoint[][])=>{const key=`${from}:${to}:${mask?'bounded-body':'strip'}`,cache=zoneCache.get(path)??new Map<string,PlanPoint[][][]>();zoneCache.set(path,cache);const saved=cache.get(key);if(saved)return saved;let claimed:PlanPoint[][]=[];const bounded=mask??yardClip(yardPathBackStrip(path,from,to));const result=yardPathBackStrip(path,from,to,Infinity).map(strip=>{const zone=yardClip(yardClip([strip],bounded,'intersection'),claimed,'difference');claimed=yardClip([...claimed,...zone]);return zone;});cache.set(key,result);return result;};
   // A corner's bounded mitre and batter can extend below the centreline
   // grade. Lower the local bench by full courses until its entire body
   // footprint has the specified burial; never silently leave it exposed.
   for(let i=0;i<sections.length;i++){const section=sections[i];for(let attempt=0;attempt<count;attempt++){const row=Math.max(0,Math.round((section.bottomIn-bottom)/course)),path=coursePaths[row],body=yardClip(zonesFor(path,-d/2,d/2,yardPathEnvelope(path,d))[section.segment],sectionMasks[i],'intersection'),lowGrade=(site?site.extrema(body).min:Math.min(...body.flat().map(v=>gradeAt(v.y,v.x))))+(f.baseElevationIn??0);if(!Number.isFinite(lowGrade)||lowGrade-section.bottomIn>=construction!.minimumBurialIn-1e-5||section.bottomIn<=bottom+1e-5)break;section.bottomIn-=course;}}
   const scopeCache=new Map<string,PlanPoint[][]>(),scope=(seg:number,elevation:number)=>{const key=`${seg}:${elevation}`,saved=scopeCache.get(key);if(saved)return saved;const value=yardClip(sections.flatMap((section,i)=>section.segment===seg&&section.bottomIn<elevation-1e-6&&elevation<=(section.topIn??top)-cap+1e-6?sectionMasks[i]:[]));scopeCache.set(key,value);return value;};
   // Mesh facets on an arc share a stock schedule. Real control corners keep
   // separate cut units; a tessellation boundary is not a new purchased block.
   const curveStarts:number[]=[];if(f.curves?.length){const controls=f.wallPath??[{x:-w/2,y:0},{x:w/2,y:0}];let searchFrom=0;for(const control of controls){const point={x:x+c*control.x-s*control.y,y:z+s*control.x+c*control.y},index=wallPath.findIndex((p,i)=>i>=searchFrom&&Math.hypot(p.x-point.x,p.y-point.y)<1e-5);if(index>=0){curveStarts.push(index);searchFrom=index+1;}}}
   const lay=(role:'wall-block'|'wall-cap',path:PlanPoint[],elevation:number,height:number,unitLength:number,row:number)=>{
    const width=role==='wall-cap'?capDepth:d,zones=zonesFor(path,-width/2,width/2,yardPathEnvelope(path,width)),curved=curveStarts.length>=2,stations=[0],curvePieces=new Map<string,YardBox[]>();for(let seg=0;seg+1<path.length;seg++)stations.push(stations.at(-1)!+Math.hypot(path[seg+1].x-path[seg].x,path[seg+1].y-path[seg].y));
    let controlEdge=0;for(let seg=0;seg+1<path.length;seg++){
     while(curved&&controlEdge+1<curveStarts.length-1&&seg>=curveStarts[controlEdge+1])controlEdge++;

     const p=path[seg],q=path[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,angle=Math.atan2(uy,ux),zone=yardClip(zones[seg],role==='wall-cap'&&f.wallTopSteps?.length?yardClip(sections.flatMap((section,i)=>section.segment===seg&&Math.abs(section.topIn!-elevation)<1e-6?sectionMasks[i]:[])):scope(seg,role==='wall-cap'?elevation-cap+1e-7:elevation),'intersection'),along=zone.flat().map(v=>(v.x-p.x)*ux+(v.y-p.y)*uy);if(!along.length)continue;
     const start=Math.min(...along),end=Math.max(...along),stagger=row%2&&f.hardscape?.patternId!=='stack-bond'?unitLength/2:0,station=curved?stations[seg]-stations[curveStarts[controlEdge]]:0;let slot=curved?Math.floor((station+start+stagger)/unitLength):0;
     for(let u=curved?slot*unitLength-stagger-station:start-stagger;u<end-.001;u+=unitLength,slot++){
      const left=Math.max(start,u),right=Math.min(end,u+unitLength);if(right-left<=.05)continue;
      const leftGap=curved&&!supplier&&Math.abs(left-u)<1e-6?.025:0,rightGap=curved&&!supplier&&Math.abs(right-u-unitLength)<1e-6?.025:0,centre=(left+leftGap+right-rightGap)/2,blank=rectangle(p.x+ux*centre,p.y+uy*centre,right-left-(curved?leftGap+rightGap:supplier?0:.05),width,angle),cuts=yardClip([blank],zone,'intersection');
      let textureX=p.x+ux*(u+unitLength/2),textureZ=p.y+uy*(u+unitLength/2),textureAngle=angle;if(curved){const target=stations[curveStarts[controlEdge]]+slot*unitLength-stagger+unitLength/2;let lo=curveStarts[controlEdge],hi=curveStarts[controlEdge+1]-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(stations[mid]<=target)lo=mid;else hi=mid-1;}const begin=path[lo],finish=path[lo+1],length=Math.hypot(finish.x-begin.x,finish.y-begin.y),distance=target-stations[lo];textureX=begin.x+(finish.x-begin.x)*distance/length;textureZ=begin.y+(finish.y-begin.y)*distance/length;textureAngle=Math.atan2(finish.y-begin.y,finish.x-begin.x);}
      let fragment=0;for(const cut of yardSolidCells(cuts)){add(role,cut,elevation,height,f.color,!supplier||!rectangularUnit(supplier.unit));const b=model.boxes.at(-1)!;b.unitId=`${f.id}-${role}-${row}-${curved?controlEdge:seg}-${slot}`;if(fragment++===0)b.renderContours=cuts;else b.renderDuplicate=true;if(curved){const pieces=curvePieces.get(b.unitId)??[];pieces.push(b);curvePieces.set(b.unitId,pieces);}if(supplier?.color.swatch)b.surface={swatchKey:hardscapeSwatchKey(supplier.product.id,supplier.finish.id,supplier.color.id),cx:textureX,cz:textureZ,angle:textureAngle,lengthIn:unitLength,widthIn:width,heightIn:role==='wall-cap'?height:course,kind:role==='wall-cap'?'paver':'wall',sourceUrl:supplier.product.sourceUrl};}
     }
    }
    for(const pieces of curvePieces.values()){pieces[0].renderContours=yardClip(pieces.map(b=>b.polygon!));delete pieces[0].renderDuplicate;for(const b of pieces.slice(1))b.renderDuplicate=true;}
   };
   model.topIn=top;if(f.finishedElevationIn!==undefined&&construction!.minExposedHeightIn<=0){model.quoteRequired=true;localWarnings.push('A fixed wall cap meets or falls below local proposed front ground. Revise the finished levels or grading; buried cap/face conditions remain pending.');}let drainageYd3=0,backfillYd3=0,gridArea=0,gridGrossArea=0,actualGridLayers=0,aboveGroundGridArea=0,planningGridArea=0,planningGridGrossArea=0;
   for(let row=0;row<count;row++){
    const rowBottom=bottom+row*course,elevation=rowBottom+course,path=coursePaths[row];
    lay('wall-block',path,elevation,course-(supplier?0:.03),length,row);
    for(const [role,from,to,color]of free?[]:[['wall-drainage',d/2,drainageEnd,'#989a91'],['backfill',drainageEnd,backEnd,'#765e42']] as const){
     const zones=zonesFor(path,from,to);for(let seg=0;seg<zones.length;seg++){const cut=yardClip(zones[seg],scope(seg,elevation),'intersection');let volume=0;if(site){const band=siteMaterialBand(site,cut,rowBottom,elevation);volume=band.volumeYd3;for(const region of band.regions){const maxTop=Math.max(...region.polygon.map(v=>sitePlaneHeight(region.topPlane,v.x,v.y)));add(role,region.polygon,maxTop,maxTop-rowBottom,color,true);const box=model.boxes.at(-1)!;box.topPlane=region.topPlane;box.bottomIn=rowBottom;}}else{for(const poly of yardSolidCells(cut))add(role,poly,elevation,course,color,true);volume=yardArea(cut)*course/324;}if(role==='wall-drainage')drainageYd3+=volume;else backfillYd3+=volume;}

    }
   }
   if(cap){if(f.wallTopSteps?.length)for(const capTop of [...new Set(sections.map(section=>section.topIn!))]){const row=Math.max(0,Math.min(count-1,Math.round((capTop-cap-bottom)/course)-1));lay('wall-cap',coursePaths[row],capTop,cap,capLength,Math.round((capTop-top)/course));}else lay('wall-cap',coursePaths.at(-1)!,top,cap,capLength,0);}
   const sectionLayers=sections.map(section=>{const elevations:number[]=[];for(let y=section.bottomIn+course;y<(section.topIn??top)-cap-1e-6;y+=course*construction!.everyCourses)elevations.push(y);if(!elevations.length)elevations.push((section.topIn??top)-cap);return elevations;}),gridElevations=[...new Set(sectionLayers.flat().map(y=>Number(y.toFixed(7))))].sort((a,b)=>a-b),sectionGridCounts=sections.map(()=>0);
   for(const elevation of free?[]:gridElevations){
    const row=Math.max(0,Math.min(count-1,Math.round((elevation-bottom)/course)-1)),path=coursePaths[row],raw=yardPathBackStrip(path,-d/2+1,-d/2+lengthIn),requestedStrips=raw.map((poly,seg)=>yardClip([poly],yardClip(sections.flatMap((section,i)=>section.segment===seg&&sectionLayers[i].some(y=>Math.abs(y-elevation)<1e-5)?sectionMasks[i]:[])),'intersection')),strips=site?requestedStrips.map(polys=>sitePolygonsBelowGround(site,polys,elevation)):requestedStrips,installed=yardClip(strips.flat());
    const requestedArea=yardArea(yardClip(requestedStrips.flat()));planningGridArea+=requestedArea;planningGridGrossArea+=Math.max(requestedArea,requestedStrips.reduce((n,p)=>n+yardArea(p),0));
    if(site){aboveGroundGridArea+=Math.max(0,requestedArea-yardArea(installed));for(let i=0;i<sections.length;i++)if(sectionLayers[i].some(y=>Math.abs(y-elevation)<1e-5)&&yardArea(yardClip(installed,sectionMasks[i],'intersection'))>.001)sectionGridCounts[i]++;}
    if(!installed.length)continue;actualGridLayers++;gridArea+=yardArea(installed);gridGrossArea+=Math.max(yardArea(installed),strips.reduce((n,p)=>n+yardArea(p),0));for(const poly of yardSolidCells(installed))add('geogrid',poly,elevation,.04,'#27352c',true);
   }
   let baseYd3=0,minBurial=Infinity,maxBurial=-Infinity,minExposed=Infinity,maxExposed=-Infinity,filterArea=0,drainPipeLengthIn=0;
   const baseZonesByRow=new Map<number,PlanPoint[][][]>(),excavationZones=zonesFor(wallPath,d/2,backEnd+construction!.maxSetbackIn);
   for(let i=0;i<sections.length;i++){
    const section=sections[i],row=Math.round((section.bottomIn-bottom)/course),path=coursePaths[row],seg=section.segment;
    if(!baseZonesByRow.has(row))baseZonesByRow.set(row,zonesFor(path,-d/2-6,free?d/2+6:drainageEnd));
    const base=yardClip(baseZonesByRow.get(row)![seg],sectionMasks[i],'intersection'),body=yardClip(zonesFor(path,-d/2,d/2,yardPathEnvelope(path,d))[seg],sectionMasks[i],'intersection'),drainage=yardClip(zonesFor(path,d/2,drainageEnd)[seg],sectionMasks[i],'intersection');
    for(const poly of yardSolidCells(base))add('base',poly,section.bottomIn,baseDepthIn,'#8c8a7c',true);
    baseYd3+=yardArea(base)*baseDepthIn/324;
    if(!padPlane)excavations.push({featureId:f.id,polys:base,bottom:section.bottomIn-baseDepthIn});if(!free)excavations.push({featureId:f.id,polys:yardClip(excavationZones[seg],sectionMasks[i],'intersection'),bottom:section.bottomIn});
    const bodyGrades=site?site.extrema(body):{min:Math.min(...body.flat().map(v=>gradeAt(v.y,v.x))),max:Math.max(...body.flat().map(v=>gradeAt(v.y,v.x)))};minExposed=Math.min(minExposed,(section.topIn??top)-bodyGrades.max);maxExposed=Math.max(maxExposed,(section.topIn??top)-bodyGrades.min);minBurial=Math.min(minBurial,bodyGrades.min+(f.baseElevationIn??0)-section.bottomIn);maxBurial=Math.max(maxBurial,bodyGrades.max+(f.baseElevationIn??0)-section.bottomIn);
    const p=wallPath[seg],q=wallPath[seg+1],span=Math.hypot(q.x-p.x,q.y-p.y),start=Math.max(0,section.startIn),end=Math.min(span,section.endIn),sectionRun=Math.max(0,end-start),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,offset=d/2+drainageDepthIn/2+row*construction!.setbackPerCourseIn;
    // Horizontal toe drains follow level benches. Vertical drops are included
    // in supply only; the final junction/outlet route remains a site decision.
    const m:YardMember={id:`${f.id}-drain-pipe-${i}`,featureId:f.id,role:'drain-pipe',color:'#262e32',a:{x:p.x+ux*start-uy*offset,y:section.bottomIn+2,z:p.y+uy*start+ux*offset},b:{x:p.x+ux*end-uy*offset,y:section.bottomIn+2,z:p.y+uy*end+ux*offset},width:4,depth:4};if(!free){members.push(m);model.members.push(m);drainPipeLengthIn+=sectionRun;
    if(site){const band=siteMaterialBand(site,drainage,section.bottomIn,(section.topIn??top)-cap),side=siteRetainedSideArea(site,{x:m.a.x,y:m.a.z},{x:m.b.x,y:m.b.z},section.bottomIn,(section.topIn??top)-cap);filterArea+=band.planAreaSqft+band.topAreaSqft+side.areaSqft+sectionRun*drainageDepthIn*2/144;}else filterArea+=yardArea(drainage)*2+sectionRun*((section.topIn??top)-cap-section.bottomIn+drainageDepthIn*2)/144;}
   }
   const stepChanges=sections.slice(1).reduce((n,section,i)=>n+Math.round(Math.abs(section.bottomIn-sections[i].bottomIn)/course),0);
   if(!free)drainPipeLengthIn+=stepChanges*course;
   const minDrainCollectionInvertIn=Math.min(...model.members.filter(m=>m.role==='drain-pipe').flatMap(m=>[m.a.y-m.depth/2,m.b.y-m.depth/2])),outletElevation=f.wallConstruction?.drainOutletElevationIn,outletFall=f.wallConstruction?.drainOutletFallPct,checkableOutlet=construction!.drainOutletCount===1&&construction!.drainOutletLengthFt>0&&outletElevation!==undefined&&outletFall!==undefined,outletCheck:Record<string,number>=checkableOutlet?{drainOutletAvailableFallIn:minDrainCollectionInvertIn-outletElevation!,drainOutletRequiredFallIn:construction!.drainOutletLengthFt*12*outletFall!/100,drainOutletMaxElevationIn:minDrainCollectionInvertIn-construction!.drainOutletLengthFt*12*outletFall!/100}:{},drainOutletCheckPassed=checkableOutlet&&outletCheck.drainOutletAvailableFallIn!+1e-6>=outletCheck.drainOutletRequiredFallIn!;
   if(free){/* no drain */}else if(!drainOutletCheckPassed){model.quoteRequired=true;localWarnings.push(construction!.drainOutletCount!==1?'Outlet elevation check pending: multiple outlets need per-route surveyed inverts, lengths and required fall.':!checkableOutlet?'Outlet elevation check pending: enter surveyed discharge invert, required fall and positive solid route length.':'Entered outlet invert cannot provide the specified fall from the lowest modeled collection invert; revise the route or discharge elevation.');}
   else localWarnings.push(`Entered outlet drop ${outletCheck.drainOutletAvailableFallIn!.toFixed(2)} in meets the ${outletCheck.drainOutletRequiredFallIn!.toFixed(2)} in specified fall. Collection grade, fittings and discharge remain pending.`);
   const constructionQuantities={minDrainCollectionInvertIn,drainOutletElevationPending:drainOutletCheckPassed?0:1,drainOutletCheckPassed:drainOutletCheckPassed?1:0,...outletCheck,geogridLayers:actualGridLayers,geogridMaxLayersPerBench:site?Math.max(0,...sectionGridCounts):Math.max(...sectionLayers.map(layers=>layers.length)),geogridAboveGroundSqft:aboveGroundGridArea,geogridPlanningSqft:planningGridArea,geogridPlanningOrderSqft:planningGridGrossArea*1.1,geogridPlacementPending:aboveGroundGridArea>.001?1:0,geogridSqft:gridArea,geogridGrossSqft:gridGrossArea,geogridCornerOverlapSqft:Math.max(0,gridGrossArea-gridArea),geogridOrderSqft:gridGrossArea*1.1,geogridLengthIn:lengthIn,geogridCourseInterval:construction!.everyCourses,minWallBurialIn:Number.isFinite(minBurial)?Number(minBurial.toFixed(5)):construction!.minBurialIn,maxWallBurialIn:Number.isFinite(maxBurial)?Number(maxBurial.toFixed(5)):construction!.maxBurialIn,maxExposedHeightIn:wf.finishedElevationIn!==undefined?maxExposed:construction!.maxExposedHeightIn,minExposedHeightIn:wf.finishedElevationIn!==undefined?minExposed:construction!.minExposedHeightIn,wallFoundationSteps:stepChanges,wallSetbackIn:construction!.maxSetbackIn,wallBatterAngleDeg:construction!.batterAngleDeg,drainOutletCount:construction!.drainOutletCount,drainOutletPipeLf:construction!.drainOutletLengthFt,wallCapBondLf:cap?run/12:0};
   model.quantities={...model.quantities,wallLengthLf:(f.wallTopSteps?.length?yardWallStationPath(f).lengthIn:run)/12,wallFaceSqft:wf.finishedElevationIn!==undefined?sections.reduce((n,section)=>{const p=wallPath[section.segment],q=wallPath[section.segment+1],span=Math.hypot(q.x-p.x,q.y-p.y),lo=Math.max(0,section.startIn),hi=Math.min(span,section.endIn),ux=(q.x-p.x)/span,uy=(q.y-p.y)/span,inset=Math.min(1e-5,(hi-lo)/100),height=(u:number)=>(section.topIn??top)-gradeAt(p.y+uy*u-ux*d/2,p.x+ux*u+uy*d/2),a=height(lo+inset),b=height(hi-inset),run=Math.max(0,hi-lo),area=a>=0&&b>=0?run*(a+b)/2:a<=0&&b<=0?0:run*Math.max(a,b)**2/(2*Math.abs(a-b));return n+area/144;},0):run*h/144,wallBlocks:new Set(model.boxes.filter(b=>b.role==='wall-block').map(b=>b.unitId)).size,wallCaps:new Set(model.boxes.filter(b=>b.role==='wall-cap').map(b=>b.unitId)).size,drainPipeLf:drainPipeLengthIn/12,wallBaseYd3:baseYd3,drainageYd3,backfillYd3,wallFilterFabricSqft:filterArea,...constructionQuantities};
   if(site&&!free){const retained=site.extrema(yardPathBackStrip(wallPath,d/2,backEnd+construction!.maxSetbackIn));model.quantities.retainedGradeMinIn=retained.min;model.quantities.retainedGradeMaxIn=retained.max;if(aboveGroundGridArea>.001||retained.min<top-cap-.01||retained.max>top-cap+.01){model.quantities.wallRetainedGradePending=1;model.quoteRequired=true;localWarnings.push(`Proposed retained ground ${retained.min.toFixed(1)}â€“${retained.max.toFixed(1)} in versus body top ${(top-cap).toFixed(1)} in. Drainage/backfill are clipped to measured proposed ground; ${aboveGroundGridArea.toFixed(1)} sq ft of planned grid has no measured buried placement. Confirm retained grading, reinforcement cover/connections and exposed wall design.`);}}
   // Seat wall: two finished faces and no retained side (wallQuoteScopes quotes the second face; never $0).
   if(free){const q=model.quantities,hi=q.maxExposedHeightIn;delete q.minDrainCollectionInvertIn;q.drainOutletElevationPending=0;q.wallFreestanding=1;if(pad)q.wallFaceSqft=run*(top-grade)/144;q.wallSecondFaceSqft=q.wallFaceSqft;
    localWarnings.push(`Freestanding seat wall${pad?` on ${pad.name}: it stands on the paving, ${count} whole courses and cap ${(top-grade).toFixed(1)} in high`:''}. Both faces exposed and finished, cap overhanging both sides; no drainage stone, backfill or geogrid.${hi>=16&&hi<=24?' Seat height (16–24 in).':''}`);
    if(seat?.straddles)localWarnings.push(`${f.name}: it straddles the edge of ${seat.straddles.name}, so it is built on the ground, with its own base course and burial, not on the paving. Move it wholly onto the patio to stand it on the paving.`);
    if(hi>36){q.freestandingReviewPending=1;model.quoteRequired=true;localWarnings.push(`Freestanding wall over 36 in (${hi.toFixed(1)} in): builder review and engineering required for overturning, wind and impact.`);}}
   if(supplier){
    for(const b of model.boxes){if(b.role==='wall-block')b.stockUnitId=supplier.unit.id;else if(b.role==='wall-cap'){b.stockUnitId=supplier.cap?.stockUnitId;b.color=supplier.cap?.colorHex??f.color;if(supplier.cap?.swatchKey)b.surface={swatchKey:supplier.cap.swatchKey,cx:b.surface?.cx??b.x,cz:b.surface?.cz??b.z,angle:b.surface?.angle??a,lengthIn:capLength,widthIn:capDepth,heightIn:cap,kind:'paver',sourceUrl:supplier.cap.sourceUrl};else delete b.surface;}}
    model.stockSchedule=[supplier.unit,...(supplier.cap?[supplier.cap]:[])].map(u=>{const stock=u===supplier.cap?supplier.cap!.stockUnitId:u.id;return {unitId:stock,widthMm:u.widthMm,lengthMm:u.lengthMm,heightMm:u.heightMm,pieces:new Set(model.boxes.filter(b=>b.stockUnitId===stock).map(b=>b.unitId)).size,...(u===supplier.cap?{productId:supplier.cap!.sourceProductId}:{})};});
    if(supplier.cap)localWarnings.push(`${supplier.cap.name}; ${supplier.cap.widthMm} Ã— ${supplier.cap.lengthMm} Ã— ${supplier.cap.heightMm} mm cap; ${model.quantities.wallCapBondLf.toFixed(1)} ft bond. Cuts retain thickness; verify adhesive coverage, ends/packaging. ${supplier.cap.sourceUrl}`);
   }
   if(f.wallTopSteps?.length){model.quantities.wallTopSteps=f.wallTopSteps.length;model.quantities.wallTopTransitionPending=1;model.quoteRequired=true;localWarnings.push('Stepped cap end cuts, vertical returns and reinforcement connections require a verified manufacturer detail. Stock courses remain full height; top transitions are pending.');}
   model.quantities.wallCourses=count;model.sourceUrl=supplier?.product.sourceUrl;
   const assemblyPrerequisite=f.productId==='techo-sandstonethinsetveneer-wall'?'Sandstone veneer: structural backing, foundation, waterproofing/bond and grid connection pending; no assembled order.':f.productId==='techo-skyscraper-wall'?'Skyscraper: select native base/middle/top/extender, connectors/infill and compatible coping; no assembled order.':f.productId==='oaks-modeco-one'?`Modeco: native top units, adhesive every row; ${(retainedDepth*25.4).toFixed(0)} mm total versus 445 mm garden-wall limit. Tapered stock, availability and grid connection pending; no assembled order.`:'';
   if(assemblyPrerequisite){model.quoteRequired=true;model.quantities.wallAssemblyPending=1;model.quantities.wallConceptualBlocks=model.quantities.wallBlocks;model.quantities.wallConceptualCaps=model.quantities.wallCaps;model.quantities.wallBlocks=0;model.quantities.wallCaps=0;delete model.stockSchedule;localWarnings.push(assemblyPrerequisite);}
   if(f.productId==='oaks-modeco-one'){model.quantities.wallTopCourseNative=1;model.quantities.wallCourseBondLf=Math.max(0,model.boxes.filter(b=>b.role==='wall-block').reduce((n,b)=>n+yardArea([b.polygon!]),0)/(d/12)-run/12);if(retainedDepth*25.4>445+1e-5||construction!.maxExposedHeightIn-construction!.minExposedHeightIn>1e-5)localWarnings.push('Modeco garden-wall height/slope exceeded; select an approved retaining assembly. Extra grid does not extend this system limit.');}

   localWarnings.push(`${count} maximum body courses Ã— ${course.toFixed(3)} in; ${constructionQuantities.minWallBurialIn.toFixed(1)} in minimum burial. ${construction!.foundationMode==='stepped'?`${stepChanges} full-course foundation steps`:'One deepest level foundation'}. Survey, bench bearing/run and stock joints pending.`);
   if(site||terrain.slopePct)localWarnings.push(`Exposed height ${construction!.minExposedHeightIn.toFixed(1)}â€“${construction!.maxExposedHeightIn.toFixed(1)} in; stepped foundations use full courses.`);
   localWarnings.push(`Setback ${construction!.setbackPerCourseIn.toFixed(3)} in/course, ${construction!.batterAngleDeg.toFixed(1)}Â° batter, ${construction!.maxSetbackIn.toFixed(1)} in maximum. Stock fixed; verify connector position and corners/radius.`);
   if(!free)localWarnings.push(`Grid allowance every wall: ${(planningGridGrossArea*1.1).toFixed(1)} sq ft planning order including 10% cuts; ${actualGridLayers} measured elevations/${gridArea.toFixed(1)} installed sq ft; ${lengthIn.toFixed(1)} in length, ${construction!.everyCourses} course interval. Strength/direction, buried cover, connections, gaps/turns and stability pending.`);
   if(!free)localWarnings.push(`Toe pipe ${(drainPipeLengthIn/12).toFixed(1)} ft including step drops; ${construction!.drainOutletCount} outlets; ${construction!.drainOutletLengthFt?`${construction!.drainOutletLengthFt.toFixed(1)} ft solid run`:'outlet run pending'}. Confirm fall, fittings/cleanouts and discharge.`);
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
 reconcilePoolMaterials(pools,features,boxes,excavations);
 reconcileWallPaving(features,boxes,excavations);
 for(const f of features)for(const w of f.warnings)if(!warnings.includes(w))warnings.push(w);
 for(const pool of pools)for(const warning of pool.warnings){const text=`${pool.config.name}: ${warning}`;if(!warnings.includes(text))warnings.push(text);}
 // Foundation solids set a minimum measurable concrete-pier void. Overdig,
 // footing benches and installation-specific pile spoil are recorded as pending.
 const foundationFormations:typeof excavations=((pools.length>0||data.siteModel||terrain.elevationIn!==0||terrain.slopePct!==0||enabled.some(f=>f.finishedElevationIn!==undefined)?deckModel?.foundationSupports:undefined)??[]).filter(p=>p.status!=='coverage-pending'&&p.foundation!=='Deck Blocks'&&p.foundation!=='Helical Piles'&&p.bottomElevationIn!==null).map(p=>({featureId:`deck-foundation:${p.id}`,polys:[Array.from({length:128},(_,i)=>({x:p.x+6*Math.cos(i*Math.PI/64),y:p.z+6*Math.sin(i*Math.PI/64)}))],bottom:p.bottomElevationIn!}));
 const earthworkFor=(formations:typeof excavations)=>{
 const excavationRegions:YardExcavationRegion[]=[];
 if(!site){const ground={x:0,z:terrain.slopePct/100,constant:terrain.elevationIn};let cells:Parameters<typeof applyPlaneFormation>[0]=[];
  for(const e of [...formations].sort((a,b)=>a.bottom-b.bottom))cells=applyPlaneFormation(cells,e.polys,e.formationPlane??{x:0,z:0,constant:e.bottom},e.featureId,yardClip,yardSolidCells);
  for(const cell of cells){const delta=subtractPlanes(ground,cell.plane),polygon=abovePlane(cell.polygon,delta),volumeYd3=Math.max(0,planeVolume(polygon,delta))/46656;if(volumeYd3>1e-8)excavationRegions.push({featureId:cell.featureId,polygon,bottomIn:planeAt(cell.plane,polygon[0].x,polygon[0].y),...(formations.some(f=>f.formationPlane)?{formationPlane:cell.plane}:{}),volumeYd3});}
 }
 const siteEarthwork=site?integrateSiteExcavation(site,formations.map(e=>({featureId:e.featureId,polygons:e.polys,bottomIn:e.bottom,...(e.formationPlane?{formationPlane:e.formationPlane}:{})}))):undefined;if(siteEarthwork)for(const r of siteEarthwork.regions)excavationRegions.push(r);
  return {excavationRegions,siteEarthwork};
 };
 const yardEarthwork=earthworkFor(excavations),combinedEarthwork=foundationFormations.length?earthworkFor([...foundationFormations,...excavations]):yardEarthwork,sharedExcavationRegions=combinedEarthwork.excavationRegions,deckFoundationRegions=sharedExcavationRegions.filter(r=>r.featureId.startsWith('deck-foundation:')),deckFoundationExcavationYd3=deckFoundationRegions.reduce((n,r)=>n+r.volumeYd3,0),sharedExcavationYd3=sharedExcavationRegions.reduce((n,r)=>n+r.volumeYd3,0),excavationRegions=deckFoundationRegions.length?sharedExcavationRegions.filter(r=>!r.featureId.startsWith('deck-foundation:')):yardEarthwork.excavationRegions,siteEarthwork=combinedEarthwork.siteEarthwork;
 // A ground-fit patio's edge is a designed step: the bank meets its top, the ground under it stays for its own
 // excavation. Its interior is left out of the grade-jump check so only real jumps (between banks, at walls) remain.
 const gradeWarnings=site?siteElevationWarnings(data,outsideFeaturePads(site,designSiteModel(data)?.featurePads),features):[];warnings.push(...gradeWarnings);
 for(const feature of features){const scopes=hardscapeAssemblyQuoteScopes([feature]);if(scopes.length)feature.assemblyQuoteScopes=scopes;}
 const fires=fireFeatureModels(data,features,{gradeAt,houseFootprint,deckModel,ids});features.push(...fires);for(const fire of fires)for(const w of fire.warnings)if(!warnings.includes(w))warnings.push(w);
 const active=features.filter(f=>!f.excluded),sum=(key:string)=>active.reduce((n,f)=>n+(f.quantities[key]||0),0),patioUnion=yardClip(active.filter(f=>f.config.kind==='patio').flatMap(f=>f.footprints));
 // Stone edge courses on raised patio sides (ground fit lowEdge 'stone'); absent unless a patio has one, so other
 // designs keep their quantities exactly.
 const coursed=active.filter(f=>f.quantities.edgeCourseLf!==undefined),edgeCourse:{edgeCourseLf?:number;edgeCourseMaxIn?:number}=coursed.length?{edgeCourseLf:Math.round(sum('edgeCourseLf')*10)/10,edgeCourseMaxIn:Math.max(...coursed.map(f=>f.quantities.edgeCourseMaxIn))}:{};
 const perimeter=patioUnion.reduce((n,p)=>n+p.reduce((m,v,i)=>{const q=p[(i+1)%p.length];return m+Math.hypot(v.x-q.x,v.y-q.y);},0),0)/12;
 return {...(pools.length?{pools}:{}),formationRegions:[...foundationFormations,...excavations].flatMap(e=>e.polys.map(polygon=>({featureId:e.featureId,polygon,bottomIn:e.bottom,...(e.formationPlane?{formationPlane:e.formationPlane}:{})}))),features,boxes,members,warnings,terrain,...(site?{siteSurface:siteSurfaceSnapshot(site),siteCutFill:site.cutFill,siteEarthwork:{complete:site.cutFill.complete&&!features.some(f=>f.exclusionReason==='site-coverage')&&!deckModel?.foundationSupports.some(p=>p.status==='coverage-pending'||p.foundation==='Helical Piles'),uncoveredGradingAreaSqft:site.cutFill.uncoveredAreaSqft,pendingFeatureIds:features.filter(f=>f.exclusionReason==='site-coverage').map(f=>f.config.id)}}:{}),excavationRegions,sharedExcavationRegions,deckFoundationExcavationYd3,sharedExcavationYd3,foundationExcavationPending:!!deckModel&&!!(pools.length>0||data.siteModel||terrain.elevationIn!==0||terrain.slopePct!==0||enabled.some(f=>f.finishedElevationIn!==undefined))&&(deckModel.foundationSupports.some(p=>p.status==='coverage-pending'||p.foundation==='Helical Piles')||foundationFormations.length>0),patioUnion,quoteRequired:pools.some(p=>p.pending.length>0)||gradeWarnings.length>0||budgetExcludedIds.length>0||features.some(f=>f.quoteRequired)||!!site&&!site.cutFill.complete,paverBudget:{limit:YARD_PAVER_BUDGET,reservedPieces:reservedPavers,remainingPieces:YARD_PAVER_BUDGET-reservedPavers,excludedFeatureIds:budgetExcludedIds},deckClearance:{clearanceIn:SUPPORT_CLEARANCE_IN,supportCutouts:yardClip(supportCutouts),minStairClearanceIn,minFramingClearanceIn,checked:!!deckModel,stairCoverageComplete,framingCoverageComplete,...(measuredDeck?{minLandingClearanceIn:measuredDeck.minLandingClearanceIn,minStringerEnvelopeClearanceIn:measuredDeck.minStringerEnvelopeClearanceIn,stringerCoverageComplete:measuredDeck.stringerCoverageComplete,stairTerminations:measuredDeck.stairTerminations}:{})},quantities:{...Object.fromEntries(('stepRiserBlocks stepRiserCuts stepSupportBlocks stepSupportBlockCuts stepLandingPieces stepLandingCuts stoneStepPieces stoneStepCuts stoneStepAreaSqft stoneSupportStepPieces stoneSupportStepCuts stoneFillerPieces stoneFillerCuts unsupportedBearingAreaSqft wallFaceSqft wallLengthLf paverPieces wallBlocks wallCaps geogridSqft geogridOrderSqft geogridPlanningSqft geogridPlanningOrderSqft wallFilterFabricSqft waterVolumeGal linerSqft').split(' ').map(k=>[k,sum(k)])) as Record<'stepRiserBlocks'|'stepRiserCuts'|'stepSupportBlocks'|'stepSupportBlockCuts'|'stepLandingPieces'|'stepLandingCuts'|'stoneStepPieces'|'stoneStepCuts'|'stoneStepAreaSqft'|'stoneSupportStepPieces'|'stoneSupportStepCuts'|'stoneFillerPieces'|'stoneFillerCuts'|'unsupportedBearingAreaSqft'|'wallFaceSqft'|'wallLengthLf'|'paverPieces'|'wallBlocks'|'wallCaps'|'geogridSqft'|'geogridOrderSqft'|'geogridPlanningSqft'|'geogridPlanningOrderSqft'|'wallFilterFabricSqft'|'waterVolumeGal'|'linerSqft',number>,sharedExcavationYd3,deckFoundationExcavationYd3,stepEngineeredFillYd3:sum('stepEngineeredFillYd3'),stoneSupportVolumeYd3:sum('stoneSupportVolumeYd3'),patioAreaSqft:sum('paverAreaSqft'),patioPerimeterLf:perimeter,baseYd3:sum('baseYd3'),wallBaseYd3:sum('wallBaseYd3'),raisedFillYd3:sum('raisedFillYd3'),siteEarthworkFillYd3:siteEarthwork?.fillYd3??0,beddingYd3:sum('beddingYd3'),drainageYd3:sum('drainageYd3'),backfillYd3:sum('backfillYd3'),excavationYd3:excavationRegions.reduce((n,e)=>n+e.volumeYd3,0),...edgeCourse}};
}

// A controller commit clones a design, even for a lock or a private price.
// Keep a bounded content cache for pool projects so those edits and undo do not
// repeat the exact terrain/formation union. Every physical value and the complete
// deck model remain in the key; organization and private prices are not geometry.
const poolProjectModels=new Map<string,ReturnType<typeof buildUncachedYardModel>>();
export function buildYardModel(data:DeckData,deckModel?:DeckTakeoff){
 if(!data.pools?.length)return buildUncachedYardModel(data,deckModel);
 const {editorOrganization,poolQuoteInputs,quoteResolutions,scenePresentation,...physical}=data;
 const key=JSON.stringify([physical,deckModel]);
 const saved=poolProjectModels.get(key);
 if(saved){poolProjectModels.delete(key);poolProjectModels.set(key,saved);return saved;}
 const model=buildUncachedYardModel(data,deckModel);poolProjectModels.set(key,model);
 while(poolProjectModels.size>3)poolProjectModels.delete(poolProjectModels.keys().next().value!);
 return model;
}
registerAdvancedYardRuntime({buildYardModel});
