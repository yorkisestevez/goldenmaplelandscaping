import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {HARDSCAPE_PRODUCTS,hardscapeBody,hardscapeProblem} from '../src/features/deckcraft/hardscapeCatalogue';
import {hardscapeBlanks} from '../src/features/deckcraft/hardscapeLayout';
import {buildYardModel,yardArea} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {yardElevationEdit,yardGradeIn,yardSurfaceIn,yardWallCourses} from '../src/features/deckcraft/yardElevations';
import {yardShapeEdit,yardShapeWorldPoints} from '../src/features/deckcraft/yardShapeEditing';
import {serializeDesign,parseDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {parseAssistantPlan} from '../src/features/deckcraft/designer/assistantPlan';
let checks=0,units=0,wallCases=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;},near=(a:number,b:number,m:string)=>ok(Math.abs(a-b)<1e-5,`${m}: ${a} vs ${b}`);
const base:YardFeature={id:'stone-qa',kind:'patio',name:'Courtyard',enabled:true,xFt:60,zFt:60,widthFt:6,depthFt:4,heightIn:3,rotationDeg:0,productId:'permacon-melville',color:'#aaa69b'};
const data=(features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',deckType:'Freestanding',yardFeatures:features,terrainConfig:{widthFt:250,depthFt:250,elevationIn:7,slopePct:2}});
const raw=JSON.parse(readFileSync(new URL('../public/deckcraft/hardscape-catalogue.json',import.meta.url),'utf8'));
// Every selectable stock record is compared with the supplier-sourced public
// catalogue, then exercised through real geometry, rather than only its index.
for(const p of HARDSCAPE_PRODUCTS)for(const finish of p.finishes)for(const unit of finish.units){
 const source=raw.products.find((v:any)=>v.id===p.id).finishes.find((v:any)=>v.id===finish.id).units.find((v:any)=>v.id===unit.id);
 eq([unit.widthMm,unit.lengthMm,unit.heightMm],[source.widthMm,source.lengthMm,source.heightMm],`${p.id}/${unit.id}: source dimensions unchanged`);
 ok(/^https:\/\//.test(source.sourceUrl??p.sourceUrl),'Stock has a supplier evidence URL');
 if(!hardscapeBody(unit.role))continue;
 const color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id));if(!color)continue;
 const wall=p.category==='wall',f:YardFeature={...base,kind:wall?'retaining-wall':'patio',heightIn:wall?30.25:3,depthFt:wall?unit.lengthMm/304.8:4,productId:p.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'running-bond',angleDeg:0,jointMm:wall?0:3}};
 eq(hardscapeProblem(f),'','Documented stock selection is valid');
 if(!wall){for(const blank of hardscapeBlanks(f)){near(blank.length,unit.lengthMm/25.4,'Paver length stays full stock');near(blank.width,unit.widthMm/25.4,'Paver width stays full stock');}}
 const model=buildYardModel(data([f])),pieces=model.boxes.filter(b=>b.role===(wall?'wall-block':'paver'));ok(pieces.length>0,'Stock is rendered');
 for(const b of pieces)near(b.h,unit.heightMm/25.4,`${p.id}: stock thickness/course is exact`);
 if(wall){for(const value of [-17.5,0,21.25]){const raised=yardElevationEdit(f,'baseElevationIn',value),d=data([raised]),geometry=buildYardModel(d),courses=yardWallCourses(raised,yardGradeIn(d,raised));near(geometry.features[0].topIn,yardSurfaceIn(d,raised),'Wall top follows exact grade + base + height');near(courses.count*unit.heightMm/25.4,courses.top-courses.cap-courses.bottom,'No partial supplier courses');ok(courses.burialIn>=courses.minimumBurialIn-1e-8&&courses.burialIn<courses.minimumBurialIn+courses.course+1e-8,'Fractional courses resolved by burial');eq(geometry.features[0].stockSchedule?.[0].pieces,geometry.features[0].quantities.wallBlocks,'Stock schedule counts whole order units');for(const b of geometry.boxes.filter(b=>b.role==='wall-block'))near(b.h,unit.heightMm/25.4,'Raise/lower keeps block height');wallCases++;}}
 units++;
}
const shaped=yardShapeEdit(base,[{x:660,y:660},{x:780,y:660},{x:780,y:720},{x:720,y:720},{x:720,y:780},{x:660,y:780}]),raised=yardElevationEdit(shaped,'heightIn',17.25),before=buildYardModel(data([shaped])),after=buildYardModel(data([raised]));
eq(yardShapeWorldPoints(raised),yardShapeWorldPoints(shaped),'Raising keeps every perimeter point fixed');near(after.features[0].topIn-before.features[0].topIn,14.25,'Patio exact rise');eq(after.quantities.paverPieces,before.quantities.paverPieces,'Patio rise does not resize or recount stones');near(yardArea(after.features[0].footprints),yardArea(before.features[0].footprints),'Patio area unchanged');eq(parseDesign(serializeDesign(data([raised]))).yardFeatures,[raised],'Elevations survive exact persistence');
const genericWall:YardFeature={...base,id:'wall-qa',kind:'retaining-wall',productId:'segmental-concrete',depthFt:1,heightIn:24,baseElevationIn:11.5};
eq(validateDesign(data([genericWall])).yardFeatures,[genericWall],'New base elevation survives strict import');ok(buildYardTakeoff(data([genericWall])).sections.some(s=>s.id==='wall-elevation-wall-qa'&&s.amountCents===null),'Changed grade cannot claim free earthworks');
for(const [f,field,n]of [[base,'heightIn',49],[base,'baseElevationIn',1],[genericWall,'baseElevationIn',121],[genericWall,'heightIn',NaN],[genericWall,'heightIn',5]]as const){assert.throws(()=>yardElevationEdit(f,field,n));checks++;}
let called=0;const evil={...genericWall};Object.defineProperty(evil,'baseElevationIn',{enumerable:true,get:()=>{called++;return 12;}});assert.throws(()=>validateDesign(data([evil])));eq(called,0,'Base validation never invokes a getter');assert.throws(()=>validateDesign(data([{...base,baseElevationIn:0}])));checks++;
let state:DeckAgentHostState={data:data([shaped,genericWall]),ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false},commits=0;
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next,canUndo:true};commits++;},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:test=>{assert(test(state));return Promise.resolve();}});
const saved=serializeDesign(state.data),request={id:'elevation-batch',expectedRevision:api.read().revision,commands:[{type:'yard.elevation',id:shaped.id,field:'heightIn',valueIn:19.5},{type:'yard.elevation',id:genericWall.id,field:'baseElevationIn',valueIn:14.25}]};
ok((await api.preview(request)).ok,'Agent previews elevations');eq(serializeDesign(state.data),saved,'Preview writes nothing');eq(commits,0,'Preview no history');ok((await api.execute(request)).ok,'Agent commits elevations');eq(commits,1,'Atomic elevation batch one history entry');eq(state.data.yardFeatures![1].baseElevationIn,14.25,'Agent wall datum applied');const final=serializeDesign(state.data);ok(!(await api.execute({id:'bad',commands:[...request.commands,{type:'yard.elevation',id:shaped.id,field:'baseElevationIn',valueIn:2}]})).ok,'Invalid batch rejected');eq(serializeDesign(state.data),final,'Invalid batch preserves design');eq(commits,1,'Invalid batch no history');ok(api.describe().commands.includes('yard.elevation'),'Agent capability discoverable');ok(parseAssistantPlan({kind:'edit',message:'Raise the wall.',assumptions:[],commands:[request.commands[1]]}).ok,'Typed/voice assistant schema accepts elevation');
console.log(`Yard elevation / stock dimension checks passed: ${checks} checks, ${units} selectable stock variants, ${wallCases} wall elevation cases across ${HARDSCAPE_PRODUCTS.length} products.`);
