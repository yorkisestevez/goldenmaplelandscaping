import {buildGradingTransitions} from './gradingTransitionGeometry';
import type {GradingTransitionModel} from './gradingTransitionGeometry';
export {siteElevationWarnings} from './siteElevationChecks';

import './siteModelRuntime';

import Delaunator from 'delaunator';

import {localPolygonClip} from './lib/localPolygonClip';

import type {DeckData,TerrainConfig} from './types';

import type {DeckTakeoff,Member,Box} from './deckTakeoff';

import type {SiteModel,SiteBoundaryPoint,SiteGradingRegion} from './siteModel';

import {validateSiteModel} from './siteModel';

import {getTerrainConfig} from './yardSettings';

import {stairLandingPolygons} from './stairLandingGeometry';

import {stairTargetId} from './stairTargets';

import {yardFeatureOutline} from './yardPathGeometry';

import {patioTopPlane,applyPlaneFormation} from './yardElevationGeometry';

export interface SiteVertex {xIn:number;zIn:number;elevationIn:number}

export interface SitePlane {x:number;z:number;constant:number}

export interface SiteSurfaceTriangle {vertices:[SiteVertex,SiteVertex,SiteVertex];plane:SitePlane;existingPlane:SitePlane;gradingId?:string}

export interface SiteCutFill {cutYd3:number;fillYd3:number;netFillYd3:number;gradedAreaSqft:number;uncoveredAreaSqft:number;complete:boolean}

export interface SiteSurface {transitionModels?:GradingTransitionModel[];existingTriangles:SiteSurfaceTriangle[];proposedTriangles:SiteSurfaceTriangle[];coverage:SiteBoundaryPoint[][];bounds:{minX:number;maxX:number;minZ:number;maxZ:number};cutFill:SiteCutFill;legacy:boolean;sample:(xIn:number,zIn:number,kind?:'existing'|'proposed')=>number|undefined;extrema:(polygons:SiteBoundaryPoint[][],kind?:'existing'|'proposed')=>{min:number;max:number;complete:boolean};lineBreaks:(a:SiteBoundaryPoint,b:SiteBoundaryPoint,kind?:'existing'|'proposed')=>number[]}

export interface SiteFormation {featureId:string;polygons:SiteBoundaryPoint[][];bottomIn:number;formationPlane?:SitePlane}

export interface SiteExcavationRegion {featureId:string;polygon:SiteBoundaryPoint[];bottomIn:number;formationPlane?:SitePlane;volumeYd3:number}

export type SiteSurfaceSnapshot=Pick<SiteSurface,'existingTriangles'|'proposedTriangles'|'coverage'|'bounds'|'cutFill'|'legacy'|'transitionModels'>;

export const siteSurfaceSnapshot=(surface:SiteSurface):SiteSurfaceSnapshot=>({existingTriangles:surface.existingTriangles,proposedTriangles:surface.proposedTriangles,coverage:surface.coverage,bounds:surface.bounds,cutFill:surface.cutFill,legacy:surface.legacy,...(surface.transitionModels?{transitionModels:surface.transitionModels}:{})});

const S=100000,EPS=1e-7;

export const siteSignedArea=(poly:SiteBoundaryPoint[])=>poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a.x*b.y-b.x*a.y;},0)/2;

export const siteArea=(polys:SiteBoundaryPoint[][])=>Math.abs(polys.reduce((n,p)=>n+siteSignedArea(p),0));

export const sitePlaneHeight=(p:SitePlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;

export function siteClip(subject:SiteBoundaryPoint[][],clip:SiteBoundaryPoint[][]=[],operation:'union'|'difference'|'intersection'='union'):SiteBoundaryPoint[][]{

 return localPolygonClip(subject,clip,operation,S).filter(p=>Math.abs(siteSignedArea(p))>EPS);
}

/** Exact convex trapezoids including polygon holes; they preserve affine

 * height integration and can be triangulated with a fan. */

export function siteSolidCells(polys:SiteBoundaryPoint[][]):SiteBoundaryPoint[][]{

 const xs=[...new Set(polys.flat().map(p=>p.x))].sort((a,b)=>a-b),out:SiteBoundaryPoint[][]=[];

 for(let i=0;i+1<xs.length;i++){const left=xs[i],right=xs[i+1],mid=(left+right)/2;if(right-left<EPS)continue;const edges:{a:SiteBoundaryPoint;b:SiteBoundaryPoint;y:number}[]=[];

  for(const poly of polys)for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];if((a.x<=mid&&b.x>mid)||(b.x<=mid&&a.x>mid))edges.push({a,b,y:a.y+(mid-a.x)*(b.y-a.y)/(b.x-a.x)});}

  edges.sort((a,b)=>a.y-b.y);const at=(e:typeof edges[number],x:number)=>e.a.y+(x-e.a.x)*(e.b.y-e.a.y)/(e.b.x-e.a.x);

  for(let j=0;j+1<edges.length;j+=2){const p=[{x:left,y:at(edges[j],left)},{x:right,y:at(edges[j],right)},{x:right,y:at(edges[j+1],right)},{x:left,y:at(edges[j+1],left)}];if(siteSignedArea(p)>EPS)out.push(p);}

 }

 return out;

}

function planeFor(v:[SiteVertex,SiteVertex,SiteVertex]):SitePlane{const [a,b,c]=v,dx=b.xIn-a.xIn,dz=b.zIn-a.zIn,ex=c.xIn-a.xIn,ez=c.zIn-a.zIn,det=dx*ez-ex*dz,x=((b.elevationIn-a.elevationIn)*ez-(c.elevationIn-a.elevationIn)*dz)/det,z=(dx*(c.elevationIn-a.elevationIn)-ex*(b.elevationIn-a.elevationIn))/det;return {x,z,constant:a.elevationIn-x*a.xIn-z*a.zIn};}

const planOf=(t:SiteSurfaceTriangle)=>t.vertices.map(v=>({x:v.xIn,y:v.zIn}));

function triangles(polys:SiteBoundaryPoint[][],plane:SitePlane,existingPlane:SitePlane,gradingId?:string):SiteSurfaceTriangle[]{return siteSolidCells(polys).flatMap(cell=>cell.slice(1,-1).flatMap((_,i)=>{const vertices=[cell[0],cell[i+1],cell[i+2]];if(Math.abs(siteSignedArea(vertices))<=EPS)return [];return [{vertices:vertices.map(v=>({xIn:v.x,zIn:v.y,elevationIn:sitePlaneHeight(plane,v.x,v.y)})) as [SiteVertex,SiteVertex,SiteVertex],plane,existingPlane,...(gradingId?{gradingId}:{})}];}));}

const gradingPlane=(g:SiteGradingRegion):SitePlane=>({x:g.slopeXPct/100,z:g.slopeZPct/100,constant:g.elevationIn-g.originXIn*g.slopeXPct/100-g.originZIn*g.slopeZPct/100});

const contains=(poly:SiteBoundaryPoint[],x:number,z:number)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],cross=(b.x-a.x)*(z-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(cross)<EPS&&x>=Math.min(a.x,b.x)-EPS&&x<=Math.max(a.x,b.x)+EPS&&z>=Math.min(a.y,b.y)-EPS&&z<=Math.max(a.y,b.y)+EPS)return true;if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};

const polygonBounds=(polys:SiteBoundaryPoint[][])=>{const ps=polys.flat();return {minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minZ:Math.min(...ps.map(p=>p.y)),maxZ:Math.max(...ps.map(p=>p.y))};};

const boundsOverlap=(a:SiteSurface['bounds'],b:SiteSurface['bounds'])=>a.minX<=b.maxX+EPS&&a.maxX>=b.minX-EPS&&a.minZ<=b.maxZ+EPS&&a.maxZ>=b.minZ-EPS;

function positive(poly:SiteBoundaryPoint[],plane:SitePlane):SiteBoundaryPoint[]{const out:SiteBoundaryPoint[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ha=sitePlaneHeight(plane,a.x,a.y),hb=sitePlaneHeight(plane,b.x,b.y);if(ha>=-EPS)out.push(a);if(ha>EPS&&hb<-EPS||ha<-EPS&&hb>EPS){const t=ha/(ha-hb);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out.length>=3&&Math.abs(siteSignedArea(out))>EPS?out:[];}

const negate=(p:SitePlane):SitePlane=>({x:-p.x,z:-p.z,constant:-p.constant});

const subtract=(a:SitePlane,b:SitePlane):SitePlane=>({x:a.x-b.x,z:a.z-b.z,constant:a.constant-b.constant});

/** Affine height over a convex polygon integrates exactly as triangle area

 * times mean vertex height, including where cut turns into fill. */

export function siteAffineIntegral(poly:SiteBoundaryPoint[],plane:SitePlane){let volume=0;for(let i=1;i+1<poly.length;i++){const tri=[poly[0],poly[i],poly[i+1]],area=Math.abs(siteSignedArea(tri));volume+=area*tri.reduce((n,v)=>n+sitePlaneHeight(plane,v.x,v.y),0)/3;}return volume;}

const positiveIntegral=(poly:SiteBoundaryPoint[],plane:SitePlane)=>{const p=positive(poly,plane);return p.length?Math.max(0,siteAffineIntegral(p,plane)):0;};

function spatialSampler(ts:SiteSurfaceTriangle[],bounds:SiteSurface['bounds']){

 const size=Math.max(1,Math.min(64,Math.ceil(Math.sqrt(ts.length/2)))),width=Math.max(EPS,bounds.maxX-bounds.minX),depth=Math.max(EPS,bounds.maxZ-bounds.minZ),cx=(x:number)=>Math.max(0,Math.min(size-1,Math.floor((x-bounds.minX)/width*size))),cz=(z:number)=>Math.max(0,Math.min(size-1,Math.floor((z-bounds.minZ)/depth*size))),buckets=new Map<number,SiteSurfaceTriangle[]>();

 for(const t of ts){const xs=t.vertices.map(v=>v.xIn),zs=t.vertices.map(v=>v.zIn);for(let x=cx(Math.min(...xs));x<=cx(Math.max(...xs));x++)for(let z=cz(Math.min(...zs));z<=cz(Math.max(...zs));z++){const key=z*size+x,list=buckets.get(key)??[];list.push(t);buckets.set(key,list);}}

 return (x:number,z:number)=>{if(!Number.isFinite(x+z)||x<bounds.minX-EPS||x>bounds.maxX+EPS||z<bounds.minZ-EPS||z>bounds.maxZ+EPS)return undefined;for(const t of buckets.get(cz(z)*size+cx(x))??[]){const [a,b,c]=t.vertices,cross=(u:SiteVertex,v:SiteVertex)=>(v.xIn-u.xIn)*(z-u.zIn)-(v.zIn-u.zIn)*(x-u.xIn),p=cross(a,b),q=cross(b,c),r=cross(c,a);if(p>=-EPS&&q>=-EPS&&r>=-EPS||p<=EPS&&q<=EPS&&r<=EPS)return sitePlaneHeight(t.plane,x,z);}return undefined;};

}

function lineBreaks(ts:SiteSurfaceTriangle[],a:SiteBoundaryPoint,b:SiteBoundaryPoint){const dx=b.x-a.x,dz=b.y-a.y,values=[0,1];for(const t of ts){const poly=planOf(t);for(let i=0;i<3;i++){const p=poly[i],q=poly[(i+1)%3],ex=q.x-p.x,ez=q.y-p.y,den=dx*ez-dz*ex;if(Math.abs(den)<EPS)continue;const px=p.x-a.x,pz=p.y-a.y,u=(px*ez-pz*ex)/den,v=(px*dz-pz*dx)/den;if(u>EPS&&u<1-EPS&&v>=-EPS&&v<=1+EPS)values.push(u);}}return [...new Set(values.map(v=>Number(v.toFixed(10))))].sort((a,b)=>a-b);}

const cache=new WeakMap<SiteModel,SiteSurface>();

export function createSiteSurface(siteModel:SiteModel|undefined,terrain:TerrainConfig):SiteSurface{

 if(siteModel){const saved=cache.get(siteModel);if(saved)return saved;}

 const model=siteModel?validateSiteModel(siteModel):undefined,points=model?.points??[{id:'a',xIn:-terrain.widthFt*6,zIn:-terrain.depthFt*6,elevationIn:terrain.elevationIn-terrain.depthFt*6*terrain.slopePct/100},{id:'b',xIn:terrain.widthFt*6,zIn:-terrain.depthFt*6,elevationIn:terrain.elevationIn-terrain.depthFt*6*terrain.slopePct/100},{id:'c',xIn:terrain.widthFt*6,zIn:terrain.depthFt*6,elevationIn:terrain.elevationIn+terrain.depthFt*6*terrain.slopePct/100},{id:'d',xIn:-terrain.widthFt*6,zIn:terrain.depthFt*6,elevationIn:terrain.elevationIn+terrain.depthFt*6*terrain.slopePct/100}],tin=Delaunator.from(points,p=>p.xIn,p=>p.zIn),existingTriangles:SiteSurfaceTriangle[]=[];

 for(let i=0;i<tin.triangles.length;i+=3){const vertices=[points[tin.triangles[i]],points[tin.triangles[i+1]],points[tin.triangles[i+2]]] as [SiteVertex,SiteVertex,SiteVertex],poly=vertices.map(v=>({x:v.xIn,y:v.zIn}));if(Math.abs(siteSignedArea(poly))<EPS)continue;const plane=planeFor(vertices),clipped=model?.boundary?siteClip([poly],[model.boundary],'intersection'):[poly];existingTriangles.push(...triangles(clipped,plane,plane));}

 if(!existingTriangles.length)throw Error('Survey boundary has no covered terrain area.');

 const hull=Array.from(tin.hull,i=>({x:points[i].xIn,y:points[i].zIn})),coverage=model?.boundary?siteClip([hull],[model.boundary],'intersection'):[siteSignedArea(hull)>0?hull:hull.reverse()],all=coverage.flat(),bounds={minX:Math.min(...all.map(v=>v.x)),maxX:Math.max(...all.map(v=>v.x)),minZ:Math.min(...all.map(v=>v.y)),maxZ:Math.max(...all.map(v=>v.y))},proposedTriangles:SiteSurfaceTriangle[]=[],cutFill:SiteCutFill={cutYd3:0,fillYd3:0,netFillYd3:0,gradedAreaSqft:0,uncoveredAreaSqft:0,complete:true};

 const grading=model?.grading??[],gradingBounds=grading.map(g=>polygonBounds([g.boundary]));

 for(const existing of existingTriangles){const original=planOf(existing),existingBounds=polygonBounds([original]);let available=[original];for(let i=grading.length-1;i>=0;i--){if(!boundsOverlap(existingBounds,gradingBounds[i]))continue;const g=grading[i],zone=siteClip(available,[g.boundary],'intersection');if(!zone.length)continue;const plane=gradingPlane(g),delta=subtract(existing.plane,plane);for(const cell of siteSolidCells(zone)){cutFill.cutYd3+=positiveIntegral(cell,delta)/46656;cutFill.fillYd3+=positiveIntegral(cell,negate(delta))/46656;}cutFill.gradedAreaSqft+=siteArea(zone)/144;proposedTriangles.push(...triangles(zone,plane,existing.plane,g.id));available=siteClip(available,[g.boundary],'difference');if(!available.length)break;}proposedTriangles.push(...triangles(available,existing.plane,existing.plane));}

 const gradingArea=siteArea(siteClip(grading.map(g=>g.boundary)))/144;cutFill.uncoveredAreaSqft=Math.max(0,gradingArea-cutFill.gradedAreaSqft);cutFill.complete=cutFill.uncoveredAreaSqft<1e-5;cutFill.netFillYd3=cutFill.fillYd3-cutFill.cutYd3;

 const existingSample=spatialSampler(existingTriangles,bounds),triangleBounds=new WeakMap<SiteSurfaceTriangle,SiteSurface['bounds']>();for(const t of [...existingTriangles,...proposedTriangles])triangleBounds.set(t,polygonBounds([planOf(t)]));

 let finalSample:ReturnType<typeof spatialSampler>|undefined;
 const surface:SiteSurface={existingTriangles,proposedTriangles,coverage,bounds,cutFill,legacy:!model,sample:(x,z,kind='proposed')=>{if(!model)return terrain.elevationIn+z*terrain.slopePct/100;if(kind==='proposed'&&finalSample)return finalSample(x,z);const measured=existingSample(x,z);if(measured===undefined||kind==='existing')return measured;for(let i=grading.length-1;i>=0;i--)if(contains(grading[i].boundary,x,z))return sitePlaneHeight(gradingPlane(grading[i]),x,z);return measured;},extrema:(polygons,kind='proposed')=>{if(!model){const heights=polygons.flat().map(p=>terrain.elevationIn+p.y*terrain.slopePct/100);return {min:Math.min(...heights),max:Math.max(...heights),complete:true};}let min=Infinity,max=-Infinity,covered=0;const requested=polygonBounds(polygons);for(const triangle of kind==='existing'?existingTriangles:proposedTriangles){if(!boundsOverlap(requested,triangleBounds.get(triangle)!))continue;const zone=siteClip(polygons,[planOf(triangle)],'intersection');covered+=siteArea(zone);for(const v of zone.flat()){const h=sitePlaneHeight(triangle.plane,v.x,v.y);min=Math.min(min,h);max=Math.max(max,h);}}return {min,max,complete:Math.max(0,siteArea(siteClip(polygons))-covered)<1e-3};},lineBreaks:(a,b,kind='proposed')=>lineBreaks(kind==='existing'?existingTriangles:proposedTriangles,a,b)};

 if(model?.transitions?.some(t=>t.enabled)){
  // Capture source levels against the base grading; transitions never sample
  // each other. Pending strips leave the measured/proposed TIN untouched.
  surface.transitionModels=buildGradingTransitions(surface,model.transitions);
  const faces=surface.transitionModels.filter(m=>m.status==='ready').flatMap(m=>m.triangles.map(face=>({face,id:m.id,polygon:face.vertices.map(v=>({x:v.xIn,y:v.zIn})),bounds:polygonBounds([face.vertices.map(v=>({x:v.xIn,y:v.zIn}))])}))),updated:SiteSurfaceTriangle[]=[];
  for(const base of proposedTriangles){const original=planOf(base),bounds=polygonBounds([original]);let remaining=[original];for(const t of faces){if(!boundsOverlap(bounds,t.bounds))continue;const zone=siteClip(remaining,[t.polygon],'intersection');if(!zone.length)continue;updated.push(...triangles(zone,t.face.plane,base.existingPlane,`transition:${t.id}`));remaining=siteClip(remaining,[t.polygon],'difference');if(!remaining.length)break;}updated.push(...triangles(remaining,base.plane,base.existingPlane,base.gradingId));}
  proposedTriangles.splice(0,proposedTriangles.length,...updated);
  cutFill.cutYd3=0;cutFill.fillYd3=0;cutFill.gradedAreaSqft=0;
  for(const t of proposedTriangles){const polygon=planOf(t),delta=subtract(t.existingPlane,t.plane);cutFill.cutYd3+=positiveIntegral(polygon,delta)/46656;cutFill.fillYd3+=positiveIntegral(polygon,negate(delta))/46656;if(t.gradingId)cutFill.gradedAreaSqft+=siteArea([polygon])/144;triangleBounds.set(t,polygonBounds([polygon]));}
  cutFill.uncoveredAreaSqft+=surface.transitionModels.reduce((n,m)=>n+m.missingAreaSqft,0);cutFill.complete=cutFill.complete&&surface.transitionModels.every(m=>m.status==='ready');cutFill.netFillYd3=cutFill.fillYd3-cutFill.cutYd3;
  finalSample=spatialSampler(proposedTriangles,bounds);
 }
 if(siteModel)cache.set(siteModel,surface);return surface;

}

export function sampleSiteHeight(data:Pick<DeckData,'siteModel'|'terrainConfig'>,xIn:number,zIn:number,kind:'existing'|'proposed'='proposed'){const terrain=getTerrainConfig(data as DeckData);return data.siteModel?createSiteSurface(data.siteModel,terrain).sample(xIn,zIn,kind):terrain.elevationIn+zIn*terrain.slopePct/100;}

/** Dedicated engineered fill above proposed ground and below a feature's

 * formation. It cannot overlap the soil fill below the shared lower envelope. */

export function integrateSiteFeatureFill(surface:SiteSurface,polygons:SiteBoundaryPoint[][],formationIn:number|SitePlane){let volume=0;const requested=polygonBounds(polygons),floor=typeof formationIn==='number'?{x:0,z:0,constant:formationIn}:formationIn;for(const triangle of surface.proposedTriangles){if(!boundsOverlap(requested,polygonBounds([planOf(triangle)])))continue;const zone=siteClip(polygons,[planOf(triangle)],'intersection');for(const cell of siteSolidCells(zone))volume+=positiveIntegral(cell,subtract(floor,triangle.plane))/46656;}return volume;}

/** A horizontal construction course filled only up to proposed retained

 * ground. These convex face pieces preserve the exact sloping top for 3D. */

export function siteMaterialBand(surface:SiteSurface,polygons:SiteBoundaryPoint[][],bottomIn:number,topIn:number){

 const regions:{polygon:SiteBoundaryPoint[];topPlane:SitePlane;bottomIn:number;volumeYd3:number}[]=[],requested=polygonBounds(polygons),floor={x:0,z:0,constant:bottomIn},ceiling={x:0,z:0,constant:topIn};let volumeYd3=0,planAreaSqft=0,topAreaSqft=0;

 const add=(polygon:SiteBoundaryPoint[],topPlane:SitePlane)=>{if(!polygon.length)return;const volume=positiveIntegral(polygon,subtract(topPlane,floor))/46656;if(volume<=EPS)return;regions.push({polygon,topPlane,bottomIn,volumeYd3:volume});volumeYd3+=volume;const area=Math.abs(siteSignedArea(polygon))/144;planAreaSqft+=area;topAreaSqft+=area*Math.sqrt(1+topPlane.x**2+topPlane.z**2);};

 for(const triangle of surface.proposedTriangles){if(!boundsOverlap(requested,polygonBounds([planOf(triangle)])))continue;const zone=siteClip(polygons,[planOf(triangle)],'intersection');for(const cell of siteSolidCells(zone)){const filled=positive(cell,subtract(triangle.plane,floor));if(!filled.length)continue;const toCeiling=subtract(triangle.plane,ceiling);add(positive(filled,toCeiling),ceiling);if(!filled.every(v=>Math.abs(sitePlaneHeight(toCeiling,v.x,v.y))<EPS))add(positive(filled,negate(toCeiling)),triangle.plane);}}

 return {regions,volumeYd3,planAreaSqft,topAreaSqft};

}

/** Coverage at or below proposed ground, for buried reinforcement. */

export function sitePolygonsBelowGround(surface:SiteSurface,polygons:SiteBoundaryPoint[][],elevationIn:number){const out:SiteBoundaryPoint[][]=[],requested=polygonBounds(polygons),height={x:0,z:0,constant:elevationIn};for(const triangle of surface.proposedTriangles){if(!boundsOverlap(requested,polygonBounds([planOf(triangle)])))continue;for(const cell of siteSolidCells(siteClip(polygons,[planOf(triangle)],'intersection'))){const p=positive(cell,subtract(triangle.plane,height));if(p.length)out.push(p);}}return siteClip(out);}

/** Exact vertical-area allowance along a directed retained-side line. */

export function siteRetainedSideArea(surface:SiteSurface,a:SiteBoundaryPoint,b:SiteBoundaryPoint,bottomIn:number,topIn:number){const length=Math.hypot(b.x-a.x,b.y-a.y),faces=surface.lineBreaks(a,b);let areaIn2=0;for(let i=0;i+1<faces.length;i++){const lo=faces[i],hi=faces[i+1],at=(t:number)=>surface.sample(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),q0=at(lo+(hi-lo)*.25),q1=at(lo+(hi-lo)*.75);if(q0===undefined||q1===undefined)return {areaSqft:0,complete:false};const h0=q0-(q1-q0)/2,h1=q1+(q1-q0)/2,cuts=[0,1];if(Math.abs(h1-h0)>EPS)for(const level of [bottomIn,topIn]){const t=(level-h0)/(h1-h0);if(t>EPS&&t<1-EPS)cuts.push(t);}cuts.sort((a,b)=>a-b);const depth=(t:number)=>Math.max(0,Math.min(topIn,h0+(h1-h0)*t)-bottomIn);for(let j=0;j+1<cuts.length;j++)areaIn2+=length*(hi-lo)*(cuts[j+1]-cuts[j])*(depth(cuts[j])+depth(cuts[j+1]))/2;}return {areaSqft:areaIn2/144,complete:true};}

const siteRectangle=(x:number,z:number,w:number,d:number,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+c*u*w/2-s*v*d/2,y:z+s*u*w/2+c*v*d/2}));};

const boxPlan=(box:Box)=>box.polygon??siteRectangle(box.x,box.z,box.w,box.d,-(box.angle??0));

/** Member underside minus measured ground over the whole plan envelope,

 * including interior TIN vertices; the section is a planning envelope. */

function memberClearance(surface:SiteSurface,member:Member){const dx=member.b.x-member.a.x,dz=member.b.z-member.a.z,length=Math.hypot(dx,dz),slope=length?(member.b.y-member.a.y)/(length*length):0,plane={x:dx*slope,z:dz*slope,constant:member.a.y-member.depth/2-dx*slope*member.a.x-dz*slope*member.a.z},polygon=siteRectangle((member.a.x+member.b.x)/2,(member.a.z+member.b.z)/2,Math.max(member.width,length),member.width,Math.atan2(dz,dx)),bounds=polygonBounds([polygon]);let min=Infinity,max=-Infinity,covered=0;for(const triangle of surface.proposedTriangles){if(!boundsOverlap(bounds,polygonBounds([planOf(triangle)])))continue;const zone=siteClip([polygon],[planOf(triangle)],'intersection');covered+=siteArea(zone);for(const v of zone.flat()){const clearance=sitePlaneHeight(plane,v.x,v.y)-sitePlaneHeight(triangle.plane,v.x,v.y);min=Math.min(min,clearance);max=Math.max(max,clearance);}}return {min,max,complete:Math.max(0,siteArea([polygon])-covered)<.001};}

/** Measured deck/stair validation on the existing deck datum. The final

 * termination is compared to the proposed grade; stairs are never moved. */

export function siteDeckClearances(surface:SiteSurface,deck:DeckTakeoff,data?:DeckData){

 const warnings:string[]=[],treads=deck.treads.map(t=>{const range=surface.extrema([boxPlan(t)]);return {min:t.y+t.h/2-range.max,complete:range.complete};}),landings=deck.levels.filter(l=>l.kind==='landing').map(l=>{const range=surface.extrema([l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))]);return {min:l.top-range.max,complete:range.complete};}),frames=deck.levels.flatMap(l=>[...l.joists,...l.beams,...(l.rim??[])]).map(m=>memberClearance(surface,m)),stringers=deck.stringers.map(m=>memberClearance(surface,m));

 const stairCoverageComplete=[...treads,...landings].every(r=>r.complete),framingCoverageComplete=frames.every(r=>r.complete),stringerCoverageComplete=stringers.every(r=>r.complete),minimum=(ranges:{min:number;complete:boolean}[])=>ranges.length&&ranges.every(r=>r.complete&&Number.isFinite(r.min))?Math.min(...ranges.map(r=>r.min)):null,minStairClearanceIn=minimum([...treads,...landings]),minLandingClearanceIn=minimum(landings),minFramingClearanceIn=minimum(frames),minStringerEnvelopeClearanceIn=minimum(stringers);

 if(!stairCoverageComplete)warnings.push('Survey coverage is incomplete at a stair tread or landing; walking-surface clearance is pending.');

 if(!framingCoverageComplete||!stringerCoverageComplete)warnings.push('Survey coverage is incomplete at deck framing or a stair stringer; the affected clearance is pending.');

 if(minStairClearanceIn!==null&&minStairClearanceIn<=0)warnings.push('Proposed terrain intersects or covers a deck stair tread or landing walking surface; revise grading or the stair design.');

 if(minFramingClearanceIn!==null&&minFramingClearanceIn<=0)warnings.push('Proposed terrain intersects the modeled deck framing envelope; revise grading or deck elevations.');

 if(minStringerEnvelopeClearanceIn!==null&&minStringerEnvelopeClearanceIn<0)warnings.push('A stair stringer planning envelope meets proposed ground; verify the actual notched section, lower bearing and grading clearance.');

 const terminalIds=[...new Set(deck.flights.filter(f=>f.kind==='grade').map(f=>stairTargetId(f.id)))],stairTerminations=terminalIds.flatMap(id=>{

  const group=deck.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===id),expectedIn=Math.min(...group.map(f=>f.end.y)),terminal=group.filter(f=>Math.abs(f.end.y-expectedIn)<1e-6),polygons=stairLandingPolygons(deck,id),target=data?.stairTargets?.find(t=>t.flightId===id);let range=surface.extrema(polygons),source='proposed ground';

  if(target?.surface==='patio'){source='selected patio';const f=data?.yardFeatures?.find(f=>f.id===target.patioId&&f.enabled&&f.kind==='patio'),grade=f?surface.sample(f.xFt*12,f.zFt*12):undefined,coverage=f?siteArea(siteClip(polygons,yardFeatureOutline(f),'difference')):Infinity;if(f&&grade!==undefined&&coverage<.001&&range.complete){const plane=patioTopPlane(f,grade),heights=polygons.flat().map(p=>sitePlaneHeight(plane,p.x,p.y));range={min:Math.min(...heights),max:Math.max(...heights),complete:true};}else range={min:Infinity,max:-Infinity,complete:false};}

  const maxMismatchIn=range.complete&&Number.isFinite(range.min+range.max)?Math.max(Math.abs(range.min-expectedIn),Math.abs(range.max-expectedIn)):null;

  if(!range.complete)warnings.push(`Stair termination ${id} is outside measured coverage or its full selected landing surface; final elevation and riser are pending.`);else if(maxMismatchIn!==null&&maxMismatchIn>.25)warnings.push(`Stair termination ${id} remains at ${expectedIn.toFixed(1)} in while ${source} is ${range.min.toFixed(1)}–${range.max.toFixed(1)} in over the full landing; revise the endpoint/risers or explicit grading.`);

  return terminal.map(f=>({flightId:f.id,expectedIn:f.end.y,groundMinIn:Number.isFinite(range.min)?range.min:null,groundMaxIn:Number.isFinite(range.max)?range.max:null,maxMismatchIn,complete:range.complete}));

 });

 return {warnings,stairCoverageComplete,framingCoverageComplete,stringerCoverageComplete,minStairClearanceIn,minLandingClearanceIn,minFramingClearanceIn,minStringerEnvelopeClearanceIn,stairTerminations};

}

/** Shared measured excavation: existing soil to the deeper of explicit

 * proposed grading and constant construction formations. A formation owns

 * its area once, even where it crosses several survey/proposed faces. */

export function integrateSiteExcavation(surface:SiteSurface,formations:SiteFormation[]){

 if(formations.some(f=>f.formationPlane))return integratePlaneExcavation(surface,formations);

 const ordered=formations.filter(f=>f.polygons.length).map(f=>({...f,bounds:polygonBounds(f.polygons)})).sort((a,b)=>a.bottomIn-b.bottomIn),regions:SiteExcavationRegion[]=[];let fillYd3=0;

 const add=(cell:SiteBoundaryPoint[],formation:SitePlane,existing:SitePlane,featureId:string)=>{const cut=positive(cell,subtract(existing,formation));if(cut.length){const volume=positiveIntegral(cut,subtract(existing,formation))/46656;if(volume>EPS)regions.push({featureId,polygon:cut,bottomIn:sitePlaneHeight(formation,cut[0].x,cut[0].y),formationPlane:formation,volumeYd3:volume});}fillYd3+=positiveIntegral(cell,subtract(formation,existing))/46656;};

 for(const triangle of surface.proposedTriangles){const original=planOf(triangle),triangleBounds=polygonBounds([original]);let available=[original];for(const f of ordered){if(!boundsOverlap(triangleBounds,f.bounds))continue;const zone=siteClip(available,f.polygons,'intersection');if(!zone.length)continue;const floor={x:0,z:0,constant:f.bottomIn},difference=subtract(triangle.plane,floor);for(const cell of siteSolidCells(zone)){const lowerFloor=positive(cell,difference),lowerGrading=positive(cell,negate(difference));if(lowerFloor.length)add(lowerFloor,floor,triangle.existingPlane,f.featureId);if(lowerGrading.length&&!cell.every(v=>Math.abs(sitePlaneHeight(difference,v.x,v.y))<EPS))add(lowerGrading,triangle.plane,triangle.existingPlane,`site-grading:${triangle.gradingId??'existing'}`);}available=siteClip(available,f.polygons,'difference');if(!available.length)break;}for(const cell of siteSolidCells(available))add(cell,triangle.plane,triangle.existingPlane,`site-grading:${triangle.gradingId??'existing'}`);}

 return {regions,excavationYd3:regions.reduce((n,r)=>n+r.volumeYd3,0),fillYd3};

}



/** Incrementally partition the lower envelope at every competing affine plane

 * crossing. Each final cell has exactly one owner, including grading. */

function integratePlaneExcavation(surface:SiteSurface,formations:SiteFormation[]){

 const requested=formations.filter(f=>f.polygons.length).map(f=>({...f,bounds:polygonBounds(f.polygons),plane:f.formationPlane??{x:0,z:0,constant:f.bottomIn}}));

 const regions:SiteExcavationRegion[]=[];let fillYd3=0;

 for(const triangle of surface.proposedTriangles){

  const original=planOf(triangle),bounds=polygonBounds([original]);let cells=siteSolidCells([original]).map(polygon=>({polygon,plane:triangle.plane,featureId:`site-grading:${triangle.gradingId??'existing'}`}));

  for(const f of requested){if(boundsOverlap(bounds,f.bounds))cells=applyPlaneFormation(cells,siteClip(f.polygons,[original],'intersection'),f.plane,f.featureId,siteClip,siteSolidCells);}

  for(const cell of cells){const delta=subtract(triangle.existingPlane,cell.plane),cut=positive(cell.polygon,delta),volume=cut.length?positiveIntegral(cut,delta)/46656:0;

   if(volume>EPS)regions.push({featureId:cell.featureId,polygon:cut,bottomIn:sitePlaneHeight(cell.plane,cut[0].x,cut[0].y),formationPlane:cell.plane,volumeYd3:volume});

   fillYd3+=positiveIntegral(cell.polygon,negate(delta))/46656;

  }

 }return {regions,excavationYd3:regions.reduce((n,r)=>n+r.volumeYd3,0),fillYd3};

}



import * as siteEngine from './siteSurfaceEngine';

import {registerSiteEngine} from './siteSurface';

registerSiteEngine(siteEngine);

