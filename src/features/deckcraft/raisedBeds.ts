import type {LandscapePoint} from './landscapeTypes';
/** Raised beds (S2). A raised bed's soil top is ONE level plane in the project datum:
 *
 *   soil top = lowest proposed ground along the bed's outline + raisedIn,
 *              never below the highest proposed ground inside the outline − 2 in.
 *
 * raisedIn is measured from the bed's lowest edge grade. Where that level would bury the bed's high side more than
 * 2 in (a bed drawn across a slope), the whole soil top rises with it instead, so a "raised" bed never quietly turns
 * into a cut. Planting soil fills soil top − proposed ground wherever the ground is lower. Pure: no site engine. */
export const RAISED_BED={maxIn:36,slackIn:2,unheldIn:6} as const;
type Plan={x:number;y:number};
/** The ground queries a raised bed needs. A SiteSurface satisfies it, as does planeGround(). */
export interface BedGround {
 sample(xIn:number,zIn:number):number|undefined;
 extrema(polygons:Plan[][]):{min:number;max:number;complete:boolean};
 /** Fractions 0…1 along a→b: both ends and every ground break between (ground is straight between them). */
 lineBreaks(a:Plan,b:Plan):number[];
}
export interface GroundPlane {x:number;z:number;constant:number}
const at=(p:GroundPlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;
/** A legacy yard's configured terrain plane as bed ground (no triangulation is loaded). */
export function planeGround(plane:GroundPlane):BedGround{return {sample:(x,z)=>at(plane,x,z),extrema:polys=>{const h=polys.flat().map(p=>at(plane,p.x,p.y));return {min:Math.min(...h),max:Math.max(...h),complete:true};},lineBreaks:()=>[0,1]};}
const signed=(p:LandscapePoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.z-b.x*a.z;},0)/2;
/** Counter-clockwise copy (positive signed area in x, z): the inside lies left of travel. */
export const ccwRing=(ring:LandscapePoint[])=>{const p=ring.map(v=>({x:v.x,z:v.z}));return signed(p)<0?p.reverse():p;};
export interface GroundStop {x:number;z:number;h:number|undefined}
/** Proposed ground along each edge of a closed ring, at the edge's ends and every ground break between. */
export function ringGround(ground:BedGround,ring:LandscapePoint[]):GroundStop[][]{
 return ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return ground.lineBreaks({x:a.x,y:a.z},{x:b.x,y:b.z}).map(t=>{const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;return {x,z,h:ground.sample(x,z)};});});
}
export interface BedLevel {topIn:number;lowIn:number;highIn:number;complete:boolean}
/** The soil-top rule above for an outline ring; undefined when none of the outline is on measured ground. */
export function bedLevel(ground:BedGround,ring:LandscapePoint[],raisedIn:number):BedLevel|undefined{
 const stops=ringGround(ground,ring).flat();let low=Infinity,high=-Infinity,known=0;
 for(const s of stops)if(s.h!==undefined){known++;low=Math.min(low,s.h);high=Math.max(high,s.h);}
 if(!known)return;
 const inside=ground.extrema([ccwRing(ring).map(p=>({x:p.x,y:p.z}))]);if(Number.isFinite(inside.max))high=Math.max(high,inside.max);
 return {topIn:Math.max(low+raisedIn,high-RAISED_BED.slackIn),lowIn:low,highIn:high,complete:inside.complete&&known===stops.length};
}
/** Length (in) of the ring stops where a level `topIn` stands more than `aboveIn` over the ground (unmeasured stretches excluded). */
export function exposedRun(stops:GroundStop[][],topIn:number,aboveIn=0){
 let run=0;for(const edge of stops)for(let i=0;i+1<edge.length;i++){const a=edge[i],b=edge[i+1];if(a.h===undefined||b.h===undefined)continue;const len=Math.hypot(b.x-a.x,b.z-a.z),ea=topIn-a.h-aboveIn,eb=topIn-b.h-aboveIn;run+=ea>0&&eb>0?len:ea<=0&&eb<=0?0:len*Math.max(ea,eb)/Math.abs(eb-ea);}
 return run;
}
/** Exact planting soil (yd³) between a level top and a ground plane over plan rings (holes wound opposite):
 * each ring is clipped to where the top is above the plane, then the affine depth is integrated by fan triangles. */
export function planeFillYd3(polys:LandscapePoint[][],plane:GroundPlane,topIn:number){
 const f=(p:LandscapePoint)=>topIn-at(plane,p.x,p.z);let total=0;
 for(const ring of polys){const kept:LandscapePoint[]=[];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],fa=f(a),fb=f(b);if(fa>=0)kept.push(a);if(fa>0&&fb<0||fa<0&&fb>0){const t=fa/(fa-fb);kept.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}
  for(let i=1;i+1<kept.length;i++){const a=kept[0],b=kept[i],c=kept[i+1];total+=((b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z))/2*(f(a)+f(b)+f(c))/3;}
 }
 return Math.abs(total)/46656;
}
