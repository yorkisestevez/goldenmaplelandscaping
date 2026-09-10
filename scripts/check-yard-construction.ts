import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {YardFeature,DeckData} from '../src/features/deckcraft/types';
import {buildYardModel,yardArea,yardClip,yardSolidCells,projectedYardPavers,YARD_PAVER_BUDGET} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {PAVER_BRANDS,CARR_TRADE,BIN_COST} from '../src/data/carrPrices';
import {hardscapeTakeoff} from '../src/utils/takeoff';
import {computeEstimate} from '../src/utils/estimateEngine';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
const feature=(id:string,x=0,z=0,w=10,d=10,productId=PAVER_BRANDS[0].id):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt:x,zFt:z,widthFt:w,depthFt:d,heightIn:0,rotationDeg:0,productId,color:'#aaa69b'});
const deck=(yardFeatures:YardFeature[],extra:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),deckType:'Freestanding',houseVisible:false,municipality:'Barrie',siteType:'Standard',soilCondition:'Sandy',terrainConfig:{widthFt:100,depthFt:100,elevationIn:0,slopePct:0},yardFeatures,...extra});
const close=(a:number,b:number,e=1e-4)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const first=feature('A'),second=feature('B',5);
const overlap=buildYardModel(deck([first,second]));close(overlap.quantities.patioAreaSqft,150);
assert(overlap.warnings.some(w=>w.includes('overlap resolved')));
for(let i=0;i<overlap.excavationRegions.length;i++)for(let j=i+1;j<overlap.excavationRegions.length;j++)close(yardArea(yardClip([overlap.excavationRegions[i].polygon],[overlap.excavationRegions[j].polygon],'intersection')),0);
const disabled=buildYardTakeoff(deck([{...first,enabled:false}]));assert.equal(disabled.knownSubtotalCents,0);assert.equal(disabled.sharedSiteWorkCount,0);assert.equal(disabled.quantities.bins,0);
const adjacent=buildYardTakeoff(deck([feature('A',-5),feature('B',5)])),single=buildYardTakeoff(deck([feature('C',0,0,20,10)]));assert.equal(adjacent.knownSubtotalCents,single.knownSubtotalCents);assert.equal(adjacent.sharedSiteWorkCount,1);
const mixed=buildYardTakeoff(deck([feature('A',-5),feature('B',5,0,10,10,PAVER_BRANDS[1].id)]));assert.equal(mixed.materials.length,2);assert.equal(mixed.quantities.skids,4);
for(const p of mixed.materials){const source=hardscapeTakeoff({sqft:p.installedAreaSqft,paver:PAVER_BRANDS.find(q=>q.id===p.productId)!,element:'patio',shape:'simple',surface:'grass'});assert.equal(p.amountCents,source.items.find(i=>i.id==='patio-material')!.retailCents);}
assert.equal(mixed.sections.filter(s=>s.id==='yard-disposal').length,1);assert.equal(mixed.sections.find(s=>s.id==='yard-disposal')!.amountCents,mixed.quantities.bins*BIN_COST*100);
const pond={...feature('pond',0,0,4,4,'pond'),kind:'water-feature' as const,heightIn:24},withHole=buildYardModel(deck([feature('patio',0,0,20,20),pond]));close(withHole.quantities.patioAreaSqft,375);
const waterFootprint=withHole.features.find(f=>f.config.id==='pond')!.footprints;
for(const b of withHole.boxes.filter(b=>b.role==='paver'))close(yardArea(yardClip([b.polygon!],waterFootprint,'intersection')),0);
assert.equal(buildYardTakeoff(deck([pond])).subtotalCents,null);
const conflicting=buildYardModel(deck([pond,{...pond,id:'pond2'}]));assert.equal(conflicting.features.filter(f=>f.excluded).length,1);
const holes=[[{x:0,y:0},{x:120,y:0},{x:120,y:120},{x:0,y:120}],[{x:30,y:30},{x:30,y:90},{x:90,y:90},{x:90,y:30}]];close(yardArea(yardSolidCells(holes)),75);
const wall={...feature('wall',0,0,16,1,'segmental-concrete'),kind:'retaining-wall' as const,heightIn:30},wallModel=buildYardModel(deck([wall]));assert(wallModel.quantities.wallBlocks>0&&wallModel.quantities.wallCaps>0);assert(wallModel.members.some(m=>m.role==='drain-pipe'));
const flat=buildYardModel(deck([first])),slope=buildYardModel(deck([first],{terrainConfig:{widthFt:100,depthFt:100,elevationIn:0,slopePct:10}}));close(flat.quantities.excavationYd3,slope.quantities.excavationYd3);
const raised=buildYardTakeoff(deck([{...first,heightIn:36}]));assert(raised.quantities.raisedFillYd3>0);assert.equal(raised.quantities.excavationYd3,0);assert(raised.quoteRequired);
const houseCollision=buildYardModel(deck([{...first,xFt:5,zFt:-3}],{deckType:'Attached',houseVisible:true}));assert(houseCollision.quantities.patioAreaSqft<100);assert(houseCollision.warnings.some(w=>w.includes('house footprint')));
const fountain=buildYardModel(deck([{...pond,productId:'fountain',heightIn:60}]));assert.equal(fountain.features[0].quantities.basinDepthIn,24);assert(fountain.boxes.some(b=>b.role==='rock'&&b.h===60));
assert(buildYardTakeoff(deck([wall])).quoteRequired);
const deckData=deck([],{width:12,length:12,height:60,levels:1,stairFlights:1,stairType:'Straight'}),deckModel=buildDeckTakeoff(deckData),support=deckModel.levels[0].supports[0];
const underDeck=feature('under-deck',support.x/12,support.z/12),supportedData={...deckData,yardFeatures:[underDeck]},cutPatio=buildYardModel(supportedData,deckModel);
assert(cutPatio.quantities.patioAreaSqft>0&&cutPatio.quantities.patioAreaSqft<100,'Patio remains valid beneath raised deck, with support cut-outs');
assert(cutPatio.deckClearance.checked);assert.equal(buildYardModel(supportedData).deckClearance.checked,false,'No implicit deck rebuild');
for(const b of cutPatio.boxes.filter(b=>b.role==='paver'||b.role==='base'))close(yardArea(yardClip([b.polygon!],cutPatio.features[0].supportClearances!,'intersection')),0);
close(buildYardTakeoff(supportedData,cutPatio).quantities.patioAreaSqft,cutPatio.quantities.patioAreaSqft);
for(const kind of ['retaining-wall','water-feature'] as const){const conflict=buildYardModel({...deckData,yardFeatures:[{...underDeck,kind,productId:kind==='retaining-wall'?'segmental-concrete':'pond',heightIn:30}]},deckModel);assert(conflict.features[0].excluded);assert(conflict.warnings.some(w=>w.includes('deck footing or support post')));}
const lastTread=deckModel.treads.at(-1)!,stairConflict=buildYardModel({...deckData,yardFeatures:[{...pond,productId:'fountain',xFt:lastTread.x/12,zFt:lastTread.z/12,heightIn:60}]},deckModel);assert(stairConflict.features[0].excluded);assert(stairConflict.warnings.some(w=>w.includes('deck stair tread')));
const highGrade=buildYardModel({...deckData,terrainConfig:{widthFt:100,depthFt:100,elevationIn:80,slopePct:2}},deckModel);assert(highGrade.deckClearance.minStairClearanceIn!<0);assert(highGrade.warnings.some(w=>w.includes('covers a deck stair walking surface')));
let cases=0;
for(const p of PAVER_BRANDS)for(const rotationDeg of [0,27,90]){const model=buildYardModel(deck([{...first,productId:p.id,rotationDeg},wall,pond]));for(const b of model.boxes){assert([b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite));assert(b.w>0&&b.h>0&&b.d>0);assert(b.polygon&&yardArea([b.polygon])>0);}assert(Number.isFinite(model.quantities.excavationYd3));cases++;}
// The locked reference job keeps its current price; only shared geometric
// quantities, never source rates, may move other job totals.
const refProduct=PAVER_BRANDS.find(p=>p.id==='permacon-mondrian-plus')!,size=Math.sqrt(500),ref=buildYardTakeoff(deck([feature('ref',0,0,size,size,refProduct.id)]));
const source=computeEstimate({projectType:'full',selectedElements:['patio'],sizes:{patio:500},details:{'patio.shape':'simple','patio.surface':'grass'},conditions:{},location:'barrie',tier:'mid',paverBrandId:refProduct.id,deckBrandId:'',addOns:[]});assert.equal(ref.knownSubtotalCents,source.precise!.subtotalCents);
assert.equal(CARR_TRADE.waste.standard,1.1);
const publicText=JSON.stringify(ref);assert(!publicText.includes('tradeCents')&&!publicText.includes('marginPct')&&!publicText.includes('unitTrade'));
const big=feature('big-brooklyn',0,0,60,60,'permacon-brooklyn');
assert.equal(projectedYardPavers(big),19400,'A single sixty-foot Brooklyn patio remains usable');
const oversized=buildYardModel(deck([{...big,widthFt:100,depthFt:100}]));assert(oversized.quoteRequired);assert.equal(oversized.boxes.length,0);assert.equal(oversized.quantities.patioAreaSqft,0);assert.equal(oversized.excavationRegions.length,0);assert.equal(oversized.features[0].exclusionReason,'paver-budget');
const manyLarge=buildYardModel(deck(Array.from({length:20},(_,i)=>({...big,id:`big-${i}`,xFt:i*100}))));
assert(!manyLarge.features[0].excluded);assert.equal(manyLarge.features[0].quantities.paverPieces,19400);assert.equal(manyLarge.features.filter(f=>f.excluded).length,19);assert.equal(manyLarge.paverBudget.reservedPieces,19400);assert.equal(manyLarge.paverBudget.remainingPieces,600);assert(manyLarge.quantities.paverPieces<=YARD_PAVER_BUDGET);assert(manyLarge.quoteRequired);
for(const f of manyLarge.features.filter(f=>f.excluded)){assert(f.quoteRequired);assert.equal(f.boxes.length,0);assert.equal(f.footprints.length,0);assert.equal(f.quantities.paverAreaSqft,0);}
assert.equal(buildYardModel(deck([{...big,enabled:false}])).paverBudget.reservedPieces,0);
console.log(`Yard model/takeoff passed: overlap union, hole clipping, excavation deduplication, mixed products, shared floors/deliveries/bins, disabled features, source price parity and ${cases} finite geometry scenarios.`);
