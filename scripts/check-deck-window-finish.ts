import assert from 'node:assert/strict';
// Measured/sloped-ground foundations are a lazy runtime in the app (ensureDesignExtensions); register it before calculating.
import '../src/features/deckcraft/foundationDatumsRuntime';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {fasciaSlabs,accessoryFasciaSlabs} from '../src/features/deckcraft/components/viewer3d/fasciaSlabs';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {slabGeometry} from '../src/features/deckcraft/components/viewer3d/slabGeometry';
import {reflectionBinding} from '../src/features/deckcraft/components/viewer3d/windowReflections';
import {createWindowGlass} from '../src/features/deckcraft/components/viewer3d/windowGlass';
import type {DeckData} from '../src/features/deckcraft/types';
let checks=0;const ok=(v:unknown,s:string)=>{assert(v,s);checks++;};
const near=(a:number,b:number)=>Math.abs(a-b)<1e-4;
for(const patch of [{},{shape:'L-Shape'},{cornerChamfers:{frontLeftFt:2,frontRightFt:3}},{levels:2,width2:10,length2:8,height2:12},{terrainConfig:{widthFt:80,depthFt:80,elevationIn:0,slopePct:3}}]){
  const d={...structuredClone(DEFAULT_DECK),width:22,length:16,height:36,...patch} as DeckData,m=buildDeckTakeoff(d),pieces=fasciaSlabs(m);
  ok(pieces.length===m.levels.reduce((n,l)=>n+(l.rim?.length??0),0),'One installed fascia per authoritative rim piece');
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
  ok(covers.length===selected.fascia.length&&covers.some(s=>s.capA||s.capB),'Selected supplier fascia also has real mitres, keeping every modeled piece');
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
