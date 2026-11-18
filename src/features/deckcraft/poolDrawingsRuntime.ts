import {isObjectVisible} from './editorOrganization';
import {poolRenderMeshes,poolMeshSection} from './poolRenderMeshes';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {DrawItem,Pt,LayerId} from './drawings/drawingTypes';
import {getPoolModels} from './poolModel';
import {poolLocalBounds,poolWorldPoint} from './poolGeometry';
import {elevationLabel,ELEVATION_DATUM} from './elevationDatum';
import {profileEdgeBreaks} from './elevationProfiles';
import {buildElevationProfile} from './elevationProfiles';
import {registerPoolDrawingsRuntime} from './poolDrawings';
const inside=(q:Pt,p:Pt[])=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(Math.abs((q.x-a.x)*(b.y-a.y)-(q.y-a.y)*(b.x-a.x))<1e-7&&q.x>=Math.min(a.x,b.x)-1e-7&&q.x<=Math.max(a.x,b.x)+1e-7&&q.y>=Math.min(a.y,b.y)-1e-7&&q.y<=Math.max(a.y,b.y)+1e-7)return true;if((a.y>q.y)!==(b.y>q.y)&&q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
const point=(a:Pt,b:Pt,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function poolPlanDrawingItems(data:DeckData,deck:DeckTakeoff):DrawItem[]{
 const items:DrawItem[]=[];
 for(const m of getPoolModels(data,deck).filter(p=>isObjectVisible(data.editorOrganization,p.config.id))){
  for(const [polys,layer] of [[m.openingFootprints,'C-FNSH'],[m.structureFootprints,'C-FORM'],[m.copingFootprints,'C-FNSH'],[m.excavationFootprints,'C-FORM']] as const)for(const poly of polys)items.push({kind:'poly',closed:true,points:poly,layer});
  const p=m.config,b=poolLocalBounds(p),midX=(b.minX+b.maxX)/2;
  items.push({kind:'text',at:{x:p.xIn,y:p.zIn},text:`${p.name} · ${p.type} · ${m.status.toUpperCase()}`,height:.09,anchor:'middle',layer:'A-ANNO-TEXT'});
  for(const [i,d] of p.depthProfile.entries()){const q=poolWorldPoint(p,{x:midX,y:b.minZ+d.stationIn});if(!m.openingFootprints.some(poly=>inside(q,poly)))continue;items.push({kind:'text',at:q,text:`floor ${elevationLabel(m.waterElevationIn-d.depthIn)} / water ${elevationLabel(m.waterElevationIn)} / coping ${elevationLabel(m.copingTopElevationIn)}`,height:.06,anchor:'start',layer:'A-ANNO-TEXT'});if(i===0||i===p.depthProfile.length-1)items.push({kind:'circle',c:q,r:2,layer:'C-FNSH'});}
  const a=poolWorldPoint(p,{x:midX,y:b.minZ-24}),z=poolWorldPoint(p,{x:midX,y:b.maxZ+24});items.push({kind:'line',a,b:z,layer:'A-ANNO-DIMS'},{kind:'text',at:a,text:`POOL ${p.name}: longitudinal section start`,height:.07,anchor:'start',layer:'A-ANNO-TEXT'});
  for(const t of p.serviceTrenches??[])items.push({kind:'poly',closed:false,points:t.points,layer:'C-FORM'},{kind:'text',at:t.points[0],text:`${t.service} trench · ${(t.depthIn).toFixed(2)} in below local ground`,height:.06,anchor:'start',layer:'A-ANNO-TEXT'});
 }
 return items;
}
/** Reference sections intersect each physical prism and retain depth/profile breaks.
 * Actual terrain remains whole for ground reporting; no opening fills a coverage gap. */
export function poolSectionDrawingItems(data:DeckData,deck:DeckTakeoff,origin:Pt):DrawItem[]{
 const items:DrawItem[]=[];let row=origin.y;
 for(const m of getPoolModels(data,deck).filter(p=>isObjectVisible(data.editorOrganization,p.config.id))){
  const p=m.config,b=poolLocalBounds(p),meshes=poolRenderMeshes(m);
  for(const axis of ['longitudinal','across'] as const){
   const a=poolWorldPoint(p,axis==='longitudinal'?{x:(b.minX+b.maxX)/2,y:b.minZ-24}:{x:b.minX-24,y:(b.minZ+b.maxZ)/2}),z=poolWorldPoint(p,axis==='longitudinal'?{x:(b.minX+b.maxX)/2,y:b.maxZ+24}:{x:b.maxX+24,y:(b.minZ+b.maxZ)/2}),length=Math.hypot(z.x-a.x,z.y-a.y),segment={a,b:z},levels=m.solids.flatMap(s=>s.polygon.flatMap(q=>[s.topPlane.x*q.x+s.topPlane.z*q.y+s.topPlane.constant,s.bottomPlane.x*q.x+s.bottomPlane.z*q.y+s.bottomPlane.constant])),low=Math.min(0,...levels)-12,high=Math.max(0,m.copingTopElevationIn,...levels)+12,baseline=row+high;
   const line=(x0:number,x1:number,y0:number,y1:number,layer:LayerId)=>items.push({kind:'line',a:{x:origin.x+x0,y:baseline-y0},b:{x:origin.x+x1,y:baseline-y1},layer});
   items.push({kind:'text',at:{x:origin.x,y:row-20},text:`${p.name} · ${axis} · ${m.status.toUpperCase()} · ${ELEVATION_DATUM}`,height:.09,anchor:'start',layer:'A-ANNO-TEXT'});
   for(const mesh of meshes){const layer=mesh.role==='water'?'C-PGRD':mesh.role==='base'||mesh.role==='backfill'?'C-FORM':'C-FNSH';for(const span of poolMeshSection(mesh,a,z))line(span.a.stationIn,span.b.stationIn,span.a.elevationIn,span.b.elevationIn,layer);}
   const grade=buildElevationProfile(data,{id:`pool-${p.id}-${axis}`,name:p.name,segments:[segment]});
   for(const [key,layer] of [['existingIn','C-EXST'],['proposedIn','C-PGRD']] as const){let previous:typeof grade.points[number]|undefined;for(const q of grade.points){if(q[key]===null){previous=undefined;continue;}if(previous&&previous[key]!==null)line(previous.stationIn,q.stationIn,previous[key]!,q[key]!,layer);previous=q;}}
   const breaks=[0,1,...m.formationRegions.flatMap(r=>r.polygon.flatMap((q,i)=>profileEdgeBreaks(segment,q,r.polygon[(i+1)%r.polygon.length])))].sort((u,v)=>u-v);
   for(const r of m.formationRegions)for(let i=0;i+1<breaks.length;i++){const u=breaks[i],v=breaks[i+1];if(v-u<1e-8||!inside(point(a,z,(u+v)/2),r.polygon))continue;const qa=point(a,z,u),qb=point(a,z,v),h=(q:Pt)=>r.formationPlane.x*q.x+r.formationPlane.z*q.y+r.formationPlane.constant;line(u*length,v*length,h(qa),h(qb),'C-FORM');}
   const label=`Coping ${elevationLabel(m.copingTopElevationIn)} · water ${elevationLabel(m.waterElevationIn)} · depth ${p.depthProfile.map(d=>d.depthIn.toFixed(2)).join(' / ')} in BELOW WATER`;
   items.push({kind:'text',at:{x:origin.x,y:baseline-low+18},text:label,height:.08,anchor:'start',layer:'A-ANNO-TEXT'});row+=high-low+80;
  }
  for(const note of new Set([...m.warnings,...m.pending])){items.push({kind:'text',at:{x:origin.x,y:row},text:`${p.name}: ${note}`,height:.07,anchor:'start',layer:'A-ANNO-TEXT'});row+=20;}
  row+=24;
 }
 return items;
}
registerPoolDrawingsRuntime({poolPlanDrawingItems,poolSectionDrawingItems});
