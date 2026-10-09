import {Suspense,useEffect,useMemo,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import {Environment,Lightformer,useEnvironment} from '@react-three/drei';
import * as THREE from 'three';
import {SKY_DATA as SKY,skyStrength,skyYaw,VISIBLE_SKY_MIN_DEG,visibleSkyStrength,visibleSkyHorizon,type Lighting} from './skyModel';
import dayLighting from './assets/sky/sky-day-ibl.hdr?url';
import eveningLighting from './assets/sky/sky-evening-ibl.hdr?url';
import {SCENE_LOOK} from './sceneLook';
import {DAY_SKY_BLEND,DAY_SKY_GAIN,DAY_SKY_GREEN,DAY_SKY_RED,GOLDEN_SKY_BLEND,GOLDEN_SKY_BLUE,GOLDEN_SKY_GAIN,GOLDEN_SKY_GREEN,GOLDEN_SKY_RED,SHOWCASE_GOLDEN_FILL,SHOWCASE_SKY_FILL} from './showcaseGrade';
import {SHOWCASE_CLEAR_FOG,SHOWCASE_FOG_DENSITY,getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from './showcaseMode';

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
const DOME_FRAGMENT=/* glsl */`
uniform sampler2D lighting;uniform mat3 turn;uniform float minimumElevation,strength,uHorizonBand,uRich,uWarm,uSkyline;
varying vec3 vDir;
const float PI=3.141592653589793;
void main(){
  vec3 d=normalize(turn*vDir);
  float el=asin(clamp(d.y,-1.,1.)),u=atan(d.z,d.x)/(2.*PI)+.5,seam=fract(u+.5);
  // The original photo's upper sky becomes the visible hemisphere. The HDRI
  // that illuminates and reflects from the design is unchanged. Neighbourhood
  // mode keeps that same clean sample: the photo's ground ring is a dark flat
  // band with vertical seams, and a corner camera would otherwise show it.
  float displayed=max(0.,el),cleanEl=minimumElevation+displayed*(1.-minimumElevation/(PI*.5));
  float sampleEl=cleanEl+uHorizonBand*0.,v=sampleEl/PI+.5;
  float dux=abs(dFdx(u))<abs(dFdx(seam))?dFdx(u):dFdx(seam),duy=abs(dFdy(u))<abs(dFdy(seam))?dFdy(u):dFdy(seam);
  vec3 sky=textureGrad(lighting,vec2(u,v),vec2(dux,dFdx(v)),vec2(duy,dFdy(v))).rgb;
  // Correct after exposure. A lift applied to the dim photograph sits under the neutral toe and prints as cyan.
  vec3 exposed=max(sky,vec3(0.0))*strength*mix(1.0,${DAY_SKY_GAIN},uRich)*mix(1.0,${GOLDEN_SKY_GAIN},uWarm);
  float luma=dot(exposed,vec3(0.2126,0.7152,0.0722));
  float lead=max(exposed.b,luma);
  vec3 natural=vec3(lead*${DAY_SKY_RED},lead*${DAY_SKY_GREEN},lead);
  float naturalL=max(dot(natural,vec3(0.2126,0.7152,0.0722)),0.0001);
  float skyish=smoothstep(0.0,0.06,exposed.b-exposed.g)*uRich;
  exposed=mix(exposed,natural*(luma/naturalL),${DAY_SKY_BLEND}*skyish);
  vec3 warmTone=vec3(luma*${GOLDEN_SKY_RED},luma*${GOLDEN_SKY_GREEN},luma*${GOLDEN_SKY_BLUE});
  float warmL=max(dot(warmTone,vec3(0.2126,0.7152,0.0722)),0.0001);
  exposed=mix(exposed,warmTone*(luma/warmL),${GOLDEN_SKY_BLEND}*uWarm);
  // The clean upper sky is stretched onto the horizon, so a bright patch in that
  // sample would sit as a smeared strip. Showcase fades the lowest sky into a
  // fixed tree-line haze. The colour does not follow the sample's luminance.
  float skyline=smoothstep(0.22,0.0,el)*uSkyline;
  vec3 treeline=vec3(0.04,0.045,0.035)*strength;
  // Warm glow just above the tree line at golden hour. The bottom stays the
  // dark silhouette, and the colour is fixed so a bright sample cannot punch through.
  float glow=smoothstep(0.20,0.07,el)*smoothstep(0.0,0.045,el)*uWarm*uSkyline;
  exposed=mix(exposed,vec3(0.11,0.052,0.02)*strength,glow*0.62);
  exposed=mix(exposed,treeline,skyline*mix(0.85,0.62,uWarm));
  gl_FragColor=vec4(max(exposed,vec3(0.0)),1.);
}`;

/** The clean photographed sky, following the camera and drawn behind everything. */
function SkyDome({lighting,yaw,strength,horizonBand,rich,warm,skyline}:{lighting:THREE.Texture;yaw:number;strength:number;horizonBand:boolean;rich:boolean;warm:boolean;skyline:boolean}){
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{lighting:{value:null},turn:{value:new THREE.Matrix3()},minimumElevation:{value:VISIBLE_SKY_MIN_DEG*Math.PI/180},strength:{value:1},uHorizonBand:{value:0},uRich:{value:0},uWarm:{value:0},uSkyline:{value:0}},
    vertexShader:DOME_VERTEX,fragmentShader:DOME_FRAGMENT,side:THREE.BackSide,depthWrite:false,fog:false,
  }),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const u=material.uniforms;u.lighting.value=lighting;u.strength.value=strength;u.uHorizonBand.value=horizonBand?1:0;u.uRich.value=rich?1:0;u.uWarm.value=warm?1:0;u.uSkyline.value=skyline?1:0;
  u.turn.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,yaw,0))).transpose();
  return <mesh name="sky-dome" material={material} frustumCulled={false} renderOrder={-1} raycast={()=>null}
    ref={mesh=>{if(mesh)mesh.onBeforeRender=(_r,_s,camera)=>{mesh.position.copy(camera.position);mesh.updateMatrixWorld();};}}>
    <sphereGeometry args={[LOOK.domeRadiusFt,128,64]}/>
  </mesh>;
}

/** The HDRI's light, its dome and the horizon haze. Suspends while the files load. */
/** One sky: illumination and panorama exposure are independent. The day sky can stand in at dusk while it loads. */
function SkyOf({lighting,strength=visibleSkyStrength(lighting),illumination=skyStrength(lighting).environment}:{lighting:Lighting;strength?:number;illumination?:number}){
  const data=SKY[lighting],yaw=skyYaw(lighting);
  const map=useEnvironment({files:lighting==='evening'?eveningLighting:dayLighting});
  const scene=useThree(s=>s.scene),invalidate=useThree(s=>s.invalidate),flags=useSyncExternalStore(subscribeShowcase,getShowcaseFlags,getShowcaseServerFlags);
  const context=flags.context,graded=flags.quality&&flags.post&&lighting==='day',dayBlue=graded&&flags.hour!=='golden',goldenSky=graded&&flags.hour==='golden';
  const horizon=useMemo(()=>(context?visibleSkyHorizon(map,0):visibleSkyHorizon(map))??data.horizonColor,[map,data,context]);
  // The viewer keeps one fog for its life (adding or removing fog recompiles every material); the sky only recolours it.
  useEffect(()=>{if(!scene.fog)return;scene.fog.color.setRGB(horizon[0],horizon[1],horizon[2]).multiplyScalar(strength);if(scene.fog instanceof THREE.FogExp2)scene.fog.density=context?(graded?SHOWCASE_CLEAR_FOG:SHOWCASE_FOG_DENSITY):SCENE_LOOK.sky.fogDensity;invalidate();},[scene,horizon,strength,invalidate,context,graded]);
  return <>
    <Environment map={map} environmentIntensity={graded?illumination*(goldenSky?SHOWCASE_GOLDEN_FILL:SHOWCASE_SKY_FILL):illumination} environmentRotation={new THREE.Euler(0,yaw,0)}/>
    <SkyDome lighting={map} yaw={yaw} strength={strength} horizonBand={context} rich={dayBlue} warm={goldenSky} skyline={flags.quality&&flags.post}/>
  </>;
}

/** The HDRI's light, its dome and the horizon haze. Suspends while the day sky loads; the evening's, once asked for,
 * loads behind the day sky dimmed, so switching to Night never drops back to the studio light. */
export default function Sky3D({evening}:{evening:boolean}){
  useEffect(()=>{preloadEvening();},[]);
  return evening?<Suspense fallback={<SkyOf lighting="day" strength={skyStrength('evening').background} illumination={skyStrength('evening').environment}/>}><SkyOf lighting="evening"/></Suspense>:<SkyOf lighting="day"/>;
}
// The day sky loads with the viewer; the evening's follows once the day's is in (preloadEvening), so switching to
// Night (and the proposal's night pictures) rarely waits, without a phone fetching both skies up front.
useEnvironment.preload({files:dayLighting});
let eveningPreloaded=false;
function preloadEvening(){if(eveningPreloaded)return;eveningPreloaded=true;useEnvironment.preload({files:eveningLighting});}

/** The studio light the viewer had before G3: three soft panels and a hemisphere light, while the sky loads or if it can't. */
export function StudioLight({evening}:{evening:boolean}){
  return <>
    <hemisphereLight args={[evening?'#667f9d':'#eaf2ff',evening?'#283022':'#788565',evening?.13:.55]}/>
    <Environment key={evening?'evening':'day'} resolution={128} frames={1} environmentIntensity={evening?.16:.4}><Lightformer intensity={3} position={[0,12,0]} rotation={[Math.PI/2,0,0]} scale={[20,20,1]}/><Lightformer intensity={2} position={[-15,6,8]} rotation={[0,Math.PI/2,0]} scale={[12,15,1]}/><Lightformer intensity={1} position={[12,5,-8]} rotation={[0,-Math.PI/2,0]} scale={[10,10,1]}/></Environment>
  </>;
}
