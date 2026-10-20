import {useCallback,useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useRenderQuality} from './SceneRenderQuality';
import {SNOW_ON,applySnowCover} from './seasonSnow';
import {useSeason} from './sceneSeason';

/** How many flakes fall around the camera, by render tier. Phones get settled snow only (owner's call, 2026-10-20). */
const FLAKES={high:6000,balanced:3000};
const FALL_BOX={half:70,height:45};

/** Settled snow on everything in winter, and falling snow on computers; mounted only while winter shows, and leaving
 * winter switches the snow off. Materials made after winter starts (an edit, a lazily loaded plant) are picked up on the
 * frame that first draws them. */
export default function SeasonScene(){
 const season=useSeason(),scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate),q=useRenderQuality(),seen=useRef(new WeakSet<THREE.Material>());
 const cover=useCallback(()=>{
  let added=false;
  scene.traverse(o=>{
   const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
   for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(!m||seen.current.has(m))continue;seen.current.add(m);if(applySnowCover(m))added=true;}
  });
  return added;
 },[scene]);
 const winter=season==='winter';
 useEffect(()=>{SNOW_ON.value=winter?1:0;if(winter)cover();invalidate();},[winter,cover,invalidate]);
 useEffect(()=>()=>{SNOW_ON.value=0;invalidate();},[invalidate]);
 // The canvas draws on demand: a new plant or an edit draws a frame, and that frame picks up its materials.
 useFrame(()=>{if(winter&&cover())invalidate();});
 const coarse=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches,falling=winter&&q.tier!=='constrained'&&!coarse;
 // Marked on the canvas for tests and stills: whether this device shows falling snow.
 const canvas=useThree(s=>s.gl.domElement);
 useEffect(()=>{canvas.dataset.snowfall=falling?'on':'off';return()=>{delete canvas.dataset.snowfall;};},[canvas,falling]);
 return falling&&q.tier!=='constrained'?<Snowfall count={FLAKES[q.tier]}/>:null;
}

/** Flakes in a box that travels with the camera: each falls, sways and wraps, so the snow never runs out. */
function Snowfall({count}:{count:number}){
 const geometry=useMemo(()=>{
  const seeds=new Float32Array(count*4);
  for(let i=0;i<count;i++){seeds[i*4]=Math.random();seeds[i*4+1]=Math.random();seeds[i*4+2]=Math.random();seeds[i*4+3]=Math.random();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));g.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,4));
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6);return g;
 },[count]);
 const material=useMemo(()=>new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{uTime:{value:0},uCamera:{value:new THREE.Vector3()},uHalf:{value:FALL_BOX.half},uHeight:{value:FALL_BOX.height},uScale:{value:600}},
  vertexShader:`attribute vec4 seed;uniform float uTime;uniform vec3 uCamera;uniform float uHalf;uniform float uHeight;uniform float uScale;varying float vFade;
void main(){
 float speed=2.2+seed.w*1.6;
 vec3 p=vec3(seed.x*2.0*uHalf,mod(seed.y*uHeight-uTime*speed,uHeight),seed.z*2.0*uHalf);
 p.x+=sin(uTime*.6+seed.w*30.0)*.8;p.z+=cos(uTime*.5+seed.x*30.0)*.8;
 p.xz=uCamera.xz+mod(p.xz-uCamera.xz+uHalf,2.0*uHalf)-uHalf;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uScale*(.05+seed.y*.05)/-mv.z,1.0,9.0);
 vFade=smoothstep(1.0,4.0,-mv.z);
}`,
  fragmentShader:`varying float vFade;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.96,.97,1.0),(1.0-smoothstep(.2,.5,d))*.85*vFade);}`,
 }),[]);
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 const size=useThree(s=>s.size);
 useFrame(({clock,camera,invalidate})=>{
  material.uniforms.uTime.value=clock.elapsedTime;material.uniforms.uCamera.value.copy(camera.position);material.uniforms.uScale.value=size.height*.9;
  invalidate();
 });
 return <points name="season-snowfall" geometry={geometry} material={material} frustumCulled={false} raycast={()=>null} renderOrder={10}/>;
}
