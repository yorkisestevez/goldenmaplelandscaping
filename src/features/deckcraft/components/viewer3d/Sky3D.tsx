import {Suspense,useEffect,useMemo,useSyncExternalStore} from 'react';
import {useThree,useLoader} from '@react-three/fiber';
import {Lightformer} from '@react-three/drei';
import {EnvironmentMap,EnvironmentPortal} from './sceneEnvironment';
import {RGBELoader} from 'three-stdlib';
import * as THREE from 'three';
import {SKY_DATA as SKY,skyStrength,skyYaw,visibleSkyStrength,visibleSkyHorizon,type Lighting} from './skyModel';
import dayLighting from './assets/sky/sky-day-ibl.hdr?url';
import eveningLighting from './assets/sky/sky-evening-ibl.hdr?url';
import {SCENE_LOOK} from './sceneLook';
import {SHOWCASE_GOLDEN_FILL,SHOWCASE_SKY_FILL} from './showcaseGrade';
import {SKY_PARS,SKY_RADIANCE,hazeColour,skyUniforms} from './skyShade';
import {SHOWCASE_CLEAR_FOG,SHOWCASE_FOG_DENSITY,getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from '../../showcaseMode';

/**
 * The real sky (Real Life G3): a CC0 HDRI supplies environment fill. An extracted sun, or a neutral key replacing
 * part of a soft HDR's energy, casts shadows. The visible dome samples only the photographed
 * upper sky: nearby roofs and rocks from the captured panorama are not scenery in this design.
 * Lighting/reflections retain the complete original HDRI; the far lawn fades into the clean sky's haze.
 * Until the files arrive the old studio light stands in (StudioLight), so the view never goes blank.
 */
const {sky:LOOK}=SCENE_LOOK;

const DOME_VERTEX=/* glsl */`
varying vec3 vDir;
void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
// The sky's colour comes from skyShade.ts, which the far lawn shares so the two meet at the same colour.
const DOME_FRAGMENT=/* glsl */`${SKY_PARS}${SKY_RADIANCE}
varying vec3 vDir;
void main(){gl_FragColor=vec4(skyRadiance(vDir),1.);}`;

/** The clean photographed sky, following the camera and drawn behind everything. */
function SkyDome({lighting,yaw,strength,horizonBand,rich,warm,skyline,haze,hazeRgb}:{lighting:THREE.Texture;yaw:number;strength:number;horizonBand:boolean;rich:boolean;warm:boolean;skyline:boolean;haze:number;hazeRgb:[number,number,number]}){
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
  // The uniforms are the renderer's shared sky set (skyShade.ts): the far lawn reads them too.
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:skyUniforms(gl),
    vertexShader:DOME_VERTEX,fragmentShader:DOME_FRAGMENT,side:THREE.BackSide,depthWrite:false,fog:false,
  }),[gl]);
  useEffect(()=>()=>material.dispose(),[material]);
  const u=material.uniforms;u.lighting.value=lighting;u.strength.value=strength;u.uHorizonBand.value=horizonBand?1:0;u.uRich.value=rich?1:0;u.uWarm.value=warm?1:0;u.uSkyline.value=skyline?1:0;
  u.uHaze.value=haze;u.uHazeColour.value.set(...hazeRgb);
  // The lawn fades into the sky only while a dome is up (counted, as the evening sky can replace the day's in one commit).
  useEffect(()=>{u.uSkyReady.value+=1;invalidate();return()=>{u.uSkyReady.value=Math.max(0,u.uSkyReady.value-1);};},[u,invalidate]);
  u.turn.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,yaw,0))).transpose();
  return <mesh name="sky-dome" material={material} frustumCulled={false} renderOrder={-1} raycast={()=>null}
    ref={mesh=>{if(mesh)mesh.onBeforeRender=(_r,_s,camera)=>{mesh.position.copy(camera.position);mesh.updateMatrixWorld();};}}>
    <sphereGeometry args={[LOOK.domeRadiusFt,128,64]}/>
  </mesh>;
}

/** The sky's .hdr light probe, loaded exactly as drei's useEnvironment loads an .hdr (three-stdlib RGBELoader,
 * equirectangular, linear). Calling the loader directly keeps drei's EXR and gain-map loaders out of the viewer. */
function useSkyMap(url:string){
  const texture=useLoader(RGBELoader,url);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
  return texture;
}
/** The HDRI's light, its dome and the horizon haze. Suspends while the files load. */
/** One sky: illumination and panorama exposure are independent. The day sky can stand in at dusk while it loads. */
function SkyOf({lighting,strength=visibleSkyStrength(lighting),illumination=skyStrength(lighting).environment}:{lighting:Lighting;strength?:number;illumination?:number}){
  const data=SKY[lighting],yaw=skyYaw(lighting);
  const map=useSkyMap(lighting==='evening'?eveningLighting:dayLighting);
  const scene=useThree(s=>s.scene),gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),flags=useSyncExternalStore(subscribeShowcase,getShowcaseFlags,getShowcaseServerFlags);
  // Trees and haze come with the realistic look too; the grade follows it at the device's own budget.
  const context=flags.context||flags.realistic,graded=(flags.quality||flags.realistic)&&flags.post&&lighting==='day',dayBlue=graded&&flags.hour!=='golden',goldenSky=graded&&flags.hour==='golden';
  const horizon=useMemo(()=>(context?visibleSkyHorizon(map,0):visibleSkyHorizon(map))??data.horizonColor,[map,data,context]);
  // The haze over the horizon (and so the colour the far lawn ends in) comes from the clean sky's horizon row in every look.
  const {horizonHaze:HAZE}=SCENE_LOOK.sky,hazeRgb=useMemo(()=>hazeColour(visibleSkyHorizon(map)??data.horizonColor as [number,number,number],strength),[map,data,strength]);
  const haze=lighting==='evening'?HAZE.evening:goldenSky?HAZE.golden:context?HAZE.realistic:HAZE.editor;
  // The viewer keeps one fog for its life (adding or removing fog recompiles every material); the sky only recolours it.
  useEffect(()=>{gl.domElement.dataset.sky=lighting;if(!scene.fog)return;scene.fog.color.setRGB(horizon[0],horizon[1],horizon[2]).multiplyScalar(strength);if(scene.fog instanceof THREE.FogExp2)scene.fog.density=context?(graded?SHOWCASE_CLEAR_FOG:SHOWCASE_FOG_DENSITY):SCENE_LOOK.sky.fogDensity;invalidate();},[scene,horizon,strength,invalidate,context,graded,gl,lighting]);
  return <>
    <EnvironmentMap map={map} environmentIntensity={graded?illumination*(goldenSky?SHOWCASE_GOLDEN_FILL:SHOWCASE_SKY_FILL):illumination} environmentRotation={new THREE.Euler(0,yaw,0)}/>
    <SkyDome lighting={map} yaw={yaw} strength={strength} horizonBand={context} rich={dayBlue} warm={goldenSky} skyline={(flags.quality||flags.realistic)&&flags.post} haze={haze} hazeRgb={hazeRgb}/>
  </>;
}

/** The HDRI's light, its dome and the horizon haze. Suspends while the day sky loads; the evening's, once asked for,
 * loads behind the day sky dimmed, so switching to Night never drops back to the studio light. */
export default function Sky3D({evening}:{evening:boolean}){
  // The day map is already in (this component suspended until then). Wait briefly so the evening file does not
  // share the first uploads and shader compiles.
  useEffect(()=>{const timer=window.setTimeout(preloadEvening,1500);return()=>window.clearTimeout(timer);},[]);
  return evening?<Suspense fallback={<SkyOf lighting="day" strength={skyStrength('evening').background} illumination={skyStrength('evening').environment}/>}><SkyOf lighting="evening"/></Suspense>:<SkyOf lighting="day"/>;
}
// The day sky loads with the viewer; the evening's follows once the day's is in (preloadEvening), so switching to
// Night (and the proposal's night pictures) rarely waits, without a phone fetching both skies up front.
useLoader.preload(RGBELoader,dayLighting);
let eveningPreloaded=false;
function preloadEvening(){if(eveningPreloaded)return;eveningPreloaded=true;useLoader.preload(RGBELoader,eveningLighting);}

/** The studio light the viewer had before G3: three soft panels and a hemisphere light, while the sky loads or if it can't. */
export function StudioLight({evening}:{evening:boolean}){
  return <>
    <hemisphereLight args={[evening?'#667f9d':'#eaf2ff',evening?'#283022':'#788565',evening?.13:.55]}/>
    <EnvironmentPortal key={evening?'evening':'day'} resolution={128} environmentIntensity={evening?.16:.4}><Lightformer intensity={3} position={[0,12,0]} rotation={[Math.PI/2,0,0]} scale={[20,20,1]}/><Lightformer intensity={2} position={[-15,6,8]} rotation={[0,Math.PI/2,0]} scale={[12,15,1]}/><Lightformer intensity={1} position={[12,5,-8]} rotation={[0,-Math.PI/2,0]} scale={[10,10,1]}/></EnvironmentPortal>
  </>;
}
