import assert from 'node:assert/strict';
// Measured/sloped-ground foundations are a lazy runtime in the app (ensureDesignExtensions); register it before calculating.
import '../src/features/deckcraft/foundationDatumsRuntime';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {FASCIA_JOINT_IN,FASCIA_STOCK_IN,fasciaSlabs,accessoryFasciaSlabs} from '../src/features/deckcraft/components/viewer3d/fasciaSlabs';
import {FASCIA_RETAIL_RATES} from '../src/features/deckcraft/supplierRates';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {slabGeometry} from '../src/features/deckcraft/components/viewer3d/slabGeometry';
import {reflectionBinding} from '../src/features/deckcraft/components/viewer3d/windowReflections';
import {createWindowGlass} from '../src/features/deckcraft/components/viewer3d/windowGlass';
import type {DeckData} from '../src/features/deckcraft/types';
let checks=0;const ok=(v:unknown,s:string)=>{assert(v,s);checks++;};
const near=(a:number,b:number)=>Math.abs(a-b)<1e-4;
for(const patch of [{},{shape:'L-Shape'},{cornerChamfers:{frontLeftFt:2,frontRightFt:3}},{levels:2,width2:10,length2:8,height2:12},{terrainConfig:{widthFt:80,depthFt:80,elevationIn:0,slopePct:3}},{width:12.01},{width:12+1/12},{width:24.5}]){
  const d={...structuredClone(DEFAULT_DECK),width:22,length:16,height:36,...patch} as DeckData,m=buildDeckTakeoff(d),pieces=fasciaSlabs(m);
  // Fascia comes in 12 ft boards: each rim run is as many boards as the estimate prices, split evenly (no sliver at a
  // corner) and butted with a gap; the run's own ends keep their mitres, exactly at its corners.
  const rims=m.levels.flatMap(l=>l.rim??[]),runLength=(r:typeof rims[number])=>Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z);
  const onRun=(r:typeof rims[number])=>pieces.filter(s=>[s.a,s.b].every(p=>Math.abs((p.x-r.a.x)*(r.b.z-r.a.z)-(p.y-r.a.z)*(r.b.x-r.a.x))<1e-3*runLength(r))&&[s.a,s.b].every(p=>(p.x-r.a.x)*(r.b.x-r.a.x)+(p.y-r.a.z)*(r.b.z-r.a.z)>=-1e-6&&(p.x-r.b.x)*(r.a.x-r.b.x)+(p.y-r.b.z)*(r.a.z-r.b.z)>=-1e-6));
  for(const r of rims){
    const on=onRun(r),lengths=on.map(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)),near3=(p:{x:number;y:number},x:number,z:number)=>Math.hypot(p.x-x,p.y-z)<1e-6;
    ok(on.some(s=>near3(s.a,r.a.x,r.a.z))&&on.some(s=>near3(s.b,r.b.x,r.b.z)),'Fascia runs right to both corners of its rim run, with no gap left at a mitre');
    ok(Math.max(...lengths)-Math.min(...lengths)<1e-6,`A ${runLength(r).toFixed(1)} in run is split into equal boards, never a sliver at a corner`);
  }
  ok(pieces.length===rims.reduce((n,r)=>n+Math.ceil(runLength(r)/FASCIA_STOCK_IN-1e-9),0),'Each rim run is as many fascia boards as the estimate cuts from 12 ft stock');
  ok(Object.values(FASCIA_RETAIL_RATES).every(r=>r.stockIn===FASCIA_STOCK_IN),'The drawn fascia board length is the priced stock length');
  ok(pieces.every(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)<=FASCIA_STOCK_IN+1e-6),'No drawn fascia board is longer than the stock it is cut from');
  {const long=rims.find(r=>runLength(r)>FASCIA_STOCK_IN+1);if(long){const on=onRun(long),lengths=on.map(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)).sort((p,q)=>q-p);
    ok(on.length>=2&&Math.abs(lengths.reduce((n,l)=>n+l,0)+(on.length-1)*FASCIA_JOINT_IN-runLength(long))<1e-6&&on.filter(s=>s.capA||s.capB).length<=2&&on.every(s=>s.grainAnchor),'A long run shows its butt joint: the pieces and their gaps fill the run, mitres only at its ends, each board its own grain');}}
  let joins=0;
  for(const s of pieces){
    const plain=slabGeometry([s],'along',false),eased=slabGeometry([s],'along',false,true);
    plain.computeBoundingBox();eased.computeBoundingBox();
    for(const key of ['min','max'] as const)for(const axis of ['x','y','z'] as const)ok(Math.abs(plain.boundingBox![key][axis]-eased.boundingBox![key][axis])<.071,'Edge easing stays within the existing fascia envelope');
    const p=eased.getAttribute('position'),n=eased.getAttribute('normal'),uv=eased.getAttribute('uv');
    ok([p,n,uv].every(a=>Array.from(a.array).every(Number.isFinite)),'Mitred and chamfered finish vertices, normals and UVs are finite');
    let volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);volume+=a.dot(b.cross(c))/6;}
    ok(volume>0,'The finished fascia has outward faces and positive closed volume');
    for(const cap of [s.capA,s.capB])if(cap){joins++;ok(pieces.some(t=>t!==s&&[t.capA,t.capB].some(q=>q===cap&&near(q.outer.x,cap.outer.x)&&near(q.outer.y,cap.outer.y))),'Each fascia miter shares its inner and outer cut with its neighbour');}
    plain.dispose();eased.dispose();
  }
  ok(joins>=4,'Rectangles, concave corners, angles and levels retain actual fascia mitres');
  const selected=catalogueAccessoryLayout({...d,catalogueAccessories:['tt_fascia']},m),covers=accessoryFasciaSlabs(selected.fascia);
  ok(covers.length===selected.fascia.reduce((n,f)=>n+Math.ceil(Math.hypot(f.b.x-f.a.x,f.b.z-f.a.z)/FASCIA_STOCK_IN-1e-9),0)&&covers.some(s=>s.capA||s.capB),'Selected supplier fascia also has real mitres and shows its 12 ft boards, keeping every modeled piece');
  for(const s of covers)for(const cap of [s.capA,s.capB])if(cap)ok(covers.some(t=>t!==s&&(t.capA===cap||t.capB===cap)),'Offset supplier fascia corners meet exactly without a filler');
}
const reflection=reflectionBinding(),photo=new THREE.Texture(),room={x:100,y:70,w:144,h:80,door:true};
for(const evening of [false,true])for(const offset of [[-36,0,.8],[36,0,2.2]] as [number,number,number][]){
  const material=createWindowGlass(evening,photo,{reflection,room,offset});
  const shader={uniforms:{} as Record<string,THREE.IUniform>,vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,undefined as never);
  ok(shader.uniforms.uDeckReflection===reflection.texture&&shader.uniforms.uReflectionMatrix===reflection.matrix&&shader.uniforms.uReflectionReady===reflection.ready,'Every pane follows the live facade reflection without recompiling');
  ok(shader.uniforms.uRoomHalf.value.x===72&&shader.uniforms.uRoomSill.value===0,'Sliding panes share one full-width room and a floor at the threshold');
  ok(shader.uniforms.uEvening.value===(evening?1:0),'Day and night use their proper reflection/interior balance');
  ok(!/\$\{/.test(shader.vertexShader+shader.fragmentShader)&&!shader.fragmentShader.includes('1.-1,'),'Generated GLSL has no template tokens or mixed integer/float subtraction');
  material.dispose();
}
photo.dispose();console.log(`DECK WINDOW AND FINISH OK — real facade reflection bindings, continuous patio interiors, closed mitered fascia, edge bounds and outward normals; ${checks} checks.`);
