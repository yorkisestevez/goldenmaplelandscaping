/** Presentation-only switches for stills and fly-through footage.
 * They are not design data: colours, quantities and prices stay on the saved project.
 * URL (read once, after hydration): ?deck-quality=showcase, ?deck-context=1,
 * ?deck-hour=day|golden|night and ?deck-grade=0 to keep the previous showcase look.
 * ?deck-light=golden is the neighbourhood alias for golden hour.
 * The still-export panel writes the same flags for the live view it captures. */
export type ShowcaseHour='day'|'golden'|'night';
/** `realistic` is the live realistic look: the grade, contact shadows, a hazy horizon and a tree line in the editor, at
 * the device's own render budget. It is on by default where the renderer is high tier, and the viewer's toggle can
 * change it (remembered on the device). `quality` and `context` stay the presentation switches for stills: the top
 * render tier, depth of field, and the fence and neighbour houses. */
export interface ShowcaseFlags {quality:boolean;context:boolean;hour:ShowcaseHour;post:boolean;realistic:boolean}
const OFF:ShowcaseFlags={quality:false,context:false,hour:'day',post:true,realistic:false};
let flags:ShowcaseFlags=OFF;
const listeners=new Set<()=>void>();
let urlApplied=false;

export function getShowcaseFlags(){return flags;}
export function getShowcaseServerFlags(){return OFF;}
export function showcaseQuality(){return flags.quality;}
export function showcaseContext(){return flags.context;}
/** Neighbourhood lighting hook. Golden hour is the presentation hour, with the grade on. */
export function showcaseGolden(){return flags.quality&&flags.post&&flags.hour==='golden';}
/** Filmic grade, SMAA, contact-hardening shadows and the house trim: the presentation look, or the live realistic look. */
export function showcasePostEnabled(){return (flags.quality||flags.realistic)&&flags.post;}
/** The tree line and horizon haze around the yard. The fence and neighbour houses stay presentation-only (`context`). */
export function showcaseTrees(){return flags.context||flags.realistic;}
const REALISTIC_KEY='deckcraft.realistic-look';
/** The viewer's Realistic look choice on this device: on, off, or not chosen (the render tier decides). */
export function realisticPreference():'on'|'off'|null{try{const v=localStorage.getItem(REALISTIC_KEY);return v==='on'||v==='off'?v:null;}catch{return null;}}
export function setRealisticPreference(on:boolean){try{localStorage.setItem(REALISTIC_KEY,on?'on':'off');}catch{/* private mode: this visit only */}setShowcaseFlags({realistic:on});}
/** 2K detail loads for showcase post, and for a high-tier editor. A before-still (post off) stays on 1K. */
export function showcaseDetail(tier:string){if(flags.quality&&!flags.post)return false;return flags.quality||tier==='high';}
export function subscribeShowcase(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}

export function setShowcaseFlags(next:Partial<ShowcaseFlags>){
 const quality=next.quality??flags.quality,context=next.context??flags.context,hour=next.hour??flags.hour,post=next.post??flags.post,realistic=next.realistic??flags.realistic;
 if(quality===flags.quality&&context===flags.context&&hour===flags.hour&&post===flags.post&&realistic===flags.realistic)return;
 flags={quality,context,hour,post,realistic};
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

/** Distance haze for the neighbourhood. Light enough that a 160 ft lot stays
 * clear; only the far neighbourhood softens. The editor's fog is unchanged. */
export const SHOWCASE_FOG_DENSITY=0.00042;
/** The photographic grade uses the same light haze, so a showcase still is not milkier than the neighbourhood. */
export const SHOWCASE_CLEAR_FOG=0.00042;
