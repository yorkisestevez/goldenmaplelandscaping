import {PAVER_BRANDS,CARR_TRADE,BIN_COST} from '../../data/carrPrices';
import baseline from '../../data/engine-baseline.json';
import {computeEstimate,type EstimateInput} from '../../utils/estimateEngine';
import {hardscapeTakeoff,disposalBinsFor,c} from '../../utils/takeoff';
import type {DeckData} from './types';
import {buildYardModel,type YardModel} from './yardModel';

export interface PublicYardSection {id:string;label:string;amountCents:number|null;quantity?:number;unit?:string;note?:string;featureIds?:string[]}
export interface PublicYardMaterial {productId:string;label:string;installedAreaSqft:number;orderAreaSqft:number;skids:number;amountCents:number|null;featureIds:string[]}
/** Same flatbed packing and source rates as takeoff.ts; grouped materials share
 * trucks, while each product retains its own integer pallet requirement. */
function palletDelivery(skids:number){const d=CARR_TRADE.delivery;let total=0;while(skids>0){const n=Math.min(skids,d.flatbedMaxSkids);total+=d.flatbedBase+Math.max(0,n-d.flatbedBaseSkids)*d.flatbedPerExtraSkid;skids-=n;}return Math.round(c(total)*baseline.facts.materialMarkup);}
const wallHeightFactor=(h:number)=>h<24?1:h<=48?1.5:h<=72?2.2:3.2;

/** Public adapter: it deliberately returns neither engine lineItems nor trade
 * prices nor margin. One engine invocation owns all shared site-work floors. */
export function buildYardTakeoff(data:DeckData,model:YardModel=buildYardModel(data)){
 const active=model.features.filter(f=>!f.excluded),patios=active.filter(f=>f.config.kind==='patio'),walls=active.filter(f=>f.config.kind==='retaining-wall'),water=active.filter(f=>f.config.kind==='water-feature');
 const warnings=[...model.warnings],unknown:PublicYardSection[]=[],materials:PublicYardMaterial[]=[];
 for(const f of model.features.filter(f=>f.excluded))unknown.push({id:`excluded-${f.config.id}`,label:`${f.config.name}: excluded layout needs revision`,amountCents:null,featureIds:[f.config.id],note:f.warnings.join(' ')||'This feature cannot be included in the current layout; revise its dimensions or position before quoting.'});
 const grouped=new Map<string,{area:number;ids:string[]}>();
 for(const f of patios){const group=grouped.get(f.config.productId)||{area:0,ids:[]};group.area+=f.quantities.paverAreaSqft;group.ids.push(f.config.id);grouped.set(f.config.productId,group);}
 for(const [id,g]of grouped){const p=PAVER_BRANDS.find(p=>p.id===id);if(!p){unknown.push({id:`unknown-${id}`,label:'Unpriced paving product and installation',amountCents:null,quantity:g.area,unit:'sq ft',featureIds:g.ids});materials.push({productId:id,label:id,installedAreaSqft:g.area,orderAreaSqft:g.area,skids:0,amountCents:null,featureIds:g.ids});continue;}
  const takeoff=hardscapeTakeoff({sqft:g.area,paver:p,shape:'simple',surface:'grass',element:'patio'}),line=takeoff.items.find(i=>i.id==='patio-material')!;
  materials.push({productId:id,label:`${p.brand} ${p.product}`,installedAreaSqft:g.area,orderAreaSqft:g.area*CARR_TRADE.waste.standard,skids:takeoff.quantities.skids,amountCents:line.retailCents,featureIds:g.ids});
 }
 const knownArea=materials.filter(p=>p.amountCents!==null).reduce((n,p)=>n+p.installedAreaSqft,0),referencePaver=PAVER_BRANDS.find(p=>materials.some(m=>m.productId===p.id&&m.amountCents!==null))||PAVER_BRANDS[0];
 const knownWalls=walls.filter(f=>['segmental-concrete','armour-stone'].includes(f.config.productId));
 for(const f of knownWalls)unknown.push({id:`wall-review-${f.config.id}`,label:`${f.config.name}: engineering and selected system confirmation`,amountCents:null,featureIds:[f.config.id],note:'The current wall assembly allowance is included in the priced sections. This pending confirmation does not add a second wall charge.'});
 for(const f of walls.filter(f=>!knownWalls.includes(f)))unknown.push({id:`unknown-${f.config.id}`,label:`${f.config.name}: wall system`,amountCents:null,featureIds:[f.config.id]});
 for(const f of water)for(const [suffix,label,quantity,unit]of [['water-system','Water feature, basin, pump and filtration',1,'assembly'],['liner','Liner and underlay',f.quantities.linerSqft,'sq ft'],['rock','Selected rock and finishing',f.quantities.rockPieces,'modeled pieces']] as const)unknown.push({id:`${f.config.id}-${suffix}`,label:`${f.config.name}: ${label}`,amountCents:null,quantity,unit,featureIds:[f.config.id],note:'Supplier selection, installation and electrical scope require a quote; no water-system price is assumed.'});
 if(model.quantities.raisedFillYd3>.001)unknown.push({id:'yard-raised-fill',label:'Additional engineered fill and containment',amountCents:null,quantity:model.quantities.raisedFillYd3,unit:'cu yd',note:'Elevation-derived fill below the standard patio base; supplier and installation quote required.'});
 const equivalentWallLf=knownWalls.reduce((n,f)=>n+f.quantities.wallLengthLf*wallHeightFactor(f.config.heightIn),0);
 const input:EstimateInput={projectType:'full',selectedElements:[...(knownArea>0?['patio']:[]),...(equivalentWallLf>0?['wall']:[])],sizes:{patio:knownArea,wall:equivalentWallLf,wallHeight:'Under 2ft'},details:{'patio.surface':'grass','patio.shape':'simple','wall.wallPurpose':'garden'},conditions:{access:data.siteType==='Urban Tight',slope:Math.abs(model.terrain.slopePct)>0||data.siteType==='Hillside',drainage:data.soilCondition==='Clay'},location:data.municipality==='Barrie'?'barrie':'other',tier:'mid',paverBrandId:referencePaver.id,deckBrandId:'',addOns:[]};
 if(active.length&&data.municipality!=='Barrie')warnings.push('Yard delivery uses the existing Outside Simcoe allowance until the precise delivery location is selected.');
 if(knownWalls.length)warnings.push('Walls use the existing estimator mid-tier, height-adjusted assembly band; the selected wall label is not a verified unit-material price. Engineering and the chosen block/stone supply quote remain to be confirmed.');
 if(water.length)warnings.push('Shared disposal includes modeled water-feature excavation. Water-feature excavation labour, equipment, rock delivery and construction remain unpriced.');
 const engine=computeEstimate(input),precise=engine.precise;
 const categories={excavation:precise?.perCategoryCents.excavation||0,materials:precise?.perCategoryCents.materials||0,labour:precise?.perCategoryCents.labour||0,disposal:0,restoration:precise?.perCategoryCents.restoration||0};
 const common=knownArea>0?hardscapeTakeoff({sqft:knownArea,paver:referencePaver,shape:'simple',surface:'grass',element:'patio'}):null;
 const skids=materials.reduce((n,p)=>n+p.skids,0),edgePieces=Math.ceil(model.quantities.patioPerimeterLf/8),bins=disposalBinsFor(model.quantities.excavationYd3*27,'full-depth');
 if(common){
  const old=(id:string)=>common.items.find(i=>i.id===id)?.retailCents||0;
  const paverCents=materials.reduce((n,p)=>n+(p.amountCents||0),0),edgeCents=Math.round(c(edgePieces*CARR_TRADE.consumables.snapEdgePer8ftPiece)*baseline.facts.materialMarkup);
  categories.materials+=paverCents-old('patio-material')+edgeCents-old('edge-restraint')+palletDelivery(skids)-old('delivery-pallets');
 }
 categories.disposal=c(bins*BIN_COST);
 const sections:PublicYardSection[]=[];
 if(active.length){
  for(const [id,label]of [['excavation','Shared excavation and base installation'],['materials','Paving materials, wall allowances and shared delivery'],['labour','Installation labour'],['disposal','Shared excavation disposal'],['restoration','Shared site restoration']] as const)if(categories[id]>0)sections.push({id:`yard-${id}`,label,amountCents:categories[id],...(id==='disposal'?{quantity:bins,unit:'bins',note:'Joint volume converted to the current full-depth disposal capacity; no separate minimum bin per feature.'}:{})});
 }
 sections.push(...unknown);
 const knownSubtotalCents=Object.values(categories).reduce((n,v)=>n+v,0),knownHstCents=Math.round(knownSubtotalCents*baseline.facts.hstRate),quoteRequired=unknown.length>0;
 const floorTopUpCents=common&&!knownWalls.length&&!Object.values(input.conditions).some(Boolean)?Math.max(0,categories.excavation+categories.labour-common.excavationRetailCents-common.installRetailCents):null;
 return {sections,materials,warnings,quoteRequired,knownSubtotalCents,knownHstCents,knownGrandTotalCents:knownSubtotalCents+knownHstCents,subtotalCents:quoteRequired?null:knownSubtotalCents,hstCents:quoteRequired?null:knownHstCents,grandTotalCents:quoteRequired?null:knownSubtotalCents+knownHstCents,quantities:{...model.quantities,polySandBags:common?.quantities.polySandBags||0,fabricRolls:common?.quantities.fabricRolls||0,aggregateTonnes:common?.quantities.aggregateTonnes||0,deliveryLoads:common?.quantities.deliveryLoads||0,edgePieces,skids,bins},sharedSiteWorkCount:input.selectedElements.length?1:0,sharedSiteWork:{floorTopUpCents,note:'Current crew/excavation floors applied once across all yard features. No separate mobilization fee. Top-up is not separately identifiable for mixed wall/site-condition allowances; coordinate shared operations with the deck scope.'},wallAllowance:{equivalentLinearFeet:equivalentWallLf,description:'Existing estimator mid-tier height-adjusted assembly allowance; not a unit-material quotation.'}};
}
export type YardTakeoff=ReturnType<typeof buildYardTakeoff>;
