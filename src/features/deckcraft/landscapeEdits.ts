import './landscapeTypesRuntime';
import './landscapeModelRuntime';
import type {DeckData} from './types';
import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
import {validateLandscapeObjects} from './landscapeTypes';
import {assertUnlockedChanges,assertUniqueObjectIds,isObjectLocked} from './editorOrganization';
import {activePuttingCups,landscapeBedAreas,landscapePlacement} from './landscapeModelRuntime';
import {landscapeStructureExclusions,landscapeClip,landscapeConnected} from './landscapeFill';
import {reframeLandscape,convertLandscapeOutline,landscapeOutlinePaths,landscapeLocal,landscapeWorld,insideLandscapeRing,landscapeSignedArea,editLandscapeHandle,splitLandscapeSegment,landscapeSegmentKind,presetLandscapeOutline,resizeLandscape,simplifyLandscapeStroke,type LandscapeHandle,type LandscapePreset,type LandscapeSegment} from './landscapeOutline';
import {puttingCupWorld} from './landscapeSurfaces';
import {arcGeometry,bulgeForRadius} from './circularArcs';
export type LandscapeEdit=
 |{action:'create';object:LandscapeObject}|{action:'patch';patch:Partial<LandscapeObject>}|{action:'delete'}|{action:'convert'}
 |{action:'preset';preset:LandscapePreset;widthIn?:number;depthIn?:number}
 |{action:'handle';handle:LandscapeHandle;point:LandscapePoint}
 |{action:'split'|'remove-point';ring:number;index:number}|{action:'segment';ring:number;index:number;kind:LandscapeSegment['kind']}
 |{action:'radius';ring:number;index:number;radiusIn:number;side?:number}
 |{action:'resize';widthIn:number;depthIn:number;convertArcs?:boolean}
 |{action:'round';radiusIn:number}
 |{action:'freehand';points:LandscapePoint[];smoothingIn:number}
 |{action:'fill';point:LandscapePoint;container?:LandscapePoint[]};
/** An unrelated existing conflict remains pending; an edit cannot introduce a new one. */
export function assertLandscapePlacements(before:DeckData,after:DeckData){
 const oldAreas=landscapeBedAreas(before.landscapeObjects??[],before),nextAreas=landscapeBedAreas(after.landscapeObjects??[],after);
 for(const o of after.landscapeObjects?.filter(o=>o.enabled)??[]){const old=before.landscapeObjects?.find(p=>p.id===o.id&&p.enabled);
  if(o.kind==='bed'){
   const valid=new Set(activePuttingCups(o,nextAreas.get(o.id)??[])),priorValid=new Set(old?activePuttingCups(old,oldAreas.get(old.id)??[]):[]),priorConflicts=old?(old.puttingCups??[]).filter(p=>!priorValid.has(p)).map(p=>puttingCupWorld(old,p)):[];
   // Counts alone miss a newly covered cup when another is uncovered, and reject explicit removals.
   for(const cup of o.puttingCups??[])if(!valid.has(cup)){const p=puttingCupWorld(o,cup);if(!priorConflicts.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1e-6))throw Error(`${o.name}: a cup intersects an excluded surface. Adjust or remove the cup explicitly.`);}
  }
  else{const next=landscapePlacement(after,o),prior=old&&landscapePlacement(before,old);if(next.pendingReason&&next.pendingReason!==prior?.pendingReason)throw Error(`${o.name}: ${next.pendingReason}`);}
 }
}
export function applyLandscapeEdit(data:DeckData,id:string,edit:LandscapeEdit):Pick<DeckData,'landscapeObjects'>{
 assertUniqueObjectIds(data);let objects=data.landscapeObjects??[],old=objects.find(o=>o.id===id),next=old;
 if(edit.action==='create'){if(old||[...(data.yardFeatures??[]),...(data.pools??[]),...(data.siteModel?.transitions??[])].some(o=>o.id===id))throw Error('Choose a unique object identifier.');if(edit.object.id!==id)throw Error('Object identity must match the target.');next=edit.object;objects=[...objects,next];}
 else{
  if(!old)throw Error('Select a current landscape object.');if(isObjectLocked(data.editorOrganization,id))throw Error(`${old.name} is locked. Unlock it or its layer before editing.`);
  if(edit.action==='delete')objects=objects.filter(o=>o.id!==id);
  else if(edit.action==='patch'){if(edit.patch.id!==undefined&&edit.patch.id!==id)throw Error('Object identity cannot change.');next={...old,...edit.patch};}
  else if(edit.action==='convert')next=convertLandscapeOutline(old);
  else{
   if(old.kind!=='bed')throw Error('Shape controls apply to landscape areas.');next=structuredClone(convertLandscapeOutline(old));
   if(edit.action==='preset'){const width=edit.widthIn??old.widthIn,depth=edit.preset==='circle'?width:edit.depthIn??old.depthIn;next={...next,widthIn:width,depthIn:depth,outline:presetLandscapeOutline(edit.preset,width,depth),groundCoverOnly:true};delete next.fillSeed;}
   else if(edit.action==='handle'){next=editLandscapeHandle(next,edit.handle,edit.point);if(edit.handle.part!=='cup')delete next.fillSeed;}
   else if(edit.action==='resize')next=resizeLandscape(next,edit.widthIn,edit.depthIn,edit.convertArcs);
   else if(edit.action==='freehand'){if(!Number.isFinite(edit.smoothingIn)||edit.smoothingIn<.1||edit.smoothingIn>24)throw Error('Smoothing must be between 0.1 and 24 inches.');const ring=simplifyLandscapeStroke(edit.points.map(p=>landscapeLocal(next!,p)),edit.smoothingIn);next.outline={outer:ring,holes:[]};next.groundCoverOnly=true;delete next.fillSeed;}
   else if(edit.action==='fill'){
    const boundary=edit.container??data.siteModel?.boundary.map(p=>({x:p.x,z:p.y}));if(!boundary)throw Error('Trace a closed container or site boundary before filling.');
    const obstacles=[...landscapeStructureExclusions(data),...objects.filter(o=>o.id!==id&&o.kind==='bed'&&o.enabled).flatMap(landscapeOutlinePaths)],p=boundary.map(p=>({...p}));if(landscapeSignedArea(p)<0)p.reverse();
    const available=landscapeConnected(landscapeClip([p],obstacles,'difference'),edit.point);if(!available.length)throw Error('Choose open ground inside a closed boundary, away from existing surfaces.');
    const points=p.map(p=>landscapeLocal(next!,p));next.outline={outer:{points,segments:points.map(()=>({kind:'line'}))},holes:[]};next.groundCoverOnly=true;next.fillSeed=landscapeLocal(next,edit.point);
   }else if(edit.action==='round'){
    const r=next.outline!.outer;if(r.segments.some(s=>s.kind!=='line'))throw Error('Round corners on a straight outline, or edit an existing curve.');if(!Number.isFinite(edit.radiusIn)||edit.radiusIn<=0)throw Error('Enter a positive corner radius.');const points:LandscapePoint[]=[],segments:LandscapeSegment[]=[];
    for(let i=0;i<r.points.length;i++){const a=r.points[(i+r.points.length-1)%r.points.length],b=r.points[i],c=r.points[(i+1)%r.points.length],u={x:a.x-b.x,z:a.z-b.z},v={x:c.x-b.x,z:c.z-b.z},la=Math.hypot(u.x,u.z),lb=Math.hypot(v.x,v.z),angle=Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.z*v.z)/(la*lb)))),t=edit.radiusIn/Math.tan(angle/2);if(t>=Math.min(la,lb)/2)throw Error('Radius is too large for adjacent edges.');const start={x:b.x+u.x*t/la,z:b.z+u.z*t/la},end={x:b.x+v.x*t/lb,z:b.z+v.z*t/lb},sign=Math.sign(u.x*v.z-u.z*v.x);points.push(start,end);segments.push({kind:'arc',bulgeIn:sign*edit.radiusIn*(1-Math.cos((Math.PI-angle)/2))},{kind:'line'});}next.outline!.outer={points,segments};delete next.fillSeed;
   }else{
    const r=edit.ring===0?next.outline!.outer:next.outline!.holes[edit.ring-1];if(!r?.points[edit.index])throw Error('Choose a current edge or point.');let ring=r;
    if(edit.action==='split')ring=splitLandscapeSegment(r,edit.index);
    else if(edit.action==='segment')ring=landscapeSegmentKind(r,edit.index,edit.kind);
    else if(edit.action==='radius'){const a=r.points[edit.index],b=r.points[(edit.index+1)%r.points.length];ring=structuredClone(r);ring.segments[edit.index]={kind:'arc',bulgeIn:bulgeForRadius({x:a.x,y:a.z},{x:b.x,y:b.z},edit.radiusIn,edit.side??-1)};}
    else if(edit.action==='remove-point'){if(r.points.length<=3)throw Error('Keep at least three points.');ring=structuredClone(r);ring.points.splice(edit.index,1);ring.segments.splice(edit.index,1);ring.segments[(edit.index+ring.segments.length-1)%ring.segments.length]={kind:'line'};}
    if(edit.ring===0)next.outline!.outer=ring;else next.outline!.holes[edit.ring-1]=ring;delete next.fillSeed;
   }
  }
  if(next&&['handle','split','remove-point','segment','radius','round','freehand','fill'].includes(edit.action)&&!(edit.action==='handle'&&edit.handle.part==='cup'))next=reframeLandscape(next);
  if(edit.action!=='delete')objects=objects.map(o=>o.id===id?next!:o);
 }
 if(next?.outline){const p=landscapeOutlinePaths(next).flat();if(p.some(v=>Math.abs(v.x)>120000||Math.abs(v.z)>120000))throw Error('Outline exceeds the project coordinate limits.');}
 if(!validateLandscapeObjects(objects))throw Error('Check dimensions, curves, holes and cup positions. Curves cannot cross; cups must stay inside the green and away from its holes.');
 const proposed={...data,landscapeObjects:objects};assertUnlockedChanges(data,proposed);
 if(edit.action!=='delete'&&next?.enabled){if(next.kind==='bed'){const remaining=landscapeBedAreas(objects,proposed).get(id)??[];if(activePuttingCups(next,remaining).length!==(next.puttingCups??[]).length)throw Error('A cup is outside the remaining green or intersects a structure. Move or remove it explicitly.');}else{const placement=landscapePlacement(proposed,next);if(placement.pendingReason)throw Error(placement.pendingReason);}}
 return {landscapeObjects:objects};
}
