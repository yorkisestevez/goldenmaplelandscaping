/** Presentation-only switches for stills and future camera footage.
 * They are not design data: colours, quantities and prices stay on the saved project.
 * URL (read once, after hydration): ?deck-quality=showcase, ?deck-context=1,
 * ?deck-hour=day|golden|night and ?deck-grade=0 to keep the previous showcase look.
 * ?deck-light=golden is the neighbourhood alias for golden hour.
 * The still-export panel writes the same flags for the live view it captures. */
export type ShowcaseHour='day'|'golden'|'night';
export interface ShowcaseFlags {quality:boolean;context:boolean;hour:ShowcaseHour;post:boolean}
const OFF:ShowcaseFlags={quality:false,context:false,hour:'day',post:true};
let flags:ShowcaseFlags=OFF;
const listeners=new Set<()=>void>();
let urlApplied=false;

export function getShowcaseFlags(){return flags;}
export function getShowcaseServerFlags(){return OFF;}
export function showcaseQuality(){return flags.quality;}
export function showcaseContext(){return flags.context;}
/** Neighbourhood lighting hook. Golden hour is the presentation hour, with the grade on. */
export function showcaseGolden(){return flags.quality&&flags.post&&flags.hour==='golden';}
/** Filmic grade, depth of field, SMAA, contact-hardening shadows and the house trim. */
export function showcasePostEnabled(){return flags.quality&&flags.post;}
/** 2K detail loads for showcase post, and for a high-tier editor. A before-still (post off) stays on 1K. */
export function showcaseDetail(tier:string){if(flags.quality&&!flags.post)return false;return flags.quality||tier==='high';}
export function subscribeShowcase(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}

export function setShowcaseFlags(next:Partial<ShowcaseFlags>){
 const quality=next.quality??flags.quality,context=next.context??flags.context,hour=next.hour??flags.hour,post=next.post??flags.post;
 if(quality===flags.quality&&context===flags.context&&hour===flags.hour&&post===flags.post)return;
 flags={quality,context,hour,post};
 for(const listener of listeners)listener();
}

/** One read of the page URL. A later toggle is not overwritten by the query string. */
export function applyShowcaseSearch(){
 if(urlApplied||typeof location==='undefined')return;
 urlApplied=true;
 const params=new URLSearchParams(location.search);
 const quality=params.get('deck-quality')==='showcase',context=params.get('deck-context')==='1';
 const hourParam=params.get('deck-hour'),light=params.get('deck-light');
 const named=hourParam==='golden'||hourParam==='night'||hourParam==='day'?hourParam:light==='golden'?'golden':undefined;
 const hour:ShowcaseHour|undefined=named;
 const grade=params.get('deck-grade'),post=grade==='0'?false:grade==='1'?true:undefined;
 if(quality||context||hour||post!==undefined)setShowcaseFlags({quality,context,...(hour?{hour}:{}),...(post!==undefined?{post}:{})});
}

/** Distance haze while the photographed horizon is visible. The yard (under ~80 ft) stays clear;
 * the far lawn dissolves into that band. The editor's fog is restored when context is off. */
export const SHOWCASE_FOG_DENSITY=0.00155;
/** Clearer air for the photographic grade. Context without the grade keeps SHOWCASE_FOG_DENSITY. */
export const SHOWCASE_CLEAR_FOG=0.00042;
