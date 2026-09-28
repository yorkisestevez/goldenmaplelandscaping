import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {planSketchOf,generatePlanSketchDesign,planYardMeasurements,resizePlanYardSketch} from '../src/features/deckcraft/sketch/planSketch';
import {generateSketchDesign} from '../src/features/deckcraft/sketch/sketchToDesign';
import {parseSketchDocument,type SketchDocument,type SketchShape} from '../src/features/deckcraft/sketch/sketchTypes';
import {yardShapeWorldPoints,yardShapeRunIn} from '../src/features/deckcraft/yardShapeEditing';

let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const equal=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a:number,b:number,m:string)=>ok(Math.abs(a-b)<1e-7,m);
const clone=<T,>(v:T):T=>structuredClone(v);
const patio:YardFeature={id:'garden',kind:'patio',name:'Garden patio',enabled:false,xFt:8.125,zFt:29.25,widthFt:16,depthFt:12,heightIn:-2,rotationDeg:37,productId:'permacon-melville',color:'#aaa69b',outline:[{x:-96,y:-72},{x:0,y:-72},{x:96,y:-72},{x:96,y:72},{x:-96,y:72}],hardscape:{finishId:'finish',colorId:'colour',unitId:'unit',patternId:'pattern',capUnitId:'retained-cap',angleDeg:17.5,jointMm:3.25}};
const wall:YardFeature={...patio,id:'wall',name:'Garden wall',kind:'retaining-wall',enabled:true,widthFt:28,depthFt:.25,heightIn:24,rotationDeg:-19,productId:'segmental-concrete',outline:undefined,wallPath:[{x:-96,y:-72},{x:0,y:-72},{x:96,y:-72},{x:96,y:72}],hardscape:undefined};
const water:YardFeature={...wall,id:'water',kind:'water-feature',name:'Keep pond',widthFt:6,depthFt:6,wallPath:undefined,productId:'pond'};
const current:DeckData={...clone(DEFAULT_DECK),stairFlights:0,materialMarkup:43,customerName:'Retained customer',yardFeatures:[patio,wall,water],scopeOfWork:'Retained private scope'};
const baseline=planSketchOf(current).document;
const shape=(d:SketchDocument,id:string)=>d.shapes.find(s=>s.id===`plan-yard-${id}`)!;
function edited(change:(d:SketchDocument)=>void){const d=clone(baseline),before=JSON.stringify(current);change(d);const result=generatePlanSketchDesign(d,current,baseline);equal(JSON.stringify(current),before,'The source design never mutates');ok(result.ok,result.errors.join('; '));return {data:{...current,...result.patch},patch:result.patch!,result,d};}
function rejected(change:(d:SketchDocument)=>void){const d=clone(baseline);change(d);const result=generatePlanSketchDesign(d,current,baseline);ok(!result.ok,'An invalid edit is rejected');equal(result.patch,undefined,'Invalid edits expose no partial patch');}
function retained(data:DeckData,f:YardFeature){const next=data.yardFeatures!.find(v=>v.id===f.id)!;for(const key of ['id','kind','name','enabled','rotationDeg','productId','color','hardscape'] as const)equal(next[key],f[key],`Editing retains ${key}`);equal(data.yardFeatures!.find(v=>v.id==='water'),water,'Unsupported water geometry remains exact');for(const key of ['scopeOfWork','customerName','materialMarkup','boardLayout','railSections','privacyScreenSections','lightingSystem'] as const)equal(data[key],current[key],`Yard editing retains ${key}`);return next;}

equal(shape(baseline,'garden').points.length,5,'Seeded patio retains a collinear pull point');
equal(shape(baseline,'wall').points.length,4,'Seeded wall retains an added point');
equal(shape(baseline,'wall').drawing,'edge-path','Walls seed as open paths');
ok(!baseline.shapes.some(s=>s.id==='plan-yard-water'),'Water is preserved without inventing unsupported sketch geometry');
ok(planSketchOf(current).warnings.some(w=>w.includes('excluded')),'Excluded shapes have a clear source warning');
equal(parseSketchDocument(baseline).shapes.find(s=>s.id==='plan-yard-wall')!.points.length,4,'Parser does not remove wall pull points');
const noop=generatePlanSketchDesign(clone(baseline),current,baseline);ok(noop.ok,noop.errors.join('; '));equal(noop.patch,{},'No-op is exactly an empty patch');equal(calculateEstimate({...current,...noop.patch},DECK_SETTINGS),calculateEstimate(current,DECK_SETTINGS),'No-op preserves every price and quantity');
const labelled=edited(d=>{shape(d,'garden').label='View label';});equal(labelled.patch,{},'View labels never overwrite yard product metadata');

const moved=edited(d=>{shape(d,'garden').points=shape(d,'garden').points.map(p=>({x:p.x+12.125,y:p.y-7.5}));});const movedPatio=retained(moved.data,patio);near(movedPatio.xFt,patio.xFt+12.125/12,'Whole shape moves in exact world inches');near(movedPatio.zFt,patio.zFt-7.5/12,'Whole move follows world out direction');
const pulled=edited(d=>{const s=shape(d,'garden');s.points[3].x+=18.25;s.points[3].y+=12.5;Object.assign(s,planYardMeasurements(s,current));});const pulledPatio=retained(pulled.data,patio);equal(pulledPatio.outline!.length,5,'A pulled patio retains its collinear handle');yardShapeWorldPoints(patio).forEach((p,i)=>{const q=yardShapeWorldPoints(pulledPatio)[i];near(q.x,p.x+(i===3?18.25:0),'Only the selected point changes world X');near(q.y,p.y+(i===3?12.5:0),'Only the selected point changes world Y');});
const scaled=edited(d=>{const s=shape(d,'garden');Object.assign(s,resizePlanYardSketch(s,{widthFt:20,depthFt:15},current));});const scaledPatio=retained(scaled.data,patio);near(scaledPatio.widthFt,20,'Rotated patio measured width scales once');near(scaledPatio.depthFt,15,'Rotated patio measured depth scales once');
const measured=edited(d=>{shape(d,'garden').widthFt=20;shape(d,'garden').depthFt=15;});near(measured.data.yardFeatures![0].widthFt,scaledPatio.widthFt,'Measurement-only editing matches pre-scaled UI width');near(measured.data.yardFeatures![0].depthFt,scaledPatio.depthFt,'Measurement-only editing matches pre-scaled UI depth');
const raised=edited(d=>{shape(d,'garden').heightIn=4.125;});equal(raised.data.yardFeatures![0].outline,patio.outline,'Height changes do not resample polygon points');near(raised.data.yardFeatures![0].heightIn,4.125,'Patio elevation remains editable');
const longer=edited(d=>{const s=shape(d,'wall');Object.assign(s,resizePlanYardSketch(s,{widthFt:42,depthFt:1/12},current));});const longWall=retained(longer.data,wall);near(yardShapeRunIn(longWall.wallPath!)/12,42,'Wall dimensions scale the full open run, not its bounding box');near(longWall.depthFt,1/12,'Thin wall thickness is independent of path scaling');equal(longWall.wallPath!.length,4,'Wall resize preserves every open pull point');
const wallPull=edited(d=>{const s=shape(d,'wall');s.points[3].y+=10.25;Object.assign(s,planYardMeasurements(s,current));});const nextWall=retained(wallPull.data,wall);near(nextWall.widthFt,yardShapeRunIn(nextWall.wallPath!)/12,'Pulling an endpoint updates only total open run');near(nextWall.depthFt,wall.depthFt,'Endpoint pulls leave physical thickness unchanged');
const removed=edited(d=>{d.shapes=d.shapes.filter(s=>s.id!=='plan-yard-garden');});equal(removed.data.yardFeatures,[wall,water],'Removing one patio keeps all other feature records exact');

const deck=baseline.shapes.find(s=>s.id==='plan-deck-1')!,origin={x:deck.points[0].x,y:deck.points[0].y};
const addedPatio:SketchShape={id:'new-patio',kind:'patio',label:'New terrace',points:[{x:origin.x+240,y:origin.y+300},{x:origin.x+360,y:origin.y+300},{x:origin.x+360,y:origin.y+420},{x:origin.x+240,y:origin.y+420}],widthFt:10,depthFt:10,heightIn:0};
const addedWall:SketchShape={id:'new-wall',kind:'retaining-wall',label:'New wall',drawing:'edge-path',points:[{x:origin.x+240,y:origin.y+480},{x:origin.x+360,y:origin.y+480},{x:origin.x+360,y:origin.y+540}],widthFt:15,depthFt:.25,heightIn:18};
const additions=edited(d=>{d.shapes.push(addedPatio,addedWall);});equal(additions.data.yardFeatures!.slice(0,3),current.yardFeatures,'Adding yard shapes retains every original feature');near(additions.data.yardFeatures![3].widthFt,10,'New patio measured shape is represented');near(additions.data.yardFeatures![4].widthFt,15,'New L wall uses open length');equal(additions.data.yardFeatures![4].wallPath!.length,3,'New L wall has no invented closing segment');equal(additions.data.yardFeatures![4].id,'yard-new-wall','New feature IDs are stable from the sketch ID');
const sameAdded=edited(d=>d.shapes.push(addedPatio,addedWall));equal(sameAdded.patch,additions.patch,'Regeneration does not invent different feature IDs');
const reseed=planSketchOf(additions.data).document;equal(generatePlanSketchDesign(reseed,additions.data,reseed).patch,{},'New shapes round-trip back into sketch as exact no-ops');

rejected(d=>{const s=shape(d,'garden');s.points=[s.points[0],s.points[3],s.points[2],s.points[4]];});
rejected(d=>{const s=shape(d,'wall');s.points.push({...s.points[0]});});
rejected(d=>{shape(d,'wall').widthFt=81;});
rejected(d=>{shape(d,'garden').heightIn=49;});
const stale=clone(current);stale.yardFeatures![0].xFt+=1;const staleResult=generatePlanSketchDesign(baseline,stale,baseline);ok(!staleResult.ok,'Changed yard source geometry invalidates a stale sketch');equal(staleResult.patch,undefined,'Stale input cannot expose a patch');
const blank=generateSketchDesign({version:1,shapes:[...baseline.shapes.filter(s=>s.kind==='deck'),addedPatio]},current);ok(!blank.ok,'A new blank deck sketch explicitly rejects unsupported yard additions');ok(blank.errors.some(s=>s.includes('Current plan')),'The rejection explains how to edit yard safely');equal(blank.patch,undefined,'Blank mode never drops existing yard metadata');
const many={...current,yardFeatures:Array.from({length:20},(_,i)=>({...patio,id:i===19?'p'.repeat(80):`patio-${i}`,name:`Patio ${i}`}))};const manyBaseline=planSketchOf(many).document;equal(manyBaseline.shapes.filter(s=>s.kind==='patio').length,20,'All supported yard slots seed including long saved IDs');equal(generatePlanSketchDesign(manyBaseline,many,manyBaseline).patch,{},'All 20 yard slots and long IDs round-trip exactly');
console.log(`Deck sketch yard checks passed (${checks}).`);
