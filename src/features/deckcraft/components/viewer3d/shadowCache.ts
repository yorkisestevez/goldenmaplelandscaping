import * as THREE from 'three';
import {SCENE_LOOK} from './sceneLook';

/**
 * Shadow maps drawn only when they would change (renderPipeline.tsx turns three's per-frame redraw off), and the sun's
 * shadow fitted to what casts. Plain three.js with no React, so check-deck-realism can test it on a scene of its own.
 */

/** A cheap fingerprint of everything that decides the shadow maps: each caster's shape, place and material, and each
 * shadow-casting light's place and aim. Colours, the camera and hover outlines don't count. */
export function shadowKey(scene:THREE.Scene){
  let h=2166136261;const mix=(v:number)=>{h=Math.imul(h^(Math.round(v*1024)|0),16777619);};
  scene.traverseVisible(o=>{
    const light=o as THREE.Light;if(!o.castShadow||!((o as THREE.Mesh).isMesh||light.isLight))return;
    mix(o.id);const e=o.matrixWorld.elements;for(const i of [0,1,2,5,8,10,12,13,14])mix(e[i]);
    if(light.isLight){mix(light.intensity>0?1:0);const target=(light as THREE.SpotLight).target;if(target){target.updateMatrixWorld();const t=target.matrixWorld.elements;mix(t[12]);mix(t[13]);mix(t[14]);}return;}
    const m=o as THREE.InstancedMesh;mix(m.geometry.id);mix((m.geometry.attributes.position as THREE.BufferAttribute|undefined)?.version??0);
    if(m.isInstancedMesh){mix(m.count);mix(m.instanceMatrix.version);}
    for(const mat of Array.isArray(m.material)?m.material:[m.material])mix(mat.version);
  });
  return h;
}

const _sphere=new THREE.Sphere(),_v=new THREE.Vector3();
/** Fits the sun's shadow to what casts (Environment3D names it "sun"): the shadow map's texels go to the deck and
 * house instead of empty lawn, with a margin of m feet. The far plane runs well past the last caster, since shadows
 * land beyond it. */
export function fitSun(scene:THREE.Scene,m=SCENE_LOOK.sunShadow.marginFt){
  const sun=scene.getObjectByName('sun') as THREE.DirectionalLight|undefined;
  if(!sun?.isDirectionalLight||!sun.castShadow)return;
  const cam=sun.shadow.camera;sun.shadow.updateMatrices(sun);
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  scene.traverseVisible(o=>{
    const m=o as THREE.InstancedMesh;if(!m.isMesh||!o.castShadow)return;
    if(m.isInstancedMesh){if(!m.count)return;if(!m.boundingSphere)m.computeBoundingSphere();_sphere.copy(m.boundingSphere!);}
    else{if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();_sphere.copy(m.geometry.boundingSphere!);}
    if(!(_sphere.radius>=0))return;
    _sphere.applyMatrix4(o.matrixWorld);_v.copy(_sphere.center).applyMatrix4(cam.matrixWorldInverse);const r=_sphere.radius;
    x0=Math.min(x0,_v.x-r);y0=Math.min(y0,_v.y-r);z0=Math.min(z0,_v.z-r);x1=Math.max(x1,_v.x+r);y1=Math.max(y1,_v.y+r);z1=Math.max(z1,_v.z+r);
  });
  if(!Number.isFinite(x0))return;
  cam.left=x0-m;cam.right=x1+m;cam.bottom=y0-m;cam.top=y1+m;cam.near=-z1-m;cam.far=-z0+m+Math.max(x1-x0,y1-y0);
  cam.updateProjectionMatrix();
}
