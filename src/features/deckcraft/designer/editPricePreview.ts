import type {DeckData} from '../types';
/** Price review is loaded only on demand; uses the same calculator and unresolved quotes as the estimate. */
export async function editPricePreview(data:DeckData,patch:Partial<DeckData>){
 const {calculateEstimate}=await import('../calculations');
 const before=calculateEstimate(data),after=calculateEstimate({...data,...patch});
 const money=(v:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(v);
 return `Priced portion including HST: ${money(before.total)} → ${money(after.total)} (${after.total-before.total>=0?'+':''}${money(after.total-before.total)}). ${after.quoteRequired.length?`Outstanding quotes: ${after.quoteRequired.join('; ')}.`:'No outstanding quote items.'}`;
}
