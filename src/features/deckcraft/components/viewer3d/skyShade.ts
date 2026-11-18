import * as THREE from 'three';
import {VISIBLE_SKY_MIN_DEG} from './skyModel';
import {SCENE_LOOK} from './sceneLook';
import {DAY_SKY_BLEND,DAY_SKY_GAIN,DAY_SKY_GREEN,DAY_SKY_RED,GOLDEN_SKY_BLEND,GOLDEN_SKY_BLUE,GOLDEN_SKY_GAIN,GOLDEN_SKY_GREEN,GOLDEN_SKY_RED} from './showcaseGrade';

/**
 * The sky's colour in any direction, shared by the dome (Sky3D.tsx) and the far lawn (lawnSurface.ts). The lawn fades
 * into exactly the colour the dome paints on its own azimuth, so the ground's edge and the sky meet without a line.
 * Plain module (no React), so the check scripts can read and run it.
 */
const {aerial:AERIAL,horizonHaze:HAZE}=SCENE_LOOK.sky;

/** Uniforms and PI for skyRadiance. Three's common chunk already defines PI for the lawn; the dome's ShaderMaterial has none. */
export const SKY_PARS=/* glsl */`
#ifndef PI
#define PI 3.141592653589793
#endif
uniform sampler2D lighting;uniform mat3 turn;uniform float minimumElevation,strength,uHorizonBand,uRich,uWarm,uSkyline,warmth,uHaze,uSkyReady,uAerialNear,uAerialFar;uniform vec3 uHazeColour;`;

/** The dome's colour for direction dir (before turning). Below the horizon it repeats the horizon's colour. */
export const SKY_RADIANCE=/* glsl */`
vec3 skyRadiance(vec3 dir){
  vec3 d=normalize(turn*dir);
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
  // Air between here and the horizon: a pale haze over the lowest few degrees, the colour the far lawn fades into.
  exposed=mix(exposed,uHazeColour*mix(1.0,${DAY_SKY_GAIN},uRich)*mix(1.0,${GOLDEN_SKY_GAIN},uWarm),(1.-smoothstep(0.0,${HAZE.topRad},el))*uHaze);
  // warmth 0 leaves the sky as graded. A fly-through raises it only while grading golden hour.
  exposed=mix(exposed,exposed*vec3(1.22,.78,.42),clamp(warmth,0.,1.));
  return max(exposed,vec3(0.0));
}`;

const shared=new WeakMap<object,Record<string,THREE.IUniform>>();
/** One set of sky uniforms per renderer: the dome writes them, and the lawn reads the same objects. */
export function skyUniforms(renderer:object){
  let u=shared.get(renderer);
  if(!u){
    u={lighting:{value:null},turn:{value:new THREE.Matrix3()},minimumElevation:{value:VISIBLE_SKY_MIN_DEG*Math.PI/180},strength:{value:1},
      uHorizonBand:{value:0},uRich:{value:0},uWarm:{value:0},uSkyline:{value:0},warmth:{value:0},uHaze:{value:0},uHazeColour:{value:new THREE.Vector3()},
      uSkyReady:{value:0},uAerialNear:{value:AERIAL.nearFt},uAerialFar:{value:AERIAL.farFt}};
    shared.set(renderer,u);
  }
  return u;
}

/** The horizon haze's colour (linear) from the clean sky's horizon row: partly desaturated and lifted, as air is. */
export function hazeColour(horizon:readonly [number,number,number],strength:number):[number,number,number]{
  const l=.2126*horizon[0]+.7152*horizon[1]+.0722*horizon[2];
  return horizon.map(c=>(l+(c-l)*HAZE.desaturate)*HAZE.lift*strength) as [number,number,number];
}

/** How far the lawn has faded into the sky (0 to 1), as the lawn shader works it out: by the horizontal distance from
 * the camera (feet), held back over the yard (distances from the far ring's centre, inches) and complete at the rim. */
export function lawnAerial(cameraFt:number,fromCentreIn:number,yardIn:number,ringIn:number){
  const d=Math.max(cameraFt,1),q0=Math.min(1,Math.max(0,(1/AERIAL.nearFt-1/d)/(1/AERIAL.nearFt-1/AERIAL.farFt)));
  const step=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  const q=q0*q0*(3-2*q0)*step(yardIn,yardIn+AERIAL.yardRampFt*12,fromCentreIn);
  return Math.max(q,step(AERIAL.rimFrom*ringIn,AERIAL.rimTo*ringIn,fromCentreIn));
}
