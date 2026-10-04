import type {DeckEstimate} from '../designFacts';
/** Compare matched physical units only; never add feet to pieces or tax to scope. */
export function optionScopeComparison(before:DeckEstimate,after:DeckEstimate){
 const sections=new Set([...before.sections,...after.sections].filter(s=>!/^HST/.test(s.title)).map(s=>s.title));
 const amounts=[...sections].map(title=>{const a=before.sections.find(s=>s.title===title),b=after.sections.find(s=>s.title===title);return {title,before:a?.total??0,after:b?.total??0,delta:(b?.total??0)-(a?.total??0),pending:!!a?.quoteRequired||!!b?.quoteRequired};}).filter(r=>Math.abs(r.delta)>=.005||r.pending);
 const collect=(e:DeckEstimate)=>{const rows=new Map<string,{name:string;section:string;unit:string;qty:number}>();for(const s of e.sections){if(/^HST/.test(s.title))continue;for(const i of s.items){const qty=Number(i.qty);if(!Number.isFinite(qty)||qty<=0||i.unit==='scope')continue;const key=JSON.stringify([s.title,i.name,i.unit]),row=rows.get(key);rows.set(key,{name:i.name,section:s.title,unit:i.unit,qty:(row?.qty??0)+qty});}}return rows;};
 const a=collect(before),b=collect(after),quantities=[...new Set([...a.keys(),...b.keys()])].map(key=>{const left=a.get(key),right=b.get(key);return {...(right??left)!,before:left?.qty??0,after:right?.qty??0,delta:(right?.qty??0)-(left?.qty??0)};}).filter(r=>Math.abs(r.delta)>.000001);
 return {amounts,quantities,addedQuotes:after.quoteRequired.filter(q=>!before.quoteRequired.includes(q)),removedQuotes:before.quoteRequired.filter(q=>!after.quoteRequired.includes(q)),area:after.area-before.area,personHours:after.manHours-before.manHours};
}
