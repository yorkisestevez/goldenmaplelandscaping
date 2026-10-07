import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {groundEdgeGeometry} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {patioEdgeGeometry,edgeCourseMaterial} from '../src/features/deckcraft/components/viewer3d/PatioEdges3D';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {insideRings} from '../src/features/deckcraft/patioGroundContact';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import type {BufferGeometry} from 'three';
import {lawnGround,LAWN_DROP,SURVEY_FEATHER_IN} from '../src/features/deckcraft/components/viewer3d/lawnGround';
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import type {SiteGradingRegion,SiteModel} from '../src/features/deckcraft/siteModel';
const rect=(x:number,z:number,w:number,d:number)=>[{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];
const points=rect(0,0,120,120).map((p,i)=>({id:String(i),xIn:p.x,zIn:p.y,elevationIn:0}));
const grade=(id:string,x:number,z:number,w:number,d:number,h:number):SiteGradingRegion=>({id,name:id,boundary:rect(x,z,w,d),originXIn:0,originZIn:0,elevationIn:h,slopeXPct:0,slopeZPct:0});
let checks=0;
function verify(grading:SiteGradingRegion[],area:number,interior:boolean,kind:'existing'|'proposed'='proposed'){
 const siteModel:SiteModel={version:1,points,grading},yard=buildYardModel({...DEFAULT_DECK,siteModel}),before=JSON.stringify(yard),g=groundEdgeGeometry(yard,kind),p=g.getAttribute('position');let measuredArea=0;
 for(let i=0;i<p.count;i+=3){const ax=p.getX(i+1)-p.getX(i),ay=p.getY(i+1)-p.getY(i),az=p.getZ(i+1)-p.getZ(i),bx=p.getX(i+2)-p.getX(i),by=p.getY(i+2)-p.getY(i),bz=p.getZ(i+2)-p.getZ(i);measuredArea+=Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)/2;}
 assert.ok(Math.abs(measuredArea-area)<.002,`${measuredArea} expected ${area}`);checks++;
 if(interior)for(let i=0;i<p.count;i++){assert.ok(p.getX(i)>=20-.001&&p.getX(i)<=100+.001&&p.getZ(i)>=20-.001&&p.getZ(i)<=100+.001);checks++;}
 assert.equal(JSON.stringify(yard),before);checks++;g.dispose();
}
// The measured patch meets the estimated lawn at its own edge height (lawnGround.ts), so no earth wall stands round it.
verify([grade('perimeter',0,0,120,120,12)],0,false);
{const yard=buildYardModel({...DEFAULT_DECK,siteModel:{version:1,points,grading:[grade('perimeter',0,0,120,120,12)]}}),lawn=lawnGround(yard);
 for(const [x,z] of [[0,60],[120,30],[45,0],[80,120]]){assert.ok(Math.abs(lawn.height(x,z)-(12-LAWN_DROP))<1e-6);checks++;}
 assert.ok(Math.abs(lawn.height(-SURVEY_FEATHER_IN-1,60)-(0-LAWN_DROP))<1e-6,'settles to the survey mean');checks++;
 const mid=lawn.height(-SURVEY_FEATHER_IN/2,60);assert.ok(mid<12-LAWN_DROP&&mid>-LAWN_DROP);checks++;
 assert.equal(lawn.measured(60,60),true);assert.equal(lawn.measured(-10,60),false);checks+=2;}
verify([grade('internal',20,20,80,80,12)],4*80*12,true);
verify([grade('low',20,20,80,80,12),grade('high',60,20,40,80,18)],5280,true);
verify([grade('low',20,20,80,80,12),grade('same',60,20,40,80,12)],4*80*12,true);
verify([grade('internal',20,20,80,80,12)],0,true,'existing');
verify([],0,true);
verify([{...grade('crossing',20,20,80,80,0),originXIn:60,slopeXPct:100}],9600,true);
// A patio's edge faces (patioEdgeGeometry) and the yard model's edge warnings read open lawn only: never the ground in
// the patio's own cut-outs round deck posts, never the ground under another patio's paving. A stone-edged patio
// (groundFit.lowEdge 'stone') draws its raised side as the stone course, not exposed base.
{
 const grid=(h:(x:number,z:number)=>number):SiteModel=>{const pts=[];let id=0;for(let x=-240;x<=480;x+=120)for(let z=-240;z<=480;z+=120)pts.push({id:'s'+(id++),xIn:x,zIn:z,elevationIn:h(x,z)});return {version:1,points:pts,grading:[]};};
 const patio=(id:string,patch:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt:20,zFt:20,widthFt:10,depthFt:6,heightIn:0,rotationDeg:0,finishedElevationIn:24,productId:'permacon-melville',color:'#aaa',groundFit:{slopeRatio:3},...patch});
 const design=(site:SiteModel,features:YardFeature[],patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,siteModel:site,yardFeatures:features,terrainConfig:{widthFt:100,depthFt:100,elevationIn:0,slopePct:0},...patch});
 const edgeWarning=(w:string)=>/beside it is up to|stands up to/.test(w);
 const centres=(g:BufferGeometry)=>{const p=g.getAttribute('position'),out:{x:number;y:number;z:number}[]=[];for(let i=0;i<p.count;i+=3)out.push({x:(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y:(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z:(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3});return out;};
 const near=(rings:{x:number;y:number}[][],x:number,z:number,d:number)=>rings.some(r=>r.some((a,i)=>{const b=r[(i+1)%r.length],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-dx*t,z-a.y-dz*t)<d;}))||insideRings(rings,x,z);
 // 1. A fitted patio under a deck, 3 in up on ground falling 4%: its paving is cut round the deck posts.
 const underDeck=design(grid((_x,z)=>z*.04),[patio('under',{xFt:8,zFt:6,widthFt:20,depthFt:16,finishedElevationIn:3})],{width:16,length:12,height:60,stairFlights:0});
 const deck=buildDeckTakeoff(underDeck),y1=buildYardModel(underDeck,deck),posts=y1.deckClearance.supportCutouts,e1=patioEdgeGeometry(y1);
 assert.ok(!y1.features[0].excluded&&posts.length>0&&y1.features[0].footprints.length>1,'the patio is cut round the deck posts');checks++;
 assert.ok(!y1.warnings.some(edgeWarning),'no ground-beside warning read in a post cut-out');checks++;
 for(const g of [e1.dig,e1.base,e1.edge]){assert.ok(!centres(g).some(c=>near(posts,c.x,c.z,.05)),'no dig or base drawn round a post cut-out');checks++;}
 // 2. Two fitted patios sharing an edge at x = 240, 24 and 30 in on ground rising 1:10: a designed step between pavings.
 const abut=design(grid((_x,z)=>z*.1),[patio('a',{xFt:15,finishedElevationIn:24}),patio('b',{xFt:25,finishedElevationIn:30})]),y2=buildYardModel(abut),e2=patioEdgeGeometry(y2);
 assert.ok(!y2.warnings.some(w=>edgeWarning(w)&&w.startsWith('b:')),'the higher patio reads no ground under the lower one');checks++;
 const shared=(c:{x:number;z:number})=>Math.abs(c.x-240)<.05&&c.z>204+.05&&c.z<276-.05;
 for(const g of [e2.dig,e2.base,e2.edge]){assert.ok(!centres(g).some(shared),'no edge face along the shared edge');checks++;}
 // 3. A stone-edged patio standing 30 in on that ground: its raised side is the course; without a stone edge (and no
 // banks) the same side is exposed base.
 const stone=design(grid((_x,z)=>z*.1),[patio('s',{finishedElevationIn:30,groundFit:{slopeRatio:3,lowEdge:'stone'}})]),plain=design(grid((_x,z)=>z*.1),[patio('s',{finishedElevationIn:30,groundFit:undefined})]);
 const y3=buildYardModel(stone),e3=patioEdgeGeometry(y3),e4=patioEdgeGeometry(buildYardModel(plain)),thick=Math.max(...y3.features[0].boxes.filter(b=>b.role==='paver').map(b=>b.h));
 assert.ok(e3.edge.getAttribute('position').count>0&&e3.base.getAttribute('position').count===0,'stone-edged: the raised side is the stone course');checks++;
 assert.ok(e4.base.getAttribute('position').count>0&&e4.edge.getAttribute('position').count===0,'no stone edge: the raised side is exposed base');checks++;
 const ys=e3.edge.getAttribute('position');let top=-Infinity;for(let i=0;i<ys.count;i++)top=Math.max(top,ys.getY(i));assert.ok(top<=30-thick+1e-6,'the course stands below the pavers');checks++;
 assert.ok(y3.features[0].quantities.edgeCourseLf>0,'and the yard model measures it');checks++;
 const m=edgeCourseMaterial();assert.ok(m.customProgramCacheKey().includes('edge-course-v1')&&m.side===2,'stone course material: patched, both sides');checks++;m.dispose();
 for(const e of [e1,e2,e3,e4])for(const g of [e.dig,e.base,e.edge])g.dispose();
}
console.log(`SITE RENDERING OK — ${checks} checks; actual internal grade jumps, a survey edge feathered into the lawn and shared continuous edges; patio edges read open lawn only and a stone edge draws as stone; quantities unchanged.`);
