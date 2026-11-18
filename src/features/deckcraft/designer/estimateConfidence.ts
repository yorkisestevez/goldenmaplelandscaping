import type {DeckEstimate} from '../designFacts';
type Item=DeckEstimate['sections'][number]['items'][number];
export type PriceStatus='confirmed'|'allowance'|'pending';
/** A numeric benchmark alone is never evidence of a confirmed supplier price. */
export function priceStatus(item:Item):PriceStatus {
 return item.quoteResolved?'confirmed':item.cost===null?'pending':'allowance';
}
export function estimateConfidence(estimate:DeckEstimate){
 const rows=estimate.sections.filter(s=>!/^HST/.test(s.title)).flatMap(s=>s.items.filter(i=>Number(i.qty)>0||(i.cost!==null&&i.cost!==0)).map(item=>({section:s.title,...item,status:priceStatus(item)})));
 const totals={confirmed:0,allowance:0};
 for(const row of rows)if(row.status!=='pending')totals[row.status]+=row.cost??0;
 const stock=estimate.stockSchedule.map(r=>({...r,extraLf:Math.max(0,r.orderedLf-r.installedLf),extraPercent:r.installedLf>0?Math.max(0,(r.orderedLf/r.installedLf-1)*100):0}));
 return {rows,totals,stock,pending:estimate.quoteRequired.length,delivery:rows.filter(r=>/delivery|freight|hauling/i.test(r.name)),labour:rows.filter(r=>r.section==='Labour (Construction & Build)')};
}
/** This is the margin equivalent of material markup, never whole-project profit. */
export function materialMarginPercent(markup:number){return Number.isFinite(markup)&&markup>=0?markup/(100+markup)*100:null;}
