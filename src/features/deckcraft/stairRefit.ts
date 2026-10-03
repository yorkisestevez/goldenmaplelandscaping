import {getPoolModels} from './poolModel';
import './stairTargetsRuntime';
import type {DeckData} from './types';
import {buildDeckTakeoff,type Box,type DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {polygonCut,signedArea} from './lib/polygonCuts';
import {getHouseBlocks,rectPolygon} from './houseFootprint';
import {createSiteSurface,sampleSiteHeight} from './siteSurface';
import {getTerrainConfig} from './yardSettings';
import {buildYardModel} from './yardModel';
import {patioTopPlane,planeAt} from './yardElevationGeometry';
import {stairLandingPolygons} from './stairLandingGeometry';
import {STAIR_TARGET_LIMITS,stairTargetId,type StairTarget} from './stairTargets';
export interface StairRefitOptions {flightId?:string;surface?:'terrain'|'patio';patioId?:string;landingDepthIn?:number;maxLandingVariationIn?:number}
export interface StairRefitProposal {target:StairTarget;landingOutline:PlanPoint[];landingOutlines:PlanPoint[][];landingMinIn:number;landingMaxIn:number;totalRiseIn:number;riseIn:number;runIn:number}
export interface StairRefitPreview {status:'ready'|'pending';patch:Partial<DeckData>;summary:string[];warnings:string[];proposals:StairRefitProposal[]}
const area=(p:PlanPoint[][])=>p.reduce((n,q)=>n+Math.abs(signedArea(q)),0);
const footprint=(b:Box):PlanPoint[]=>{if(b.polygon)return b.polygon;const c=Math.cos(b.angle??0),s=Math.sin(b.angle??0);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:b.x+c*u*b.w/2+s*v*b.d/2,y:b.z-s*u*b.w/2+c*v*b.d/2}));};
const group=(model:DeckTakeoff,id:string)=>model.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===id);
/** Read-only proposal. A saved target is changed only by applying the returned
 * patch through the existing revision-guarded controller/history workflow. */
export function previewStairRefit(data:DeckData,options:StairRefitOptions={}):StairRefitPreview {
 const pending=(...warnings:string[]):StairRefitPreview=>({status:'pending',patch:{},summary:[],warnings,proposals:[]});
 const depth=options.landingDepthIn??36,tolerance=options.maxLandingVariationIn??STAIR_TARGET_LIMITS.landingVariationIn;
 if(!Number.isFinite(depth)||depth<36||depth>120||!Number.isFinite(tolerance)||tolerance<0||tolerance>.5)return pending('Use a landing depth of 36–120 inches and a level-fit tolerance no greater than ½ inch.');
 const initial=buildDeckTakeoff(data),poolExclusions=getPoolModels(data,initial).flatMap(p=>p.permanentExclusionFootprints),ids=[...new Set(initial.flights.filter(f=>f.kind==='grade').map(f=>stairTargetId(f.id)))];
 if(!ids.length)return pending('Add a grade stair flight before requesting a refit.');
 if(options.flightId&&!ids.includes(options.flightId))return pending('The requested stair flight is no longer present. Read the current flight target IDs.');
 if(options.surface!==undefined&&!['terrain','patio'].includes(options.surface))return pending('Choose proposed terrain or a current patio landing surface.');
 const selected=options.flightId?[options.flightId]:ids,surfaceKind=options.surface??'terrain',patio=surfaceKind==='patio'?data.yardFeatures?.find(f=>f.id===options.patioId&&f.kind==='patio'&&f.enabled):undefined;
 if(surfaceKind==='patio'&&!patio)return pending('Choose an enabled patio before requesting a finished-surface stair refit.');
 const patioModel=patio?buildYardModel(data,initial).features.find(f=>f.config.id===patio.id):undefined;
 if(patio&&(!patioModel||patioModel.excluded||!patioModel.footprints.length))return pending('The selected patio has no supported finished footprint. Resolve its coverage or overlaps before fitting a landing.');
 const measured=data.siteModel?createSiteSurface(data.siteModel,getTerrainConfig(data)):undefined;
 const extremes=(polygons:PlanPoint[][])=>{
  if(patio){const missing=area(polygonCut(polygons,patioModel!.footprints,true)),grade=patio.finishedElevationIn!==undefined?0:sampleSiteHeight(data,patio.xFt*12,patio.zFt*12);if(missing>.01||!Number.isFinite(grade))return {complete:false,min:null,max:null};const plane=patioTopPlane(patio,grade!);const values=polygons.flat().map(p=>planeAt(plane,p.x,p.y));return {complete:true,min:Math.min(...values),max:Math.max(...values)};}
  if(measured){const range=measured.extrema(polygons,'proposed');return {complete:range.complete,min:range.min,max:range.max};}
  const values=polygons.flat().map(p=>sampleSiteHeight(data,p.x,p.y)!);return {complete:values.every(Number.isFinite),min:Math.min(...values),max:Math.max(...values)};
 };
 const proposals:StairRefitProposal[]=[],warnings:string[]=[];let draft=data;
 for(const id of selected){
  const oldFlights=group(initial,id),upper=Math.max(...oldFlights.map(f=>f.start.y)),oldCount=id==='grade-path'?Math.max(...oldFlights.map(f=>f.risers)):oldFlights.reduce((n,f)=>n+f.risers,0),going=data.stairTargets?.find(t=>t.flightId===id)?.treadDepthIn??data.stairTreadDepthIn??initial.stairSupport.runIn;
  if(going<10||going>24)return pending('The current tread going cannot be preserved within the supported 10–24 inch target range.');
  const counts=Array.from({length:28},(_,i)=>i+1).sort((a,b)=>Math.abs(a-oldCount)-Math.abs(b-oldCount)||a-b),failures=new Set<string>();let found:StairRefitProposal|undefined;
  for(const n of counts){
   if(id==='grade-path'&&n>14)continue;
   const seedRange=extremes(stairLandingPolygons(initial,id,depth));if(!seedRange.complete||seedRange.min===null||seedRange.max===null){failures.add('The complete landing footprint is not covered by the selected measured terrain or finished patio.');break;}
   const seed=(seedRange.min+seedRange.max)/2,target:StairTarget={flightId:id,elevationIn:seed,riserCount:n,treadDepthIn:going,surface:surfaceKind,...(patio?{patioId:patio.id}:{})},targets=[...(draft.stairTargets??[]).filter(t=>t.flightId!==id),target],candidate={...draft,stairTargets:targets},model=buildDeckTakeoff(candidate),flights=group(model,id);
   if(!flights.length){failures.add('The stair layout cannot produce this target; revise its path, opening or landing arrangement.');continue;}
   const polygons=stairLandingPolygons(model,id,depth),range=extremes(polygons);
   if(poolExclusions.length&&area(polygonCut(polygons,poolExclusions))>.001){failures.add('The complete landing footprint intersects a pool opening, shell or coping. Move the pool or stair before fitting this landing.');continue;}
   if(!range.complete||range.min===null||range.max===null){failures.add('The complete proposed landing footprint is outside the selected surface coverage.');continue;}
   if(range.max-range.min>tolerance+1e-6){failures.add('The landing surface varies too much for this equal-riser fit. Grade a level landing or select a compatible finished patio surface.');continue;}
   target.elevationIn=(range.min+range.max)/2;const rise=(upper-target.elevationIn)/n;
   if(rise<STAIR_TARGET_LIMITS.minRiseIn-1e-7||rise>STAIR_TARGET_LIMITS.maxRiseIn+1e-7){failures.add('No equal-riser count fits the fixed upper deck and selected landing elevation within the supported rise range.');continue;}
   const finalModel=buildDeckTakeoff({...candidate,stairTargets:[...targets.filter(t=>t.flightId!==id),target]}),finalFlights=group(finalModel,id),stairs=finalModel.treads.filter(b=>b.flightId===id),house=getHouseBlocks(data),otherDecks=finalModel.levels.filter(l=>l.kind==='deck').map(l=>({top:l.top,outline:l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))}));
   const planCollision=stairs.some(b=>house.some(h=>area(polygonCut([footprint(b)],[rectPolygon(h.rect)]))>1)||otherDecks.some(l=>Math.abs(l.top-(b.y+b.h/2))<24&&area(polygonCut([footprint(b)],[l.outline]))>1));
   const poolCollision=poolExclusions.length&&stairs.some(b=>area(polygonCut([footprint(b)],poolExclusions))>.001);
   const groundCollision=stairs.some(b=>{const p=footprint(b),r=measured?.extrema([p],'proposed');if(r&&!r.complete)return true;const highest=r?.max??Math.max(...p.map(v=>sampleSiteHeight(data,v.x,v.y)!));return !Number.isFinite(highest)||highest>b.y-b.h/2+.25;});
   const landingSupportPending=finalModel.foundationSupports.some(f=>finalModel.levels[f.levelIndex].kind!=='deck'&&f.status!=='modeled');
   const layoutCollision=finalModel.issues.some(v=>/stair (wrap )?runs into|stair path needs|stair.*opening.*wide/i.test(v));
   if(planCollision||poolCollision||groundCollision||layoutCollision||landingSupportPending){failures.add('The refitted treads collide with the house, pool, another deck level or proposed ground, or the intermediate landing support needs coverage or clearance.');continue;}
   const inconsistent=finalFlights.some(f=>Math.abs(f.rise-rise)>1e-6)||Math.abs(Math.min(...finalFlights.map(f=>f.end.y))-target.elevationIn)>1e-6;
   if(inconsistent){failures.add('This stair arrangement cannot retain the proposed common rise and termination.');continue;}
   found={target,landingOutline:polygons[0],landingOutlines:polygons,landingMinIn:range.min,landingMaxIn:range.max,totalRiseIn:upper-target.elevationIn,riseIn:rise,runIn:(n-1)*going};break;
  }
  if(!found)return pending(...failures.size?[...failures]:['No feasible stair refit was found. Review the stair layout and landing surface.']);
  proposals.push(found);draft={...draft,stairTargets:[...(draft.stairTargets??[]).filter(t=>t.flightId!==id),found.target]};
 }
 warnings.push('Planning refit only: confirm the full landing, permitted rise/going, stringer throat, footing bearing and connections before construction.');
 if(data.stairType==='Winder'||data.stairPath)warnings.push('Winder and wrapped tread mitres, corner supports and landing connections retain their construction review requirements.');
 return {status:'ready',patch:{stairTargets:draft.stairTargets},proposals,summary:proposals.map(p=>`${p.target.flightId}: ${p.target.riserCount} equal risers at ${p.riseIn.toFixed(2)} in to ${p.target.elevationIn.toFixed(2)} in datum; ${p.target.treadDepthIn.toFixed(2)} in going.`),warnings};
}
