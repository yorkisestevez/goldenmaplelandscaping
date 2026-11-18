import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {validateDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink} from '../src/features/deckcraft/designLink';
import {exportProjectBundle,importProjectBundle} from '../src/features/deckcraft/projectBundle';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
const dir=resolve('../../outputs/advanced-step-editor');await mkdir(dir,{recursive:true});const reviews=[];
for(const name of ['modern-pool-lounge','ivory-plunge-garden']){
 const raw=JSON.parse(await readFile(resolve('../../outputs/stone-step-supports',name+'.raw.json'),'utf8'));await ensureLiveDesignExtensions(raw);const before=validateDesign(raw),beforeEstimate=calculateEstimate(before);
 let state:DeckAgentHostState={data:before,view:'3d',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;state={...state,data:next,canUndo:true};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:()=>Promise.resolve()});
 const steps=before.yardFeatures!.filter(f=>f.stoneSteps),request={id:name+'-convert-preview',expectedRevision:api.read().revision,commands:steps.map(f=>({type:'yard.stepConvert' as const,id:f.id}))};
 const preview=await api.preview(request);assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(commits,0);const applied=await api.execute({...request,id:name+'-convert-apply'});assert.equal(applied.ok,true,JSON.stringify(applied));assert.equal(commits,1);
 const estimate=calculateEstimate(state.data);assert.ok(estimate.yardModel.features.every(f=>!f.excluded));assert.equal(estimate.yardModel.quantities.stoneStepPieces,8);assert.equal(estimate.yardModel.quantities.stoneSupportStepPieces,12);assert.equal(estimate.subtotal,beforeEstimate.subtotal);assert.ok(Math.abs(estimate.yardModel.quantities.sharedExcavationYd3-beforeEstimate.yardModel.quantities.sharedExcavationYd3)<1e-7);
 for(const old of steps){const next=state.data.yardFeatures!.find(f=>f.id===old.id)!;assert.equal(next.finishedElevationIn,old.finishedElevationIn);assert.equal(next.stoneSteps,undefined);assert.equal(next.stepAssembly?.tread.thicknessIn,old.stoneSteps!.stockThicknessIn);}
 const bundle=await exportProjectBundle(state.data);const imported=await importProjectBundle(bundle);assert.deepEqual(imported.yardFeatures,JSON.parse(JSON.stringify(state.data.yardFeatures)));assert.deepEqual(imported.pools,JSON.parse(JSON.stringify(state.data.pools)));
 await writeFile(resolve(dir,name+'.deckcraft'),new Uint8Array(await bundle.arrayBuffer()));await writeFile(resolve(dir,name+'.raw.json'),JSON.stringify(state.data,null,2));await writeFile(resolve(dir,name+'.json'),serializeDesign(state.data));await writeFile(resolve(dir,name+'.url.txt'),(await encodeDesignLink(state.data,'http://127.0.0.1:4328')).replace('/deck-designer#','/deck-designer/#'));
 reviews.push({name,commits,fixedLevelsPreserved:true,geometryAndQuantitiesPreserved:true,pricedSubtotal:estimate.subtotal,sharedExcavationYd3:estimate.yardModel.quantities.sharedExcavationYd3,stock:estimate.yardModel.features.filter(f=>f.config.stepAssembly).map(f=>({id:f.config.id,quantities:f.quantities,stockSchedule:f.stockSchedule,warnings:f.warnings}))});api.dispose();console.log(name+': reviewed conversion applied once; 8 treads + 12 supports retained');
}
await writeFile(resolve(dir,'conversion-review.json'),JSON.stringify(reviews,null,2));
