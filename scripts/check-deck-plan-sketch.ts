import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {planSketchOf,generatePlanSketchDesign} from '../src/features/deckcraft/sketch/planSketch';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {editableBoundaries} from '../src/features/deckcraft/designer/boundaryEditMath';
import type {DeckData} from '../src/features/deckcraft/types';
import type {SketchDocument,SketchShape} from '../src/features/deckcraft/sketch/sketchTypes';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const equal=(a:unknown,b:unknown,message:string)=>{assert.deepEqual(a,b,message);checks++;};
const near=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<1e-7,message);
const clone=<T,>(v:T):T=>structuredClone(v);
const seven=[{x:.125,y:0},{x:8.0625,y:0},{x:16,y:0},{x:16,y:8.25},{x:12.25,y:12.125},{x:5.375,y:12.125},{x:.125,y:8.25}];
const rich:DeckData={...clone(DEFAULT_DECK),width:15.875,length:12.125,stairFlights:0,deckOutlines:{main:seven},boardLayout:{regions:[{id:'zone',level:1,polygon:[{x:24,y:24},{x:96,y:24},{x:96,y:72},{x:24,y:72}],angleDeg:35}],breakers:[{id:'break',level:1,start:{x:96,y:12},end:{x:96,y:120}}],pieces:[]},pictureFrameRows:2,sceneLighting:'Evening',customerName:'Round trip customer',projectAddress:'Measured property',scopeOfWork:'Keep this private scope',materialMarkup:43,railDefault:false,railSections:[{id:'front',level:1,edgeId:'front',startPct:0,endPct:100,enabled:true}],lightingSystem:{selectedItems:[],wireDistance:57}};
// Extra settings are intentionally preserved as part of the complete user design, even if unrelated to geometry.
const estimate=(data:DeckData)=>calculateEstimate(data,DECK_SETTINGS);
function edit(data:DeckData,change:(doc:SketchDocument)=>void){const before=JSON.stringify(data),baseline=planSketchOf(data).document,doc=clone(baseline);change(doc);const result=generatePlanSketchDesign(doc,data,baseline);equal(JSON.stringify(data),before,'The source design is immutable');ok(result.ok,result.errors.join('; '));return {data:{...data,...result.patch},patch:result.patch!,baseline,doc,result};}
const shape=(doc:SketchDocument,id='plan-deck-1')=>doc.shapes.find(s=>s.id===id)!;

// No-op and label-only edits preserve the raw added collinear pull point and every private pricing/detail field.
for(const data of [rich,DEFAULT_DECK,{...rich,houseVisible:false},{...rich,stairType:'Landing' as const,stairFlights:1}]){
 const baseline=planSketchOf(data).document,before=serializeDesign(data),priced=estimate(data),result=generatePlanSketchDesign(clone(baseline),data,baseline);
 ok(result.ok,result.errors.join('; '));equal(result.patch,{},'Opening the same measured plan is exactly a no-op');equal(serializeDesign({...data,...result.patch}),before,'No-op preserves saved configuration byte for byte');equal(estimate({...data,...result.patch}),priced,'No-op preserves the complete estimate');
}
const labelled=edit(rich,d=>{shape(d).label='My custom label';});equal(labelled.patch,{},'Sketch labels never regenerate design settings');
equal(shape(planSketchOf(rich).document).points.length,7,'Added collinear pull points are seeded unsimplified');
const privateDesign={...rich,quoteResolutions:[{scopeKey:'quote-1234567890abcdef',fingerprint:'scope-1234567890abcdef',supplyCost:317.25,installationCost:191.5,confirmedOn:'2026-09-26',source:'Measured contractor quote',note:'Private confirmed cost',additionalScope:true as const}]};
const privateNoop=edit(privateDesign,()=>{});equal(privateNoop.patch,{},'A current sketch does not invalidate private quote records');equal(privateNoop.data.quoteResolutions,privateDesign.quoteResolutions,'Private source and cost records remain exact');
const privateEdit=edit(privateDesign,d=>{shape(d).heightIn=42;});equal(privateEdit.data.quoteResolutions,privateDesign.quoteResolutions,'Geometry edits retain private quote records for later scope review');

// Existing seven-point geometry can change one corner, a complete edge, or a measured width.
const point=edit(rich,d=>{shape(d).points[5].y+=3.75;shape(d).depthFt=12.4375;});
equal(point.data.deckOutlines?.main?.length,7,'A direct point edit retains seven raw pull points');near(point.data.deckOutlines!.main![5].y,12.4375,'Moved corner returns to precise plan feet');
for(const key of ['boardLayout','pictureFrameRows','sceneLighting','lightingSystem','materialMarkup','railDefault','railSections','customerName','projectAddress','scopeOfWork'] as const)equal(point.data[key],rich[key],`Point edits preserve ${key}`);
equal(getHouseConfig(point.data),getHouseConfig(rich),'A deck point edit freezes the original implicit house and openings');equal(getHousePlacement(point.data).x0,getHousePlacement(rich).x0,'A deck width edit leaves the house in its measured world position');
const edge=edit(rich,d=>{const s=shape(d);s.points[3].x+=9.25;s.points[4].x+=9.25;s.widthFt=(16*12+9.25-.125*12)/12;});equal(edge.data.deckOutlines!.main!.length,7,'Edge pulls retain all seven points');near(edge.data.deckOutlines!.main![3].x,16+9.25/12,'An edge can move by fractional inches');
const width=edit(rich,d=>{shape(d).widthFt=19.5;});near(width.data.width,19.5,'Editing measured width scales the current polygon once');equal(width.data.deckOutlines?.main?.length,7,'Width changes preserve collinear handles');
const preScaled=edit(rich,d=>{const s=shape(d),x=Math.min(...s.points.map(p=>p.x)),ratio=19.5/s.widthFt!;s.points=s.points.map(p=>({...p,x:x+(p.x-x)*ratio}));s.widthFt=19.5;});equal(preScaled.data.deckOutlines,width.data.deckOutlines,'Already scaled UI points are not scaled a second time');
const height=edit(rich,d=>{shape(d).heightIn=42;});equal(height.data.height,42,'Elevation edits update only the selected deck height');equal(height.data.deckOutlines,rich.deckOutlines,'Height edits preserve raw outlines');equal(getHouseConfig(height.data),getHouseConfig(rich),'Height edits preserve original door and window positions');
const fractional:DeckData={...rich,deckOutlines:{main:seven.map((p,i)=>({x:p.x+i*.012345678901234,y:p.y}))}};
const fractionalHeight=edit(fractional,d=>{shape(d).heightIn=39.25;});equal(fractionalHeight.data.deckOutlines,fractional.deckOutlines,'Display translation arithmetic cannot rewrite high precision points during height-only edits');ok(!Object.hasOwn(fractionalHeight.patch,'deckOutlines'),'A height-only patch does not include phantom outline changes');
const saved=parseDesign(serializeDesign(point.data));equal(saved.deckOutlines,point.data.deckOutlines,'Saved designs retain current-sketch point edits');equal(planSketchOf(saved).document,planSketchOf(point.data).document,'Reopening reads the latest regular plan');

// A two-level layout keeps the untouched connection settings and local selections while moving a measured child.
const multi:DeckData={...clone(DEFAULT_DECK),stairFlights:0,levels:2,width2:10,length2:8,height2:12,level2Position:'Front',level2Offset:50,level2FullStep:true};
const oldChild=editableBoundaries(multi,buildDeckTakeoff(multi)).find(b=>b.level===2)!;
const child=edit(multi,d=>{const s=shape(d,'plan-deck-2');s.points=s.points.map(p=>({x:p.x+6.125,y:p.y}));});
near(child.data.deckOutlineOffsets!.second!.x*12,oldChild.offset.x+6.125,'Child translation is stored as a measured world origin');equal(child.data.level2Position,multi.level2Position,'Unedited connection side is preserved');equal(child.data.level2FullStep,true,'Unedited complete step connection remains');equal(child.data.height2,multi.height2,'Unedited child elevation remains');
const removed=edit(multi,d=>{d.shapes=d.shapes.filter(s=>s.id!=='plan-deck-2');});equal(removed.data.levels,1,'Explicitly removing the last deck level removes it');
const added=edit({...clone(DEFAULT_DECK),stairFlights:0},d=>{const main=shape(d),x=main.points[0].x+48,y=Math.max(...main.points.map(p=>p.y));d.shapes.push({id:'new-landing',kind:'landing',label:'Landing',points:[{x,y},{x:x+96,y},{x:x+96,y:y+96},{x,y:y+96}],widthFt:8,depthFt:8,heightIn:12});});
equal(added.data.levels,2,'A supported new landing adds exactly one deck level');equal(added.data.houseConfig,DEFAULT_DECK.houseConfig,'Adding a level does not replace the implicit main house');equal(added.data.deckingMaterial,DEFAULT_DECK.deckingMaterial,'Added geometry preserves product settings');equal(added.data.stairFlights,0,'An added landing does not invent grade stairs');

// House edits preserve all openings/appearance; depth follows the fixed front wall and current UI bottom anchoring.
const house=edit(rich,d=>{const s=shape(d,'plan-house-main'),bottom=Math.max(...s.points.map(p=>p.y)),depth=s.depthFt!+2,ratio=depth/s.depthFt!;s.points=s.points.map(p=>({...p,y:bottom+(p.y-bottom)*ratio}));s.depthFt=depth;});
near(getHouseConfig(house.data).depthFt,getHouseConfig(rich).depthFt+2,'House depth returns to the same measured front wall');equal(getHouseConfig(house.data).openings,getHouseConfig(rich).openings,'House depth edits retain measured openings');

// New and edited stair paths merge only stair fields, leaving the complete current board and house design intact.
const steps=edit({...clone(DEFAULT_DECK),stairFlights:0},d=>{const main=shape(d),front=Math.max(...main.points.map(p=>p.y));d.shapes.push({id:'new-steps',kind:'stairs',label:'Steps',drawing:'edge-path',points:[{x:main.points[0].x+36,y:front},{x:main.points[0].x+108,y:front}],riserCount:6,treadDepthIn:13});});
equal(steps.data.stairRiserCount,6,'A new stair path forwards the editable riser count');equal(steps.data.stairTreadDepthIn,13,'A new stair path forwards the editable going');ok(buildDeckTakeoff(steps.data).flights.some(f=>f.kind==='grade'&&f.width===72&&f.risers===6&&f.run===13),'The measured stair span reaches the actual geometry');
const deleted=edit(steps.data,d=>{d.shapes=d.shapes.filter(s=>s.kind!=='stairs');});equal(deleted.data.stairFlights,0,'Deleting current stair sketch disables grade stairs');equal(deleted.data.stairPath,undefined,'Deleting current stairs clears their attachment path');
const legacyCount=edit(DEFAULT_DECK,d=>{shape(d,'plan-stairs').riserCount=6;shape(d,'plan-stairs').treadDepthIn=14;});equal(legacyCount.data.stairRiserCount,6,'Editing the displayed legacy stair path transfers the exact selected count');ok(buildDeckTakeoff(legacyCount.data).flights.some(f=>f.kind==='grade'&&f.width===48&&f.risers===6&&f.run===14),'Legacy stair opening stays fixed when its count and depth change');

// A pulled concave corner can make a framing row tangent to a vertex. A point
// intersection must not become a zero-length lumber cut that blocks the edit.
const notch:DeckData={...clone(DEFAULT_DECK),width:18,length:14,height:30,deckType:'Freestanding',houseVisible:false,stairFlights:0,
  deckOutlines:{main:[{x:0,y:0},{x:9,y:0},{x:18,y:0},{x:18,y:14},{x:11,y:14},{x:11,y:12},{x:0,y:12}]},
  pattern:'Picture Frame',pictureFrameRows:1,boardLayout:{regions:[{id:'angled',level:1,polygon:[{x:12,y:12},{x:96,y:12},{x:96,y:84},{x:12,y:84}],angleDeg:30}],breakers:[{id:'divider',level:1,start:{x:108,y:0},end:{x:108,y:144},widthIn:5.5}],pieces:[]}};
const pulledNotch=edit(notch,d=>{const s=shape(d),left=Math.min(...s.points.map(p=>p.x));s.widthFt=20;s.points=s.points.map(p=>({...p,x:left+(p.x-left)*20/18}));s.points[5].x+=1;s.points[0].y+=1;s.points[1].y+=1;});
const notchModel=buildDeckTakeoff(pulledNotch.data);
ok(notchModel.levels.every(l=>[...l.joists,...l.beams,...l.blocking,...l.rim??[]].every(m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)>0)),'A valid pulled outline contains only physical nonzero framing members');
ok(Number.isFinite(estimate(pulledNotch.data).total),'A tangent framing row cannot prevent the resized design from being priced');
equal(pulledNotch.data.boardLayout,notch.boardLayout,'The tangent fix keeps the selected board direction and breaker');

// Unsupported replacements, stale drafts, crossings and locked boundaries fail atomically rather than losing details.
const baseline=planSketchOf(rich).document;
const fails=(change:(d:SketchDocument)=>void,data=rich)=>{const doc=clone(baseline);change(doc);const result=generatePlanSketchDesign(doc,data,baseline);ok(!result.ok&&result.errors.length>0,'Unsafe or stale edit is rejected explicitly');equal(result.patch,undefined,'A failed edit exposes no partial patch');};
fails(d=>{shape(d).points[3]={...shape(d).points[0]};});
fails(d=>{d.shapes=d.shapes.filter(s=>s.id!=='plan-deck-1');});
fails(d=>{shape(d).kind='house';});
fails(d=>{shape(d).widthFt=20;},{...rich,height:44});
for(const invalid of [NaN,Infinity,-Infinity])fails(d=>{shape(d).points[2].x=invalid;});
fails(d=>{shape(d).widthFt=0;});
fails(d=>{shape(d).depthFt=121;});
const locked={...rich,boundaryLocks:[{level:1 as const,edge:0,dxIn:95.25,dyIn:0}]};const lockedBase=planSketchOf(locked).document,lockedDraft=clone(lockedBase);shape(lockedDraft).points[1].x+=10;ok(!generatePlanSketchDesign(lockedDraft,locked,lockedBase).ok,'A locked exact edge prevents a sketch point pull');
let accessed=false;const hostile=clone(baseline);Object.defineProperty(shape(hostile),'widthFt',{get(){accessed=true;return 20;},enumerable:true});ok(!generatePlanSketchDesign(hostile,rich,baseline).ok&&!accessed,'Accessor input is rejected without executing it');
console.log(JSON.stringify({checks,status:'passed'}));
