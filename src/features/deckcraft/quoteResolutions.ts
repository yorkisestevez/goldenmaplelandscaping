import {registerQuoteCosting} from './quoteCostRegistry';
import {RAILING_CATALOGUE} from './manufacturerRuntimeCatalogue';
import type {DeckData,QuoteResolution} from './types';
import type {ConnectorScheduleRow} from './schedule';
import type {EstimateResult} from './calculations';

type Section=EstimateResult['sections'][number];
export interface QuoteScope {key:string;fingerprint:string;name:string;labels:string[];rows:{section:number;item:number;name:string;spec:string;qty:number|string;unit:string;sectionTitle:string}[]}
export interface QuoteResolutionReview {scopes:QuoteScope[];active:string[];inactive:number}
const fail=(s:string):never=>{throw Error(s);};
/** Defence in depth on the synchronous price path. Full import validation lives in the lazy review/job modules. */
function checkedCostRecords(value:unknown):QuoteResolution[]{
 const keys=['scopeKey','fingerprint','supplyCost','installationCost','confirmedOn','source','note','additionalScope'];
 if(!Array.isArray(value)||value.length>100||Object.getPrototypeOf(value)!==Array.prototype||Object.getOwnPropertySymbols(value).length)fail('Invalid private quote costs.');
 const array=Object.getOwnPropertyDescriptors(value),seen=new Set<string>();if(Object.keys(array).some(k=>k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=(value as unknown[]).length)))fail('Invalid private quote costs.');
 for(let i=0;i<(value as unknown[]).length;i++)if(!array[i]||!('value'in array[i]))fail('Invalid private quote costs.');
 for(const record of value as QuoteResolution[]){if(!record||typeof record!=='object'||Object.getPrototypeOf(record)!==Object.prototype)fail('Invalid private quote costs.');const d=Object.getOwnPropertyDescriptors(record);if(Object.getOwnPropertySymbols(record).length||Object.keys(d).length!==keys.length||keys.some(k=>!d[k]||!('value'in d[k])||!d[k].enumerable))fail('Invalid private quote costs.');
  if(keys.slice(0,2).some(k=>typeof d[k].value!=='string')||['confirmedOn','source','note'].some(k=>typeof d[k].value!=='string')||record.additionalScope!==true||record.source.length>160||record.note.length>1000||!/^\d{4}-\d\d-\d\d$/.test(record.confirmedOn))fail('Invalid private quote costs.');
  for(const n of [record.supplyCost,record.installationCost])if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1_000_000||Math.abs(n*100-Math.round(n*100))>1e-6)fail('Invalid private quote costs.');if(record.supplyCost+record.installationCost<=0)fail('Invalid private quote costs.');const key=record.scopeKey+record.fingerprint;if(seen.has(key))fail('Duplicate private quote cost.');seen.add(key);
 }return value as QuoteResolution[];
}
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical)}]`:v&&typeof v==='object'?`{${Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`:JSON.stringify(v)??'undefined';
const hash=(text:string)=>{let a=2166136261,b=3339675911;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;};
const words=(s:string)=>s.toLowerCase().replace(/\((builder|supplier) quote\)/g,'').replace(/\b(builder|supplier|quote|required|with selected finish|custom-layout|accent boards|boards|supply and installation)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
/** Non-cost stock/price confirmations belong to the pergola contractor controls.
 * An added fee cannot confirm availability, kit completeness or a provisional listing. */
export const isQuoteStatusRequirement=(label:string)=>label==='Pergola supply/accessory costs require contractor confirmation; public listing prices are provisional.'||label.startsWith('Pergola availability and kit completeness require confirmation (catalog:');
/** Current quote labels are bound to the actual null-cost rows, not guessed supplier prices. */
export function buildQuoteScopes(data:DeckData,sections:Section[],labels:readonly string[],connectors:ConnectorScheduleRow[]=[]):QuoteScope[]{
 const groups:{name:string;labels:string[];rows:QuoteScope['rows']}[]=[];
 sections.forEach((s,si)=>{const rows=s.items.flatMap((i,ii)=>i.cost===null&&Number(i.qty)>0?[{section:si,item:ii,name:i.name,spec:i.spec,qty:i.qty,unit:i.unit,sectionTitle:s.title}]:[]);if(!rows.length)return;if(s.title==='Labour (Construction & Build)'||s.title==='in-lite® Lighting System'||s.title==='Add-ons & Extras'||s.title==='Deck-part finishes'||s.title==='Manufacturer deck accessories'||s.title==='Terrain stair support connections'||s.title.startsWith('Yard ·'))rows.forEach(r=>groups.push({name:r.name,labels:[],rows:[r]}));else groups.push({name:s.title,labels:[],rows});});
 for(const [ci,c] of connectors.entries())if(c.qty>0&&c.rate===null&&!c.basis.startsWith('Priced by'))groups.push({name:c.name,labels:[],rows:[{section:-1,item:ci,name:c.name,spec:c.basis,qty:c.qty,unit:c.unit,sectionTitle:'Connection components'}]});
 for(const label of [...new Set(labels)]){
  if(isQuoteStatusRequirement(label))continue;
  const q=words(label);let matches=groups.filter(g=>g.rows.some(r=>{const n=words(r.name);return n===q||q.length>5&&words(r.spec)===q||n.length>5&&q.startsWith(n+' ')||q.length>5&&n.startsWith(q+' ');}));
  if(!matches.length){const title=label===RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId)?.name?'Railing System':/^Tread materials|^Stair treads and risers/.test(label)?'Stairs':/^Deck skirting/.test(label)?'Deck skirting':/^Stair and level cladding/.test(label)?'Stair and level cladding':/^Fascia boards/.test(label)?'Deck-part finishes':/^Deckorators Dark Slate picture-frame/.test(label)?'Picture-frame border finish':/frameless|glass railing|glass panels|railing/i.test(label)?'Railing System':undefined;if(title)matches=groups.filter(g=>g.rows.some(r=>sections[r.section]?.title===title&&(title!=='Deck-part finishes'||r.name.startsWith('Fascia ·'))));}
  if(!matches.length&&groups.some(g=>g.name==='Decking')&&!/labour|installation|fabrication/i.test(label))matches=groups.filter(g=>g.name==='Decking'&&sections[g.rows[0].section].items.some(i=>words(i.spec).includes(q)));
  if(matches.length){const first=matches[0];first.labels.push(label);for(const other of matches.slice(1)){first.rows.push(...other.rows);first.labels.push(...other.labels);groups.splice(groups.indexOf(other),1);}}else groups.push({name:label,labels:[label],rows:[]});
 }
 // Manufacturer-specific fasteners replace generic clips/screws; quote them once with the selected assembly.
 if(data.catalogueAccessories?.some(id=>id==='tt_concealoc'||id==='dk_stealthlock')){const accessory=groups.find(g=>g.rows.some(r=>sections[r.section]?.title==='Manufacturer deck accessories'&&/clip|fasten|concealoc|stealthlock/i.test(r.name)));if(accessory)for(const g of [...groups])if(g!==accessory&&g.rows.some(r=>sections[r.section]?.title==='Hardware & Fasteners'&&['Hidden Clips','Deck Screws'].includes(r.name))){accessory.rows.push(...g.rows);accessory.labels.push(...g.labels);groups.splice(groups.indexOf(g),1);}}
 if(data.catalogueAccessories?.includes('tt_protac_flashing')){const supplier=groups.find(g=>g.rows.some(r=>r.sectionTitle==='Manufacturer deck accessories'&&/ledger flashing/i.test(r.name)));if(supplier)for(const g of [...groups])if(g!==supplier&&g.rows.some(r=>r.sectionTitle==='Add-ons & Extras'&&r.name==='Ledger Flashing')){supplier.rows.push(...g.rows);supplier.labels.push(...g.labels);groups.splice(groups.indexOf(g),1);}}
 const ignored=new Set(['quoteResolutions','generatedImageUrl','isGeneratingImage','houseVisible','sceneLighting','lightingPreviewOn','boundaryLocks']);
 const design=Object.fromEntries(Object.entries(data).filter(([k,v])=>!ignored.has(k)&&v!==undefined));const basis=hash(canonical({design,connectors,sections:sections.filter(s=>s.total>0||s.quoteRequired).map(s=>({title:s.title,total:s.total,items:s.items})),labels:[...new Set(labels)].sort()}));
 return groups.map(g=>{const identity=canonical({name:g.name,labels:[...new Set(g.labels)].sort(),rows:g.rows.map(r=>({section:sections[r.section]?.title??'Connection components',name:r.name})).sort((a,b)=>canonical(a).localeCompare(canonical(b)))}),key=`quote-${hash(identity)}`;return {key,fingerprint:`scope-${hash(basis+canonical({identity,rows:g.rows.map(r=>({...r,section:sections[r.section]?.title??'Connection components',item:r.name}))}))}`,name:g.name,labels:[...new Set(g.labels)],rows:g.rows};});
}
export function applyQuoteResolutions(data:DeckData,sections:Section[],labels:string[],markup:number,connectors:ConnectorScheduleRow[]=[]):QuoteResolutionReview|undefined {
 if(!data.quoteResolutions?.length)return undefined;const entries=checkedCostRecords(data.quoteResolutions),scopes=buildQuoteScopes(data,sections,labels,connectors),active:string[]=[],items:Section['items']=[];
 for(const scope of scopes){const entry=entries.find(e=>e.scopeKey===scope.key&&e.fingerprint===scope.fingerprint);if(!entry)continue;active.push(scope.key);const amount=entry.supplyCost*markup+entry.installationCost;scope.rows.forEach(r=>{if(r.section<0){connectors[r.item].quoteResolved=true;connectors[r.item].basis=`Covered by confirmed additional scope dated ${entry.confirmedOn}. Original basis: ${connectors[r.item].basis}`;return;}const item=sections[r.section].items[r.item];item.quoteResolved=true;item.spec=`Covered by confirmed additional scope dated ${entry.confirmedOn}. Original scope basis: ${item.spec}`;});for(const label of scope.labels){let i;while((i=labels.indexOf(label))>=0)labels.splice(i,1);}items.push({name:scope.name,spec:`Confirmed additional scope dated ${entry.confirmedOn}; price includes material markup on additional supply and the confirmed installation scope. Existing priced work remains included separately.`,qty:1,unit:'scope',cost:amount});}
 if(items.length){for(const s of sections)if(s.quoteRequired&&!(s.title==='Aluminum pergola'&&labels.some(isQuoteStatusRequirement))&&!s.items.some(i=>i.cost===null&&!i.quoteResolved&&Number(i.qty)>0)&&!scopes.some(q=>q.rows.some(r=>sections[r.section]===s)&&!active.includes(q.key)))s.quoteRequired=false;sections.push({title:'Confirmed additional quote costs',icon:'✓',description:'Confirmed missing scope: supply includes material markup; installation has no second markup. HST is added below. Planning allowances still require review.',total:items.reduce((n,i)=>n+(i.cost??0),0),items});}
 const inactive=entries.length-active.length;return {scopes,active,inactive};
}

// Loaded by private contractor workflows; public designs never require this costing extension.
registerQuoteCosting(applyQuoteResolutions);
