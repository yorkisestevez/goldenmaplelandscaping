import {getPoolModels} from './poolModel';
import type {DeckData,YardFeature} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {YardModel,YardBox} from './yardModel';
import type {PlanPoint} from './lib/deckGeometry';
import {arcGeometry} from './circularArcs';
import {yardShapeLocalPoints,yardShapeWorldPoint,yardShapeCurveWorldPoints} from './yardShapeGeometry';
import {createSiteSurface,sitePlaneHeight} from './siteSurface';
import {getTerrainConfig} from './yardSettings';
import {yardSurfaceIn} from './yardElevations';
import {patioTopPlane} from './yardElevationGeometry';

export {elevationLabel,ELEVATION_DATUM} from './elevationDatum';
export interface ProfileSegment {a:PlanPoint;b:PlanPoint;bulgeIn?:number}
export interface ElevationProfileSpec {id:string;name:string;segments:ProfileSegment[];featureId?:string;finishedIn?:number;extraStations?:number[];poolRef?:{id:string;level:'floor'|'water'|'rim'};stair?:{top:number;rise:number;run:number;risers:number;stations?:number[];firstDrop?:number}}
export interface ElevationProfilePoint {stationIn:number;xIn:number;zIn:number;existingIn:number|null;proposedIn:number|null;finishedIn:number|null;formationIn:number|null}
export interface ElevationProfileSolid {id:string;role:YardBox['role'];stonePart?:YardBox['stonePart'];startIn:number;endIn:number;bottomIn:number;topIn:number}
export interface ElevationProfile {spec:ElevationProfileSpec;lengthIn:number;points:ElevationProfilePoint[];complete:boolean;solids?:ElevationProfileSolid[]}
const EPS=1e-7,TAU=Math.PI*2;
export function profileSegmentLength(segment:ProfileSegment){return segment.bulgeIn?arcGeometry(segment.a,segment.b,segment.bulgeIn).lengthIn:Math.hypot(segment.b.x-segment.a.x,segment.b.y-segment.a.y);}
export function profileSegmentPoint(s:ProfileSegment,t:number):PlanPoint{
 if(!s.bulgeIn)return {x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t};
 const g=arcGeometry(s.a,s.b,s.bulgeIn),a=Math.atan2(s.a.y-g.center.y,s.a.x-g.center.x)-Math.sign(s.bulgeIn)*g.sweep*t;
 return {x:g.center.x+g.radius*Math.cos(a),y:g.center.y+g.radius*Math.sin(a)};
}
/** Exact intersections with a terrain face edge, retaining analytic arc chainage. */
export function profileEdgeBreaks(s:ProfileSegment,a:PlanPoint,b:PlanPoint):number[]{
 const dx=b.x-a.x,dy=b.y-a.y;
 if(!s.bulgeIn){const ux=s.b.x-s.a.x,uy=s.b.y-s.a.y,den=ux*dy-uy*dx;if(Math.abs(den)<EPS)return [];const t=((a.x-s.a.x)*dy-(a.y-s.a.y)*dx)/den,u=((a.x-s.a.x)*uy-(a.y-s.a.y)*ux)/den;return t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS?[t]:[];}
 const g=arcGeometry(s.a,s.b,s.bulgeIn),px=a.x-g.center.x,py=a.y-g.center.y,A=dx*dx+dy*dy,B=2*(px*dx+py*dy),C=px*px+py*py-g.radius*g.radius,D=B*B-4*A*C;
 if(A<EPS||D<-EPS)return [];const start=Math.atan2(s.a.y-g.center.y,s.a.x-g.center.x),out:number[]=[];
 for(const sign of [-1,1]){const u=(-B+sign*Math.sqrt(Math.max(0,D)))/(2*A);if(u<-EPS||u>1+EPS)continue;const angle=Math.atan2(a.y+u*dy-g.center.y,a.x+u*dx-g.center.x),delta=((Math.sign(s.bulgeIn)*(start-angle))%TAU+TAU)%TAU,t=delta/g.sweep;if(t>EPS&&t<1-EPS)out.push(t);}return out;
}
/** Exact crossings between two competing formation planes along a section. */
export function profilePlaneBreaks(s:ProfileSegment,p:{x:number;z:number;constant:number}):number[]{
 const v=(q:PlanPoint)=>p.x*q.x+p.z*q.y+p.constant;
 if(!s.bulgeIn){const a=v(s.a),b=v(s.b),t=a/(a-b);return Number.isFinite(t)&&t>EPS&&t<1-EPS?[t]:[];}
 const g=arcGeometry(s.a,s.b,s.bulgeIn),n=Math.hypot(p.x,p.z);if(n<EPS)return [];const ratio=-(p.x*g.center.x+p.z*g.center.y+p.constant)/(g.radius*n);if(Math.abs(ratio)>1+EPS)return [];const base=Math.atan2(p.z,p.x),angle=Math.acos(Math.max(-1,Math.min(1,ratio))),start=Math.atan2(s.a.y-g.center.y,s.a.x-g.center.x);
 return [base-angle,base+angle].map(a=>(((Math.sign(s.bulgeIn)*(start-a))%TAU+TAU)%TAU)/g.sweep).filter(t=>t>EPS&&t<1-EPS);
}
export function featureProfileSegments(f:YardFeature):ProfileSegment[]{
 const p=yardShapeLocalPoints(f).map(v=>yardShapeWorldPoint(f,v));return p.slice(1).map((b,i)=>({a:p[i],b,...(f.curves?.find(c=>c.edge===i)?{bulgeIn:f.curves.find(c=>c.edge===i)!.bulgeIn}:{})}));
}
export function patioFinishedPlane(data:DeckData,f:YardFeature){return patioTopPlane(f,yardSurfaceIn(data,f)-f.heightIn);}
export function wallFinishedAt(data:DeckData,f:YardFeature,station:number){let top=yardSurfaceIn(data,f);for(const step of f.wallTopSteps??[])if(station>=step.stationIn-EPS)top=step.elevationIn;return top;}
function featureLocalExtents(f:YardFeature){const p=yardShapeLocalPoints(f),count=p.length;for(const arc of f.curves??[]){const a=p[arc.edge],b=p[(arc.edge+1)%count],g=arcGeometry(a,b,arc.bulgeIn),start=Math.atan2(a.y-g.center.y,a.x-g.center.x);for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const delta=((Math.sign(arc.bulgeIn)*(start-angle))%TAU+TAU)%TAU;if(delta<=g.sweep+EPS)p.push({x:g.center.x+g.radius*Math.cos(angle),y:g.center.y+g.radius*Math.sin(angle)});}}return p;}
export function elevationProfileSpecs(data:DeckData,deck?:DeckTakeoff):ElevationProfileSpec[]{
 const specs:ElevationProfileSpec[]=[];
 for(const f of data.yardFeatures??[]){if(!f.enabled||f.kind==='water-feature')continue;if(f.kind==='retaining-wall')specs.push({id:f.id,name:`${f.name} · wall path`,featureId:f.id,segments:featureProfileSegments(f),extraStations:f.wallTopSteps?.map(s=>s.stationIn)});else for(const axis of ['across','out'] as const){const p=featureLocalExtents(f),values=p.map(v=>axis==='across'?v.x:v.y),low=Math.min(...values),high=Math.max(...values),a=yardShapeWorldPoint(f,axis==='across'?{x:low,y:0}:{x:0,y:low}),b=yardShapeWorldPoint(f,axis==='across'?{x:high,y:0}:{x:0,y:high});specs.push({id:`${f.id}-${axis}`,name:`${f.name} · ${axis}`,featureId:f.id,segments:[{a,b}]});}}
 for(const pool of getPoolModels(data,deck)){
  const f=pool.config,a=f.rotationDeg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),local=pool.openingFootprints.flat().map(p=>({x:c*(p.x-f.xIn)+sn*(p.y-f.zIn),y:-sn*(p.x-f.xIn)+c*(p.y-f.zIn)})),world=(x:number,y:number)=>({x:f.xIn+c*x-sn*y,y:f.zIn+sn*x+c*y}),xs=local.map(p=>p.x),zs=local.map(p=>p.y),loX=Math.min(...xs),hiX=Math.max(...xs),loZ=Math.min(...zs),hiZ=Math.max(...zs);
  for(const axis of ['longitudinal','across'] as const)for(const level of ['floor','water','rim'] as const)specs.push({id:`pool-${f.id}-${axis}-${level}`,name:`${f.name} · ${axis} · ${level==='rim'?'coping surface':level==='water'?'water surface':'basin floor'}`,poolRef:{id:f.id,level},segments:[axis==='longitudinal'?{a:world((loX+hiX)/2,loZ-24),b:world((loX+hiX)/2,hiZ+24)}:{a:world(loX-24,(loZ+hiZ)/2),b:world(hiX+24,(loZ+hiZ)/2)}],extraStations:axis==='longitudinal'?f.depthProfile.map(p=>24+p.stationIn):undefined});
 }
 if(deck){for(const flight of deck.flights){const a={x:flight.start.x,y:flight.start.z},b={x:flight.end.x,y:flight.end.z},winder=flight.winderCenter&&flight.winderRadiusIn,c=flight.winderCenter,bulgeIn=winder?-Math.sign((b.x-a.x)*(c!.y-a.y)-(b.y-a.y)*(c!.x-a.x))*Math.hypot(b.x-a.x,b.y-a.y)*(Math.sqrt(2)-1)/2:undefined,segment={a,b,...bulgeIn?{bulgeIn}:{}},length=profileSegmentLength(segment),stations=winder?[length/3,2*length/3]:Array.from({length:flight.risers},(_,i)=>i*flight.run);specs.push({id:`stair-${flight.id}`,name:`Stair ${flight.id}`,segments:[segment],extraStations:stations,finishedIn:flight.end.y,stair:{top:flight.start.y,rise:flight.rise,run:flight.run,risers:flight.risers,stations,firstDrop:winder?0:1}});}const supports=deck.levels.flatMap(l=>l.supports);if(supports.length){const p=supports.slice().sort((a,b)=>a.z-b.z||a.x-b.x),a=p[0],b=p.at(-1)!;if(Math.hypot(b.x-a.x,b.z-a.z)>EPS)specs.push({id:'deck-foundations',name:'Deck foundations · reference section',segments:[{a:{x:a.x,y:a.z},b:{x:b.x,y:b.z}}]});}}
 return specs;
}
const inside=(p:PlanPoint,poly:PlanPoint[])=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],dx=b.x-a.x,dy=b.y-a.y;if(Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;};
export function buildElevationProfile(data:DeckData,spec:ElevationProfileSpec,yard?:YardModel):ElevationProfile{
 const terrain=getTerrainConfig(data),surface=data.siteModel?createSiteSurface(data.siteModel,terrain):undefined,lengths=spec.segments.map(profileSegmentLength),lengthIn=lengths.reduce((a,b)=>a+b,0),feature=data.yardFeatures?.find(f=>f.id===spec.featureId),points:ElevationProfilePoint[]=[],modeled=yard?.features.find(f=>f.config.id===spec.featureId),footprints=modeled?.footprints??(feature?.kind==='patio'?[yardShapeCurveWorldPoints(feature)]:[]),regions=yard?.formationRegions??yard?.sharedExcavationRegions??yard?.excavationRegions??[];
 // Signed rings preserve clipped holes; an excluded feature has no finished surface.
 const pool=spec.poolRef?(yard?.pools??getPoolModels(data)).find(p=>p.config.id===spec.poolRef!.id):undefined,poolFootprints=pool?(spec.poolRef!.level==='rim'?pool.copingFootprints:pool.openingFootprints):[];
 const covered=(p:PlanPoint)=>feature?.enabled!==false&&!modeled?.excluded&&footprints.reduce((sum,poly)=>sum+(inside(p,poly)?Math.sign(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a.x*b.y-b.x*a.y;},0)):0),0)!==0;
 const stairBoxes=(feature?.stoneSteps||feature?.stepAssembly)&&feature.enabled&&!modeled?.excluded?(modeled?.boxes??[]).filter(b=>b.polygon&&(b.role==='stone-step'||b.role==='base'||b.role==='bedding')):[],solids:ElevationProfileSolid[]=[];
 const treadTop=(p:PlanPoint)=>{const tops=stairBoxes.filter(b=>b.role==='stone-step'&&(b.stonePart==='tread'||b.stonePart==='landing'||!b.stonePart)&&inside(p,b.polygon!)).map(b=>b.y+b.h/2);return covered(p)&&tops.length?Math.max(...tops):null;};
 const at=(s:ProfileSegment,t:number,offset:number,length:number):ElevationProfilePoint=>{const p=profileSegmentPoint(s,t),stationIn=offset+length*t,sample=(kind:'existing'|'proposed')=>surface?.sample(p.x,p.y,kind)??(surface?null:terrain.elevationIn+p.y*terrain.slopePct/100);let finishedIn:number|null=spec.finishedIn??null;
  if(spec.stair){const stair=spec.stair,stations=stair.stations??Array.from({length:stair.risers},(_,i)=>i*stair.run),drops=stations.filter(v=>v<=stationIn+EPS).length;finishedIn=stair.top-Math.min(stair.risers,drops)*stair.rise;}
  if(feature)finishedIn=feature.kind==='patio'?((feature.stoneSteps||feature.stepAssembly)?treadTop(p):covered(p)?sitePlaneHeight(patioFinishedPlane(data,feature),p.x,p.y):null):feature.enabled&&!modeled?.excluded?wallFinishedAt(data,feature,stationIn):null;
  if(pool&&spec.poolRef){const isCovered=poolFootprints.reduce((sum,poly)=>sum+(inside(p,poly)?Math.sign(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a.x*b.y-b.x*a.y;},0)):0),0)!==0;const floor=pool.floorRegions.find(r=>inside(p,r.polygon));finishedIn=!isCovered?null:spec.poolRef.level==='water'?pool.waterElevationIn:spec.poolRef.level==='rim'?pool.copingTopElevationIn:floor?sitePlaneHeight(floor.plane,p.x,p.y):null;}
  const floors=regions.filter(r=>inside(p,r.polygon)).map(r=>r.formationPlane?sitePlaneHeight(r.formationPlane,p.x,p.y):r.bottomIn);
  return {stationIn,xIn:p.x,zIn:p.y,existingIn:sample('existing'),proposedIn:sample('proposed'),finishedIn:Number.isFinite(finishedIn)?finishedIn:null,formationIn:floors.length?Math.min(...floors):null};
 };
 let start=0;
 for(let i=0;i<spec.segments.length;i++){const s=spec.segments[i],length=lengths[i];if(length<EPS)continue;const breaks=[0,1];for(const triangle of [...surface?.existingTriangles??[],...surface?.proposedTriangles??[]])for(let e=0;e<3;e++){const a=triangle.vertices[e],b=triangle.vertices[(e+1)%3];breaks.push(...profileEdgeBreaks(s,{x:a.xIn,y:a.zIn},{x:b.xIn,y:b.zIn}));}
  for(const poly of [...footprints,...poolFootprints,...pool?.floorRegions.map(r=>r.polygon)??[],...regions.map(r=>r.polygon),...stairBoxes.map(b=>b.polygon!)])for(let e=0;e<poly.length;e++)breaks.push(...profileEdgeBreaks(s,poly[e],poly[(e+1)%poly.length]));
  for(const box of stairBoxes){const cuts=[0,1];for(const poly of [box.polygon!,...footprints])for(let e=0;e<poly.length;e++)cuts.push(...profileEdgeBreaks(s,poly[e],poly[(e+1)%poly.length]));const stops=[...new Set(cuts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);let interval:ElevationProfileSolid|undefined;
   for(let k=0;k+1<stops.length;k++){const a=stops[k],b=stops[k+1],p=profileSegmentPoint(s,(a+b)/2);if(b-a<EPS||!inside(p,box.polygon!)||!covered(p)){interval=undefined;continue;}const startIn=start+length*a,endIn=start+length*b;if(interval&&Math.abs(interval.endIn-startIn)<EPS)interval.endIn=endIn;else{interval={id:box.id,role:box.role,...box.stonePart?{stonePart:box.stonePart}:{},startIn,endIn,bottomIn:box.y-box.h/2,topIn:box.y+box.h/2};solids.push(interval);}}
  }
  for(let u=0;u<regions.length;u++)for(let v=u+1;v<regions.length;v++){const a=regions[u],b=regions[v],p=a.formationPlane??{x:0,z:0,constant:a.bottomIn},q=b.formationPlane??{x:0,z:0,constant:b.bottomIn};for(const t of profilePlaneBreaks(s,{x:p.x-q.x,z:p.z-q.z,constant:p.constant-q.constant})){const point=profileSegmentPoint(s,t);if(inside(point,a.polygon)&&inside(point,b.polygon))breaks.push(t);}}
  for(const station of spec.extraStations??[])if(station>=start&&station<=start+length)breaks.push((station-start)/length);if(s.bulgeIn)for(let t=1;t<64;t++)breaks.push(t/64);
  const stops=[...new Set(breaks.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);
  // Each interval has its own end samples. At coverage and formation boundaries
  // one-sided samples share the exact station so profiles cannot bridge holes.
  for(let k=0;k+1<stops.length;k++){const a=stops[k],b=stops[k+1],nudge=Math.min(1e-7,(b-a)/1000),left=at(s,a+nudge,start,length),right=at(s,b-nudge,start,length),mid=at(s,(a+b)/2,start,length),pa=profileSegmentPoint(s,a),pb=profileSegmentPoint(s,b);
   // Extend affine levels to the exact endpoint using this interval's local slope.
   const extend=(v:ElevationProfilePoint,target:number,p:PlanPoint)=>{for(const key of ['existingIn','proposedIn','finishedIn','formationIn'] as const)if(v[key]!==null&&mid[key]!==null){const delta=mid.stationIn-v.stationIn;if(Math.abs(delta)>EPS)v[key]=v[key]!+(mid[key]!-v[key]!)/delta*(target-v.stationIn);}return {...v,stationIn:target,xIn:p.x,zIn:p.y};};
   points.push(extend(left,start+length*a,pa),mid,extend(right,start+length*b,pb));
  }start+=length;
 }
 return {spec,lengthIn,points,complete:points.every(p=>p.existingIn!==null&&p.proposedIn!==null),...((feature?.stoneSteps||feature?.stepAssembly)?{solids}:{})};
}
