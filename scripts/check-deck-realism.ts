import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SCENE_LOOK} from '../src/features/deckcraft/components/viewer3d/sceneLook';
import {fitSun,shadowKey} from '../src/features/deckcraft/components/viewer3d/shadowCache';

/**
 * DeckCraft's photographic look (the "Real Life" track, plan phases G1–G8). G1 is the render pipeline: ambient
 * occlusion from the scene's own depth, evening-only bloom, tone mapping after the effects, shadow maps redrawn only
 * when something that casts changes, the sun's shadow fitted to what casts, and the proposal pictures drawn through
 * the same pipeline. Later phases add their own sections here.
 */
let checks=0;
const ok=(condition:unknown,message:string)=>{assert(condition,message);checks++;};
const read=(path:string)=>readFileSync(path,'utf8');
const VIEWER='src/features/deckcraft/components/viewer3d/';

// The look is plain data, shared with the photo engine.
ok(!/from ['"](three|@react-three)/.test(read(`${VIEWER}sceneLook.ts`)),'sceneLook.ts stays free of three.js');
ok(SCENE_LOOK.toneMapping==='Neutral'&&SCENE_LOOK.exposure===1,'Tone mapping stays Khronos PBR Neutral at exposure 1, so product colours stay faithful');
ok(SCENE_LOOK.bloom.threshold>1,'Only HDR light sources glow: the bloom threshold is above white');
ok(SCENE_LOOK.ao.intensity.day<=1&&SCENE_LOOK.ao.intensity.evening<SCENE_LOOK.ao.intensity.day,'Ambient occlusion is lighter in the evening, when fixtures carry the light');
ok(SCENE_LOOK.powderCoat.metalness===0&&SCENE_LOOK.powderCoat.clearcoat>0,'Powder coat is paint with a clear coat, not metal');

// Wiring.
const pipeline=read(`${VIEWER}renderPipeline.tsx`),viewer=read(`${VIEWER}Deck3DViewer.tsx`),environment=read(`${VIEWER}Environment3D.tsx`);
ok(pipeline.includes('this.gtao.setGBuffer(this.beauty.depthTexture!)'),'Ambient occlusion reads the scene’s own depth, so the scene is drawn once per frame');
ok(/if\(evening\)\{[\s\S]{0,80}UnrealBloomPass/.test(pipeline),'Bloom runs in the evening only');
ok(pipeline.includes('gl.shadowMap.autoUpdate=false')&&/if\(key!==state\.key\)\{[^}]*gl\.shadowMap\.needsUpdate=true;\}/.test(pipeline),'Shadow maps are drawn only when the shadow key changes');
ok(/catch\(error\)\{fail\(error\);\}\s*gl\.render\(scene,camera\);/.test(pipeline),'Any failure falls back to the plain renderer');
ok(viewer.includes('<RenderPipeline evening={evening}/>')&&viewer.includes('const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(scale);else gl.render(scene,camera);'),'The live view and the proposal pictures both draw through the pipeline');
ok(viewer.includes('shadows="percentage"')&&viewer.includes('antialias:false'),'Multisampling lives in the pipeline’s own target, and shadows use PCF (r185 retires PCFSoft)');
ok(environment.includes('<directionalLight name="sun" castShadow'),'The sun is named, so its shadow can be fitted');

// The shadow key: it changes when a shadow would, and not when only the camera or a colour does.
function sceneWithSun(){
  const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();
  const deck=new THREE.Mesh(new THREE.BoxGeometry(16,1,12),material);deck.position.set(0,3,6);deck.castShadow=true;
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.3,3,.3),material,3);posts.castShadow=true;
  [[-7,1.5,1],[7,1.5,1],[0,1.5,11]].forEach(([x,y,z],i)=>posts.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,y,z)));posts.computeBoundingSphere();
  // A thin 20 ft pole (a pergola column): its shadow's tip lands far past anything a bounding sphere covers.
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,20),material);pole.position.set(-10,10,-2);pole.castShadow=true;
  const lawn=new THREE.Mesh(new THREE.PlaneGeometry(400,400),material);lawn.receiveShadow=true;
  const sun=new THREE.DirectionalLight('#fff',2);sun.name='sun';sun.castShadow=true;sun.position.set(21.6,38.4,31.2);
  Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:192});
  scene.add(deck,posts,pole,lawn,sun);scene.updateMatrixWorld();
  return {scene,deck,posts,pole,sun,material};
}
{
  const {scene,deck,posts,sun,material}=sceneWithSun(),key=()=>{scene.updateMatrixWorld();return shadowKey(scene);},start=key();
  ok(key()===start,'The same scene gives the same key');
  material.color.set('#123456');new THREE.PerspectiveCamera().position.set(9,9,9);
  ok(key()===start,'A colour change or a camera move leaves the shadow maps alone');
  deck.position.x+=.5;const moved=key();ok(moved!==start,'Moving a caster redraws the shadow maps');
  posts.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-6,1.5,1));posts.instanceMatrix.needsUpdate=true;const shifted=key();ok(shifted!==moved,'Moving one instance redraws them');
  posts.count=2;const fewer=key();ok(fewer!==shifted,'Fewer instances redraw them');
  deck.visible=false;const hidden=key();ok(hidden!==fewer,'Hiding a caster redraws them');
  deck.visible=true;material.alphaTest=.5;material.needsUpdate=true;const cut=key();ok(cut!==hidden,'A material change that can cut a shadow redraws them');
  sun.target.position.set(0,0,-4);ok(key()!==cut,'Re-aiming a shadow-casting light redraws them');
}

// The sun's shadow: fitted tightly round everything that casts, with room beyond for the ground it lands on.
{
  const {scene,deck,posts,pole,sun}=sceneWithSun();fitSun(scene);
  const cam=sun.shadow.camera,area=(cam.right-cam.left)*(cam.top-cam.bottom);
  ok(area<96*96/4,`The fitted shadow covers a quarter or less of the old fixed square (${area.toFixed(0)} of ${96*96} sq ft), so its texels are four times as fine`);
  const inside=(p:THREE.Vector3)=>{const v=p.clone().applyMatrix4(cam.matrixWorldInverse);return v.x>=cam.left&&v.x<=cam.right&&v.y>=cam.bottom&&v.y<=cam.top&&-v.z>=cam.near&&-v.z<=cam.far;};
  const corners=new THREE.Box3().setFromObject(deck).getSize(new THREE.Vector3());
  ok([-1,1].every(sx=>[-1,1].every(sz=>inside(new THREE.Vector3(deck.position.x+sx*corners.x/2,deck.position.y,deck.position.z+sz*corners.z/2)))),'Every corner of the deck is inside the sun’s shadow');
  ok([0,1,2].every(i=>{const m=new THREE.Matrix4();posts.getMatrixAt(i,m);return inside(new THREE.Vector3().setFromMatrixPosition(m));}),'Every post is inside it');
  // Where the deck's shadow falls on the lawn: along the sunlight from each corner down to the ground.
  const toSun=sun.position.clone().normalize();
  ok([-1,1].every(sx=>[-1,1].every(sz=>{const c=new THREE.Vector3(deck.position.x+sx*8,deck.position.y,deck.position.z+sz*6);return inside(c.clone().addScaledVector(toSun,-c.y/toSun.y));})),'The ground the deck’s shadow lands on is inside it too');
  const tip=new THREE.Vector3(pole.position.x,20,pole.position.z);
  ok(inside(tip.clone().addScaledVector(toSun,-tip.y/toSun.y)),'So is the tip of a tall post’s shadow, well past the post itself');
  const empty=new THREE.Scene(),lonely=new THREE.DirectionalLight();lonely.name='sun';lonely.castShadow=true;empty.add(lonely);empty.updateMatrixWorld();
  const before={...lonely.shadow.camera};fitSun(empty);
  ok(lonely.shadow.camera.left===before.left&&lonely.shadow.camera.far===before.far,'With nothing casting, the sun’s shadow is left as it was');
}

console.log(`DECK REALISM OK — look, pipeline wiring, shadow key and sun fit; ${checks} checks.`);
