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
  day:{slope:[1.012,1.008,1.004],offset:[0.001,0.0004,0],power:[0.997,0.998,1],contrast:1.025,pivot:.18,shadow:[.985,.996,1.012],highlight:[1.012,1.004,.992],split:.045,vignette:.12},
  golden:{slope:[1.09,1.02,.88],offset:[.014,.004,-.01],power:[.95,.985,1.05],contrast:1.08,pivot:.18,shadow:[.82,.74,.98],highlight:[1.2,.98,.7],split:.32,vignette:.18},
  night:{slope:[.9,.96,1.08],offset:[-.012,-.006,.006],power:[1.05,1.02,.96],contrast:1.1,pivot:.16,shadow:[.72,.84,1.16],highlight:[1.14,.98,.8],split:.24,vignette:.26},
};
/** Night bloom: a wider, weaker glow so landscape lights read without blowing out. Threshold stays above white. */
export const SHOWCASE_BLOOM={strength:.22,radius:.78,threshold:1.08};
/** Subtle photographic defocus. Full blur is a few pixels; the focus plane stays sharp. */
export const SHOWCASE_DOF={apertureScale:3,apertureBias:8,maxRadiusPx:2.75};

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
