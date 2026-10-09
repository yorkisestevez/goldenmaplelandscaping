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
  golden:{slope:[1.2,1.06,.72],offset:[.02,.006,-.02],power:[.9,.97,1.1],contrast:1.22,pivot:.18,shadow:[.68,.56,.9],highlight:[1.34,.92,.46],split:.5,vignette:.16},
  night:{slope:[.92,.98,1.05],offset:[-.006,-.003,.004],power:[1.03,1.01,.98],contrast:1.16,pivot:.16,shadow:[.66,.78,1.1],highlight:[1.18,1,.84],split:.3,vignette:.22},
};
/** Night bloom: a wider, weaker glow so landscape lights read without blowing out. Threshold stays above white. */
export const SHOWCASE_BLOOM={strength:.22,radius:.78,threshold:1.08};
/** Architectural stills stay nearly sharp. A hint of defocus, and never enough to open a tread. */
export const SHOWCASE_DOF={apertureScale:3,apertureBias:10,maxRadiusPx:1.15};
/** Stills use SMAA only. Jittered supersampling averages thin stair treads with the ground behind them. */
export const SHOWCASE_STILL_SAMPLES=1;
/** Showcase day key, relative to the HDRI sun. Fill is reduced separately so shade can read. */
export const SHOWCASE_DAY_SUN=1.48;
/** Share of the daylight environment kept while the grade is on. */
export const SHOWCASE_SKY_FILL=0.72;

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
