import {poolPricedEarthwork} from './poolQuoteRegistry';
import {physicalEarthworkReconciliation} from './physicalQuote';
import {PAVER_BRANDS,CARR_TRADE,BIN_COST} from '../../data/carrPrices';
import baseline from '../../data/engine-baseline.json';
import {computeEstimate,type EstimateInput} from '../../utils/estimateEngine';
import {hardscapeTakeoff,disposalBinsFor,c} from '../../utils/takeoff';
import type {DeckData,YardFeature} from './types';
import {hardscapeSelection,hardscapeName} from './hardscapeCatalogue';
import {yardEarthworkPlan} from './yardEarthwork';
import {landscapeTakeoff,landscapeQuoteSections} from './landscapeModel';
import {wallQuoteScopes,yardTakeoffRuntime} from './yardQuoteScopes';
import {buildYardModel,type YardModel} from './yardModel';
import {ALLOWANCE_FINISHES,allowanceItems} from './yardSettings';
import {CARR_PAVER_TRADE_2026,carrPaverFreight2026} from './supplierRates';

export interface PublicYardSection {id:string;label:string;amountCents:number|null;quantity?:number;unit?:string;note?:string;featureIds?:string[]}
export interface PublicYardMaterial {productId:string;label:string;installedAreaSqft:number;orderAreaSqft:number;skids:number;amountCents:number|null;featureIds:string[]}
/** Current paver freight, shared across selected products. Aggregate delivery remains
 * in the existing site engine and is not added a second time here. */
function palletDelivery(materials:PublicYardMaterial[]){const amount=materials.reduce((n,p)=>n+p.orderAreaSqft*(CARR_PAVER_TRADE_2026[p.productId]?.deliveryPerSqft??.30),0);return Math.round(c(carrPaverFreight2026(amount))*baseline.facts.materialMarkup);}
const wallHeightFactor=(h:number)=>h<24?1:h<=48?1.5:h<=72?2.2:3.2;

/** Public adapter: it deliberately returns neither engine lineItems nor trade
 * prices nor margin. One engine invocation owns all shared site-work floors. */
export function buildYardTakeoff(data:DeckData,model:YardModel=buildYardModel(data)){
 // Placed fire features are priced at the estimator's fire pit allowance below, never as site work here. Only a placed
 // (not excluded) one replaces the fire pit allowance; an excluded one is a builder quote line like any excluded feature.
 const fires=model.features.filter(f=>!f.excluded&&f.config.kind==='fire-feature'),excludedFires=model.features.filter(f=>f.excluded&&f.config.kind==='fire-feature'),active=model.features.filter(f=>!f.excluded&&!fires.includes(f)),patios=active.filter(f=>f.config.kind==='patio'&&!f.config.stoneSteps&&!f.config.stepAssembly),walls=active.filter(f=>f.config.kind==='retaining-wall'),water=active.filter(f=>f.config.kind==='water-feature');
 const warnings=[...model.warnings],unknown:PublicYardSection[]=[],materials:PublicYardMaterial[]=[];
 for(const f of model.features.filter(f=>f.excluded))unknown.push({id:`excluded-${f.config.id}`,label:`${f.config.name}: excluded layout needs revision`,amountCents:null,featureIds:[f.config.id],note:f.warnings.join(' ')||'This feature cannot be included in the current layout; revise its dimensions or position before quoting.'});
 for(const f of active)unknown.push(...(f.assemblyQuoteScopes??[]));
 const grouped=new Map<string,{area:number;ids:string[];feature:YardFeature;stockArea:number}>();
 for(const f of patios){const zones=f.pavingZones??[{feature:f.config,areaSqft:f.quantities.paverAreaSqft,stockAreaSqft:f.quantities.paverStockAreaSqft??f.quantities.paverAreaSqft}];for(const z of zones){const key=z.feature.productId+(z.feature.hardscape?':'+JSON.stringify(z.feature.hardscape):''),group=grouped.get(key)||{area:0,ids:[],feature:z.feature,stockArea:0};group.area+=z.areaSqft;group.stockArea+=z.stockAreaSqft;if(!group.ids.includes(f.config.id))group.ids.push(f.config.id);grouped.set(key,group);}}
 for(const [key,g]of grouped){const id=g.feature.productId,p=g.feature.hardscape?undefined:PAVER_BRANDS.find(p=>p.id===id);if(!p){const selected=hardscapeSelection(g.feature),label=selected?hardscapeName(g.feature):id;unknown.push({id:`unknown-${g.ids[0]}-${materials.length}`,label:`${label}: paving supply and installation`,amountCents:null,quantity:g.area,unit:'sq ft',featureIds:g.ids,note:'Selected paving stock, cuts, installation and freight unpriced; reconcile shared base/excavation already included.'});materials.push({productId:id,label,installedAreaSqft:g.area,orderAreaSqft:g.stockArea,skids:0,amountCents:null,featureIds:g.ids});continue;}
  const current=CARR_PAVER_TRADE_2026[id],pricedPaver=current?{...p,materialTradePerSqft:current.rate}:p;
  const takeoff=hardscapeTakeoff({sqft:g.area,paver:pricedPaver,shape:'simple',surface:'grass',element:'patio'}),line=takeoff.items.find(i=>i.id==='patio-material')!;
  materials.push({productId:id,label:`${p.brand} ${p.product}`,installedAreaSqft:g.area,orderAreaSqft:g.area*CARR_TRADE.waste.standard,skids:takeoff.quantities.skids,amountCents:line.retailCents,featureIds:g.ids});
 }
 // The priced parent assembly owns the complete shared footprint even when an accent's supply needs a quote.
 const knownArea=patios.filter(f=>!f.config.hardscape&&PAVER_BRANDS.some(p=>p.id===f.config.productId)).reduce((n,f)=>n+f.quantities.areaSqft,0),referencePaver=PAVER_BRANDS.find(p=>materials.some(m=>m.productId===p.id&&m.amountCents!==null))||PAVER_BRANDS[0];
 for(const f of patios)for(const i of f.config.inlays??[]){const zone=f.pavingZones?.find(z=>z.inlayId===i.id);unknown.push({id:`patio-inlay-${f.config.id}-${i.id}`,label:zone?`${f.config.name}: ${i.name} custom inlay cutting and setting`:`${f.config.name}: ${i.name} excluded layout needs revision`,amountCents:null,quantity:zone?.areaSqft??1,unit:zone?'sq ft':'design review',featureIds:[f.config.id],note:zone?'Inlay supply separate; quote custom cutting/setting, fabrication and transitions. Shared base counted once.':'Inlay excluded from geometry/quantities; revise position, overlap or stock thickness before quoting.'});}
 const knownWalls=walls.filter(f=>['segmental-concrete','armour-stone'].includes(f.config.productId));

 for(const f of walls)unknown.push(...wallQuoteScopes(f,knownWalls.includes(f)));
 for(const f of walls.filter(f=>f.config.baseElevationIn))unknown.push({id:`wall-elevation-${f.config.id}`,label:`${f.config.name}: elevation grading and containment`,amountCents:null,featureIds:[f.config.id],quantity:Math.abs(f.config.baseElevationIn!),unit:'in grade change',note:'Quote elevation-derived excavation/fill, compaction, containment and drainage; reconcile shared site work.'});
 for(const f of water)for(const [suffix,label,quantity,unit]of [['water-system','Water feature, basin, pump and filtration',1,'assembly'],['liner','Liner and underlay',f.quantities.linerSqft,'sq ft'],['rock','Selected rock and finishing',f.quantities.rockPieces,'modeled pieces']] as const)unknown.push({id:`${f.config.id}-${suffix}`,label:`${f.config.name}: ${label}`,amountCents:null,quantity,unit,featureIds:[f.config.id],note:'Water-system selection, installation and electrical unpriced.'});
 if(model.quantities.raisedFillYd3>.001)unknown.push({id:'yard-raised-fill',label:'Additional engineered fill and containment',amountCents:null,quantity:model.quantities.raisedFillYd3,unit:'cu yd',note:'Extra fill below patio base; supply/installation unpriced.'});
 if((model.quantities.edgeCourseLf??0)>0)yardTakeoffRuntime().edgeCourse(model,patios,unknown);
 if(patios.some(f=>(f.quantities.guardLf??0)>0))yardTakeoffRuntime().patioGuard(patios,unknown);
 const equivalentWallLf=knownWalls.reduce((n,f)=>n+f.quantities.wallLengthLf*wallHeightFactor(f.config.heightIn),0);
 const input:EstimateInput={projectType:'full',selectedElements:[...(knownArea>0?['patio']:[]),...(equivalentWallLf>0?['wall']:[])],sizes:{patio:knownArea,wall:equivalentWallLf,wallHeight:'Under 2ft'},details:{'patio.surface':'grass','patio.shape':'simple','wall.wallPurpose':'garden'},conditions:{access:data.siteType==='Urban Tight',slope:Math.abs(model.terrain.slopePct)>0||data.siteType==='Hillside',drainage:data.soilCondition==='Clay'},location:data.municipality==='Barrie'?'barrie':'other',tier:'mid',paverBrandId:referencePaver.id,deckBrandId:'',addOns:[]};
 if(knownArea>0){warnings.push('Carr May 2026 standard-colour/full-bundle benchmark. Confirm selected colour, bundles/split fees, fuel and delivery zone.');unknown.push({id:'paver-order-confirmation',label:'Paver packaging, colour and freight adjustments (supplier quote)',amountCents:null,note:'Standard-colour/Zone 1 benchmarks included; quote colour, bundles/split fees, fuel and actual-address adjustments.'});}
 if(active.length&&data.municipality!=='Barrie')warnings.push('Delivery uses Barrie Zone 1 plus location allowance until actual address/zone is confirmed.');
 if(knownWalls.length)warnings.push('Walls use a mid-tier height-adjusted assembly allowance, not a selected unit price. Supply/system engineering unconfirmed.');
 if(water.length)warnings.push('Water excavation included in shared disposal; excavation labour/equipment, rock delivery and construction unpriced.');
 const engine=computeEstimate(input),precise=engine.precise;
 // Fire pit, kitchen, turf and lighting: each is what the site's cost estimator adds for it on this backyard (the
 // same engine re-run with the item added, as the estimator's own price hints do), in a fixed order so the shared
 // site-work minimums are charged once. Walls and patios keep the figures above; the finish tier is held on both
 // sides of each difference so it never moves a wall.
 const finish=data.yardAllowances?.finish??'mid',finishLabel=ALLOWANCE_FINISHES.find(f=>f.id===finish)!.label,allowances:PublicYardSection[]=[];
 const priced=(i:EstimateInput)=>computeEstimate(i).precise?.subtotalCents??0;
 let prefix:EstimateInput={...input,tier:finish};
 // A placed fire feature takes the fire pit's place (and price) in this order: the chosen fire pit allowance is then
 // not charged as well. The estimator has one fire pit, so any further fire feature is a builder quote line. A gas
 // feature's gas line follows it as its own row (yardTakeoffRuntime.ts fireAllowance).
 for(const listed of allowanceItems(fires.length&&data.yardAllowances?{...data.yardAllowances,firePit:'none'}:data.yardAllowances,fires[0]?.config)){
  const fire=listed.featureId?yardTakeoffRuntime().fireAllowance(listed,fires[0].config):undefined,item=fire?.item??listed;
  const next:EstimateInput={...prefix,selectedElements:[...prefix.selectedElements,item.id],sizes:{...prefix.sizes,...item.sizes},details:{...prefix.details,...item.details}};
  const cents=priced(next)-priced(prefix),first=prefix.selectedElements.length===0;
  allowances.push({...(item.featureId?{featureIds:[item.featureId]}:{}),id:item.featureId?`fire-feature-${item.featureId}`:`allowance-${item.id}`,label:`${item.label} (estimator allowance)`,amountCents:cents>0?cents:null,...(item.quantity?{quantity:item.quantity,unit:item.unit}:{}),note:cents>0?`Site estimator allowance${item.usesFinish?` (${finishLabel} finish)`:''}: a planning allowance, not a quote; chosen product/site price unconfirmed.${first?" Includes one-time site work: minimum excavation/restoration/crew and site conditions once.":''}`:'The estimator has no allowance for this here; builder quote required.'});
  if(fire)allowances.push(...fire.rows);
  prefix=next;
 }
 if(fires.length||excludedFires.length)yardTakeoffRuntime().fires(fires,excludedFires,data,unknown,warnings);
 if(allowances.some(a=>!a.featureIds))warnings.push("Fire pit/kitchen/turf/lighting use planning allowances. Not drawn in 3D; confirm placement and price at site visit.");
 const categories={excavation:precise?.perCategoryCents.excavation||0,materials:precise?.perCategoryCents.materials||0,labour:precise?.perCategoryCents.labour||0,disposal:0,restoration:precise?.perCategoryCents.restoration||0};
 const common=knownArea>0?hardscapeTakeoff({sqft:knownArea,paver:referencePaver,shape:'simple',surface:'grass',element:'patio'}):null;
 // Ground-fit banks round patios (yardTakeoffRuntime.ts banks): a bank rate the owner has set prices that part on its
 // own line and takes it out of the hauling/bins and grading-fill quantities (em), so nothing is charged twice.
 const cf=model.siteCutFill,bank=cf&&(cf.bankCutYd3||cf.bankFillYd3||cf.bankAreaSqft)?yardTakeoffRuntime().banks(model):undefined,em=bank?.model??model,eq=em.quantities;
 const poolEarthwork=poolPricedEarthwork(data,em);
 const measuredWork=active.length>0||!!poolEarthwork||!!data.siteModel&&(model.quantities.sharedExcavationYd3>.001||(model.quantities.siteEarthworkFillYd3??0)>.001||!model.siteEarthwork?.complete);
 const fillDemand=eq.backfillYd3+eq.raisedFillYd3+(eq.siteEarthworkFillYd3??0),yardBank=eq.excavationYd3,sharedBank=eq.sharedExcavationYd3??yardBank;
 const physicalEarthwork=yardEarthworkPlan(sharedBank,fillDemand,data.yardEarthwork),pricedYardEarthwork=poolEarthwork??yardEarthworkPlan(yardBank,fillDemand,data.yardEarthwork),earthwork={...physicalEarthwork,pricedYardBins:pricedYardEarthwork.bins,yardBankYd3:yardBank,deckFoundationBankYd3:model.quantities.deckFoundationExcavationYd3??0};
 const foundationReconciliation=physicalEarthworkReconciliation(model);if(foundationReconciliation)unknown.push(foundationReconciliation);
 if(measuredWork&&!earthwork.haulingInputsComplete)unknown.push({id:'yard-hauling-review',label:'Soil reuse, loose spoil and hauling confirmation',amountCents:null,quantity:earthwork.exportBankYd3,unit:'cu yd bank soil to export',note:`Missing site/hauler inputs: ${earthwork.missingInputs.map(i=>i.label).join(', ')}. Disposal floor included once; costs cannot provide site values. Confirm reuse/access/trucking.`});
 if(measuredWork){const row=poolEarthwork?poolEarthwork.haulingSection:{id:'yard-hauling-cost',label:'Hauling and disposal price adjustments',amountCents:null,quantity:earthwork.bins,unit:'planning bins',note:'Disposal benchmark included once; quote only added swell/payload, haul/tipping/access and reuse charges above its planning floor.'};if(row)unknown.push(row);}
 if(measuredWork&&!knownArea&&!knownWalls.length&&!poolEarthwork)unknown.push({id:'yard-excavation-equipment',label:'Shared excavation, access and equipment installation',amountCents:null,quantity:eq.excavationYd3,unit:'cu yd bank excavation',note:'Supplier-only layout: shared excavation/equipment, access/base preparation and restoration unpriced. Coordinate once with deck/site scope; disposal/material placement separate.'});
 if((eq.siteEarthworkFillYd3??0)>.001)unknown.push({id:'site-grading-fill',label:'Proposed grading fill and compaction',amountCents:null,quantity:eq.siteEarthworkFillYd3,unit:'cu yd',note:'Residual proposed fill outside feature backfill and patio engineered fill. Reuse is allocated once; confirm approved fill, compaction, placement and supplier rates.'+(bank?.fillNote??'')});
 bank?.cut(unknown);
 if(model.siteEarthwork&&!model.siteEarthwork.complete)unknown.push({id:'site-coverage-review',label:'Unsurveyed earthwork — field elevations required',amountCents:null,quantity:model.siteEarthwork.uncoveredGradingAreaSqft,unit:'sq ft',note:'Missing elevation coverage remains unmeasured. Complete the survey before excavation quantities can be finalized.'});
 const landscape=landscapeTakeoff(data.landscapeObjects??[],data);warnings.push(...landscape.warnings);
 unknown.push(...landscapeQuoteSections(data.landscapeObjects??[],landscape));
 const skids=materials.reduce((n,p)=>n+p.skids,0),edgePieces=Math.ceil(model.quantities.patioPerimeterLf/8),bins=earthwork.bins;
 if(common){
  const old=(id:string)=>common.items.find(i=>i.id===id)?.retailCents||0;
  const paverCents=materials.reduce((n,p)=>n+(p.amountCents||0),0),edgeCents=Math.round(c(edgePieces*CARR_TRADE.consumables.snapEdgePer8ftPiece)*baseline.facts.materialMarkup);
  categories.materials+=paverCents-old('patio-material')+edgeCents-old('edge-restraint')+palletDelivery(materials)-old('delivery-pallets');
 }
 categories.disposal=c(earthwork.pricedYardBins*BIN_COST);
 const sections:PublicYardSection[]=[];
 if(measuredWork){
  for(const [id,label]of [['excavation','Shared excavation and base installation'],['materials','Paving materials, wall allowances and shared delivery'],['labour','Installation labour'],['disposal','Shared excavation disposal'],['restoration','Shared site restoration']] as const)if(categories[id]>0)sections.push({id:`yard-${id}`,label,amountCents:categories[id],...(id==='disposal'?{quantity:earthwork.pricedYardBins,unit:'bins',note:'Yard-owned excavation disposal benchmark excludes already allowanced deck foundation scope; no per-feature bin minimum. Confirm swell/reuse and usable bin volume/payload.'}:{})});
 }
 // Priced bank rows (never a $0 line).
 const banks=bank?.rows??[];
 sections.push(...banks,...allowances,...unknown);
 const knownSubtotalCents=Object.values(categories).reduce((n,v)=>n+v,0)+[...banks,...allowances].reduce((n,a)=>n+(a.amountCents??0),0),knownHstCents=Math.round(knownSubtotalCents*baseline.facts.hstRate),quoteRequired=unknown.length>0||allowances.some(a=>a.amountCents===null);
 const floorTopUpCents=common&&!knownWalls.length&&!Object.values(input.conditions).some(Boolean)?Math.max(0,categories.excavation+categories.labour-common.excavationRetailCents-common.installRetailCents):null;
 return {sections,materials,earthwork,landscape,warnings,quoteRequired,knownSubtotalCents,knownHstCents,knownGrandTotalCents:knownSubtotalCents+knownHstCents,subtotalCents:quoteRequired?null:knownSubtotalCents,hstCents:quoteRequired?null:knownHstCents,grandTotalCents:quoteRequired?null:knownSubtotalCents+knownHstCents,quantities:{...model.quantities,polySandBags:common?.quantities.polySandBags||0,fabricRolls:common?.quantities.fabricRolls||0,aggregateTonnes:common?.quantities.aggregateTonnes||0,deliveryLoads:common?.quantities.deliveryLoads||0,edgePieces,skids,bins},sharedSiteWorkCount:input.selectedElements.length||allowances.length?1:0,sharedSiteWork:{floorTopUpCents,note:'Shared crew/excavation floors once; no extra mobilization. Mixed wall/site-condition top-up inseparable; coordinate deck scope.'},wallAllowance:{equivalentLinearFeet:equivalentWallLf,description:'Existing estimator mid-tier height-adjusted assembly allowance; not a unit-material quotation.'}};
}
export type YardTakeoff=ReturnType<typeof buildYardTakeoff>;
