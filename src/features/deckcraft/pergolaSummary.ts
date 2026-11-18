import type {DeckData} from './types';
import {PERGOLA_OPTIONS} from './pergolaOptions';
import {pergolaProduct,pergolaVariant} from './pergolaCostCatalog';
import {pergolaSize} from './pergolaValidation';
/** Compact truthful live-design fact. Full SKU/source/finish evidence is included by proposals and model exports. */
export function pergolaDescription(data:DeckData):string|null{
 const s=data.pergola,p=s&&pergolaProduct(s),v=s&&pergolaVariant(s);if(!s||!p||!v)return null;const d=pergolaSize(s);
 return `Aluminum pergola: ${p.name}, ${v.label}; ${s.supplyMode==='install-only'?'customer-owned kit, installation only':'contractor supply and installation'}; ${PERGOLA_OPTIONS[p.id].operation==='motorized'||s.accessories.includes('motor')?'motorized':'manual'} louvers; centre (${s.xFt}, ${s.zFt}) ft, rotation ${s.rotationDeg}°, louvers ${s.louverDeg}°; ${s.target.kind==='deck'?`deck level ${s.target.level+1}`:'patio'}; ${d.widthIn.toFixed(1)} × ${d.depthIn.toFixed(1)} × ${d.heightIn.toFixed(1)} in ${v.dimensions&&!p.custom?'listed envelope':'conceptual dimensions'}${s.lighting?'; planned perimeter LEDs (compatibility / electrical quote required)':s.accessories.includes('led')?'; factory LED accessory':''}; CAD listing dated ${v.source.checkedAt}; availability ${v.availability}; profiles/anchors/structural suitability require review.`;
}
