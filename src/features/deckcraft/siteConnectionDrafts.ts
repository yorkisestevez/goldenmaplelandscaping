import type {DeckData} from './types';
import type {TransitionBoundary,SiteGradingTransition} from './siteModel';
import type {GradeDiscontinuity} from './siteElevationChecks';
import type {SiteSurface,SitePlane} from './siteSurface';
import {sitePlaneHeight} from './siteSurface';
import {yardShapeLocalPoints,yardShapeWorldPoint} from './yardShapeGeometry';
import {patioTopPlane} from './yardElevationGeometry';
import {transitionBoundaryLength,transitionBoundaryPoint} from './gradingTransitionGeometry';
import {arcGeometry} from './circularArcs';
import {poolWorldPoint} from './poolGeometry';
import {isObjectVisible} from './editorOrganization';
import type {YardFeatureModel} from './yardModel';

export interface SiteConnectionBoundary {id:string;name:string;boundary:TransitionBoundary;note:string;problem?:string}
function levelCount(points:TransitionBoundary['points'],plane:SitePlane,bulgeIn?:number){if(!bulgeIn||!Math.hypot(plane.x,plane.z))return 1;const g=arcGeometry(points[0],points[1],bulgeIn);return Math.max(1,Math.ceil(g.sweep*Math.sqrt(g.radius*Math.hypot(plane.x,plane.z)/.008)));}
function specified(points:TransitionBoundary['points'],plane:SitePlane,bulgeIn?:number):TransitionBoundary {
 const b:TransitionBoundary={points,elevationSource:'specified',...(bulgeIn?{curves:[{edge:0,bulgeIn}]}:{})};
 const length=transitionBoundaryLength(b);
 // A sloped circular boundary varies with world X/Z, not linearly in chainage.
 const count=Math.min(127,levelCount(points,plane,bulgeIn));b.levels=Array.from({length:count+1},(_,i)=>i/count).map(f=>{const p=transitionBoundaryPoint(b,f);return {stationIn:f*length,elevationIn:sitePlaneHeight(plane,p.x,p.y)};});
 return b;
}
/** Finished boundaries are copied as explicit station levels. They never drive
 * an automatic object-level change or establish unmeasured survey coverage. */
export function siteConnectionBoundaries(data:DeckData,surface:SiteSurface,yard:YardFeatureModel[]=[]):SiteConnectionBoundary[]{
 const out:SiteConnectionBoundary[]=[];
 const edges=(id:string,name:string,points:TransitionBoundary['points'],source:'existing'|'proposed')=>points.forEach((a,i)=>out.push({id:`${id}:${i}`,name:`${name} · edge ${i+1}`,boundary:{points:[{...a},{...points[(i+1)%points.length]}],elevationSource:source},note:'Ground levels come from the entered site before transitions.'}));
 if(data.siteModel?.boundary)edges('site','Existing site boundary',data.siteModel.boundary,'existing');
 for(const g of data.siteModel?.grading??[])edges(`grading:${g.id}`,g.name,g.boundary,'proposed');
 for(const f of data.yardFeatures??[]){
  if(!f.enabled||!isObjectVisible(data.editorOrganization,f.id))continue;
  if(f.kind==='patio'&&!f.stoneSteps&&!f.stepAssembly){
   const grade=surface.sample(f.xFt*12,f.zFt*12);if(f.finishedElevationIn===undefined&&grade===undefined)continue;
   const p=yardShapeLocalPoints(f),plane=patioTopPlane(f,grade??0);
   p.forEach((a,i)=>{const points=[yardShapeWorldPoint(f,a),yardShapeWorldPoint(f,p[(i+1)%p.length])],bulge=f.curves?.find(c=>c.edge===i)?.bulgeIn;out.push({id:`${f.id}:${i}`,name:`${f.name} · finished edge ${i+1}`,boundary:specified(points,plane,bulge),...(levelCount(points,plane,bulge)>127?{problem:'Split this sloped circular edge into shorter paths to stay within 128 elevation stations and 0.001-inch interpolation error.'}:{}),note:f.finishedElevationIn===undefined?'Legacy surface levels are captured for this draft.':'Fixed finished levels are preserved. Ground contact is an explicit design choice.'});});
  }
  if(f.kind==='retaining-wall'){
   const controls=yardShapeLocalPoints(f),grade=surface.sample(f.xFt*12,f.zFt*12),reference=f.finishedElevationIn??(grade===undefined?NaN:grade+(f.baseElevationIn??0)+f.heightIn);let station=0;
   controls.slice(0,-1).forEach((p,i)=>{const q=controls[i+1],curve=f.curves?.find(c=>c.edge===i),segment:TransitionBoundary={points:[yardShapeWorldPoint(f,p),yardShapeWorldPoint(f,q)],elevationSource:'proposed',...(curve?{curves:[{edge:0,bulgeIn:curve.bulgeIn}]}:{})},length=transitionBoundaryLength(segment),cuts=[0,...(f.wallTopSteps??[]).filter(s=>s.stationIn>station+1e-7&&s.stationIn<station+length-1e-7).map(s=>(s.stationIn-station)/length),1];
    for(let j=0;j+1<cuts.length;j++){const u=cuts[j],v=cuts[j+1],top=[...(f.wallTopSteps??[])].reverse().find(s=>s.stationIn<=station+u*length+1e-7)?.elevationIn??reference;if(!Number.isFinite(top))continue;const a=transitionBoundaryPoint(segment,u),b=transitionBoundaryPoint(segment,v),g=curve?arcGeometry(segment.points[0],segment.points[1],curve.bulgeIn):undefined,bulge=g?Math.sign(curve!.bulgeIn)*g.radius*(1-Math.cos(g.sweep*(v-u)/2)):undefined;
     out.push({id:`${f.id}:${i}:${j}`,name:`${f.name} · cap centreline run ${i+1}.${j+1}`,boundary:specified([a,b],{x:0,z:0,constant:top},bulge),note:'Cap centreline only. Retained ground must meet the actual wall face below its structural top; do not infer a bank from this line.'});
    }station+=length;
   });
  }
  // Landings have their own authoritative dimensions and fixed elevation.
  for(const l of f.stepAssembly?.landings??[]){
   const a=l.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>yardShapeWorldPoint(f,{x:l.xIn+c*u*l.widthIn/2-s*v*l.depthIn/2,y:l.zIn+s*u*l.widthIn/2+c*v*l.depthIn/2}));
   points.forEach((p,i)=>out.push({id:`${f.id}:${l.id}:${i}`,name:`${f.name} · ${l.name} · edge ${i+1}`,boundary:specified([p,points[(i+1)%4]],{x:0,z:0,constant:l.elevationIn}),note:'Fixed landing elevation. Bearing and drainage remain recorded installation inputs.'}));
  }
  const model=yard.find(m=>m.config.id===f.id&&!m.excluded);
  const rows=new Map<string,NonNullable<typeof model>["boxes"]>();
  if(f.stoneSteps||f.stepAssembly)for(const b of model?.boxes??[]){if(b.stonePart!=="tread"&&!(b.role==="stone-step"&&!b.stonePart))continue;const key=`${b.stepFlightId??"legacy"}:${b.stepRow??0}`,list=rows.get(key)??[];list.push(b);rows.set(key,list);}
  for(const boxes of rows.values()){
   const flight=f.stepAssembly?.flights.findIndex(flight=>flight.id===boxes[0].stepFlightId)??-1,label=`${flight>=0?`Flight ${flight+1} · `:""}Row ${(boxes[0].stepRow??0)+1}`;
   // Each exposed stock edge is an actual physical edge; curves never stretch stock.
   for(const [unit,box] of boxes.entries()){const angle=-(box.angle??0),c=Math.cos(angle),s=Math.sin(angle),points=box.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:box.x+c*u*box.w/2-s*v*box.d/2,y:box.z+s*u*box.w/2+c*v*box.d/2}));
    points.forEach((p,i)=>out.push({id:`${box.id}:${i}`,name:`${f.name} · ${label} · unit ${unit+1} · edge ${i+1}`,boundary:specified([p,points[(i+1)%points.length]],box.topPlane??{x:0,z:0,constant:box.y+box.h/2}),note:'Tread edge, not an invented bottom landing. Grade must not bury the walking surface.'}));
   }
  }
 }
 for(const p of data.pools??[]){if(!p.enabled||!isObjectVisible(data.editorOrganization,p.id))continue;
  // Exact parallel line/circle offset for a single edge. Joins remain explicit.
  const offset=p.coping?p.coping.widthIn-p.coping.overhangIn:p.assembly?.wallThicknessIn??0;
  p.outline.forEach((a,i)=>{const b=p.outline[(i+1)%p.outline.length],arc=p.curves?.find(c=>c.edge===i);let points=[a,b],bulgeIn=arc?.bulgeIn;
   if(arc){const g=arcGeometry(a,b,arc.bulgeIn),radius=g.radius-Math.sign(arc.bulgeIn)*offset;if(radius<1)return;points=[a,b].map(q=>({x:g.center.x+(q.x-g.center.x)*radius/g.radius,y:g.center.y+(q.y-g.center.y)*radius/g.radius}));bulgeIn=Math.sign(arc.bulgeIn)*(radius+(Math.abs(arc.bulgeIn)>Math.hypot(b.x-a.x,b.y-a.y)/2?1:-1)*Math.sqrt(Math.max(0,radius*radius-Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)**2/4)));}
   else{const length=Math.hypot(b.x-a.x,b.y-a.y);points=[a,b].map(q=>({x:q.x+(b.y-a.y)/length*offset,y:q.y-(b.x-a.x)/length*offset}));}
   out.push({id:`${p.id}:${i}`,name:`${p.name} · outer coping edge ${i+1}`,boundary:specified(points.map(q=>poolWorldPoint(p,q)),{x:0,z:0,constant:p.copingTopElevationIn},bulgeIn),note:'Outer coping edge between joins. Transition joints, support and corner fabrication remain separate recorded inputs.'});
  });
 }
 return out;
}
export function reverseConnectionBoundary(boundary:TransitionBoundary):TransitionBoundary {
 const length=transitionBoundaryLength(boundary),count=boundary.points.length;
 return {...boundary,points:[...boundary.points].reverse().map(p=>({...p})),...(boundary.curves?{curves:boundary.curves.map(c=>({edge:count-2-c.edge,bulgeIn:-c.bulgeIn}))}:{}),...(boundary.levels?{levels:[...boundary.levels].reverse().map(l=>({stationIn:length-l.stationIn,elevationIn:l.elevationIn}))}:{})};
}
export function draftGradeConnection(jump:GradeDiscontinuity,widthIn:number,id:string):SiteGradingTransition {
 if(!Number.isFinite(widthIn)||widthIn<1||widthIn>1200)throw Error('Enter a transition width from 1 to 1200 inches.');
 const length=Math.hypot(jump.b.x-jump.a.x,jump.b.y-jump.a.y),nx=-(jump.b.y-jump.a.y)/length,ny=(jump.b.x-jump.a.x)/length;
 const side=(offset:number):TransitionBoundary=>({points:[jump.a,jump.b].map(p=>({x:p.x+nx*offset,y:p.y+ny*offset})),elevationSource:'proposed'});
 return {id,name:'Grade connection',enabled:true,a:side(widthIn/2),b:side(-widthIn/2)};
}
