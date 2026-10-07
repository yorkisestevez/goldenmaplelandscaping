import type {LandscapePoint} from './landscapeTypes';
import {localPolygonClip} from './lib/localPolygonClip';
import {bedLevel,ccwRing,ringGround,RAISED_BED,type BedGround,type GroundStop} from './raisedBeds';
/** Terraced beds (S2): a series of level raised beds stepping down a slope, each held on its downhill edge by a low
 * wall sized from the measured ground. Pure planning: the move engine turns a plan into bed objects (polygon,
 * raisedIn, edge {kind:'wall'}) and retaining walls (path, top, height); nothing here edits a design.
 *
 * Each tier is the area between two cuts square to `downhill`. Its soil top is the lowest level the raised-bed rule
 * allows (highest ground inside − 2 in), lifted where needed so its wall reaches `minWallIn`, but never more than
 * 8 in (so its uphill side stands at most 6 in over the ground, the unheld limit). Its wall runs the tier's
 * downhill-facing outline, returning up the sides while the soil stands more than 6 in over the ground; heights are
 * soil top − the lowest measured ground along the wall. Paths follow the tier outline counter-clockwise in plan
 * (x, z), so the retained soil lies on the wall's left. The cuts are searched for walls within range, the least
 * lift and the most even heights; otherwise the plan says why (too steep, too flat, unmeasured, wrong direction). */
export interface TerraceOptions {tiers:2|3;minWallIn?:number;maxWallIn?:number;downhill:{dx:number;dz:number}}
export interface TerraceBed {tier:number;outline:LandscapePoint[];soilTopIn:number;raisedIn:number;areaSqft:number}
export interface TerraceWall {tier:number;path:LandscapePoint[];topIn:number;heightIn:number;minHeightIn:number;lengthIn:number}
export type TerraceReason='too-flat'|'too-steep'|'unmeasured'|'wrong-direction'|'invalid';
export interface TerracePlan {ok:boolean;reason?:TerraceReason;message:string;tiers:number;fallIn:number;
 /** Measured fall direction (unit, plan x/z) and grade (%) from a least-squares fit of the ground over the area. */
 slope:{dx:number;dz:number;pct:number};alignment:number;beds:TerraceBed[];walls:TerraceWall[];warnings:string[]}
const MAX_LIFT_IN=RAISED_BED.unheldIn+RAISED_BED.slackIn,MIN_TIER=.15;
type P=LandscapePoint;
const signed=(p:P[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.z-b.x*a.z;},0)/2;
const inside=(p:P,ring:P[])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;};
const r2=(n:number)=>Math.round(n*100)/100;
/** Drop repeated and collinear points (an open path keeps its ends). */
function tidy(points:P[],closed:boolean){
 let p=points.filter((v,i)=>i===0&&!closed||Math.hypot(v.x-points[(i+points.length-1)%points.length].x,v.z-points[(i+points.length-1)%points.length].z)>.05);
 for(let i=closed?0:1;p.length>(closed?3:2)&&i<(closed?p.length:p.length-1);){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],ac=Math.hypot(c.x-a.x,c.z-a.z);if(ac>0&&Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/ac<1e-3)p.splice(i,1);else i++;}
 return p;
}
const lineDistance=(p:P,path:P[])=>{let best=Infinity;for(let i=0;i+1<path.length;i++){const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz));}return best;};
export function planTerraces(surface:BedGround,areaPolygon:P[],options:TerraceOptions):TerracePlan{
 const n=options.tiers,minWall=options.minWallIn??12,maxWall=options.maxWallIn??24,len=Math.hypot(options.downhill.dx,options.downhill.dz);
 const fail=(reason:TerraceReason,message:string,extra:Partial<TerracePlan>={}):TerracePlan=>({ok:false,reason,message,tiers:n,fallIn:0,slope:{dx:0,dz:0,pct:0},alignment:0,beds:[],walls:[],warnings:[],...extra});
 if(n!==2&&n!==3||!(minWall>0&&maxWall>=minWall)||!(len>0)||!Array.isArray(areaPolygon)||areaPolygon.length<3||!areaPolygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))||Math.abs(signed(areaPolygon))<144*n)return fail('invalid','Draw an area of at least one square foot per tier, choose 2 or 3 tiers, a downhill direction and wall limits.');
 const d={x:options.downhill.dx/len,z:options.downhill.dz/len},ring=tidy(ccwRing(areaPolygon),true),plan=ring.map(p=>({x:p.x,y:p.z}));
 // The measured ground over the whole area: complete coverage, fall, and its least-squares grade.
 const range=surface.extrema([plan]);if(!range.complete)return fail('unmeasured','Part of this area is off the measured ground. Survey it before planning terraces.');
 const xs=ring.map(p=>p.x),zs=ring.map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),step=Math.max(2,Math.sqrt(Math.abs(signed(ring)))/24),samples:{x:number;z:number;h:number}[]=[];
 for(let x=x0+step/2;x<x1;x+=step)for(let z=z0+step/2;z<z1;z+=step){if(!inside({x,z},ring))continue;const h=surface.sample(x,z);if(h!==undefined)samples.push({x,z,h});}
 if(samples.length<6)return fail('unmeasured','Too little of this area is on measured ground to plan terraces.');
 const m=samples.reduce((s,p)=>({x:s.x+p.x/samples.length,z:s.z+p.z/samples.length,h:s.h+p.h/samples.length}),{x:0,z:0,h:0});
 let sxx=0,sxz=0,szz=0,sxh=0,szh=0;for(const p of samples){const x=p.x-m.x,z=p.z-m.z,h=p.h-m.h;sxx+=x*x;sxz+=x*z;szz+=z*z;sxh+=x*h;szh+=z*h;}
 const det=sxx*szz-sxz*sxz,gx=det?(sxh*szz-szh*sxz)/det:0,gz=det?(szh*sxx-sxh*sxz)/det:0,grade=Math.hypot(gx,gz),slope={dx:grade?-gx/grade:0,dz:grade?-gz/grade:0,pct:r2(grade*100)},alignment=r2(slope.dx*d.x+slope.dz*d.z),fallIn=r2(range.max-range.min),base={fallIn,slope,alignment};
 if(grade<1e-4)return fail('too-flat','This area is level. A single raised bed suits it better than terraces.',base);
 if(alignment<Math.SQRT1_2)return fail('wrong-direction',`The measured ground falls toward (${slope.dx.toFixed(2)}, ${slope.dz.toFixed(2)}), not the requested downhill direction.`,base);
 // Cut frame: s runs downhill, u across.
 const s=(p:P)=>p.x*d.x+p.z*d.z,u=(p:P)=>-p.x*d.z+p.z*d.x,ss=ring.map(s),us=ring.map(u),sMin=Math.min(...ss),sMax=Math.max(...ss),uMin=Math.min(...us)-10,uMax=Math.max(...us)+10,world=(a:number,b:number)=>({x:a*d.x-b*d.z,y:a*d.z+b*d.x});
 const tier=(a:number,b:number)=>{const pieces=localPolygonClip([plan],[[world(a,uMin),world(b,uMin),world(b,uMax),world(a,uMax)]],'intersection',1000).map(p=>p.map(v=>({x:v.x,z:v.y})));const largest=pieces.sort((p,q)=>Math.abs(signed(q))-Math.abs(signed(p)))[0];return largest&&tidy(ccwRing(largest),true);};
 type Tier={ring:P[];top:number;low:number;lift:number;stops:GroundStop[][];path:GroundStop[];height:number;minHeight:number};
 const evaluate=(bounds:number[])=>{
  const tiers:Tier[]=[];
  for(let i=0;i<n;i++){
   const r=tier(bounds[i],bounds[i+1]);if(!r||r.length<3||r.length>64||Math.abs(signed(r))<144)return;
   const stops=ringGround(surface,r),level=bedLevel(surface,r,0),k=r.length;if(!level||stops.flat().some(v=>v.h===undefined))return;
   const edgeLength=(e:number)=>Math.hypot(r[(e+1)%k].x-r[e].x,r[(e+1)%k].z-r[e].z),front=r.map((a,e)=>{const b=r[(e+1)%k];return ((b.z-a.z)*d.x-(b.x-a.x)*d.z)/edgeLength(e)>.5;});
   let run:number[]=[],best=0;for(let e=0;e<k;e++){if(!front[e]||front[(e+k-1)%k])continue;const next:number[]=[];for(let j=e;front[j%k]&&next.length<k;j++)next.push(j%k);const length=next.reduce((sum,f)=>sum+edgeLength(f),0);if(length>best){best=length;run=next;}}
   if(!run.length)return;
   const runStops=run.flatMap((e,j)=>stops[e].slice(j?1:0)),frontLow=Math.min(...runStops.map(v=>v.h!)),top=Math.ceil(Math.max(level.topIn,frontLow+minWall)*4)/4;
   // Returns up the sides while the soil stands more than the unheld limit over the ground.
   const walk=(seq:GroundStop[])=>{const out:GroundStop[]=[];for(let j=1;j<seq.length;j++){const a=seq[j-1],b=seq[j],ea=top-a.h!-RAISED_BED.unheldIn,eb=top-b.h!-RAISED_BED.unheldIn;if(ea<=0)break;if(eb>0){out.push(b);continue;}const t=ea/(ea-eb);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,h:a.h!+(b.h!-a.h!)*t});break;}return out;};
   const others=k-run.length,ahead=Array.from({length:others},(_,j)=>stops[(run.at(-1)!+1+j)%k]).flatMap((e,j)=>e.slice(j?1:0)),behind=Array.from({length:others},(_,j)=>[...stops[(run[0]-1-j+k*2)%k]].reverse()).flatMap((e,j)=>e.slice(j?1:0));
   const path=[...walk(behind).reverse(),...runStops,...walk(ahead)],hs=path.map(v=>v.h!);
   tiers.push({ring:r,top,low:level.lowIn,lift:top-level.topIn,stops,path,height:top-Math.min(...hs),minHeight:top-Math.max(...hs)});
  }
  let steep=0,flat=0;tiers.forEach((t,i)=>{steep+=Math.max(0,t.height-maxWall)+Math.max(0,t.top-t.low-RAISED_BED.maxIn);flat+=Math.max(0,t.lift-MAX_LIFT_IN)+(i?Math.max(0,tiers[i-1].top-1-t.top<0?t.top-tiers[i-1].top+1:0):0);});
  const heights=tiers.map(t=>t.height);
  return {tiers,steep,flat,score:tiers.reduce((sum,t)=>sum+t.lift,0)+.25*(Math.max(...heights)-Math.min(...heights))};
 };
 const span=sMax-sMin,fractions:number[][]=[];
 if(n===2)for(let f=MIN_TIER;f<=1-MIN_TIER+1e-9;f+=.025)fractions.push([f]);
 else for(let f=MIN_TIER;f<=1-2*MIN_TIER+1e-9;f+=.05)for(let g=f+MIN_TIER;g<=1-MIN_TIER+1e-9;g+=.05)fractions.push([f,g]);
 let chosen:ReturnType<typeof evaluate>,closest:ReturnType<typeof evaluate>;
 for(const f of fractions){const result=evaluate([sMin-1,...f.map(v=>sMin+span*v),sMax+1]);if(!result)continue;if(!result.steep&&!result.flat){if(!chosen||result.score<chosen.score)chosen=result;}else if(!closest||result.steep+result.flat<closest.steep+closest.flat)closest=result;}
 if(!chosen){
  if(!closest)return fail('invalid','This area cannot be cut into level tiers along that direction. Simplify the outline.',base);
  const steep=closest.steep>=closest.flat,highest=Math.max(...closest.tiers.map(t=>t.height));
  return fail(steep?'too-steep':'too-flat',steep?`The ground falls ${fallIn} in across this area; ${n} tiers would need walls up to ${Math.ceil(highest)} in (limit ${maxWall} in).${n<3?' Try 3 tiers or':' Try'} a smaller area.`:`The ground falls only ${fallIn} in across this area; ${n} tiers with ${minWall} in walls would stand over ${RAISED_BED.unheldIn} in above their uphill ground.${n>2?' Try 2 tiers or':' Try'} a single raised bed.`,base);
 }
 const warnings:string[]=[],beds:TerraceBed[]=[],walls:TerraceWall[]=[];
 chosen.tiers.forEach((t,i)=>{
  const path=tidy(t.path.map(v=>({x:v.x,z:v.z})),false),lengthIn=path.slice(1).reduce((sum,p,j)=>sum+Math.hypot(p.x-path[j].x,p.z-path[j].z),0);
  beds.push({tier:i,outline:t.ring,soilTopIn:t.top,raisedIn:Math.round((t.top-t.low)*1000)/1000,areaSqft:r2(Math.abs(signed(t.ring))/144)});
  walls.push({tier:i,path,topIn:t.top,heightIn:r2(t.height),minHeightIn:r2(Math.max(0,t.minHeight)),lengthIn:r2(lengthIn)});
  const open=Math.max(0,...t.stops.flat().filter(v=>lineDistance(v,path)>1).map(v=>t.top-v.h!));if(open>RAISED_BED.unheldIn+.25)warnings.push(`Tier ${i+1} stands up to ${r2(open)} in over the ground away from its wall. Hold that side with timber or steel edging, or extend the wall.`);
 });
 return {ok:true,message:`${n} level tiers stepping down the measured ${slope.pct}% slope, held by walls of ${walls.map(w=>w.heightIn.toFixed(1)).join(', ')} in.`,tiers:n,...base,beds,walls,warnings};
}
