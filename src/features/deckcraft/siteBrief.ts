/**
 * S1 site brief for the AI Site Designer: a compact (about 2 KB), deterministic summary of a design's measured yard,
 * in fields for a model and in `lines` for a homeowner. Lazy: import it dynamically after `loadSiteBriefRuntime()`.
 *
 * Plan inches throughout: x to the right as seen from the yard (facing the house; left is negative, as everywhere in
 * DeckCraft), z away from the house (the house side negative), elevations on the deck's datum (0 = the ground at the
 * deck's back-left corner). The yard's shape (elevation, plane, zones, humps, low spots) is the measured ground; the
 * door and the stair feet read the design's ground (survey, grading, ground-fit banks), which is what they meet.
 * Nothing is sampled outside survey coverage: unmeasured ground is unknown (null), never guessed.
 */
import type {CompassPoint,DeckData} from './types';
import type {SiteBoundaryPoint} from './siteModel';
import {designSiteSurface,loadSiteEngine,siteArea,siteClip,siteSolidCells,type SiteSurface,type SiteSurfaceTriangle} from './siteSurface';
import {siteContours} from './siteContours';
import {getHouseConfig} from './houseSettings';
import {getHouseWalls,houseOutline,openingHidden,openingWallId} from './houseFootprint';
import {buildDeckTakeoff,type DeckTakeoff} from './deckTakeoff';
import {buildYardModel,loadAdvancedYardRuntime} from './yardModel';
import {loadStairTargetsRuntime,stairTargetId} from './stairTargets';

export type SiteBriefZoneKind='flat'|'gentle'|'moderate'|'steep';
export interface SiteBriefSpot {x:number;z:number;label:string}
export interface SiteBriefZone {id:string;kind:SiteBriefZoneKind;areaSqft:number;centroid:{x:number;z:number};meanIn:number;
  /** Typical slope of the ground that gives the zone its kind (area-weighted, between the shots). */
  slopePct:number;
  /** From the door to the nearest edge of the zone; null without a door. */
  distanceToDoorFt:number|null;
  /** Outline as [x, z] points (0.1 in), simplified to at most 12. */
  polygon:[number,number][]}
/** A hump or low spot, at a shot: `label` is the shot id. */
export interface SiteBriefFeature {label:string;x:number;z:number;elevationIn:number;
  /** Height above (hump) or depth below (low spot) the shots round it, once the overall slope is taken out. */
  prominenceIn:number;
  /** Present on the edge of the survey: the ground beyond it is unmeasured. */
  atEdge?:true}
/** Where a stair to grade comes down: its bottom on the ground (`bottomIn`) or on a landing patio. */
export interface SiteBriefStair {flightId:string;footAt:{x:number;z:number};groundAtFootIn:number|null;bottomIn?:number;landing?:{featureId:string;finishedIn:number}}
export interface SiteBrief {units:'in';datum:string;
  /** bbox: [minX, minZ, maxX, maxZ]. Positions are whole inches except zone outlines; elevations 0.1 in. */
  coverage:{areaSqft:number;bbox:[number,number,number,number];widthFt:number;depthFt:number};
  elevation:{minIn:number;maxIn:number;rangeIn:number;highAt:SiteBriefSpot;lowAt:SiteBriefSpot};
  /** Least-squares plane through the shots: its rise per run to +x and to +z, the way it falls, the scatter about it. */
  plane:{slopePct:number;risePctX:number;risePctZ:number;downhill:{dx:number;dz:number};fallsToward:string;fitRmsIn:number};
  /** The yard (survey less the house) on a grid: flat ≤ 2 %, gentle ≤ 5 %, moderate ≤ 10 %, steep beyond; flattest first. */
  zones:SiteBriefZone[];
  /** Humps stand above the overall slope; low spots sit below it where water collects (no lower ground beside them). */
  features:{humps:SiteBriefFeature[];lowSpots:SiteBriefFeature[]};
  house:{sillIn:number|null;doorAt:{x:number;z:number}|null;groundAtDoorIn:number|null;sillAboveGroundIn:number|null;deckTopIn:number|null;stairs:SiteBriefStair[]};
  coverageWarnings:string[];designWarnings:string[];
  /** Only when the caller gives northDeg (northern hemisphere: the midday sun is due south). */
  orientation:{northDeg:number;yardFaces:string;sunSide:string}|null;
  lines:string[]}
export interface SiteBriefOptions {
  /** Compass bearing the back yard faces (straight out from the house, +z), degrees clockwise from north: 0 = the yard
   * faces north, 180 = south. Without it the brief never says where the sun is. */
  northDeg?:number;
  /** Zone grid cell, inches (default 24, 6–120). */
  gridIn?:number;
  /** JSON size the brief is fitted to, bytes (default SITE_BRIEF_BUDGET, 2048); larger keeps more lines and detail. */
  maxBytes?:number}

/** Loads what a brief needs: measured terrain, the advanced yard model and stair targets. */
export async function loadSiteBriefRuntime(){await Promise.all([loadSiteEngine(),loadAdvancedYardRuntime(),loadStairTargetsRuntime()]);}
const BEARING:Record<CompassPoint,number>={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
/** `northDeg` from the permit site's "back yard faces" choice. */
export const northDegFromYardFaces=(faces:CompassPoint)=>BEARING[faces];

type P=SiteBoundaryPoint;
type Zone=SiteBriefZone&{rings:P[][]};
const r2=(v:number)=>Math.round(v*100)/100+0,r1=(v:number)=>Math.round(v*10)/10+0,r0=(v:number)=>Math.round(v)+0,ft=(inches:number)=>r1(inches/12);
const signed=(v:number)=>`${v>0?'+':v<0?'-':''}${r1(Math.abs(v))}`;
const KINDS:SiteBriefZoneKind[]=['flat','gentle','moderate','steep'];
const kindOf=(slopePct:number):SiteBriefZoneKind=>slopePct<=2?'flat':slopePct<=5?'gentle':slopePct<=10?'moderate':'steep';
const SEEN=' (seen from the yard)',MARGIN_IN=36,SLIVER_IN2=6*144,PROMINENCE_IN=2,MAX_POINTS=12,BUDGET=2048;
export const SITE_BRIEF_BUDGET=BUDGET;

/** Plain words for a plan direction, relative to the house. */
function direction(dx:number,dz:number){
  if(Math.hypot(dx,dz)<1e-9)return 'nowhere: the ground is level';
  const s=Math.round(Math.atan2(dz,dx)/(Math.PI/4));// 0 right, 2 away from the house, ±4 left, −2 toward it
  return ['toward the right'+SEEN,'away from the house and to the right'+SEEN,'away from the house','away from the house and to the left'+SEEN,'toward the left'+SEEN,'toward the house and to the left'+SEEN,'toward the house','toward the house and to the right'+SEEN][((s%8)+8)%8];
}
const signedArea=(poly:P[])=>poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a.x*b.y-b.x*a.y;},0)/2;
function centroidOf(poly:P[]){const a=signedArea(poly);if(Math.abs(a)<1e-12)return {x:poly[0].x,y:poly[0].y};let x=0,y=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],k=p.x*q.y-q.x*p.y;x+=(p.x+q.x)*k;y+=(p.y+q.y)*k;}return {x:x/(6*a),y:y/(6*a)};}
function clipHalf(poly:P[],axis:'x'|'y',c:number,above:boolean){const out:P[]=[],keep=(p:P)=>above?p[axis]>=c:p[axis]<=c;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ka=keep(a);if(ka)out.push(a);if(ka!==keep(b)){const t=(c-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}return out;}
const clipCell=(poly:P[],x0:number,z0:number,x1:number,z1:number)=>([['x',x0,true],['x',x1,false],['y',z0,true],['y',z1,false]] as const).reduce<P[]>((p,[axis,c,above])=>p.length<3?p:clipHalf(p,axis,c,above),poly);
function segmentDistance(p:P,a:P,b:P){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function inside(rings:P[][],p:P){let c=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;}
const edgeDistance=(rings:P[][],p:P)=>Math.min(...rings.map(r=>Math.min(...r.map((a,i)=>segmentDistance(p,a,r[(i+1)%r.length])))));
const covered=(rings:P[][],p:P)=>inside(rings,p)||edgeDistance(rings,p)<.01;
const crosses=(a:P,b:P,c:P,d:P)=>{const o=(p:P,q:P,r:P)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
const simple=(ring:P[])=>ring.every((a,i)=>ring.every((c,j)=>j<=i+1||i===0&&j===ring.length-1||!crosses(a,ring[(i+1)%ring.length],c,ring[(j+1)%ring.length])));
/** Closed-ring Douglas–Peucker, loosened until at most `max` points; the most detailed outline that does not cross itself. */
function simplify(ring:P[],max:number):P[]{
  const pts=ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];return Math.abs((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))>1e-6*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));});
  if(pts.length<=max)return pts;
  const dp=(seq:P[],tol:number):P[]=>{let worst=0,at=0;for(let i=1;i<seq.length-1;i++){const d=segmentDistance(seq[i],seq[0],seq[seq.length-1]);if(d>worst){worst=d;at=i;}}return worst>tol?[...dp(seq.slice(0,at+1),tol).slice(0,-1),...dp(seq.slice(at),tol)]:[seq[0],seq[seq.length-1]];};
  // Split at the vertex farthest from the first, so both halves are open chains.
  let far=0;for(let i=1;i<pts.length;i++)if(Math.hypot(pts[i].x-pts[0].x,pts[i].y-pts[0].y)>Math.hypot(pts[far].x-pts[0].x,pts[far].y-pts[0].y))far=i;
  let first:P[]|undefined;
  for(let tol=.25;tol<1e6;tol*=1.25){const out=[...dp(pts.slice(0,far+1),tol).slice(0,-1),...dp([...pts.slice(far),pts[0]],tol).slice(0,-1)];if(out.length>max||out.length<3)continue;first??=out;if(simple(out))return out;}
  return first??pts.slice(0,max);
}
const thin=(poly:[number,number][],max:number)=>poly.length<=max?poly:simplify(poly.map(([x,y])=>({x,y})),max).map(p=>[p.x,p.y] as [number,number]);

/** Least-squares plane e = a·x + c·z + d through the points (centred for conditioning). */
function fitPlane(pts:{xIn:number;zIn:number;elevationIn:number}[]){
  const n=pts.length,mx=pts.reduce((s,p)=>s+p.xIn,0)/n,mz=pts.reduce((s,p)=>s+p.zIn,0)/n,me=pts.reduce((s,p)=>s+p.elevationIn,0)/n;
  let sxx=0,sxz=0,szz=0,sxe=0,sze=0;for(const p of pts){const x=p.xIn-mx,z=p.zIn-mz,e=p.elevationIn-me;sxx+=x*x;sxz+=x*z;szz+=z*z;sxe+=x*e;sze+=z*e;}
  const det=sxx*szz-sxz*sxz,ok=Math.abs(det)>1e-9,a=ok?(sxe*szz-sze*sxz)/det:0,c=ok?(sze*sxx-sxe*sxz)/det:0,at=(x:number,z:number)=>me+a*(x-mx)+c*(z-mz);
  return {a,c,at,rms:Math.sqrt(pts.reduce((s,p)=>s+(p.elevationIn-at(p.xIn,p.zIn))**2,0)/n)};
}

/** Where a point sits in the measured yard: near the house / mid-yard / far out, and left / centre / right. */
function placeOf(b:SiteSurface['bounds'],x:number,z:number){
  const z0=Math.max(0,b.minZ),u=(x-b.minX)/Math.max(1,b.maxX-b.minX),v=(z-z0)/Math.max(1,b.maxZ-z0);
  return `${v<1/3?'near the house':v>2/3?'far from the house':'mid-yard'}, ${u<1/3?'left':u>2/3?'right':'centre'}`;
}

interface Cell {i:number;j:number;area:number;h:number;x:number;z:number;slope:number;kind:SiteBriefZoneKind;region:number}
interface ZoneGrid {cells:Cell[];at:Map<number,Cell>;g:number;gx:number;gz:number;nx:number;nz:number;house:P[][]}
/** Grid cells over the yard (survey less the house): area, mean height, centroid and slope from the measured faces. */
function zoneGrid(surface:SiteSurface,house:P[][],gridIn:number):ZoneGrid{
  const b=surface.bounds,g=Math.min(120,Math.max(6,gridIn)),gx=Math.floor(b.minX/g)*g,gz=Math.floor(b.minZ/g)*g,nx=Math.max(1,Math.ceil((b.maxX-gx)/g)),nz=Math.max(1,Math.ceil((b.maxZ-gz)/g)),at=new Map<number,Cell>();
  const hb=house.flat(),hx0=Math.min(...hb.map(p=>p.x)),hx1=Math.max(...hb.map(p=>p.x)),hz0=Math.min(...hb.map(p=>p.y)),hz1=Math.max(...hb.map(p=>p.y));
  for(const t of surface.existingTriangles){
    const poly=t.vertices.map(v=>({x:v.xIn,y:v.zIn})),slope=Math.hypot(t.plane.x,t.plane.z)*100,xs=poly.map(p=>p.x),zs=poly.map(p=>p.y);
    for(let i=Math.max(0,Math.floor((Math.min(...xs)-gx)/g));i<=Math.min(nx-1,Math.floor((Math.max(...xs)-gx)/g));i++)for(let j=Math.max(0,Math.floor((Math.min(...zs)-gz)/g));j<=Math.min(nz-1,Math.floor((Math.max(...zs)-gz)/g));j++){
      const piece=clipCell(poly,gx+i*g,gz+j*g,gx+(i+1)*g,gz+(j+1)*g);if(piece.length<3)continue;
      const xs2=piece.map(p=>p.x),zs2=piece.map(p=>p.y),overlapsHouse=hb.length&&Math.max(...xs2)>hx0&&Math.min(...xs2)<hx1&&Math.max(...zs2)>hz0&&Math.min(...zs2)<hz1;
      for(const part of overlapsHouse?siteSolidCells(siteClip([piece],house,'difference')):[piece]){const a=Math.abs(signedArea(part));if(a<1e-6)continue;const c=centroidOf(part),k=i+j*nx,cell=at.get(k)??{i,j,area:0,h:0,x:0,z:0,slope:0,kind:'flat',region:-1};cell.area+=a;cell.h+=a*(t.plane.x*c.x+t.plane.z*c.y+t.plane.constant);cell.x+=a*c.x;cell.z+=a*c.y;cell.slope+=a*slope;at.set(k,cell);}
    }
  }
  const cells=[...at.keys()].sort((p,q)=>p-q).map(k=>at.get(k)!);for(const c of cells)c.kind=kindOf(c.slope/c.area);
  return {cells,at,g,gx,gz,nx,nz,house};
}
/** Cells of one kind joined into connected zones; slivers (under 6 sq ft, or a larger `sliverIn2`) join their largest
 * neighbour, smallest first, and zones of one kind that meet then become one. */
function zonesOf(grid:ZoneGrid,surface:SiteSurface,door:P|null,sliverIn2=SLIVER_IN2):Zone[]{
  const {cells,at,g,gx,gz,nx,nz,house}=grid;for(const c of cells)c.region=-1;
  const near=(c:Cell)=>[[1,0],[-1,0],[0,1],[0,-1]].flatMap(([di,dj])=>{const i=c.i+di,j=c.j+dj,n=i>=0&&i<nx&&j>=0&&j<nz?at.get(i+j*nx):undefined;return n?[n]:[];});
  const regions:{kind:SiteBriefZoneKind;cells:Cell[];area:number}[]=[];
  for(const seed of cells){if(seed.region>=0)continue;const id=regions.length,list=[seed];seed.region=id;for(let q=0;q<list.length;q++)for(const n of near(list[q]))if(n.region<0&&n.kind===seed.kind){n.region=id;list.push(n);}regions.push({kind:seed.kind,cells:list,area:list.reduce((n,c)=>n+c.area,0)});}
  const touching=(id:number)=>[...new Set(regions[id].cells.flatMap(c=>near(c).map(n=>n.region)))].filter(r=>r!==id&&regions[r].cells.length).sort((p,q)=>p-q);
  const merge=(from:number,into:number)=>{for(const c of regions[from].cells){c.region=into;regions[into].cells.push(c);}regions[into].area+=regions[from].area;regions[from].cells=[];regions[from].area=0;};
  for(const id of regions.map((_,i)=>i).sort((p,q)=>regions[p].area-regions[q].area||p-q)){if(!regions[id].cells.length||regions[id].area>=sliverIn2)continue;const into=touching(id).sort((p,q)=>regions[q].area-regions[p].area||p-q)[0];if(into!==undefined)merge(id,into);else{for(const c of regions[id].cells)c.region=-2;regions[id].cells=[];}}
  for(let id=0;id<regions.length;id++){if(!regions[id].cells.length)continue;for(let other=touching(id).find(r=>regions[r].kind===regions[id].kind);other!==undefined;other=touching(id).find(r=>regions[r].kind===regions[id].kind))merge(other,id);}
  const zones:Zone[]=[];
  for(const r of regions){
    if(!r.cells.length)continue;
    const area=r.area,core=r.cells.filter(c=>c.kind===r.kind),squares=[...r.cells].sort((p,q)=>p.i-q.i||p.j-q.j).map(c=>[{x:gx+c.i*g,y:gz+c.j*g},{x:gx+(c.i+1)*g,y:gz+c.j*g},{x:gx+(c.i+1)*g,y:gz+(c.j+1)*g},{x:gx+c.i*g,y:gz+(c.j+1)*g}]);
    let rings=siteClip(siteClip(squares),surface.coverage,'intersection');if(house.length)rings=siteClip(rings,house,'difference');
    const outer=rings.filter(ring=>signedArea(ring)>0),outline=(outer.length?outer:rings).reduce((best,ring)=>Math.abs(signedArea(ring))>Math.abs(signedArea(best))?ring:best,rings[0]??[]);
    if(outline.length<3)continue;
    zones.push({id:'',kind:r.kind,areaSqft:r1(area/144),centroid:{x:r0(r.cells.reduce((n,c)=>n+c.x,0)/area),z:r0(r.cells.reduce((n,c)=>n+c.z,0)/area)},meanIn:r1(r.cells.reduce((n,c)=>n+c.h,0)/area),slopePct:r1(core.reduce((n,c)=>n+c.slope,0)/core.reduce((n,c)=>n+c.area,0)),distanceToDoorFt:door?ft(inside(rings,door)?0:edgeDistance(rings,door)):null,polygon:simplify(outline,MAX_POINTS).map(p=>[r1(p.x),r1(p.y)]),rings});
  }
  zones.sort((p,q)=>KINDS.indexOf(p.kind)-KINDS.indexOf(q.kind)||q.areaSqft-p.areaSqft||p.centroid.x-q.centroid.x||p.centroid.z-q.centroid.z);
  zones.forEach((z,i)=>{z.id=`z${i+1}`;});
  return zones;
}

/** Humps and low spots at the shots, once the overall plane is taken out: a shot above (below) every shot round it by
 * PROMINENCE_IN or more against their mean. Round it means its neighbours in the survey's triangulation (found through
 * the points where the surface splits Delaunay faces) and, so a dense survey still shows broad humps, every shot within
 * `radiusIn`. A low spot must also hold water: no lower ground beside it (siteContours' low points). */
function featuresOf(triangles:SiteSurfaceTriangle[],shots:{id:string;xIn:number;zIn:number;elevationIn:number}[],plane:ReturnType<typeof fitPlane>,coverage:P[][],radiusIn:number){
  const key=(x:number,z:number)=>`${Math.round(x*1e4)}/${Math.round(z*1e4)}`,node=new Map<string,number>(),links:Set<number>[]=[],idOf=(x:number,z:number)=>{const k=key(x,z);let n=node.get(k);if(n===undefined){n=links.length;node.set(k,n);links.push(new Set());}return n;};
  const shotNode=shots.map(s=>idOf(s.xIn,s.zIn)),shotOf=new Map(shotNode.map((n,i)=>[n,i]));
  for(const t of triangles){const ids=t.vertices.map(v=>idOf(v.xIn,v.zIn));for(const a of ids)for(const b of ids)if(a!==b)links[a].add(b);}
  const sinks=new Set(siteContours(triangles,12).lowPoints.map(v=>node.get(key(v.xIn,v.zIn)))),residual=shots.map(s=>s.elevationIn-plane.at(s.xIn,s.zIn)),humps:SiteBriefFeature[]=[],lowSpots:SiteBriefFeature[]=[];
  // Shots bucketed by radius-sized cells for the radius search.
  const cell=(x:number,z:number)=>`${Math.floor(x/radiusIn)}/${Math.floor(z/radiusIn)}`,buckets=new Map<string,number[]>();shots.forEach((s,i)=>{const k=cell(s.xIn,s.zIn),list=buckets.get(k);if(list)list.push(i);else buckets.set(k,[i]);});
  shots.forEach((s,i)=>{
    const around=new Set<number>();for(const m of links[shotNode[i]]){const j=shotOf.get(m);if(j!==undefined)around.add(j);else for(const m2 of links[m]){const j2=shotOf.get(m2);if(j2!==undefined&&j2!==i)around.add(j2);}}
    const cx=Math.floor(s.xIn/radiusIn),cz=Math.floor(s.zIn/radiusIn);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get(`${cx+dx}/${cz+dz}`)??[])if(j!==i&&Math.hypot(shots[j].xIn-s.xIn,shots[j].zIn-s.zIn)<=radiusIn)around.add(j);
    if(!around.size)return;
    const r=residual[i];let mean=0,above=true,below=true;for(const j of around){const v=residual[j];mean+=v;if(v>=r)above=false;if(v<=r)below=false;}mean/=around.size;
    const make=(prominence:number):SiteBriefFeature=>({label:s.id,x:r0(s.xIn),z:r0(s.zIn),elevationIn:r1(s.elevationIn),prominenceIn:r1(prominence),...(edgeDistance(coverage,{x:s.xIn,y:s.zIn})<.5?{atEdge:true as const}:{})});
    if(above&&r-mean>=PROMINENCE_IN)humps.push(make(r-mean));
    if(below&&mean-r>=PROMINENCE_IN&&sinks.has(shotNode[i]))lowSpots.push(make(mean-r));
  });
  const top=(list:SiteBriefFeature[])=>list.sort((p,q)=>q.prominenceIn-p.prominenceIn||p.label.localeCompare(q.label)).slice(0,3);
  return {humps:top(humps),lowSpots:top(lowSpots)};
}

/** Ground-related deck and yard messages, first clause only (the estimate keeps the full text); patio and feature ground
 * messages first, then clearances, then survey coverage. */
const GROUND=/ground|survey|grad(e|ing)\b|terrain|coverage|clearance|\bdig\b|exposed|\bbank|\bcut\b|\bfill\b|drain/i;
function designWarningsOf(messages:string[]){
  const rank=(w:string)=>/^[^:]{1,60}: /.test(w)?0:/clearance/i.test(w)?1:2,out:string[]=[];
  for(const w of messages.filter(m=>GROUND.test(m)).map((m,i)=>({m,i})).sort((p,q)=>rank(p.m)-rank(q.m)||p.i-q.i).map(({m})=>m)){
    let s=w.replace(/^Deck elevations remain on their original zero datum\.\s*/,'').split(/(?<=\.)\s|;\s/)[0].replace(/[.;]$/,'');
    if(s.length>90)s=s.replace(/ at its [\w -]+ edges?$/,'');
    if(s.length>90)s=s.slice(0,s.lastIndexOf(' ',87))+'...';
    if(!out.includes(s))out.push(s);
  }
  return out;
}

/** The brief, or null for a design without a survey. Throws while measured terrain is still loading. */
export function siteBrief(data:DeckData,opts:SiteBriefOptions={}):SiteBrief|null{
  if(!data.siteModel)return null;
  const surface=designSiteSurface(data);if(!surface)return null;
  const coverage=surface.coverage,b=surface.bounds,allShots=data.siteModel.points,shots=allShots.filter(p=>covered(coverage,{x:p.xIn,y:p.zIn}));
  const labelAt=(x:number,z:number)=>allShots.reduce((best,p)=>Math.hypot(p.xIn-x,p.zIn-z)<Math.hypot(best.xIn-x,best.zIn-z)?p:best,allShots[0]).id;
  const vertices=surface.existingTriangles.flatMap(t=>t.vertices),lo=vertices.reduce((a,v)=>v.elevationIn<a.elevationIn?v:a,vertices[0]),hi=vertices.reduce((a,v)=>v.elevationIn>a.elevationIn?v:a,vertices[0]);
  const fit=fitPlane(shots.length>=3?shots:vertices),slope=Math.hypot(fit.a,fit.c),down=slope>1e-9?{dx:-fit.a/slope,dz:-fit.c/slope}:{dx:0,dz:0};
  const sample=(x:number,z:number)=>{const h=surface.sample(x,z,'proposed');return h===undefined||!Number.isFinite(h)?null:h;};
  // House: the sill, the door that opens toward the yard, the deck and where its stairs meet the ground.
  const house=getHouseConfig(data),walls=getHouseWalls(data),doors=house.openings.filter(o=>o.type==='Door'&&!openingHidden(o,walls,house)),door=doors.find(o=>openingWallId(o,house).endsWith('-front'))??doors[0];
  const wall=door&&walls.find(w=>w.id===openingWallId(door,house)),doorAt=door&&wall?{x:wall.a.x+(wall.b.x-wall.a.x)*door.offsetPct/100,y:wall.a.y+(wall.b.y-wall.a.y)*door.offsetPct/100}:null;
  const groundAtDoor=doorAt&&wall?sample(doorAt.x+wall.outward.x*6,doorAt.y+wall.outward.y*6):null,sill=house.floorHeightIn??door?.bottomIn??null;
  const messages:string[]=[];let takeoff:DeckTakeoff|undefined;
  try{takeoff=buildDeckTakeoff(data);messages.push(...takeoff.issues,...buildYardModel(data,takeoff).warnings);}catch(error){messages.push(`Ground checks unavailable: ${error instanceof Error?error.message:'error'}`);}
  const main=takeoff?.levels.find(l=>(l.kind??'deck')==='deck'),stairs:SiteBriefStair[]=[],feet=new Map<string,DeckTakeoff['flights'][number]>();
  for(const f of takeoff?.flights??[])if(f.kind==='grade'){const id=stairTargetId(f.id),seen=feet.get(id);if(!seen||f.end.y<seen.end.y)feet.set(id,f);}
  for(const [flightId,f] of feet){const out=f.outward??{x:0,y:1},target=data.stairTargets?.find(t=>t.flightId===flightId),patio=target?.surface==='patio'?data.yardFeatures?.find(y=>y.id===target.patioId):undefined,ground=sample(f.end.x+out.x*6,f.end.z+out.y*6);
    stairs.push({flightId,footAt:{x:r0(f.end.x),z:r0(f.end.z)},groundAtFootIn:ground===null?null:r1(ground),...(patio?{landing:{featureId:patio.id,finishedIn:r1(patio.finishedElevationIn??target!.elevationIn)}}:{bottomIn:r1(f.end.y)})});}
  // Where the survey falls short, most important first: the door, under the deck, past its sides, past the stair feet.
  const coverageWarnings:string[]=[],decks=(takeoff?.levels??[]).filter(l=>l.kind!=='winder').map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),under=decks.some(d=>!surface.extrema([d],'existing').complete);
  if(doorAt&&groundAtDoor===null)coverageWarnings.push('Measure the ground outside the door: it is outside the survey.');
  if(under)coverageWarnings.push(`Part of the deck stands on unmeasured ground: extend the survey under it and about ${MARGIN_IN/12} ft past it.`);
  else if(decks.length){
    const all=decks.flat(),x0=Math.min(...all.map(p=>p.x)),x1=Math.max(...all.map(p=>p.x)),z0=Math.max(0,Math.min(...all.map(p=>p.y))),z1=Math.max(...all.map(p=>p.y));
    const reach=(from:(t:number)=>P,step:P)=>Math.min(...[0,.25,.5,.75,1].map(t=>{const p=from(t);let d=0;while(d<MARGIN_IN&&covered(coverage,{x:p.x+step.x*(d+3),y:p.y+step.y*(d+3)}))d+=3;return d;}));
    const short=([['left',reach(t=>({x:x0,y:z0+(z1-z0)*t}),{x:-1,y:0})],['right',reach(t=>({x:x1,y:z0+(z1-z0)*t}),{x:1,y:0})],['front',reach(t=>({x:x0+(x1-x0)*t,y:z1}),{x:0,y:1})]] as const).filter(([,r])=>r<MARGIN_IN);
    if(short.length){const sides=short.map(([s])=>s==='front'?'past the front':s),lr=sides.some(s=>s!=='past the front'),rs=short.map(([,r])=>r),span=Math.min(...rs)===Math.max(...rs)?`${rs[0]}`:`${Math.min(...rs)}-${Math.max(...rs)}`;
      coverageWarnings.push(`Survey ends ${span} in ${sides.join(' and ')} of the deck${lr?SEEN:''}: extend it about ${MARGIN_IN/12} ft.`);}
  }
  for(const s of stairs){const f=feet.get(s.flightId)!,out=f.outward??{x:0,y:1};if(!covered(coverage,{x:f.end.x+out.x*MARGIN_IN,y:f.end.z+out.y*MARGIN_IN}))coverageWarnings.push(`Extend the survey ${MARGIN_IN/12} ft past the foot of the stair, ${direction(out.x,out.y)}.`);}
  const north=opts.northDeg!==undefined&&Number.isFinite(opts.northDeg)?((opts.northDeg%360)+360)%360:undefined;
  // Bearings turn clockwise from +z toward −x as seen from above; due south is (180 − northDeg)° round from +z.
  const th=north===undefined?0:(180-north)*Math.PI/180,orientation=north===undefined?null:{northDeg:r1(north),yardFaces:['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(north/45)%8],sunSide:direction(-Math.sin(th),Math.cos(th))};
  const houseRings=houseOutline(data),base:SiteBrief={units:'in',datum:'0 = ground at deck back-left; x right (from yard), z away from house',
    coverage:{areaSqft:r1(siteArea(coverage)/144),bbox:[r0(b.minX),r0(b.minZ),r0(b.maxX),r0(b.maxZ)],widthFt:ft(b.maxX-b.minX),depthFt:ft(b.maxZ-b.minZ)},
    elevation:{minIn:r1(lo.elevationIn),maxIn:r1(hi.elevationIn),rangeIn:r1(hi.elevationIn-lo.elevationIn),highAt:{x:r0(hi.xIn),z:r0(hi.zIn),label:labelAt(hi.xIn,hi.zIn)},lowAt:{x:r0(lo.xIn),z:r0(lo.zIn),label:labelAt(lo.xIn,lo.zIn)}},
    plane:{slopePct:r1(slope*100),risePctX:r1(fit.a*100),risePctZ:r1(fit.c*100),downhill:{dx:r2(down.dx),dz:r2(down.dz)},fallsToward:direction(down.dx,down.dz),fitRmsIn:r1(fit.rms)},
    zones:[],features:featuresOf(surface.existingTriangles,shots,fit,coverage,Math.max(36,.15*Math.hypot(b.maxX-b.minX,b.maxZ-b.minZ))),
    house:{sillIn:sill===null?null:r2(sill),doorAt:doorAt?{x:r0(doorAt.x),z:r0(doorAt.y)}:null,groundAtDoorIn:groundAtDoor===null?null:r1(groundAtDoor),sillAboveGroundIn:sill!==null&&groundAtDoor!==null?r1(sill-groundAtDoor):null,deckTopIn:main?r1(main.top):null,stairs},
    coverageWarnings,designWarnings:designWarningsOf(messages),orientation,lines:[]};
  // Zones as asked (slivers under 6 sq ft merged); a yard too intricate for the budget is zoned more coarsely before any
  // zone is left out, so the zones still cover it.
  const budget=Math.max(1024,opts.maxBytes??BUDGET),area=siteArea(coverage),slivers=[SLIVER_IN2,.05*area,.1*area,.2*area].filter((v,i)=>!i||v>SLIVER_IN2);
  const grid=zoneGrid(surface,houseRings,opts.gridIn??24);let brief=base;
  for(const [i,sliver] of slivers.entries()){
    brief={...structuredClone(base),zones:zonesOf(grid,surface,doorAt,sliver).map(({rings:_,...z})=>z)};
    if(fitBudget(brief,linesOf(brief,surface),budget,i===slivers.length-1)<=budget)break;
  }
  return brief;
}

/** Plain sentences for the homeowner, in reading order, each with a rank (lower ranks are kept first). */
function linesOf(s:SiteBrief,surface:SiteSurface){
  const b=surface.bounds,p=s.plane,out:{text:string;rank:number}[]=[],add=(rank:number,text:string)=>out.push({text,rank});
  if(p.slopePct<1)add(0,`The measured ground (about ${r0(s.coverage.widthFt)} by ${r0(s.coverage.depthFt)} ft) is close to level: under 1 % overall.`);
  else{
    const proj=surface.coverage.flat().map(v=>v.x*p.downhill.dx+v.y*p.downhill.dz),drop=r0(p.slopePct/100*(Math.max(...proj)-Math.min(...proj))),lateral=Math.abs(p.downhill.dx)>=Math.abs(p.downhill.dz),minor=lateral?p.risePctZ:p.risePctX;
    const main=lateral?`rises about ${drop} in from ${p.downhill.dx<0?'left to right':'right to left'}${SEEN}`:`falls about ${drop} in ${p.downhill.dz>0?'away from':'toward'} the house`;
    const also=Math.abs(minor)<1.5?'':lateral?`, falling ${r0(Math.abs(minor))} % ${minor<0?'away from':'toward'} the house`:`, falling ${r0(Math.abs(minor))} % to the ${minor<0?'right':'left'}`;
    add(0,`The ground ${main}: ${p.slopePct} % overall${also}.`);
    if(p.risePctZ>=1.5)add(1,'Water runs toward the house: keep the finished grade falling away from the walls.');
  }
  const flat=s.zones[0],steep=s.zones.filter(z=>z.kind==='steep').sort((x,y)=>y.areaSqft-x.areaSqft)[0];
  if(flat)add(1,`${flat.kind==='flat'?'Flattest area':`Gentlest area (${flat.slopePct} %)`}: about ${r0(flat.areaSqft)} sq ft ${placeOf(b,flat.centroid.x,flat.centroid.z)}${flat.distanceToDoorFt===null?'':flat.distanceToDoorFt<1?', at the door':`, ${r0(flat.distanceToDoorFt)} ft from the door`}.`);
  const h=s.house;
  if(h.sillIn!==null&&h.sillAboveGroundIn!==null)add(1,`The ground at the door is ${r0(h.sillAboveGroundIn)} in below the ${r1(h.sillIn)} in sill${h.deckTopIn!==null?`; the deck is ${r1(h.sillIn-h.deckTopIn)} in below it`:''}.`);
  const hump=s.features.humps[0],low=s.features.lowSpots[0];
  if(low)add(2,`Water collects at ${low.label} (${signed(low.elevationIn)} in, ${placeOf(b,low.x,low.z)})${low.atEdge?', where the survey ends':''}.`);
  if(hump)add(2,`A hump stands about ${r0(hump.prominenceIn)} in above the general slope at ${hump.label} (${placeOf(b,hump.x,hump.z)}).`);
  if(steep&&steep!==flat)add(3,steep.areaSqft>=s.coverage.areaSqft/2?`Between the shots most of the yard (${r0(steep.areaSqft)} sq ft) is steep, about ${r0(steep.slopePct)} %.`:`Steepest ground: about ${r0(steep.areaSqft)} sq ft at ${r0(steep.slopePct)} %, ${placeOf(b,steep.centroid.x,steep.centroid.z)}.`);
  if(s.coverageWarnings.length)add(3,s.coverageWarnings.length>1?'Extend the survey where the coverage warnings say before building.':s.coverageWarnings[0]);
  if(s.orientation)add(3,`The yard faces ${s.orientation.yardFaces}: the midday sun is ${s.orientation.sunSide}${/toward the house/.test(s.orientation.sunSide)?', so the house shades the ground beside it':''}.`);
  const st=h.stairs[0];
  if(st)add(4,st.landing?`The stair lands on a patio at ${signed(st.landing.finishedIn)} in${st.groundAtFootIn===null?'':` over ground at ${signed(st.groundAtFootIn)} in`}.`:st.groundAtFootIn===null?'The stair comes down on unmeasured ground.':`The stair comes down at ${signed(st.bottomIn??0)} in onto ground at ${signed(st.groundAtFootIn)} in.`);
  for(const text of [`Measured heights run from ${signed(s.elevation.minIn)} in at ${s.elevation.lowAt.label} to ${signed(s.elevation.maxIn)} in at ${s.elevation.highAt.label}.`,`The survey covers about ${r0(s.coverage.areaSqft)} sq ft.`,`The shots sit within about ${r1(s.plane.fitRmsIn)} in of an even slope, on average.`,'Nothing here replaces a site visit before building.'])if(out.length<4)add(5,text);
  return out;
}

/** Fits the brief (in place) to `budget` bytes of JSON, giving up detail in a fixed order and only as far as needed:
 * outline points (to eight, whole inches, six, five, four), design messages and lower-ranked lines (never under four),
 * extra coverage messages; with `dropZones`, then the smallest zones past the eighth, fifth and third. Returns the size. */
function fitBudget(brief:SiteBrief,lines:{text:string;rank:number}[],budget:number,dropZones:boolean):number{
  let keep=Math.min(8,lines.length);
  const pick=()=>{brief.lines=lines.map((l,i)=>({...l,i})).sort((p,q)=>p.rank-q.rank||p.i-q.i).slice(0,keep).sort((p,q)=>p.i-q.i).map(l=>l.text);};
  const size=()=>new TextEncoder().encode(JSON.stringify(brief)).length,fewer=()=>{if(keep>4){keep--;pick();}};
  const points=(max:number)=>()=>{brief.zones=brief.zones.map(z=>({...z,polygon:thin(z.polygon,max)}));},whole=()=>{brief.zones=brief.zones.map(z=>({...z,polygon:z.polygon.map(([x,y])=>[r0(x),r0(y)] as [number,number])}));},messages=(max:number)=>()=>{brief.designWarnings=brief.designWarnings.slice(0,max);};
  pick();
  const largest=(n:number)=>()=>{const kept=new Set([...brief.zones].sort((p,q)=>q.areaSqft-p.areaSqft).slice(0,n));brief.zones=brief.zones.filter(z=>kept.has(z));};
  for(const step of [points(10),messages(3),fewer,points(8),whole,messages(2),fewer,points(6),fewer,messages(1),fewer,points(5),messages(0),()=>{brief.coverageWarnings=brief.coverageWarnings.slice(0,2);},points(4),...dropZones?[largest(8),largest(5),largest(3)]:[]]){if(size()<=budget)break;step();}
  return size();
}
