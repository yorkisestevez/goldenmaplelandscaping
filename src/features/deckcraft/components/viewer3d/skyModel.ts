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

/** Turning the HDRI by yaw about y moves a feature at azimuth a (atan2(z, x)) to a − yaw, as three's
 * environmentRotation does: the day sky is turned so its sun sits at the studio's azimuth. */
export function skyYaw(lighting:Lighting){return (SKY[lighting].sunAzimuthDeg-LOOK.sunAzimuthDeg)*Math.PI/180;}
/** The sun's direction in the world: the day HDRI's own elevation, at the studio's azimuth. */
export function sunDirection(){
  const el=SKY.day.sunElevationDeg*Math.PI/180,az=LOOK.sunAzimuthDeg*Math.PI/180;
  return new THREE.Vector3(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));
}
/** How bright the sky and the sun are: the evening sky is dimmed, and the evening has no sun. */
export function skyStrength(lighting:Lighting){return {environment:lighting==='evening'?LOOK.evening:1,sun:lighting==='evening'?0:SKY.day.sunIntensity};}
