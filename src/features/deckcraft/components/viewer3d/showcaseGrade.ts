import {SCENE_LOOK} from './sceneLook';
import type {ShowcaseHour} from './showcaseMode';

/**
 * Filmic grade for showcase stills and video, applied in linear HDR before Khronos Neutral.
 * Day stays close to the swatch. Golden hour warms the highlights. Night cools the shadows
 * and lets practical lights stay warm. Plain data: no three.js.
 */
export interface ShowcaseGrade{
  slope:[number,number,number];offset:[number,number,number];power:[number,number,number];
  contrast:number;pivot:number;shadow:[number,number,number];highlight:[number,number,number];split:number;vignette:number;
}
export const SHOWCASE_GRADES:Record<ShowcaseHour,ShowcaseGrade>={
  day:{slope:[1,1,1],offset:[0,0,0],power:[1,1,1],contrast:1.1,pivot:.18,shadow:[.992,.997,1],highlight:[1.028,1.006,.978],split:.06,vignette:.1},
  golden:{slope:[1.04,1.02,.99],offset:[.005,.002,.007],power:[.97,.985,1.01],contrast:1.12,pivot:.18,shadow:[.9,.97,1.09],highlight:[1.18,1.05,.84],split:.4,vignette:.12},
  night:{slope:[.92,.98,1.05],offset:[-.006,-.003,.004],power:[1.03,1.01,.98],contrast:1.16,pivot:.16,shadow:[.66,.78,1.1],highlight:[1.18,1,.84],split:.3,vignette:.22},
};
/** Night bloom: a wider, weaker glow so landscape lights read without blowing out. Threshold stays above white. */
export const SHOWCASE_BLOOM={strength:.22,radius:.78,threshold:1.08};
/** Architectural stills stay nearly sharp. A hint of defocus, and never enough to open a tread. */
export const SHOWCASE_DOF={apertureScale:3,apertureBias:10,maxRadiusPx:1.15};
/** Stills use SMAA only. Jittered supersampling averages thin stair treads with the ground behind them. */
export const SHOWCASE_STILL_SAMPLES=1;
/** Showcase day key, relative to the HDRI sun. Fill is reduced separately so shade can read. */
export const SHOWCASE_DAY_SUN=1.62;
/** Share of the daylight environment kept while the grade is on. Shade has to read against the key. */
export const SHOWCASE_SKY_FILL=0.5;
/** Golden hour keeps enough sky fill that open shade stays lightly cool while the low sun carves the light. */
export const SHOWCASE_GOLDEN_FILL=0.72;
/**
 * Daylight chromaticity for the showcase sky dome, applied after panorama exposure.
 * The photographed upper sky is cyan enough that Neutral tone mapping prints its red as 0.
 * Blend moves a blue-leading pixel toward these fractions of its blue lead and keeps the photo's luminance.
 * Night and the editor pass rich = 0 and stay on the photograph. Golden hour uses its own warm sky.
 */
export const DAY_SKY_BLEND=0.55;
export const DAY_SKY_RED=0.55;
export const DAY_SKY_GREEN=0.74;
/** Extra panorama exposure for showcase day only. The photographed sky sits a stop under a print. */
export const DAY_SKY_GAIN=1.5;
/** Golden-hour dome: warmer, with blue still leading so foliage is not painted olive. The horizon glow is separate. */
export const GOLDEN_SKY_GAIN=1.15;
export const GOLDEN_SKY_BLEND=0.34;
export const GOLDEN_SKY_RED=1.08;
export const GOLDEN_SKY_GREEN=0.94;
export const GOLDEN_SKY_BLUE=0.78;

function smooth01(edge0:number,edge1:number,x:number){const t=x<=edge0?0:x>=edge1?1:(x-edge0)/(edge1-edge0);return t*t*(3-2*t);}
/** The dome shader's daylight recolor. `rich` is 1 for showcase day and 0 everywhere else. */
export function daySkyLinear(rgb:readonly[number,number,number],strength:number,rich=1):[number,number,number]{
  const gain=1+(DAY_SKY_GAIN-1)*rich;
  const e:[number,number,number]=[Math.max(0,rgb[0])*strength*gain,Math.max(0,rgb[1])*strength*gain,Math.max(0,rgb[2])*strength*gain];
  const luma=.2126*e[0]+.7152*e[1]+.0722*e[2],lead=Math.max(e[2],luma);
  const natural:[number,number,number]=[lead*DAY_SKY_RED,lead*DAY_SKY_GREEN,lead];
  const naturalL=Math.max(.2126*natural[0]+.7152*natural[1]+.0722*natural[2],1e-4);
  const amt=DAY_SKY_BLEND*smooth01(0,.06,e[2]-e[1])*rich;
  return e.map((v,i)=>v+(natural[i]*luma/naturalL-v)*amt) as [number,number,number];
}
/** The dome shader's golden-hour recolor. `warm` is 1 only for showcase golden hour. */
export function goldenSkyLinear(rgb:readonly[number,number,number],strength:number,warm=1):[number,number,number]{
  const gain=1+(GOLDEN_SKY_GAIN-1)*warm;
  const e:[number,number,number]=[Math.max(0,rgb[0])*strength*gain,Math.max(0,rgb[1])*strength*gain,Math.max(0,rgb[2])*strength*gain];
  const luma=.2126*e[0]+.7152*e[1]+.0722*e[2];
  const tone:[number,number,number]=[luma*GOLDEN_SKY_RED,luma*GOLDEN_SKY_GREEN,luma*GOLDEN_SKY_BLUE];
  const toneL=Math.max(.2126*tone[0]+.7152*tone[1]+.0722*tone[2],1e-4);
  const amt=GOLDEN_SKY_BLEND*warm;
  return e.map((v,i)=>v+(tone[i]*luma/toneL-v)*amt) as [number,number,number];
}

export function presentationHour(evening:boolean,hour:ShowcaseHour):ShowcaseHour{
  if(evening)return 'night';
  return hour==='golden'?'golden':'day';
}
export function bloomFor(showcase:boolean){return showcase?SHOWCASE_BLOOM:SCENE_LOOK.bloom;}

const clamp01=(v:number)=>v<0?0:v>1?1:v;
/** The same curve the grade pass runs. `vignette` is 0 at the centre and 1 in the corners. */
export function gradeLinear(rgb:readonly[number,number,number],hour:ShowcaseHour,vignette=0):[number,number,number]{
  const g=SHOWCASE_GRADES[hour],c:[number,number,number]=[0,0,0];
  for(let i=0;i<3;i++){const lifted=Math.max(0,rgb[i]*g.slope[i]+g.offset[i]);c[i]=lifted**g.power[i];c[i]=(c[i]-g.pivot)*g.contrast+g.pivot;}
  const luma=.2126*c[0]+.7152*c[1]+.0722*c[2],t=clamp01((luma-.04)/.4),vig=1-g.vignette*vignette;
  for(let i=0;i<3;i++){const tint=g.shadow[i]*(1-t)+g.highlight[i]*t;c[i]=c[i]*(1-g.split+g.split*tint)*vig;}
  return c;
}
