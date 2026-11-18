import type {SitePlane,SiteSurfaceSnapshot,SiteSurfaceTriangle} from '../../siteSurface';

/** The lawn sits this far under the ground it stands for, so hardscape set at grade is never covered by it. */
export const LAWN_DROP=.7;
/** How far past the measured shots the ground takes to settle to the survey's mean level. */
export const SURVEY_FEATHER_IN=120;
type Terrain={elevationIn:number;slopePct:number};
export interface LawnGround {
 /** The lawn's height as drawn (inches, LAWN_DROP under the ground). */
 height:(x:number,z:number)=>number;
 /** True on measured ground; false where the lawn is an estimate. */
 measured:(x:number,z:number)=>boolean;
 /** The estimated lawn's height (as `height`) even where a point reads as measured: for the lawn drawn round the survey,
  * whose vertices on the survey's edge are clipped to it and can round a hair onto it. Meant for points off the survey or
  * on its edge. */
 estimated:(x:number,z:number)=>number;
 /** Where the estimated lawn settles, far from the survey (NaN for an illustrative yard). */
 farIn:number;
}
const smooth=(t:number)=>{const k=Math.min(1,Math.max(0,t));return k*k*(3-2*k);};
const planeAt=(p:SitePlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;
/** The survey triangle under a point (bucketed), or undefined off the measured ground. */
function sampler(ts:SiteSurfaceTriangle[],bounds:SiteSurfaceSnapshot['bounds']){
 const size=Math.max(1,Math.min(64,Math.ceil(Math.sqrt(ts.length/2)))),width=Math.max(1e-7,bounds.maxX-bounds.minX),depth=Math.max(1e-7,bounds.maxZ-bounds.minZ),cx=(x:number)=>Math.max(0,Math.min(size-1,Math.floor((x-bounds.minX)/width*size))),cz=(z:number)=>Math.max(0,Math.min(size-1,Math.floor((z-bounds.minZ)/depth*size))),buckets=new Map<number,SiteSurfaceTriangle[]>();
 for(const t of ts){const xs=t.vertices.map(v=>v.xIn),zs=t.vertices.map(v=>v.zIn);for(let x=cx(Math.min(...xs));x<=cx(Math.max(...xs));x++)for(let z=cz(Math.min(...zs));z<=cz(Math.max(...zs));z++){const key=z*size+x,list=buckets.get(key)??[];list.push(t);buckets.set(key,list);}}
 return (x:number,z:number)=>{if(!Number.isFinite(x+z)||x<bounds.minX-1e-6||x>bounds.maxX+1e-6||z<bounds.minZ-1e-6||z>bounds.maxZ+1e-6)return undefined;for(const t of buckets.get(cz(z)*size+cx(x))??[]){const [a,b,c]=t.vertices,cross=(u:typeof a,v:typeof a)=>(v.xIn-u.xIn)*(z-u.zIn)-(v.zIn-u.zIn)*(x-u.xIn),p=cross(a,b),q=cross(b,c),r=cross(c,a);if(p>=-1e-6&&q>=-1e-6&&r>=-1e-6||p<=1e-6&&q<=1e-6&&r<=1e-6)return t;}return undefined;};
}
type SurveyVertex=SiteSurfaceTriangle['vertices'][number];
/** u0…u1 of a coverage edge, where a survey triangle's side lies along it, and the ground's height at those two ends. */
interface Piece {u0:number;u1:number;h0:number;h1:number}
/** A coverage edge a→a+d: its height along it, which side of it is unmeasured (`side`: the sign of the outward distance
 * against d×(p−a)), the previous edge of its ring with any length (-1 if it has none) and whether the corner between
 * them, at a, bulges out of the survey (collinear counts as convex). */
interface CoverageEdge {ax:number;az:number;dx:number;dz:number;l2:number;len:number;pieces:Piece[];ha:number;hb:number;side:number;prev:number;convex:boolean}
/** Off this distance a triangle's side is not on a survey edge (the edge is rounded to ~1e-5 in when clipped). */
const ON_EDGE_IN=1e-3;
/**
 * Where two stretches of the survey's edge compete for the nearest (a notch in a traced boundary: past the medial line
 * the nearest edge switches), the estimated lawn blends the heights of the ones whose distance is within this share of
 * the nearest distance, up to BLEND_MAX_IN, instead of stepping between them. The share shrinks to nothing at the edge,
 * so the lawn still meets the survey exactly there.
 */
const BLEND_SHARE=.5,BLEND_MAX_IN=24;
/** Within this of a survey triangle's corner or side, a clipped vertex (rounded to ~1e-5 in) is on it. */
const SNAP_IN=1e-4;
/** The ground on survey triangle t at (x,z), for a vertex clipped from it: a vertex within rounding of a corner takes the
 * corner's height, of a side the height straight along that side, and one a hair outside the triangle the height at its
 * nearest point. Never the plane carried off the triangle or across a rounding error: a sliver triangle along the
 * survey's hull climbs hundreds of inches per inch across itself. */
export function surveyHeightOn(t:SiteSurfaceTriangle,x:number,z:number){
 const v=t.vertices;
 for(const p of v)if(Math.abs(x-p.xIn)<=SNAP_IN&&Math.abs(z-p.zIn)<=SNAP_IN&&Math.hypot(x-p.xIn,z-p.zIn)<=SNAP_IN)return planeAt(t.plane,p.xIn,p.zIn);
 let best=Infinity,height=0;
 for(let i=0;i<3;i++){const p=v[i],q=v[(i+1)%3],dx=q.xIn-p.xIn,dz=q.zIn-p.zIn,l=dx*dx+dz*dz,u=l?Math.max(0,Math.min(1,((x-p.xIn)*dx+(z-p.zIn)*dz)/l)):0,d=Math.hypot(x-p.xIn-dx*u,z-p.zIn-dz*u);
  if(d<best){best=d;const hp=planeAt(t.plane,p.xIn,p.zIn);height=hp+(planeAt(t.plane,q.xIn,q.zIn)-hp)*u;}}
 if(best<=SNAP_IN)return height;
 const side=(i:number)=>{const p=v[i],q=v[(i+1)%3];return (q.xIn-p.xIn)*(z-p.zIn)-(q.zIn-p.zIn)*(x-p.xIn);},s0=side(0),s1=side(1),s2=side(2);
 return s0>=0&&s1>=0&&s2>=0||s0<=0&&s1<=0&&s2<=0?planeAt(t.plane,x,z):height;
}
/** A coverage edge's height at u: straight between the two ends of the survey side lying there (or, in a gap between
 * two sides, between their facing ends). Never a plane read off the edge: a clipped edge sits a hair off the triangles,
 * and a sliver triangle's plane climbs hundreds of inches per inch across it. */
function along(e:CoverageEdge,u:number){
 let left:Piece|undefined,right:Piece|undefined;
 for(const p of e.pieces){if(u>=p.u0&&u<=p.u1)return p.h0+(p.h1-p.h0)*(u-p.u0)/(p.u1-p.u0);if(p.u1<u){if(!left||p.u1>left.u1)left=p;}else if(!right)right=p;}
 if(left&&right)return left.h1+(right.h0-left.h1)*(u-left.u1)/(right.u0-left.u1);
 return left?left.h1:right?right.h0:e.ha+(e.hb-e.ha)*u;
}
/**
 * The survey's edges, each with the survey sides lying along it, and a grid that finds the ones within reach of a point.
 * An edge's height runs straight between the ends of those sides, never sampled exactly on it: the clipped edge sits a
 * hair off the triangles, and a sample that missed used to hand the height to some far edge.
 */
function surveyEdges(rings:SiteSurfaceSnapshot['coverage'],ts:SiteSurfaceTriangle[],find:(x:number,z:number)=>SiteSurfaceTriangle|undefined,mean:number){
 // Triangle sides no other triangle shares: the triangulation's own rim.
 const key=(v:SurveyVertex)=>`${Math.round(v.xIn*1e4)}:${Math.round(v.zIn*1e4)}`,count=new Map<string,number>(),sides:{p:SurveyVertex;q:SurveyVertex;plane:SitePlane;k:string}[]=[];
 for(const t of ts)for(let i=0;i<3;i++){const a=key(t.vertices[i]),b=key(t.vertices[(i+1)%3]);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;count.set(k,(count.get(k)??0)+1);sides.push({p:t.vertices[i],q:t.vertices[(i+1)%3],plane:t.plane,k});}
 const rim=sides.filter(s=>count.get(s.k)===1);
 // The rim bucketed (clipped surveys leave thousands of unshared sides), so each edge tests only the sides near it.
 const all=rings.flat(),gx0=Math.min(...all.map(p=>p.x))-1,gz0=Math.min(...all.map(p=>p.y))-1,gw=Math.max(...all.map(p=>p.x))+1-gx0,gd=Math.max(...all.map(p=>p.y))+1-gz0,G=64,gc=(v:number,min:number,span:number)=>Math.max(0,Math.min(G-1,Math.floor((v-min)/span*G))),rimCells:number[][]=Array.from({length:G*G},()=>[]),stamp=new Int32Array(rim.length).fill(-1);
 rim.forEach((r,i)=>{for(let z=gc(Math.min(r.p.zIn,r.q.zIn),gz0,gd);z<=gc(Math.max(r.p.zIn,r.q.zIn),gz0,gd);z++)for(let x=gc(Math.min(r.p.xIn,r.q.xIn),gx0,gw);x<=gc(Math.max(r.p.xIn,r.q.xIn),gx0,gw);x++)rimCells[z*G+x].push(i);});
 // Last resort for an edge no triangle lies along: the ground just inside its ends.
 const nudged=(x:number,z:number,tx:number,tz:number)=>{for(const s of [1e-3,1e-2])for(const sign of [1,-1]){const t=find(x+(tx-sign*tz)*s,z+(tz+sign*tx)*s);if(t)return surveyHeightOn(t,x,z);}return undefined;};
 // Which side of a ring is measured: a step off its longest edge, tested against all the rings (holes too).
 const inside=(x:number,z:number)=>{let odd=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;};
 let edgeIndex=0;
 const edges:CoverageEdge[]=rings.flatMap(ring=>{
  let longest=0,side=-1;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],l=Math.hypot(b.x-a.x,b.y-a.y);if(l>longest){longest=l;const s=Math.min(1e-2,Math.max(1e-5,l*1e-4));side=inside((a.x+b.x)/2-(b.y-a.y)/l*s,(a.y+b.y)/2+(b.x-a.x)/l*s)?-1:1;}}
  const first=edgeIndex,own:CoverageEdge[]=ring.map((a,i)=>{
   const b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.y-a.y,l2=dx*dx+dz*dz,len=Math.sqrt(l2),pieces:Piece[]=[],id=edgeIndex++;
   if(len>1e-9)for(let z=gc(Math.min(a.y,b.y)-ON_EDGE_IN,gz0,gd);z<=gc(Math.max(a.y,b.y)+ON_EDGE_IN,gz0,gd);z++)for(let x=gc(Math.min(a.x,b.x)-ON_EDGE_IN,gx0,gw);x<=gc(Math.max(a.x,b.x)+ON_EDGE_IN,gx0,gw);x++)for(const j of rimCells[z*G+x]){
    if(stamp[j]===id)continue;stamp[j]=id;const r=rim[j];
    if(Math.abs((r.p.xIn-a.x)*dz-(r.p.zIn-a.y)*dx)/len>ON_EDGE_IN||Math.abs((r.q.xIn-a.x)*dz-(r.q.zIn-a.y)*dx)/len>ON_EDGE_IN)continue;
    // The side's own ends, at the surface's height there, carried straight along it to where it leaves the edge.
    const up=((r.p.xIn-a.x)*dx+(r.p.zIn-a.y)*dz)/l2,uq=((r.q.xIn-a.x)*dx+(r.q.zIn-a.y)*dz)/l2,u0=Math.max(0,Math.min(up,uq)),u1=Math.min(1,Math.max(up,uq));
    if((u1-u0)*len>1e-6){const hp=planeAt(r.plane,r.p.xIn,r.p.zIn),hq=planeAt(r.plane,r.q.xIn,r.q.zIn),at=(u:number)=>hp+(hq-hp)*(u-up)/(uq-up);pieces.push({u0,u1,h0:at(u0),h1:at(u1)});}
   }
   pieces.sort((p,q)=>p.u0-q.u0);
   let ha=mean,hb=mean;if(!pieces.length&&len>1e-9){const tx=dx/len,tz=dz/len,h0=nudged(a.x,a.y,tx,tz),h1=nudged(b.x,b.y,-tx,-tz);ha=h0??h1??mean;hb=h1??h0??mean;}
   return {ax:a.x,az:a.y,dx,dz,l2,len,pieces,ha,hb,side,prev:-1,convex:true};
  });
  own.forEach((e,i)=>{if(e.len<=1e-9)return;for(let k=1;k<own.length;k++){const p=own[(i-k+own.length)%own.length];if(p.len>1e-9){const turn=p.dx*e.dz-p.dz*e.dx;e.prev=first+(i-k+own.length)%own.length;e.convex=side*turn<=1e-9*p.len*e.len;return;}}});
  return own;
 });
 // Each grid cell lists the edges whose box, grown by the feather and the blend, reaches it: past the feather the lawn is
 // at the mean anyway.
 const R=SURVEY_FEATHER_IN,reach=R+BLEND_MAX_IN,minX=Math.min(...all.map(p=>p.x))-R,minZ=Math.min(...all.map(p=>p.y))-R,spanX=Math.max(1e-6,Math.max(...all.map(p=>p.x))+R-minX),spanZ=Math.max(1e-6,Math.max(...all.map(p=>p.y))+R-minZ);
 const size=Math.max(4,Math.min(64,Math.ceil(2*Math.sqrt(edges.length)))),cell=(v:number,min:number,span:number)=>Math.max(0,Math.min(size-1,Math.floor((v-min)/span*size))),cells:number[][]=Array.from({length:size*size},()=>[]);
 edges.forEach((e,i)=>{const x0=cell(Math.min(e.ax,e.ax+e.dx)-reach,minX,spanX),x1=cell(Math.max(e.ax,e.ax+e.dx)+reach,minX,spanX),z0=cell(Math.min(e.az,e.az+e.dz)-reach,minZ,spanZ),z1=cell(Math.max(e.az,e.az+e.dz)+reach,minZ,spanZ);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)cells[z*size+x].push(i);});
 // The stretches of edge a point faces (reused between reads): an edge it sits square off, on the unmeasured side, or a
 // corner. A corner that bulges out counts only where both its edges end at it; a notch corner (reflex) wherever one of
 // them does, on that edge's unmeasured side, so a stretch is handed on at the same point and height as it ends.
 let cap=32,fd=new Float64Array(cap),fu=new Float64Array(cap),fe=new Int32Array(cap);
 const push=(n:number,d:number,e:number,u:number)=>{if(n===cap){cap*=2;const d2=new Float64Array(cap),u2=new Float64Array(cap),e2=new Int32Array(cap);d2.set(fd);u2.set(fu);e2.set(fe);fd=d2;fu=u2;fe=e2;}fd[n]=d;fe[n]=e;fu[n]=u;return n+1;};
 /** The nearest survey edge within the feather (distance Infinity past it) and the height there, blended where edges compete. */
 return (x:number,z:number)=>{
  let best=Infinity,bestE=-1,bestU=0,n=0;if(!(x>=minX&&x<=minX+spanX&&z>=minZ&&z<=minZ+spanZ))return {distance:best,height:mean};
  for(const i of cells[cell(z,minZ,spanZ)*size+cell(x,minX,spanX)]){
   const e=edges[i],rx=x-e.ax,rz=z-e.az,t=e.l2?(rx*e.dx+rz*e.dz)/e.l2:0,u=t<0?0:t>1?1:t,px=rx-e.dx*u,pz=rz-e.dz*u,d=Math.sqrt(px*px+pz*pz);
   if(d<best){best=d;bestE=i;bestU=u;}
   if(e.prev<0||d>best+BLEND_MAX_IN)continue;
   const out=e.side*(e.dx*rz-e.dz*rx)/e.len;
   if(t>0&&t<1&&out>=-ON_EDGE_IN)n=push(n,d,i,t);
   const p=edges[e.prev],qx=x-p.ax,qz=z-p.az,tp=(qx*p.dx+qz*p.dz)/p.l2;
   if(e.convex?t<=0&&tp>=1:t<=0&&out>=-ON_EDGE_IN||tp>=1&&p.side*(p.dx*qz-p.dz*qx)/p.len>=-ON_EDGE_IN)n=push(n,Math.sqrt(rx*rx+rz*rz),i,0);
  }
  if(bestE<0)return {distance:best,height:mean};
  const height=along(edges[bestE],bestU),r=Math.min(BLEND_SHARE*best,BLEND_MAX_IN);
  if(n<2||!(r>0)||best>=R)return {distance:best,height};
  // Each competing stretch weighs in as it comes within r of the nearest, smoothly, so the lawn has no step where the
  // nearest switches. (Only when the nearest is among them: otherwise the point is not one the stretches describe.)
  let sw=0,sh=0,used=0,near=false;
  for(let k=0;k<n;k++){const g=(fd[k]-best)/r;if(g>=1)continue;if(g<1e-6)near=true;const w=1-smooth(g);if(w>0){used++;sw+=w;sh+=w*along(edges[fe[k]],fu[k]);}}
  return {distance:best,height:near&&used>1?sh/sw:height};
 };
}
const cache=new WeakMap<SiteSurfaceSnapshot,Partial<Record<'existing'|'proposed',LawnGround>>>();
/**
 * The ground the lawn is drawn on: the survey's own surface where it was measured, and past the last shot a lawn that
 * starts at the measured edge's height and settles to the survey's mean level over SURVEY_FEATHER_IN, so the measured
 * patch never stands as a raised or sunken island with earth walls round it. Display only: the site model still has no
 * ground there, and everything priced or checked reads the survey alone.
 */
export function lawnGround(yard:{siteSurface?:SiteSurfaceSnapshot;terrain:Terrain},kind:'existing'|'proposed'='proposed'):LawnGround{
 const site=yard.siteSurface,t=yard.terrain;
 if(!site){const height=(_x:number,z:number)=>t.elevationIn+z*t.slopePct/100-LAWN_DROP;return {height,measured:()=>false,estimated:height,farIn:NaN};}
 const saved=cache.get(site)?.[kind];if(saved)return saved;
 const triangles=kind==='existing'?site.existingTriangles:site.proposedTriangles,find=sampler(triangles,site.bounds),sample=(x:number,z:number)=>{const tri=find(x,z);return tri?planeAt(tri.plane,x,z):undefined;};
 let area=0,volume=0;for(const tri of site.existingTriangles){const [a,b,c]=tri.vertices,s=Math.abs((b.xIn-a.xIn)*(c.zIn-a.zIn)-(c.xIn-a.xIn)*(b.zIn-a.zIn))/2;area+=s;volume+=s*(a.elevationIn+b.elevationIn+c.elevationIn)/3;}
 const mean=area>0?volume/area:t.elevationIn;
 // Built on the first estimated-lawn read: views that only read measured ground never pay for it.
 let edgeHeight:ReturnType<typeof surveyEdges>|undefined;
 const estimated=(x:number,z:number)=>{const edge=(edgeHeight??=surveyEdges(site.coverage,triangles,find,mean))(x,z);return edge.height+(mean-edge.height)*smooth(edge.distance/SURVEY_FEATHER_IN)-LAWN_DROP;};
 const ground:LawnGround={
  height:(x,z)=>{const h=sample(x,z);return h!==undefined?h-LAWN_DROP:estimated(x,z);},
  measured:(x,z)=>find(x,z)!==undefined,
  estimated,
  farIn:mean-LAWN_DROP,
 };
 const entry=cache.get(site)??{};entry[kind]=ground;cache.set(site,entry);return ground;
}
