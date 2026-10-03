import {pergolaProduct,type PergolaSelection} from './pergolaCatalog';
/** Prefer the verified factory accessory; otherwise keep a separately quoted lighting concept. */
export function pergolaLightingPatch(s:PergolaSelection,on:boolean):Partial<PergolaSelection>{
 const led=pergolaProduct(s)?.accessories.find(a=>a.kind==='led');
 return {accessories:[...s.accessories.filter(id=>id!==led?.id),...(on&&led?[led.id]:[])],lighting:on&&!led?'perimeter-led':undefined};
}
