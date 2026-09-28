import type {CompassPoint,PermitSite} from './types';

/** The lot for the permit set's site plan: its limits, and the check every load and edit runs. */
export const PERMIT_SITE_LIMITS={lotWidthFt:[10,1000],lotDepthFt:[10,2000],leftYardFt:[0,1000],rearYardFt:[0,2000]} as const satisfies Record<string,readonly [number,number]>;
export const COMPASS_POINTS:readonly CompassPoint[]=['N','NE','E','SE','S','SW','W','NW'];
export const COMPASS_WORDS:Record<CompassPoint,string>={N:'north',NE:'northeast',E:'east',SE:'southeast',S:'south',SW:'southwest',W:'west',NW:'northwest'};
/** Feet per metre, for a survey given in metres. */
export const FT_PER_M=1/.3048;

const LABELS={lotWidthFt:'Lot width',lotDepthFt:'Lot depth',leftYardFt:'Left side yard',rearYardFt:'Rear yard'} as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

export function validatePermitSite(input:unknown):PermitSite{
  if(!record(input))throw new Error('Invalid lot details.');
  const site={} as PermitSite;
  for(const [key,[min,max]] of Object.entries(PERMIT_SITE_LIMITS) as [keyof typeof LABELS,readonly [number,number]][]){
    const v=input[key];
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${LABELS[key]} must be a number of feet between ${min} and ${max}.`);
    site[key]=v;
  }
  if(input.yardFaces!==undefined){if(!COMPASS_POINTS.includes(input.yardFaces as CompassPoint))throw new Error('Choose which way the back yard faces.');site.yardFaces=input.yardFaces as CompassPoint;}
  if(input.corner!==undefined){if(input.corner!=='left'&&input.corner!=='right')throw new Error('A corner lot street runs along the left or the right side.');site.corner=input.corner;}
  return site;
}
