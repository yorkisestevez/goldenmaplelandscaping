import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';

let checks=0;
const close=(a:number,b:number,label:string)=>assert(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const check=(label:string,fn:()=>void)=>{try{fn();checks++;}catch(cause){throw new Error(label,{cause});}};
const base:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Attached',houseVisible:true,width:17,length:12,height:36,deckingMaterial:'tt_landmark',deckingColor:'French White Oak',pictureFrameRows:1,pictureFrameOverhangIn:.5,railingType:'Glass Panels',soilCondition:'Sandy',yardFeatures:[],terrainConfig:{widthFt:120,depthFt:120,elevationIn:0,slopePct:0}};
const feature=(id:string,xFt:number,zFt:number,patch:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt,zFt,widthFt:12,depthFt:10,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#aaa69b',...patch});
const patio=feature('patio',30,25),wall=feature('wall',34,35,{kind:'retaining-wall',productId:'segmental-concrete',widthFt:12,depthFt:1,heightIn:24}),pond=feature('pond',20,32,{kind:'water-feature',productId:'pond',widthFt:4,depthFt:4,heightIn:24});
const deckOnly=calculateEstimate(base,DECK_SETTINGS);
const pricedData={...base,yardFeatures:[patio]},priced=calculateEstimate(pricedData,DECK_SETTINGS);
function taxOnce(estimate:ReturnType<typeof calculateEstimate>){
  const tax=estimate.sections.filter(s=>s.title==='HST (13%)');assert.equal(tax.length,1);
  close(estimate.subtotal,estimate.sections.filter(s=>s!==tax[0]).reduce((n,s)=>n+s.total,0),'all pre-tax sections exactly once');
  close(estimate.hst,estimate.subtotal*.13,'single project HST');close(tax[0].total,estimate.hst,'tax section');
  close(estimate.total,estimate.subtotal+estimate.hst,'grand total');close(estimate.total,estimate.sections.reduce((n,s)=>n+s.total,0),'rendered sections reconcile');
  assert.equal(estimate.materialList.filter(i=>i.item==='HST').length,1);
}
check('yard priced subtotal joins deck before one HST calculation',()=>{
  assert(priced.yardTakeoff.knownSubtotalCents>0);close(priced.subtotal-deckOnly.subtotal,priced.yardTakeoff.knownSubtotalCents/100,'yard amount is pre-tax');
  close(priced.total-deckOnly.total,priced.yardTakeoff.knownSubtotalCents/100*1.13,'yard tax not reapplied to gross adapter total');taxOnce(priced);
  close(priced.sections.filter(s=>s.title.startsWith('Yard ·')).reduce((n,s)=>n+s.total,0),priced.yardTakeoff.knownSubtotalCents/100,'yard sections not duplicated');
});
const combinedData={...base,yardFeatures:[patio,wall,pond]},combined=calculateEstimate(combinedData,DECK_SETTINGS);
check('known amounts and unpriced systems remain separate in combined estimate',()=>{
  taxOnce(combined);close(combined.subtotal-deckOnly.subtotal,combined.yardTakeoff.knownSubtotalCents/100,'only known yard portion added');
  const unknown=combined.yardTakeoff.sections.filter(s=>s.amountCents===null);assert(unknown.length>0);
  for(const row of unknown){assert(combined.quoteRequired.includes(row.label));const section=combined.sections.find(s=>s.title===`Yard · ${row.label}`)!;assert(section.quoteRequired);assert.equal(section.total,0);assert(section.items.every(i=>i.cost===null),'unpriced supply is null, never a zero-cost product');}
});
check('disabled yard features cause neither charges nor exported geometry',()=>{
  const disabledData={...combinedData,yardFeatures:combinedData.yardFeatures.map(f=>({...f,enabled:false}))},disabled=calculateEstimate(disabledData,DECK_SETTINGS);
  assert.equal(disabled.subtotal,deckOnly.subtotal);assert.equal(disabled.hst,deckOnly.hst);assert.equal(disabled.total,deckOnly.total);
  assert.equal(disabled.yardTakeoff.knownSubtotalCents,0);assert.equal(disabled.yardModel.boxes.length,0);assert.equal(disabled.yardModel.members.length,0);
  assert(!disabled.sections.some(s=>s.title.startsWith('Yard ·')));assert.deepEqual(deckExportMeshes(disabledData,disabled.model),deckExportMeshes(base,deckOnly.model));
});
check('house appearance and openings do not alter combined construction price',()=>{
  const house=getHouseConfig(combinedData),houseConfig={...house,storeys:2 as const,roofShape:'Hip' as const,roofFinish:'Metal' as const,roofColor:'#304050',cladding:'Brick' as const,claddingColor:'#a35a42',trimColor:'#ffffee',openings:house.openings.map(o=>({...o,offsetPct:o.offsetPct+2}))};
  const changedData={...combinedData,houseConfig},changed=calculateEstimate(changedData,DECK_SETTINGS);assert.equal(changed.subtotal,combined.subtotal);assert.equal(changed.total,combined.total);assert.deepEqual(changed.yardTakeoff.quantities,combined.yardTakeoff.quantities);
  assert.notDeepEqual(deckExportMeshes(changedData,changed.model).filter(m=>m.name.startsWith('house_')),deckExportMeshes(combinedData,combined.model).filter(m=>m.name.startsWith('house_')),'appearance edit changes actual house export');
});
check('combined exports include the same yard parts used by the estimate and house solids',()=>{
  const meshes=deckExportMeshes(combinedData,combined.model),byName=new Map(meshes.map(m=>[m.name,m]));assert(meshes.some(m=>m.name.startsWith('house_')));
  assert.equal(meshes.filter(m=>m.name.startsWith('yard_')).length,combined.yardModel.boxes.length+combined.yardModel.members.length);
  for(const part of combined.yardModel.boxes){const mesh=byName.get(`yard_${part.id}`)!;assert(mesh,part.id);for(const p of part.polygon??[])assert(mesh.vertices.some(v=>Math.abs(v.x-p.x)<1e-6&&Math.abs(v.z-p.y)<1e-6),`actual clipped yard vertex exported: ${part.id}`);}
});
check('calculateEstimate and exports use deck-aware patio support cut-outs',()=>{
  const highData={...base,deckType:'Freestanding' as const,houseVisible:false,height:60,yardFeatures:[]},high=calculateEstimate(highData,DECK_SETTINGS),post=high.model.levels[0].supports[0];
  const under=feature('under-deck',post.x/12,post.z/12,{widthFt:10,depthFt:10}),data={...highData,yardFeatures:[under]},estimate=calculateEstimate(data,DECK_SETTINGS),unchecked=buildYardModel(data);
  assert(estimate.yardModel.deckClearance.checked);assert(!unchecked.deckClearance.checked);assert(estimate.yardModel.quantities.patioAreaSqft>0&&estimate.yardModel.quantities.patioAreaSqft<unchecked.quantities.patioAreaSqft);
  close(estimate.yardTakeoff.quantities.patioAreaSqft,estimate.yardModel.quantities.patioAreaSqft,'takeoff uses support-cut geometry');
  const meshes=new Map(deckExportMeshes(data,estimate.model).map(m=>[m.name,m]));for(const part of estimate.yardModel.boxes)for(const p of part.polygon??[])assert(meshes.get(`yard_${part.id}`)?.vertices.some(v=>Math.abs(v.x-p.x)<1e-6&&Math.abs(v.z-p.y)<1e-6),'export rebuild must retain deck support cut-outs');
});
check('paver-budget exclusion propagates to a pending quote, not a complete cheap project',()=>{
  const a=feature('budget-first',-60,80,{widthFt:60,depthFt:60,productId:'permacon-brooklyn'}),b=feature('budget-excluded',60,80,{widthFt:60,depthFt:60,productId:'permacon-brooklyn'});
  const estimate=calculateEstimate({...base,houseVisible:false,yardFeatures:[a,b]},DECK_SETTINGS),excluded=estimate.yardModel.features.find(f=>f.config.id===b.id)!;
  assert(estimate.yardModel.quoteRequired);assert(excluded.excluded&&excluded.quoteRequired);assert.equal(excluded.exclusionReason,'paver-budget');assert.equal(excluded.boxes.length,0);assert.equal(excluded.quantities.paverAreaSqft,0);
  assert.equal(estimate.yardModel.quantities.patioAreaSqft,3600);assert(!estimate.yardTakeoff.materials.some(m=>m.featureIds.includes(b.id)));assert.equal(estimate.yardTakeoff.subtotalCents,null);
  const row=estimate.yardTakeoff.sections.find(s=>s.featureIds?.includes(b.id)&&s.amountCents===null)!;assert(row);assert(estimate.quoteRequired.includes(row.label));assert(estimate.sections.some(s=>s.title===`Yard · ${row.label}`&&s.quoteRequired&&s.items.every(i=>i.cost===null)));taxOnce(estimate);
});
const fixture={...combinedData,houseConfig:{...getHouseConfig(combinedData),storeys:2 as const,roofShape:'Hip' as const,cladding:'Brick' as const},customerName:'Combined design QA',scopeOfWork:'Deck, house context, patio, retaining wall and pond configuration for saved-design import verification.'};
check('versioned combined browser fixture round trips through the real persistence API',()=>{
  const json=serializeDesign(fixture),restored=parseDesign(json);assert.equal(JSON.parse(json).version,1);assert.equal(restored.width,17);assert.equal(restored.railingType,'Glass Panels');assert.equal(restored.yardFeatures?.length,3);assert(restored.houseConfig);assert.equal(serializeDesign(restored),json);
  const estimate=calculateEstimate(restored,DECK_SETTINGS);assert(estimate.yardModel.features.every(f=>!f.excluded),'QA fixture features are positioned safely');
  if(process.argv[2]){const path=resolve(process.argv[2]);writeFileSync(path,json);assert.equal(serializeDesign(parseDesign(readFileSync(path,'utf8'))),json);console.log(`Saved versioned browser fixture: ${path}`);}
});
console.log(`Combined deck/yard integration: ${checks} pricing, HST, exclusion, shared geometry and persistence checks passed.`);
