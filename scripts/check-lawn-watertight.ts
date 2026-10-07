// The drawn lawn is watertight: the measured ground (survey triangles, clipped round paving and water) and the estimated
// lawn round it (lawnGround.ts) meet without a crack. Checks the mesh groundGeometry builds — no shared edge with two
// heights, no T-junction where an open edge's midpoint lies on open edges none of which has its height — and that the
// survey's perimeter meets the estimated lawn within 0.01 in, on the Craighurst design (with and without ground fit),
// a survey with a traced boundary, a dense 2000-point survey, a survey whose hull carries a sliver triangle and a
// U-shaped traced boundary, where the estimated lawn must not step where the nearest survey edge switches.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import type {BufferGeometry} from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {loadAdvancedYardRuntime,buildYardModel,type YardModel} from '../src/features/deckcraft/yardModel';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import {groundGeometry} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {groundDisplayCuts} from '../src/features/deckcraft/components/viewer3d/finishedSurfaceGeometry';
import {lawnGround} from '../src/features/deckcraft/components/viewer3d/lawnGround';
import {lawnTufts} from '../src/features/deckcraft/components/viewer3d/lawnTufts';

await loadAdvancedYardRuntime();
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const CRAIGHURST='C:/Users/yorki/Desktop/Goldenmaplelandscaping.ca/deckcraft-launch/ulevel/designs/craighurst.json';

/** Shared edges with two heights, and T-junction cracks, in a triangle soup (positions in threes). */
function cracks(g:BufferGeometry){
 const p=g.getAttribute('position'),key=(i:number)=>`${Math.round(p.getX(i)*1000)}:${Math.round(p.getZ(i)*1000)}`;
 const edges=new Map<string,{n:number;ya:number;yb:number;i:number;j:number}>();let mismatched=0,worstShared=0;
 for(let t=0;t<p.count;t+=3)for(let k=0;k<3;k++){const a=t+k,b=t+(k+1)%3,ka=key(a),kb=key(b);if(ka===kb)continue;const [i,j]=ka<kb?[a,b]:[b,a],id=ka<kb?ka+'|'+kb:kb+'|'+ka,e=edges.get(id);
  if(e){e.n++;const gap=Math.max(Math.abs(e.ya-p.getY(i)),Math.abs(e.yb-p.getY(j)));worstShared=Math.max(worstShared,gap);if(gap>.005)mismatched++;}else edges.set(id,{n:1,ya:p.getY(i),yb:p.getY(j),i,j});}
 const open=[...edges.values()].filter(e=>e.n===1).map(e=>({ax:p.getX(e.i),az:p.getZ(e.i),ay:p.getY(e.i),bx:p.getX(e.j),bz:p.getZ(e.j),by:p.getY(e.j)}));
 // Open edges bucketed on a 24-inch grid by their boxes, so each midpoint meets only the edges near it.
 const C=24,cells=new Map<string,number[]>();
 open.forEach((e,n)=>{for(let x=Math.floor(Math.min(e.ax,e.bx)/C);x<=Math.floor(Math.max(e.ax,e.bx)/C);x++)for(let z=Math.floor(Math.min(e.az,e.bz)/C);z<=Math.floor(Math.max(e.az,e.bz)/C);z++){const k=x+':'+z,l=cells.get(k)??[];l.push(n);cells.set(k,l);}});
 // A midpoint is closed when some open edge it lies on carries its height. Not every one need: a sliver triangle along
 // the survey's hull (three shots nearly in line) stands as a wall a few hundred-thousandths of an inch thick, under the
 // 1e-4 in this test allows for float positions, so an edge meeting its outer side also lies on its inner side, a wall's
 // height away.
 let tCracks=0,worstT=0,where='';
 open.forEach((e,n)=>{const mx=(e.ax+e.bx)/2,mz=(e.az+e.bz)/2,my=(e.ay+e.by)/2;let gap=Infinity;for(const m of cells.get(Math.floor(mx/C)+':'+Math.floor(mz/C))??[]){if(m===n)continue;const f=open[m],dx=f.bx-f.ax,dz=f.bz-f.az,l=dx*dx+dz*dz;if(l<1e-9)continue;const t=((mx-f.ax)*dx+(mz-f.az)*dz)/l;if(t<=1e-6||t>=1-1e-6)continue;if(Math.abs((mx-f.ax)*dz-(mz-f.az)*dx)/Math.sqrt(l)>1e-4)continue;gap=Math.min(gap,Math.abs(f.ay+(f.by-f.ay)*t-my));}
  if(gap===Infinity)return;if(gap>worstT){worstT=gap;where=`${mx.toFixed(1)},${mz.toFixed(1)}`;}if(gap>.01)tCracks++;});
 return {triangles:p.count/3,open:open.length,mismatched,worstShared,tCracks,worstT,where};
}
/** The survey's perimeter, 200 points round it: the ground just inside against the estimated lawn just outside, each
 * carried straight to the edge from two readings off it. Inside, the readings are as close as the survey allows (a sliver
 * triangle along the edge can be thinner than 1e-3 in and climb inches per inch). */
function perimeterGap(yard:YardModel,kind:'existing'|'proposed'){
 const lawn=lawnGround(yard,kind),rings=yard.siteSurface!.coverage,segments=rings.flatMap(r=>r.map((a,i)=>({a,b:r[(i+1)%r.length]}))),total=segments.reduce((n,s)=>n+Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),0);
 let worst=0,read=0;
 for(let k=0;k<200;k++){let at=(k+.5)/200*total;for(const {a,b} of segments){const l=Math.hypot(b.x-a.x,b.y-a.y);if(at>l){at-=l;continue;}if(l<1e-6)break;
   const x=a.x+(b.x-a.x)*at/l,z=a.y+(b.y-a.y)*at/l,nx=(b.y-a.y)/l,nz=-(b.x-a.x)/l,h=(e:number)=>lawn.height(x+nx*e,z+nz*e),m=(e:number)=>lawn.measured(x+nx*e,z+nz*e);
   if(m(1e-3)===m(-1e-3))break;const out=m(1e-3)?-1:1,outside=2*h(out*1e-3)-h(out*2e-3),e=[1e-5,1e-4,1e-3].find(e=>m(-out*e)&&m(-out*2*e));
   if(e!==undefined){read++;worst=Math.max(worst,Math.abs(2*h(-out*e)-h(-out*2*e)-outside));}break;}}
 return {worst,read};
}
const turfBounds=(data:DeckData,yard:YardModel)=>{const width=data.width*12,depth=data.length*12,tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12,b=yard.siteSurface?.bounds,minX=Math.min(width/2-tw/2,b?.minX??Infinity),minZ=Math.min(depth/2-td/2,b?.minZ??Infinity),maxX=Math.max(width/2+tw/2,b?.maxX??-Infinity),maxZ=Math.max(depth/2+td/2,b?.maxZ??-Infinity);return {width,depth,bounds:{minX,minZ,width:maxX-minX,depth:maxZ-minZ}};};
const summary:string[]=[];
/** The ground mesh of both surfaces of a design, checked; `tight` also holds its shared edges and T-junctions to that. */
function verify(label:string,data:DeckData,deck=false,tight?:number){
 const yard=buildYardModel(data,deck?buildDeckTakeoff(data):undefined);ok(!!yard.siteSurface,`${label}: measured`);
 for(const kind of ['proposed','existing'] as const){
  const cuts=groundDisplayCuts(yard,[],kind==='proposed'),{width,depth,bounds}=turfBounds(data,yard),t=performance.now(),g=groundGeometry(yard,cuts,width,depth,bounds,kind),ms=performance.now()-t,c=cracks(g),pos=g.getAttribute('position');
  let finite=true;for(let i=0;i<pos.count;i++)if(!Number.isFinite(pos.getX(i)+pos.getY(i)+pos.getZ(i))){finite=false;break;}
  ok(finite,`${label} ${kind}: every vertex finite`);
  ok(c.mismatched===0,`${label} ${kind}: ${c.mismatched} shared edges carry two heights (worst ${c.worstShared.toFixed(4)} in)`);
  ok(c.tCracks===0,`${label} ${kind}: ${c.tCracks} T-junction cracks, worst ${c.worstT.toFixed(4)} in at ${c.where}`);
  if(tight!==undefined){ok(c.worstShared<=tight,`${label} ${kind}: shared edges agree within ${tight} in (worst ${c.worstShared.toFixed(5)})`);ok(c.worstT<=tight,`${label} ${kind}: T-junctions close within ${tight} in (worst ${c.worstT.toFixed(5)} at ${c.where})`);}
  const rim=perimeterGap(yard,kind);ok(rim.read>=150,`${label} ${kind}: perimeter read at ${rim.read} of 200 points`);ok(rim.worst<.01,`${label} ${kind}: survey edge meets the estimated lawn within 0.01 in (worst ${rim.worst.toFixed(5)})`);
  if(kind==='proposed')summary.push(`${label}: ${c.triangles} triangles, ${c.open} open edges, shared ≤ ${c.worstShared.toFixed(4)} in, T-gap ≤ ${c.worstT.toFixed(4)} in, rim ≤ ${rim.worst.toFixed(4)} in, ${ms.toFixed(0)} ms`);
  g.dispose();
 }
 return yard;
}

// 1. Craighurst, as surveyed (U-Level export), with and without ground fit round its landing.
if(existsSync(CRAIGHURST)){
 const doc=JSON.parse(readFileSync(CRAIGHURST,'utf8'));await ensureLiveDesignExtensions(doc);const data=parseDesign(JSON.stringify(doc)),landing=data.yardFeatures![0];
 verify('Craighurst',data,true);
 verify('Craighurst ground fit 3:1',{...data,yardFeatures:[{...landing,groundFit:{slopeRatio:3}}]},true);
 verify('Craighurst ground fit 3:1 stone edge',{...data,yardFeatures:[{...landing,groundFit:{slopeRatio:3,lowEdge:'stone'}}]},true);
}else summary.push(`Craighurst design not found at ${CRAIGHURST}; skipped.`);

// 2. A traced boundary: coverage edges come from the clip, a hair off the survey triangles.
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const terrain={widthFt:140,depthFt:140,elevationIn:0,slopePct:0};
const patio=(over:Partial<YardFeature>={}):YardFeature=>({id:'p',kind:'patio',name:'Patio',enabled:true,xFt:50,zFt:50,widthFt:12,depthFt:10,heightIn:0,rotationDeg:15,finishedElevationIn:60,productId:'permacon-melville',color:'#aaa',groundFit:{slopeRatio:3},...over});
const design=(site:SiteModel,features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,siteModel:site,yardFeatures:features,terrainConfig:terrain});
const scatter=(n:number)=>Array.from({length:n},(_,i)=>{const x=rnd()*1200,z=rnd()*1200;return {id:`r${i}`,xIn:x,zIn:z,elevationIn:z*.08+x*.03+Math.sin(x/90)*6};});
for(const N of [12,256]){
 const boundary=Array.from({length:N},(_,i)=>{const a=i/N*2*Math.PI,r=560+Math.sin(a*7)*30;return {x:600+Math.cos(a)*r,y:600+Math.sin(a)*r};});
 const site:SiteModel={version:1,points:scatter(600),grading:[],boundary},data=design(site,[patio()]);
 const yard=verify(`Traced ${N}-point boundary`,data);
 // Heights stay quick on a long traced edge (the lawn's blades read thousands of them on every camera move).
 const lawn=lawnGround(yard),t=performance.now();for(let i=0;i<28000;i++)lawn.height(-600+rnd()*2400,-600+rnd()*2400);const ms=performance.now()-t;
 ok(ms<300,`Traced ${N}: 28,000 lawn heights in ${ms.toFixed(0)} ms`);
 const t2=performance.now();lawnTufts(yard,192,144,[],28000,{x:1250,z:600});const tuftMs=performance.now()-t2;ok(tuftMs<300,`Traced ${N}: lawn blades round a moved focus in ${tuftMs.toFixed(0)} ms`);
 summary.push(`  heights ${ms.toFixed(0)} ms, blades ${tuftMs.toFixed(0)} ms`);
}

// 3. A dense survey: 2000 shots, a fitted patio and an unfitted one.
{seed=11;const site:SiteModel={version:1,points:scatter(2000),grading:[]};verify('Dense 2000-point survey',design(site,[patio(),patio({id:'q',name:'Lower patio',xFt:80,zFt:30,finishedElevationIn:40,groundFit:undefined})]));}

// 4. A survey whose hull carries sliver triangles (seed 9): shots nearly in line along the hull leave a triangle 0.0086 in
// wide that climbs 862 in per inch across itself, near (318–784, 1199). Vertices clipped to it round ~1e-5 in off it, and
// neither the survey drawn there nor the lawn meeting it may read its plane off the triangle.
const rolling=(x:number,z:number)=>z*.08+x*.03+Math.sin(x/90)*6+Math.cos(z/60)*8;
{seed=9;const points=Array.from({length:2000},(_,i)=>{const x=rnd()*1200,z=rnd()*1200;return {id:`s${i}`,xIn:x,zIn:z,elevationIn:rolling(x,z)};});verify('Sliver-hull 2000-point survey',design({version:1,points,grading:[]},[]),false,.001);}

// 5. A U-shaped traced boundary: a notch 400 in wide cut 800 in into the survey. Past a medial line of the notch the
// nearest survey edge switches (before the blend the lawn stepped 2.29 in within 0.5 in near (750, 400)); the estimated
// lawn in the notch has no jump over 0.5 in between points 0.5 in apart.
{
 seed=7;const points=Array.from({length:700},(_,i)=>{const x=rnd()*1200,z=rnd()*1200;return {id:`u${i}`,xIn:x,zIn:z,elevationIn:rolling(x,z)};});
 const U=[{x:50,y:50},{x:1150,y:50},{x:1150,y:1150},{x:800,y:1150},{x:800,y:350},{x:400,y:350},{x:400,y:1150},{x:50,y:1150}];
 const yard=verify('U-shaped traced boundary',design({version:1,points,grading:[],boundary:U},[patio({xFt:20,zFt:20})])),lawn=lawnGround(yard),s=.5,x0=400,z0=350,nx=801,nz=1601,t=performance.now();
 const h=new Float64Array(nx*nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+i*s,z=z0+j*s;h[j*nx+i]=lawn.measured(x,z)?NaN:lawn.height(x,z);}
 let worst=0,at='';for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;for(const n of [i+1<nx?k+1:-1,j+1<nz?k+nx:-1]){if(n<0)continue;const d=Math.abs(h[n]-h[k]);if(d>worst){worst=d;at=`${(x0+i*s).toFixed(1)},${(z0+j*s).toFixed(1)}`;}}}
 ok(worst<=.5,`U notch: the estimated lawn steps ${worst.toFixed(3)} in between points 0.5 in apart at ${at}`);
 summary.push(`  notch: largest step ${worst.toFixed(3)} in per 0.5 in at ${at} (${(performance.now()-t).toFixed(0)} ms)`);
}

console.log(summary.join('\n'));
console.log(`Lawn watertight: ${checks} checks passed.`);
