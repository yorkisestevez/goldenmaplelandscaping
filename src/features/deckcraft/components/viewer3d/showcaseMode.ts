/** Presentation-only switches for stills and future camera footage.
 * They are not design data: colours, quantities and prices stay on the saved project.
 * URL (read once, after hydration): ?deck-quality=showcase and ?deck-context=1.
 * The still-export panel writes the same flags for the live view it captures. */
export interface ShowcaseFlags {quality:boolean;context:boolean;golden:boolean}
const OFF:ShowcaseFlags={quality:false,context:false,golden:false};
let flags:ShowcaseFlags=OFF;
const listeners=new Set<()=>void>();
let urlApplied=false;

export function getShowcaseFlags(){return flags;}
export function getShowcaseServerFlags(){return OFF;}
export function showcaseQuality(){return flags.quality;}
export function showcaseContext(){return flags.context;}
export function showcaseGolden(){return flags.quality&&flags.golden;}
export function subscribeShowcase(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}

export function setShowcaseFlags(next:Partial<ShowcaseFlags>){
 const quality=next.quality??flags.quality,context=next.context??flags.context,golden=next.golden??flags.golden;
 if(quality===flags.quality&&context===flags.context&&golden===flags.golden)return;
 flags={quality,context,golden};
 for(const listener of listeners)listener();
}

/** One read of the page URL. A later toggle is not overwritten by the query string. */
export function applyShowcaseSearch(){
 if(urlApplied||typeof location==='undefined')return;
 urlApplied=true;
 const params=new URLSearchParams(location.search);
 const quality=params.get('deck-quality')==='showcase',context=params.get('deck-context')==='1',golden=params.get('deck-light')==='golden';
 if(quality||context||golden)setShowcaseFlags({quality,context,golden});
}

/** Distance haze while the photographed horizon is visible. Light enough that a
 * 200 ft estate stays clear; only the far neighbourhood softens. The editor's
 * fog is restored when context is off. */
export const SHOWCASE_FOG_DENSITY=0.00042;
