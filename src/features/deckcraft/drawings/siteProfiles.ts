import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {buildYardModel} from '../yardModel';
import {buildElevationProfile,elevationProfileSpecs,ELEVATION_DATUM,elevationLabel,profileSegmentPoint} from '../elevationProfiles';
import type {DrawItem,Pt,LayerId} from './drawingTypes';
import {siteContours} from '../siteContours';
import {createSiteSurface} from '../siteSurface';
import {getTerrainConfig} from '../yardSettings';
import {yardShapeCurveWorldPoints} from '../yardShapeGeometry';
import {yardSurfaceIn} from '../yardElevations';
import {usesPhysicalElevations} from '../elevationDatum';
export function siteElevationPlanItems(data:DeckData,deck:DeckTakeoff):DrawItem[]{
 if(!usesPhysicalElevations(data))return [];const surface=data.siteModel?createSiteSurface(data.siteModel,getTerrainConfig(data)):undefined,items:DrawItem[]=[];
 if(surface)for(const [kind,triangles,layer] of [['existing',surface.existingTriangles,'C-EXST'],['proposed',surface.proposedTriangles,'C-PGRD']] as const){const contours=siteContours(triangles);for(const c of contours.lines)items.push({kind:'line',a:c.a,b:c.b,layer});for(const a of contours.arrows){const b={x:a.x+a.dx*18,y:a.y+a.dy*18};items.push({kind:'line',a:{x:a.x,y:a.y},b,layer},{kind:'text',at:b,text:`${kind} ${a.slopePct.toFixed(1)}% fall`,layer:'A-ANNO-TEXT',height:.06,anchor:'start'});}for(const low of contours.lowPoints)items.push({kind:'text',at:{x:low.xIn,y:low.zIn},text:`${kind} low ${elevationLabel(low.elevationIn)}`,layer:'A-ANNO-TEXT',height:.06,anchor:'start'});}
 for(const p of data.siteModel?.points??[])items.push({kind:'text',at:{x:p.xIn,y:p.zIn},text:`EG ${elevationLabel(p.elevationIn)} / PG ${elevationLabel(surface?.sample(p.xIn,p.zIn))}`,layer:'A-ANNO-TEXT',height:.06,anchor:'start'});
 for(const f of data.yardFeatures??[]){if(!f.enabled||f.kind==='water-feature')continue;items.push({kind:'poly',closed:f.kind==='patio',points:yardShapeCurveWorldPoints(f),layer:'C-FNSH'},{kind:'text',at:{x:f.xFt*12,y:f.zFt*12},text:`${f.name} ${f.kind==='retaining-wall'&&f.wallTopSteps?.length?'reference cap':'finished'} ${elevationLabel(yardSurfaceIn(data,f))}${f.kind==='patio'?` · local X ${f.patioSlope?.xPct??0}% / Z ${f.patioSlope?.zPct??0}%`:''}`,layer:'A-ANNO-TEXT',height:.08,anchor:'middle'});}
 elevationProfileSpecs(data,deck).filter(s=>!s.poolRef).forEach((s,i)=>{for(const segment of s.segments){const count=segment.bulgeIn?64:1,points=Array.from({length:count+1},(_,k)=>profileSegmentPoint(segment,k/count));items.push({kind:'poly',points,closed:false,layer:'A-ANNO-DIMS'});}const p=s.segments[0]?.a;if(p)items.push({kind:'text',at:p,text:`${i+1}/A-2 section start`,layer:'A-ANNO-TEXT',height:.06,anchor:'start'});});return items;
}
export function siteProfileDrawingItems(data:DeckData,deck:DeckTakeoff,origin:Pt):DrawItem[]{
 const yard=buildYardModel(data,deck),items:DrawItem[]=[],specs=elevationProfileSpecs(data,deck).filter(s=>!s.poolRef);let y=origin.y;
 items.push({kind:'text',at:{x:origin.x,y},text:ELEVATION_DATUM,layer:'A-ANNO-TEXT',height:.09,anchor:'start'});y+=36;
 specs.forEach((spec,index)=>{const profile=buildElevationProfile(data,spec,yard),values=[...profile.points.flatMap(p=>[p.existingIn,p.proposedIn,p.finishedIn,p.formationIn]),...profile.solids?.flatMap(s=>[s.bottomIn,s.topIn])??[]].filter((v):v is number=>v!==null),lo=Math.min(0,...values)-12,hi=Math.max(0,...values)+18,height=hi-lo,top=y+hi;
  items.push({kind:'text',at:{x:origin.x,y:y-12},text:`${index+1}/A-2 ${spec.name} · true-scale height / chainage${profile.complete?'':' · GAPS: COVERAGE PENDING'}`,layer:'A-ANNO-TEXT',height:.09,anchor:'start'},{kind:'line',a:{x:origin.x,y:top},b:{x:origin.x+profile.lengthIn,y:top},layer:'A-ANNO-DIMS'});
  for(const solid of profile.solids??[])items.push({kind:'poly',closed:true,points:[{x:origin.x+solid.startIn,y:top-solid.topIn},{x:origin.x+solid.endIn,y:top-solid.topIn},{x:origin.x+solid.endIn,y:top-solid.bottomIn},{x:origin.x+solid.startIn,y:top-solid.bottomIn}],layer:solid.role==='stone-step'?'C-FNSH':'C-FORM'});
  for(const [key,layer] of [['existingIn','C-EXST'],['proposedIn','C-PGRD'],['finishedIn','C-FNSH'],['formationIn','C-FORM']] as const){let previous:typeof profile.points[number]|undefined;for(const p of profile.points){if(p[key]===null){previous=undefined;continue;}if(previous&&previous[key]!==null)items.push({kind:'line',a:{x:origin.x+previous.stationIn,y:top-previous[key]!},b:{x:origin.x+p.stationIn,y:top-p[key]!},layer:layer as LayerId});previous=p;}}
  for(const [endpoint,p] of [profile.points[0],profile.points.at(-1)].entries())if(p)items.push({kind:'text',at:{x:origin.x,y:y+height+15+endpoint*22},text:`${endpoint?'End':'Start'} ${(p.stationIn/12).toFixed(2)} ft · EG ${elevationLabel(p.existingIn)} / PG ${elevationLabel(p.proposedIn)} / finish ${elevationLabel(p.finishedIn)}`,layer:'A-ANNO-TEXT',height:.09,anchor:'start'});y+=height+100;
 });return items;
}
