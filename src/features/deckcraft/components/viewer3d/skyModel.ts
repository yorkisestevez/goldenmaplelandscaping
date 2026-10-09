import * as THREE from 'three';
import SKY from './assets/sky/sky.json';
import {SCENE_LOOK} from './sceneLook';

/**
 * The sky's numbers (Real Life G3), apart from its files so the check scripts can read them: which way the HDRI is
 * turned, where its sun is in the world and how bright sky and sun are (sky.json, from scripts/build-deck-sky.ts).
 */
export type Lighting='day'|'evening';
const {sky:LOOK}=SCENE_LOOK;
export const SKY_DATA=SKY;
/** The source panorama was photographed close to roofs/vegetation. Background
 * rays use its clean upper sky, while the original HDRI still lights the yard. */
export const VISIBLE_SKY_MIN_DEG=55;
/** The daylight HDR was normalised after extracting the sun: its actual upper
 * sky averages only 0.09 linear luminance. Give the visible photograph two
 * stops of display exposure without changing illumination or reflections. */
export const VISIBLE_DAY_SKY_EXPOSURE=4;
export function visibleSkyStrength(lighting:Lighting){return skyStrength(lighting).background*(lighting==='day'?VISIBLE_DAY_SKY_EXPOSURE:1);}
export function visibleSkyElevation(elevation:number){const min=VISIBLE_SKY_MIN_DEG*Math.PI/180;return min+Math.min(Math.PI/2,Math.max(0,elevation))*(1-min/(Math.PI/2));}
/** Match the distance haze to the actual displayed sky horizon. RGBE loaders
 * may supply half-float or float data, with either row orientation. */
/** Elevation sampled on the sky dome. Editor and neighbourhood both stay on the
 * clean upper photograph. The panorama's ground ring sits on the equator and
 * reads as a dark seamed band, so horizonBand no longer opens it. */
export function skyDomeSampleElevation(elevation:number,horizonBand:number){
 const min=VISIBLE_SKY_MIN_DEG*Math.PI/180,displayed=Math.max(0,elevation),clean=min+displayed*(1-min/(Math.PI/2));
 return clean+horizonBand*0;
}
export function visibleSkyHorizon(map:THREE.Texture,elevation?:number):[number,number,number]|null {
 const image=map.image as {width?:number;height?:number;data?:ArrayLike<number>}|undefined;
 const w=image?.width,h=image?.height,data=image?.data;if(!w||!h||!data)return null;
 const channels=data.length/(w*h);if(channels!==3&&channels!==4)return null;
 const el=elevation===undefined?visibleSkyElevation(0):elevation,v=el/Math.PI+.5,row=Math.min(h-1,Math.max(0,Math.floor((map.flipY?1-v:v)*h))),sum=[0,0,0];let count=0;
 for(let y=Math.max(0,row-1);y<=Math.min(h-1,row+1);y++)for(let x=0;x<w;x+=4){for(let c=0;c<3;c++){const n=data[(y*w+x)*channels+c];sum[c]+=map.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(n):n;}count++;}
 return count&&sum.every(Number.isFinite)?sum.map(n=>n/count) as [number,number,number]:null;
}

/** Turning the HDRI by yaw about y moves a feature at azimuth a (atan2(z, x)) to a − yaw, as three's
 * environmentRotation does: the day sky is turned so its sun sits at the studio's azimuth. */
export function skyYaw(lighting:Lighting){return (SKY[lighting].sunAzimuthDeg-LOOK.sunAzimuthDeg)*Math.PI/180;}
/** The sun's direction in the world: the day HDRI's own elevation, at the studio's azimuth. */
export function sunDirection(){
  const el=SKY.day.sunElevationDeg*Math.PI/180,az=LOOK.sunAzimuthDeg*Math.PI/180;
  return new THREE.Vector3(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));
}
/** Separate illumination from the visible panorama. For a soft HDR, the key replaces sky energy rather than adding
 * it: a horizontal white card receives the same irradiance before and after the split. Extracted suns stay intact. */
export function skyStrength(lighting:Lighting){
  if(lighting==='evening')return {environment:LOOK.evening,sun:0,background:LOOK.evening};
  if(SKY.day.sunPainted){
    const environment=LOOK.dayFill,up=Math.sin(SKY.day.sunElevationDeg*Math.PI/180);
    // Lift photographed sky fill by moving energy out of the extracted sun. Its RGB colour is max-normalised in
    // the asset, while sunIntensity records luminance, so compensate that colour's luminance at the light.
    const [r,g,b]=SKY.day.sunColor,luminance=.2126*r+.7152*g+.0722*b;
    return {environment,sun:Math.max(0,SKY.day.sunIntensity-SKY.day.skyIrradiance*(environment-1)/up)/luminance,background:1};
  }
  const environment=LOOK.dayEnvironment,up=Math.sin(SKY.day.sunElevationDeg*Math.PI/180);
  return {environment,sun:SKY.day.skyIrradiance*(1-environment)/Math.max(up,.01),background:1};
}
