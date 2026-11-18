import {writeFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {legacyScenarios} from './deck-legacy-scenarios';
import {junctionCases} from './deck-level-junction-cases';
import {DECKING_CATALOGUE,RAILING_CATALOGUE,MANUFACTURER_ACCESSORIES} from '../src/features/deckcraft/manufacturerCatalog';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import type {DeckData} from '../src/features/deckcraft/types';
import {CARR_PAVER_TRADE_2026,deckingRateWidth} from '../src/features/deckcraft/supplierRates';
import {CARR_TRADE} from '../src/data/carrPrices';
import baseline from '../src/data/engine-baseline.json';

// Independent accounting checks: section rows must reconcile; tax must be added once;
// priced material stock and markup must agree. No golden is regenerated here.
const cases:[string,DeckData][]=[...Object.entries(legacyScenarios()).map(([n,p]):[string,DeckData]=>[n,{...structuredClone(DEFAULT_DECK),...p}]),
  ...Object.entries(junctionCases()).map(([n,c]):[string,DeckData]=>[`junction/${n}`,c.design]),
  ...DECKING_CATALOGUE.filter(m=>!m.isHidden).map((m):[string,DeckData]=>[`material/${m.id}`,{...structuredClone(DEFAULT_DECK),deckingMaterial:m.id,deckingColor:m.colors[0]?.name}]),
  ...LIGHTING_CATALOGUE.filter(p=>p.supported).map((p):[string,DeckData]=>[`light/${p.id}`,{...structuredClone(DEFAULT_DECK),lightingSystem:{wireDistance:20,selectedItems:[{productId:p.id,qty:3}]}}])];
for(const productId of Object.keys(CARR_PAVER_TRADE_2026))cases.push([`yard/${productId}`,{...structuredClone(DEFAULT_DECK),yardFeatures:[{id:'priced-patio',kind:'patio',name:'Pricing audit patio',enabled:true,xFt:35,zFt:30,widthFt:12,depthFt:10,heightIn:0,rotationDeg:0,productId,color:'#aaa69b'}]}]);
cases.push(['yard/mixed-products',{...structuredClone(DEFAULT_DECK),yardFeatures:cases.filter(([name])=>name.startsWith('yard/')).slice(0,2).flatMap(([,d],i)=>d.yardFeatures!.map(f=>({...f,id:`mixed-${i}`,xFt:35+i*20})))}]);
for(const drainage of ['none','rainescape','dryspace','zipup'] as const)for(const ceiling of ['none','aluminum','pvc','cedar'] as const)for(const levels of [1,2])cases.push([`underdeck/${drainage}/${ceiling}/${levels}`,{...structuredClone(DEFAULT_DECK),height:96,levels,underDeck:{drainage,ceiling,scope:'all',gravel:true,gravelDepthIn:3,floorMesh:true}}]);
for(const deckingMaterial of ['tt_reserve','tt_terrain'])for(const boardWidth of [3.5,5.5] as const)for(const materialMarkup of [0,35,60])cases.push([`edge/${deckingMaterial}/${boardWidth}/${materialMarkup}`,{...structuredClone(DEFAULT_DECK),deckingMaterial,boardWidth,materialMarkup,autoLighting:{border:true}}]);
const failures:{design:string;check:string;actual:number;expected:number}[]=[],samples:any[]=[];
let checks=0;
const near=(n:string,label:string,a:number,b:number)=>{checks++;if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>.011)failures.push({design:n,check:label,actual:a,expected:b});};
for(const [name,data] of cases){
  const e=calculateDeckReleaseEstimate(data,DECK_SETTINGS);
  near(name,'subtotal is sum of non-tax sections',e.subtotal,e.sections.filter(s=>!s.title.startsWith('HST')).reduce((n,s)=>n+s.total,0));
  near(name,'HST added once',e.hst,e.subtotal*.13);
  near(name,'total is subtotal plus HST',e.total,e.subtotal+e.hst);
  for(const s of e.sections){near(name,`${s.title}: rows reconcile`,s.total,s.items.reduce((n,r)=>n+(r.cost??0),0));for(const r of s.items){checks++;if(r.cost!==null&&(!Number.isFinite(r.cost)||r.cost<0))failures.push({design:name,check:`${r.name}: invalid cost`,actual:r.cost,expected:0});}}
  const m=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial),stock=e.stockSchedule[0],deck=e.sections.find(s=>s.title==='Decking');
  for(const p of e.yardTakeoff.materials){const rate=CARR_PAVER_TRADE_2026[p.productId];if(rate){near(name,'paver supply × order quantity × yard markup',p.amountCents!/100,Math.round(p.installedAreaSqft*CARR_TRADE.waste.standard*rate.rate*100*baseline.facts.materialMarkup)/100);}}
  if(m?.costPerSqft!=null&&deck&&stock){near(name,'deck board stock × supplier rate × markup',deck.total,stock.orderedLf*m.costPerSqft*(deckingRateWidth(m.id,data.boardWidth)/12)*(1+(data.materialMarkup??35)/100));}
  if(['std/Rectangle/Straight/Straight/attached','std/Rectangle/Straight/Straight/freestanding-2lvl','material/cedar','material/tt_reserve','light/wedge','light/evo_hyde_550'].includes(name))samples.push({name,subtotal:e.subtotal,hst:e.hst,total:e.total,railingLf:e.calculatedRailingLf,quoteRequired:e.quoteRequired,sections:e.sections});
}
const stairWidths=[36,48,72,120].map(stairWidth=>{const e=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),stairWidth});return {stairWidth,materials:e.sections.find(s=>s.title==='Stairs')?.total,labour:e.sections.find(s=>s.title.startsWith('Labour'))?.total,stringers:e.model.quantities.stringers,treads:e.model.quantities.stairTreads};});
const catalogue={decking:{total:DECKING_CATALOGUE.filter(m=>!m.isHidden).length,unpriced:DECKING_CATALOGUE.filter(m=>!m.isHidden&&m.costPerSqft===null).map(m=>m.id)},railing:{total:RAILING_CATALOGUE.length,unpriced:RAILING_CATALOGUE.map(r=>r.id)},lighting:{total:LIGHTING_CATALOGUE.length,unpricedSupply:LIGHTING_CATALOGUE.filter(p=>p.cost===null).map(p=>p.id),unpricedInstallation:LIGHTING_CATALOGUE.filter(p=>p.laborCost===null).map(p=>p.id),sourcedSupply:LIGHTING_CATALOGUE.filter(p=>p.rateSource).length},accessories:{total:MANUFACTURER_ACCESSORIES.length}};
const out={checkedOn:'2026-09-26',designs:cases.length,checks,failures,stairWidths,catalogue,samples};
writeFileSync(new URL('../../../outputs/deckcraft-pricing-audit.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({designs:cases.length,checks,failures,stairWidths,catalogue},null,2));
process.exitCode=failures.length?1:0;
