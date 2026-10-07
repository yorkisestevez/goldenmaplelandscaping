import assert from 'node:assert/strict';
import type {YardFeature} from '../src/features/deckcraft/types';
import {stepShapeContext,resizeStepSide,wrapStepCorner} from '../src/features/deckcraft/designer/stepShapeEdits';
import {buildStepAssemblyModel,validateStepAssembly} from '../src/features/deckcraft/stepAssemblyRuntime';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ConstructionPlan from '../src/features/deckcraft/ConstructionPlan';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
const f:YardFeature={id:'steps',name:'Steps',kind:'patio',enabled:true,xFt:25,zFt:12,widthFt:4,depthFt:8,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#b8b5ae',finishedElevationIn:24,stoneSteps:{lowerElevationIn:0,riserCount:4,treadRunIn:24,stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:0,productName:'Recorded step stock',support:{kind:'full-step',courses:[0,1,2,3]}}};
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let checks=0;
for(const rotation of [0,37,90,180])for(const side of [-1,1] as const){
 const c=stepShapeContext({...f,rotationDeg:rotation})!;
 for(const width of [60,84]){
  const resized=resizeStepSide(c,side,side*(width-24)),r=stepShapeContext(resized)!;
  assert.equal(r.flight.widthIn,width);const anchor=c.world(-side*24,0),after=r.world(-side*width/2,0);near(anchor.x,after.x);near(anchor.y,after.y);
  assert.deepEqual(r.assembly.tread,c.assembly.tread);assert.equal(r.flight.upperElevationIn,24);assert.equal(r.flight.runIn,24);
  validateStepAssembly(resized,resized.stepAssembly);
  const quantities=buildStepAssemblyModel(resized,undefined,{x:0,z:0,constant:0}).quantities;
  assert.equal(quantities.stoneStepPieces,8);near(quantities.stoneStepAreaSqft,width*96/144);
  for(const corner of ['left','right'] as const){const wrap=wrapStepCorner(r,corner),w=stepShapeContext(wrap)!;validateStepAssembly(wrap,wrap.stepAssembly);assert.deepEqual(w.flight.wrapSides,['back',corner]);const edge=r.world(0,r.depth/2),wrappedEdge=w.world(0,-w.flight.wrapDepthIn/2);near(edge.x,wrappedEdge.x);near(edge.y,wrappedEdge.y);const model=buildStepAssemblyModel(wrap,undefined,{x:0,z:0,constant:0});assert.equal(model.conflicts.length,0);assert(model.quantities.stoneStepAreaSqft>quantities.stoneStepAreaSqft);const both=wrapStepCorner(w,corner==='left'?'right':'left');assert.equal(both.stepAssembly!.flights[0].wrapSides.length,3);checks++;}
  checks++;
 }
 assert.equal(resizeStepSide(c,side,side*9000).stepAssembly!.flights[0].widthIn,720);
 assert.equal(resizeStepSide(c,side,-side*9000).stepAssembly!.flights[0].widthIn,12);
}
for(const family of ['manufactured','natural-stone','cap-block'] as const){const c=stepShapeContext(f)!;c.assembly.family=family;if(family==='cap-block')c.assembly.riser={...c.assembly.tread,thicknessIn:2};const wider=resizeStepSide(c,1,60);assert.equal(wider.stepAssembly!.family,family);validateStepAssembly(wider,wider.stepAssembly);checks++;}
const drawing={...DEFAULT_DECK,yardFeatures:[wrapStepCorner(stepShapeContext(f)!,'left')]};
await ensureLiveDesignExtensions(drawing);
const markup=renderToStaticMarkup(createElement(ConstructionPlan,{data:drawing,model:buildDeckTakeoff(drawing),yard:buildYardModel(drawing),variant:'site'}));
assert(markup.includes('data-step-surface="steps"'));checks++;
console.log(`${checks} stair control scenarios passed: width, anchored side, rotations, both wraps, stock, elevations, quantities, bounds and visible plan surfaces.`);
