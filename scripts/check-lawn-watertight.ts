// The drawn lawn is watertight: the measured ground (survey triangles, clipped round paving and water) and the estimated
// lawn round it (lawnGround.ts) meet without a crack. Checks the mesh groundGeometry builds — no shared edge with two
// heights, no T-junction where an open edge's midpoint lies on open edges none of which has its height — and that the
// survey's perimeter meets the estimated lawn within 0.01 in, on the Craighurst design (with and without ground fit),
// a survey with a traced boundary, a dense 2000-point survey, a survey whose hull carries a sliver triangle and a
// U-shaped traced boundary, where the estimated lawn must not step where the nearest survey edge switches,
// and steps down into a sunken lounge: the finished lawn opens over treads below it (meeting the paving with no
// grass sliver) and stays whole over steps that rise from the lawn. Retaining, seat and freestanding walls are
// opened the same way: the lawn stops at the wall (and at a cap that overhangs it) instead of crossing the face,
// including a sunken wall whose base is below grade, while the drainage trench stays covered. Quantities and price stay on the yard model.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import type {BufferGeometry} from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {loadAdvancedYardRuntime,buildYardModel,yardClip,type YardModel} from '../src/features/deckcraft/yardModel';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import {groundGeometry} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {groundDisplayCuts,patioDisplayFootprints,sunkenStepDisplayFootprints,wallDisplayFootprints,waterDisplayFootprints} from '../src/features/deckcraft/components/viewer3d/finishedSurfaceGeometry';
import {lawnGround} from '../src/features/deckcraft/components/viewer3d/lawnGround';
import {insideRings} from '../src/features/deckcraft/patioGroundContact';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
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

// 6. Steps down into a sunken lounge, and a flight that rises from the same lawn. The finished lawn is cut over treads
// whose tops sit below the lawn and left in place over treads at or above it. A half-inch opening past each sunken
// tread meets the lounge paving, so no grass sliver remains between them.
{
 const lounge:YardFeature={id:'lounge',name:'Sunken lounge',kind:'patio',enabled:true,xFt:50,zFt:50,widthFt:10,depthFt:8,heightIn:0,rotationDeg:0,finishedElevationIn:-18,productId:'permacon-mondrian-plus',color:'#c4bfb4'};
 const flight=(id:string,name:string,xFt:number,zFt:number,lower:number,upper:number,rotationDeg=0):YardFeature=>({id,name,kind:'patio',enabled:true,xFt,zFt,widthFt:4,depthFt:3,heightIn:0,rotationDeg,productId:'permacon-mondrian-plus',color:'#b8b5ae',finishedElevationIn:upper,stoneSteps:{lowerElevationIn:lower,riserCount:3,treadRunIn:12,stockWidthIn:48,stockDepthIn:12,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:0,productName:'Cut stone treads'}});
 const patioNorth=lounge.zFt*12+lounge.depthFt*6,gap=.02,downZ=(patioNorth+gap+18)/12;
 const features=[lounge,flight('down','Steps down',50,downZ,-18,0),flight('up','Steps up',80,50,0,18,25)];
 const terrain={widthFt:160,depthFt:160,elevationIn:0,slopePct:0};
 const flat=():DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',yardFeatures:features,terrainConfig:terrain});
 const pointIn=(rings:{x:number;y:number}[][],x:number,z:number)=>insideRings(rings,x,z);
 const covered=(g:BufferGeometry,x:number,z:number)=>{const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2),abx=bx-ax,abz=bz-az,acx=cx-ax,acz=cz-az,den=abx*acz-acx*abz;if(Math.abs(den)<1e-8)continue;const px=x-ax,pz=z-az,u=(px*acz-acx*pz)/den,v=(abx*pz-px*abz)/den;if(u>=-1e-4&&v>=-1e-4&&u+v<=1+1e-4)return true;}return false;};
 const samples=(poly:{x:number;y:number}[])=>{let a=0,cx=0,cy=0;for(let i=0;i<poly.length;i++){const q=poly[(i+1)%poly.length],k=poly[i].x*q.y-q.x*poly[i].y;a+=k;cx+=(poly[i].x+q.x)*k;cy+=(poly[i].y+q.y)*k;}return [{x:cx/(3*a),y:cy/(3*a)},...poly.map(p=>({x:cx/(3*a)*.7+p.x*.3,y:cy/(3*a)*.7+p.y*.3}))];};
 for(const [label,data] of [['Illustrative lawn',flat()],['Surveyed lawn',{...flat(),siteModel:{version:1,points:[{id:'a',xIn:-400,zIn:-400,elevationIn:0},{id:'b',xIn:2400,zIn:-400,elevationIn:0},{id:'c',xIn:2400,zIn:2400,elevationIn:0},{id:'d',xIn:-400,zIn:2400,elevationIn:0}],grading:[]}}]] as [string,DeckData][]){
  await ensureLiveDesignExtensions(data);const saved=JSON.stringify(data),before=calculateEstimate(data),yard=buildYardModel(data,before.model),quantities=JSON.stringify(yard.quantities),subtotal=before.subtotal;
  const down=yard.features.find(f=>f.config.id==='down')!,up=yard.features.find(f=>f.config.id==='up')!,loungeModel=yard.features.find(f=>f.config.id==='lounge')!;
  ok(!down.excluded&&!up.excluded&&!loungeModel.excluded,`${label}: lounge, descending steps and rising steps all stay in the model`);
  ok(down.quantities.buriedTreadAreaSqft>1&&up.quantities.buriedTreadAreaSqft<.001,`${label}: only the sunken treads are measured as intersecting ground`);
  ok(yard.warnings.some(w=>w.includes(`${down.quantities.buriedTreadAreaSqft.toFixed(2)} sq ft of exposed stone treads intersect`)),`${label}: the ground-intersection warning stays with the quantity`);
  const lawn=lawnGround(yard),treads=(f:typeof down)=>f.boxes.filter(b=>b.role==='stone-step'&&b.polygon&&(!b.stonePart||b.stonePart==='tread'||b.stonePart==='landing'));
  const below=(b:ReturnType<typeof treads>[number])=>b.y+b.h/2<lawn.height(b.x,b.z)+.05,sunken=treads(down).filter(below),clear=[...treads(down).filter(b=>!below(b)),...treads(up)];
  ok(sunken.length>=2&&treads(down).some(b=>!below(b))&&treads(up).every(b=>!below(b)),`${label}: lower treads sit under the lawn and the grade-level and rising treads do not`);
  const openings=sunkenStepDisplayFootprints(yard),cuts=groundDisplayCuts(yard,[],true),legacy=yardClip([...waterDisplayFootprints(yard,[]),...patioDisplayFootprints(yard)]);
  for(const b of sunken)for(const p of samples(b.polygon!)){ok(pointIn(openings,p.x,p.y),`${label}: sunken tread ${b.id} is a lawn opening`);ok(pointIn(cuts,p.x,p.y),`${label}: finished ground cuts include sunken tread ${b.id}`);}
  for(const b of clear)for(const p of samples(b.polygon!)){ok(!pointIn(openings,p.x,p.y),`${label}: tread ${b.id} at or above the lawn is not opened`);ok(!pointIn(cuts,p.x,p.y)&&pointIn(legacy,p.x,p.y)===false,`${label}: rising and grade-level treads stay out of the finished cuts`);}
  const lowest=sunken.reduce((a,b)=>a.y+a.h/2<b.y+b.h/2?a:b),edgeAt=(score:(x:number,z:number)=>number)=>lowest.polygon!.reduce((e,p,i)=>{const q=lowest.polygon![(i+1)%lowest.polygon!.length],mx=(p.x+q.x)/2,mz=(p.y+q.y)/2,s=score(mx,mz);return s>e.s?{x:mx,z:mz,dx:q.x-p.x,dz:q.y-p.y,s}:e;},{x:0,z:0,dx:0,dz:0,s:-Infinity});
  const front=edgeAt((_x,z)=>-z),side=edgeAt(x=>x),sideLen=Math.hypot(side.dx,side.dz)||1,nx=-side.dz/sideLen,nz=side.dx/sideLen,out=nx>0?1:-1;
  ok(pointIn(cuts,side.x+nx*out*.25,side.z+nz*out*.25)&&!pointIn(cuts,side.x+nx*out*1.25,side.z+nz*out*1.25),`${label}: the opening passes the tread by half an inch and the lawn resumes beyond it`);
  const intoPatio={x:0,z:-1};for(const s of [-.25,-.12,-.04,.01,.08,.2]){const x=front.x+intoPatio.x*s,z=front.z+intoPatio.z*s;ok(pointIn(cuts,x,z),`${label}: no gap between the lowest tread and the lounge paving at ${s.toFixed(2)} in`);}
  const {width,depth,bounds}=turfBounds(data,yard),mesh=groundGeometry(yard,cuts,width,depth,bounds,'proposed'),oldMesh=groundGeometry(yard,legacy,width,depth,bounds,'proposed'),c=cracks(mesh);
  ok(c.mismatched===0&&c.tCracks===0,`${label}: lawn around the stair cut stays watertight (shared ${c.worstShared.toFixed(4)} in, T-gap ${c.worstT.toFixed(4)} in)`);
  for(const b of sunken)for(const p of samples(b.polygon!)){ok(!covered(mesh,p.x,p.y),`${label}: the lawn mesh leaves sunken tread ${b.id} open`);ok(covered(oldMesh,p.x,p.y),`${label}: without the stair cut the same tread was covered`);}
  for(const b of clear)for(const p of samples(b.polygon!)){ok(covered(mesh,p.x,p.y)&&covered(oldMesh,p.x,p.y),`${label}: the lawn mesh over tread ${b.id} is unchanged`);}
  for(const s of [-.25,-.12,-.04,.01,.08,.2])ok(!covered(mesh,front.x+intoPatio.x*s,front.z+intoPatio.z*s),`${label}: the drawn lawn has no seam across the tread-to-paving joint`);
  ok(!covered(mesh,side.x+nx*out*.25,side.z+nz*out*.25)&&covered(mesh,side.x+nx*out*1.25,side.z+nz*out*1.25),`${label}: drawn lawn stops at the stair margin and continues beside it`);
  if(data.siteModel){const rim=perimeterGap(yard,'proposed');ok(rim.worst<.01,`${label}: survey edge still meets the estimated lawn (worst ${rim.worst.toFixed(5)})`);}
  ok(JSON.stringify(data)===saved&&JSON.stringify(yard.quantities)===quantities&&calculateEstimate(data).subtotal===subtotal,`${label}: design, quantities and price are unchanged by the lawn opening`);
  summary.push(`${label}: sunken treads ${sunken.length}, grade-or-rising treads ${clear.length}, buried ${down.quantities.buriedTreadAreaSqft.toFixed(2)} sq ft still reported`);
  mesh.dispose();oldMesh.dispose();
 }
}

// 7. Walls sit in the lawn the way paving does. A sunken lounge wall (base 18 in below grade) is opened through its
// below-grade face and through the grass shelf the construction envelope left in front of it. A cap near grade, a
// grade-height wall and a freestanding seat wall on open lawn are opened on their stone, and the lawn resumes just
// outside. Drainage behind a wall stays covered. Blades do not grow on the stone. Price and quantities stay put.
{
 const lounge:YardFeature={id:'lounge',name:'Sunken lounge',kind:'patio',enabled:true,xFt:50,zFt:50,widthFt:10,depthFt:8,heightIn:0,rotationDeg:0,finishedElevationIn:-18,productId:'permacon-mondrian-plus',color:'#c4bfb4'};
 const wall=(over:Partial<YardFeature>):YardFeature=>({id:'w',name:'Wall',kind:'retaining-wall',enabled:true,xFt:50,zFt:50,widthFt:10,depthFt:1,heightIn:24,rotationDeg:0,productId:'segmental-concrete',color:'#8f877b',...over});
 const northZ=(lounge.zFt*12+lounge.depthFt*6+6)/12;
 const features=[lounge,wall({id:'sunken',name:'Sunken retaining',xFt:50,zFt:northZ,baseElevationIn:-18,finishedElevationIn:6}),wall({id:'grade',name:'Grade wall',xFt:20,zFt:70,widthFt:12,heightIn:18,finishedElevationIn:18}),wall({id:'lowcap',name:'Cap near grade',xFt:30,zFt:20,widthFt:8,heightIn:6,finishedElevationIn:3}),wall({id:'seat',name:'Seat on lawn',xFt:80,zFt:30,widthFt:8,heightIn:18,wallConstruction:{freestanding:true}}),wall({id:'seat-pad',name:'Seat on paving',xFt:50,zFt:50,widthFt:6,heightIn:18,wallConstruction:{freestanding:true}})];
 const flat=():DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',yardFeatures:features,terrainConfig:{widthFt:160,depthFt:160,elevationIn:0,slopePct:0}});
 const pointIn=(rings:{x:number;y:number}[][],x:number,z:number)=>insideRings(rings,x,z);
 const covered=(g:BufferGeometry,x:number,z:number)=>{const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2),abx=bx-ax,abz=bz-az,acx=cx-ax,acz=cz-az,den=abx*acz-acx*abz;if(Math.abs(den)<1e-8)continue;const px=x-ax,pz=z-az,u=(px*acz-acx*pz)/den,v=(abx*pz-px*abz)/den;if(u>=-1e-4&&v>=-1e-4&&u+v<=1+1e-4)return true;}return false;};
 const centroid=(poly:{x:number;y:number}[])=>{let a=0,cx=0,cy=0;for(let i=0;i<poly.length;i++){const q=poly[(i+1)%poly.length],k=poly[i].x*q.y-q.x*poly[i].y;a+=k;cx+=(poly[i].x+q.x)*k;cy+=(poly[i].y+q.y)*k;}return {x:cx/(3*a),y:cy/(3*a)};};
 for(const [label,data] of [['Illustrative walls',flat()],['Surveyed walls',{...flat(),siteModel:{version:1,points:[{id:'a',xIn:-400,zIn:-400,elevationIn:0},{id:'b',xIn:2400,zIn:-400,elevationIn:0},{id:'c',xIn:2400,zIn:2400,elevationIn:0},{id:'d',xIn:-400,zIn:2400,elevationIn:0}],grading:[]}}]] as [string,DeckData][]){
  await ensureLiveDesignExtensions(data);const saved=JSON.stringify(data),before=calculateEstimate(data),yard=buildYardModel(data,before.model),quantities=JSON.stringify(yard.quantities),subtotal=before.subtotal;
  const byId=(id:string)=>yard.features.find(f=>f.config.id===id)!;
  ok(['lounge','sunken','grade','lowcap','seat','seat-pad'].every(id=>!byId(id).excluded),`${label}: lounge and walls stay in the model`);
  const lawn=lawnGround(yard),openings=wallDisplayFootprints(yard),cuts=groundDisplayCuts(yard,[],true),legacy=yardClip([...waterDisplayFootprints(yard,[]),...patioDisplayFootprints(yard),...sunkenStepDisplayFootprints(yard)]);
  const stoneOf=(id:string)=>byId(id).boxes.filter(b=>(b.role==='wall-block'||b.role==='wall-cap')&&b.polygon&&!b.renderDuplicate);
  for(const id of ['sunken','grade','lowcap','seat'])for(const b of stoneOf(id)){ok(pointIn(openings,b.x,b.z)&&pointIn(cuts,b.x,b.z),`${label}: ${id} ${b.role} is a finished lawn opening`);ok(!pointIn(legacy,b.x,b.z),`${label}: ${id} ${b.role} was not opened with the paving`);}
  const sunken=byId('sunken'),below=sunken.boxes.filter(b=>b.role==='wall-block'&&b.polygon&&!b.renderDuplicate&&b.y+b.h/2<lawn.height(b.x,b.z));
  ok(below.length>10&&sunken.config.baseElevationIn===-18,`${label}: the sunken wall's base is below grade and its courses cross the lawn`);
  const capOf=(id:string)=>{const b=byId(id).boxes.find(b=>b.role==='wall-cap'&&!b.renderDuplicate&&b.polygon)!;return b.renderContours?.[0]??b.polygon!;};
  const northOf=(id:string)=>{const poly=capOf(id),c=centroid(poly),edge=poly.reduce((e,p,i)=>{const q=poly[(i+1)%poly.length],mx=(p.x+q.x)/2,mz=(p.y+q.y)/2;return mz>e.mz?{x:mx,z:mz,mz}:e;},{x:0,z:0,mz:-Infinity});const len=Math.hypot(edge.x-c.x,edge.z-c.y)||1;return {x:edge.x+(edge.x-c.x)/len*1.25,z:edge.z+(edge.z-c.y)/len*1.25,lipX:edge.x-(edge.x-c.x)/len*.2,lipZ:edge.z-(edge.z-c.y)/len*.2};};
  const {width,depth,bounds}=turfBounds(data,yard),mesh=groundGeometry(yard,cuts,width,depth,bounds,'proposed'),oldMesh=groundGeometry(yard,legacy,width,depth,bounds,'proposed'),c=cracks(mesh);
  ok(c.mismatched===0&&c.tCracks===0,`${label}: lawn around the wall cuts stays watertight (shared ${c.worstShared.toFixed(4)} in, T-gap ${c.worstT.toFixed(4)} in)`);
  for(const id of ['sunken','grade','lowcap','seat'])for(const b of stoneOf(id)){ok(!covered(mesh,b.x,b.z),`${label}: the lawn mesh leaves ${id} ${b.role} open`);ok(covered(oldMesh,b.x,b.z),`${label}: without the wall cut the same ${id} ${b.role} was covered`);}
  for(const id of ['grade','lowcap','seat']){const out=northOf(id);ok(!covered(mesh,out.lipX,out.lipZ)&&!pointIn(cuts,out.x,out.z)&&covered(mesh,out.x,out.z)&&covered(oldMesh,out.x,out.z),`${label}: ${id} meets the lawn at its cap and the grass resumes 1.25 in outside`);}
  const face=northOf('sunken');ok(!covered(mesh,face.lipX,face.lipZ),`${label}: the sunken wall's cap lip is open toward the lounge`);
  ok(!covered(mesh,600,644)&&pointIn(cuts,600,644)&&covered(oldMesh,600,644),`${label}: the grass shelf in front of the sunken face is opened`);
  ok(covered(mesh,600,670)&&!pointIn(cuts,600,670),`${label}: lawn on the retained side of the sunken wall stays whole`);
  const drain=byId('grade').boxes.find(b=>b.role==='wall-drainage'&&b.polygon)!;const dc=centroid(drain.polygon!);
  ok(!pointIn(cuts,dc.x,dc.y)&&covered(mesh,dc.x,dc.y)&&covered(oldMesh,dc.x,dc.y),`${label}: drainage behind the wall stays under the lawn`);
  const seatPad=stoneOf('seat-pad')[0];ok(pointIn(patioDisplayFootprints(yard),seatPad.x,seatPad.z)&&!covered(mesh,seatPad.x,seatPad.z),`${label}: a seat wall standing on paving stays in the paving opening`);
  const masks=yardClip([...cuts,...yard.features.filter(f=>!f.excluded).flatMap(f=>f.footprints)]),tufts=lawnTufts(yard,width,depth,masks,8000);
  const onStone=tufts.some(t=>['sunken','grade','lowcap','seat'].some(id=>stoneOf(id).some(b=>pointIn(b.renderContours??[b.polygon!],t.x,t.z))));
  ok(!onStone,`${label}: grass blades do not grow on wall faces or caps`);
  if(data.siteModel){const rim=perimeterGap(yard,'proposed');ok(rim.worst<.01,`${label}: survey edge still meets the estimated lawn (worst ${rim.worst.toFixed(5)})`);}
  ok(JSON.stringify(data)===saved&&JSON.stringify(yard.quantities)===quantities&&calculateEstimate(data).subtotal===subtotal,`${label}: design, quantities and price are unchanged by the wall opening`);
  summary.push(`${label}: wall stone opened, drainage covered, ${below.length} sunken courses below the lawn`);
  mesh.dispose();oldMesh.dispose();
 }
}

console.log(summary.join('\n'));
console.log(`Lawn watertight: ${checks} checks passed.`);
