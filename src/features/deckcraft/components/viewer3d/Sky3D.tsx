import {Suspense,useEffect,useMemo} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import {Environment,Lightformer,useEnvironment} from '@react-three/drei';
import * as THREE from 'three';
import {SKY_DATA as SKY,skyStrength,skyYaw,type Lighting} from './skyModel';
import dayLighting from './assets/sky/sky-day-ibl.hdr?url';
import eveningLighting from './assets/sky/sky-evening-ibl.hdr?url';
import dayBand from './assets/sky/sky-day-band.webp';
import eveningBand from './assets/sky/sky-evening-band.webp';
import {SCENE_LOOK} from './sceneLook';

/**
 * The real sky (Real Life G3): a CC0 HDRI lights the scene with its sun painted out (scripts/build-deck-sky.ts), the
 * scene's sun takes the HDRI's place in it and casts the shadows, and a dome that follows the camera shows the photo's
 * own horizon, blended into the lighting HDRI above it. The ground's far edge fades into the horizon's haze.
 * Until the files arrive the old studio light stands in (StudioLight), so the view never goes blank.
 */
const {sky:LOOK}=SCENE_LOOK;

const DOME_VERTEX=/* glsl */`
varying vec3 vDir;
void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const DOME_FRAGMENT=/* glsl */`
uniform sampler2D band;uniform sampler2D lighting;uniform mat3 turn;uniform float bandScale,bandTop,bandBottom,strength;
varying vec3 vDir;
const float PI=3.141592653589793;
void main(){
  vec3 d=normalize(turn*vDir);
  float el=asin(clamp(d.y,-1.,1.)),u=atan(d.z,d.x)/(2.*PI)+.5,seam=fract(u+.5);
  // Gradients from whichever u doesn't jump where the panorama wraps, so the wrap never picks a blurry mip.
  float dux=abs(dFdx(u))<abs(dFdx(seam))?dFdx(u):dFdx(seam),duy=abs(dFdy(u))<abs(dFdy(seam))?dFdy(u):dFdy(seam);
  float vb=clamp((el-bandBottom)/(bandTop-bandBottom),0.,1.),vl=el/PI+.5;
  vec3 horizon=textureGrad(band,vec2(u,vb),vec2(dux,dFdx(vb)),vec2(duy,dFdy(vb))).rgb*bandScale;
  vec3 above=textureGrad(lighting,vec2(u,vl),vec2(dux,dFdx(vl)),vec2(duy,dFdy(vl))).rgb;
  gl_FragColor=vec4(mix(horizon,above,smoothstep(bandTop-.05,bandTop,el))*strength,1.);
}`;

/** The sky dome: the photo's horizon band, then the lighting HDRI above it, drawn behind everything, following the camera. */
function SkyDome({band,lighting,data,yaw,strength}:{band:THREE.Texture;lighting:THREE.Texture;data:typeof SKY.day;yaw:number;strength:number}){
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{band:{value:null},lighting:{value:null},turn:{value:new THREE.Matrix3()},bandScale:{value:1},bandTop:{value:0},bandBottom:{value:0},strength:{value:1}},
    vertexShader:DOME_VERTEX,fragmentShader:DOME_FRAGMENT,side:THREE.BackSide,depthWrite:false,fog:false,
  }),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const u=material.uniforms;
  u.band.value=band;u.lighting.value=lighting;u.bandScale.value=data.bandScale;u.strength.value=strength;
  u.bandTop.value=data.bandTopDeg*Math.PI/180;u.bandBottom.value=data.bandBottomDeg*Math.PI/180;
  // The same turn three gives the lighting (the transpose of the rotation), so dome and reflections agree.
  u.turn.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,yaw,0))).transpose();
  // It follows the camera, so the horizon never comes closer.
  return <mesh name="sky-dome" material={material} frustumCulled={false} renderOrder={-1} raycast={()=>null}
    ref={mesh=>{if(mesh)mesh.onBeforeRender=(_r,_s,camera)=>{mesh.position.copy(camera.position);mesh.updateMatrixWorld();};}}>
    <sphereGeometry args={[LOOK.domeRadiusFt,64,32]}/>
  </mesh>;
}

/** The HDRI's light, its dome and the horizon haze. Suspends while the files load. */
/** One sky: its light, its dome and the haze's colour. strength overrides the sky's own (the day sky dimmed, standing in
 * for the evening while that loads). */
function SkyOf({lighting,strength=skyStrength(lighting).environment}:{lighting:Lighting;strength?:number}){
  const data=SKY[lighting],yaw=skyYaw(lighting);
  const map=useEnvironment({files:lighting==='evening'?eveningLighting:dayLighting});
  const band=useLoader(THREE.TextureLoader,lighting==='evening'?eveningBand:dayBand),gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate);
  useMemo(()=>{band.colorSpace=THREE.SRGBColorSpace;band.wrapS=THREE.RepeatWrapping;band.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());band.needsUpdate=true;},[band,gl]);
  // The viewer keeps one fog for its life (adding or removing fog recompiles every material); the sky only recolours it.
  useEffect(()=>{if(scene.fog){scene.fog.color.setRGB(data.horizonColor[0],data.horizonColor[1],data.horizonColor[2]).multiplyScalar(strength);invalidate();}},[scene,data,strength,invalidate]);
  return <>
    <Environment map={map} environmentIntensity={strength} environmentRotation={new THREE.Euler(0,yaw,0)}/>
    <SkyDome band={band} lighting={map} data={data} yaw={yaw} strength={strength}/>
  </>;
}

/** The HDRI's light, its dome and the horizon haze. Suspends while the day sky loads; the evening's, once asked for,
 * loads behind the day sky dimmed, so switching to Night never drops back to the studio light. */
export default function Sky3D({evening}:{evening:boolean}){
  useEffect(()=>{preloadEvening();},[]);
  return evening?<Suspense fallback={<SkyOf lighting="day" strength={skyStrength('evening').environment}/>}><SkyOf lighting="evening"/></Suspense>:<SkyOf lighting="day"/>;
}
// The day sky loads with the viewer; the evening's follows once the day's is in (preloadEvening), so switching to
// Night (and the proposal's night pictures) rarely waits, without a phone fetching both skies up front.
useEnvironment.preload({files:dayLighting});useLoader.preload(THREE.TextureLoader,dayBand);
let eveningPreloaded=false;
function preloadEvening(){if(eveningPreloaded)return;eveningPreloaded=true;useEnvironment.preload({files:eveningLighting});useLoader.preload(THREE.TextureLoader,eveningBand);}

/** The studio light the viewer had before G3: three soft panels and a hemisphere light, while the sky loads or if it can't. */
export function StudioLight({evening}:{evening:boolean}){
  return <>
    <hemisphereLight args={[evening?'#667f9d':'#eaf2ff',evening?'#283022':'#788565',evening?.13:.55]}/>
    <Environment key={evening?'evening':'day'} resolution={128} frames={1} environmentIntensity={evening?.16:.4}><Lightformer intensity={3} position={[0,12,0]} rotation={[Math.PI/2,0,0]} scale={[20,20,1]}/><Lightformer intensity={2} position={[-15,6,8]} rotation={[0,Math.PI/2,0]} scale={[12,15,1]}/><Lightformer intensity={1} position={[12,5,-8]} rotation={[0,-Math.PI/2,0]} scale={[10,10,1]}/></Environment>
  </>;
}
