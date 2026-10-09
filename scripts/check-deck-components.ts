import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {validateDesign,serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHouseWalls} from '../src/features/deckcraft/houseFootprint';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {withPrivacyProduct} from '../src/features/deckcraft/privacyScreens';
import {applyComponentEdit,listPlanComponents,type ComponentEdit,type ComponentEditResult} from '../src/features/deckcraft/designer/componentEditActions';
import '../src/features/deckcraft/foundationDatumsRuntime';

let checks=0;const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const success=(r:ComponentEditResult)=>{if('error'in r)throw new Error(r.error);return r;};
const base:DeckData={...validateDesign({...DEFAULT_DECK,height:48,houseConfig:{...getHouseConfig(DEFAULT_DECK),widthFt:30,depthFt:18,storeys:2,openings:[{id:'measured-window',type:'Window',facade:'Front',style:'Picture',offsetPct:30,widthIn:60,heightIn:36,bottomIn:108}]},privacyScreens:[{id:'real-screen',side:'Left',lengthFt:6,heightFt:6,offsetPct:50,lights:false}]}),materialMarkup:23.5,customerName:'Local customer',projectAddress:'Local address'};
const model=buildDeckTakeoff(base),parts=listPlanComponents(base,model),original=JSON.stringify(base);
check(new Set(parts.map(p=>p.id)).size===parts.length,'Every selectable part has a unique stable ID');
check(JSON.stringify(parts)===JSON.stringify(listPlanComponents(base,model)),'Listing the same model is deterministic');
check(JSON.stringify(base)===original,'Listing parts does not change design, private fields or customer data');
const opening=parts.find(p=>p.id==='opening:measured-window')!,front=getHouseWalls(base).find(w=>w.id==='main-front')!;
check(Math.abs(opening.anchor!.x-(front.a.x+(front.b.x-front.a.x)*.3))<1e-8&&opening.anchor!.y===front.a.y,'Opening selection uses its real wall centre, not a guessed deck coordinate');
check(Math.abs(Math.hypot(opening.line![1].x-opening.line![0].x,opening.line![1].y-opening.line![0].y)-60)<1e-8,'Opening highlight matches the measured sixty-inch width');
check(parts.filter(p=>p.kind==='beam').length===model.levels.reduce((sum,l)=>sum+l.beams.length,0),'Selectable beams cover every generated level');
check(parts.filter(p=>p.kind==='footing').length===model.levels.reduce((sum,l)=>sum+l.supports.length,0),'Selectable footings are exactly the model supports');
check(parts.find(p=>p.id==='screen:real-screen')?.anchor?.x===extrasLayout(base,model).screenHandles[0].x,'Privacy-screen target follows its actual rendered handle');
const hidden={...base,houseVisible:false},hiddenParts=listPlanComponents(hidden,buildDeckTakeoff(hidden));
check(hiddenParts.filter(p=>['house','wall','opening'].includes(p.kind)).every(p=>!p.anchor&&!p.line&&!p.polygon),'Hidden house components remain list-only without fake canvas anchors');
const disabled={...base,privacyScreens:base.privacyScreens!.map(s=>({...s,enabled:false}))};
check(!listPlanComponents(disabled,buildDeckTakeoff(disabled)).find(p=>p.id==='screen:real-screen')!.anchor,'A disabled screen is not represented by an invented drawable handle');
const lower=validateDesign({...base,levels:2,height2:16,width2:10,length2:8}),lowerModel=buildDeckTakeoff(lower),lowerParts=listPlanComponents(lower,lowerModel);
check(lowerParts.some(p=>p.id==='deck:2'),'Actual second deck level has an independent editable-tool route');
const l2=lowerModel.levels.find(l=>l.kind==='deck'&&l.index===1)!,mi=lowerModel.levels.indexOf(l2),beam=lowerParts.find(p=>p.id===`beam:${mi}:0`)!;
check(beam.line![0].x===l2.beams[0].a.x&&beam.line![0].y===l2.beams[0].a.z,'Lower-level beam positions use the model world coordinates once');
const spa=validateDesign({...base,levels:2,width2:16,length2:12,height2:18,deckOutlineOffsets:{second:{x:30,y:0}}}),spaModel=buildDeckTakeoff(spa),spaParts=listPlanComponents(spa,spaModel);
const spaLevel=spaModel.levels.find(l=>l.kind==='deck'&&l.index===1)!,spaDeck=spaParts.find(p=>p.id==='deck:2')!;
const span=spaDeck.polygon!.map(p=>p.x),spanMin=Math.min(...span),spanMax=Math.max(...span);
check(spanMin===360&&spanMax===552,'The placed lower level spans x 360–552');
const spaBeams=spaParts.filter(p=>p.kind==='beam'&&p.level===2);
check(spaBeams.length===spaLevel.beams.length&&spaBeams.every((part,i)=>{
  const member=spaLevel.beams[i],xs=[part.line![0].x,part.line![1].x];
  return xs[0]===member.a.x&&xs[1]===member.b.x&&xs.every(x=>x>=spanMin-1e-6&&x<=spanMax+1e-6)&&xs[0]!==member.a.x+spaLevel.offset.x;
}),'Lower-level beams stay on x 360–552 and are not shifted by the offset a second time');
const spaFootings=spaParts.filter(p=>p.kind==='footing'&&p.level===2);
check(spaFootings.length===spaLevel.supports.length&&spaFootings.every((part,i)=>{
  const support=spaLevel.supports[i];
  return part.anchor!.x===support.x&&part.anchor!.y===support.z&&part.anchor!.x>=spanMin-1e-6&&part.anchor!.x<=spanMax+1e-6&&part.anchor!.x!==support.x+spaLevel.offset.x;
}),'Lower-level footings use each support once and stay on x 360–552');
const sloped=validateDesign({...spa,terrainConfig:{widthFt:80,depthFt:80,elevationIn:0,slopePct:3}}),slopedModel=buildDeckTakeoff(sloped),slopedParts=listPlanComponents(sloped,slopedModel);
const slopedLevel=slopedModel.levels.find(l=>l.kind==='deck'&&l.index===1)!;
check(slopedParts.filter(p=>p.kind==='beam'&&p.level===2).every((part,i)=>{
  const member=slopedLevel.beams[i];
  return part.line![0].x===member.a.x&&part.line![1].x===member.b.x&&part.line![0].x>=360-1e-6&&part.line![1].x<=552+1e-6;
})&&slopedParts.filter(p=>p.kind==='footing'&&p.level===2).every((part,i)=>{
  const datum=slopedModel.foundationSupports.find(f=>f.levelIndex===slopedModel.levels.indexOf(slopedLevel)&&f.supportIndex===i)!;
  return part.anchor!.x===datum.x&&part.anchor!.y===datum.z&&part.anchor!.x>=360-1e-6&&part.anchor!.x<=552+1e-6;
}),'A sloped site keeps lower-level beams and datum footings on the same world span');
const landing=validateDesign({...base,stairType:'Landing',height:72}),landingModel=buildDeckTakeoff(landing);
check(listPlanComponents(landing,landingModel).filter(p=>p.kind==='footing').length===landingModel.levels.reduce((sum,l)=>sum+l.supports.length,0),'Generated stair landings expose their real supports too');

const edit=(id:string,operation:ComponentEdit,data=base)=>success(applyComponentEdit(data,buildDeckTakeoff(data),id,operation));
const moved=edit('opening:measured-window',{action:'update',fields:{widthIn:72,heightIn:48,bottomIn:100,offsetPct:45}}),movedData={...base,...moved.patch};
check(Object.keys(moved.patch).join(',')==='houseConfig','Opening operation returns only its changed public key');
check(movedData.materialMarkup===23.5&&movedData.customerName===base.customerName&&movedData.projectAddress===base.projectAddress,'Narrow edits preserve contractor markup and local customer fields');
check(movedData.houseConfig!.openings[0].offsetPct===45&&movedData.houseConfig!.openings[0].bottomIn===100,'Opening offset and height apply to the actual stored opening');
check(calculateEstimate(movedData).total===calculateEstimate(base).total,'Opening appearance edits leave the actual deck total unchanged');
check(JSON.stringify(base)===original,'Applying a pure operation never mutates its input');
const changedType=edit('opening:measured-window',{action:'update',fields:{type:'Door'}});
check(changedType.patch.houseConfig!.openings[0].type==='Door'&&!changedType.patch.houseConfig!.openings[0].style,'Changing opening type clears incompatible Picture-window styling');
const narrow={...base,houseConfig:{...base.houseConfig!,widthFt:12}},clamped=edit('opening:measured-window',{action:'update',fields:{widthIn:180,offsetPct:0}},narrow);
check(clamped.patch.houseConfig!.openings[0].widthIn===132&&clamped.patch.houseConfig!.openings[0].offsetPct>0,'Valid dimensions clamp to actual wall clearances');
check(clamped.message.includes('132 in')&&clamped.message.includes('wall offset'),'Clamped actual geometry is disclosed in the result');
const added=edit('wall:main-right',{action:'add-opening',presetKey:'Window:Casement',wallId:'main-right'}),addedData={...base,...added.patch};
check(addedData.houseConfig!.openings.length===2&&added.selectedId==='opening:part-opening-1','Add opening retains original and returns the newly selected stable ID');
const duplicate=edit('opening:measured-window',{action:'duplicate'}),duplicateData={...base,...duplicate.patch};
check(duplicateData.houseConfig!.openings.length===2&&duplicateData.houseConfig!.openings[1].id!==base.houseConfig!.openings[0].id,'Duplicate creates a separate real measured opening');
check(duplicateData.houseConfig!.openings[1].offsetPct!==base.houseConfig!.openings[0].offsetPct,'Duplicate chooses existing clear-space placement instead of stacking on the original');
const removed=edit(duplicate.selectedId,{action:'remove'},duplicateData);
check(removed.patch.houseConfig!.openings.length===1&&removed.patch.houseConfig!.openings[0].id==='measured-window','Remove deletes only the selected opening');
const houseMove=edit('house:main',{action:'update',fields:{widthFt:32,depthFt:20,offsetIn:-48}}),houseData={...base,...houseMove.patch};
check(getHousePlacement(houseData).x0===-48&&getHouseConfig(houseData).widthFt===32&&getHouseConfig(houseData).depthFt===20,'Main-house size and left position affect actual house geometry');
const hide=edit('house:main',{action:'update',fields:{visible:false}});
check(Object.keys(hide.patch).join(',')==='houseVisible','Visibility does not unnecessarily freeze or replace generated house dimensions');
const stairs=edit('stairs:primary',{action:'update',fields:{stairWidth:72,stairPosition:'Right',stairOffset:35,stairType:'Straight',stairEdgeId:''}}),stairsData={...base,...stairs.patch},stairsModel=buildDeckTakeoff(stairsData);
check(stairsModel.flights.find(f=>f.kind==='grade')!.width===72&&stairsData.stairPosition==='Right','Primary stair edit generates genuinely wider stairs on the chosen exposed edge');
check(calculateEstimate(stairsData).total>calculateEstimate(base).total,'Wider stairs affect purchased quantities and the actual total');
const screen=edit('screen:real-screen',{action:'update',fields:{lengthFt:8,heightFt:5,offsetPct:30}}),screenData={...base,...screen.patch};
check(screenData.privacySqft===40&&extrasLayout(screenData,buildDeckTakeoff(screenData)).screenHandles[0].w===96,'Screen dimensions drive actual rendered length and priced forty-square-foot area');
check(calculateEstimate(screenData).total!==calculateEstimate(base).total,'Actual screen area edit reaches deck pricing');
const screenDuplicate=edit('screen:real-screen',{action:'duplicate'}),duplicatedScreens={...base,...screenDuplicate.patch};
check(duplicatedScreens.privacyScreens!.length===2&&duplicatedScreens.privacySqft===72,'Duplicated screen is a separate priced object on a clear exposed side');
check(extrasLayout(duplicatedScreens,buildDeckTakeoff(duplicatedScreens)).screenHandles.length===2,'Both duplicated screens are actually drawn');
const screenRemoval=edit(screenDuplicate.selectedId,{action:'remove'},duplicatedScreens);
check(screenRemoval.patch.privacyScreens!.length===1&&screenRemoval.patch.privacySqft===36,'Removing selected screen updates only its record and exact priced area');
const stockScreen={...withPrivacyProduct(base.privacyScreens![0],'hideaway'),panels:1},stockData=validateDesign({...base,privacyScreens:[stockScreen]}),panels=edit('screen:real-screen',{action:'update',fields:{panels:2}},stockData);
check(panels.patch.privacyScreens![0].panels===2&&panels.patch.privacySqft===0,'Manufacturer panel quantity edits remain actual stock products requiring a quote');
check(parseDesign(serializeDesign(movedData)).houseConfig!.openings[0].widthIn===72,'Applied opening dimensions survive saved-design roundtrip');
check(parseDesign(serializeDesign(screenData)).privacySqft===40,'Applied screen dimensions and derived priced area roundtrip together');

const rejections:[string,ComponentEdit,DeckData?][]=[
 ['opening:measured-window',{action:'update',fields:{widthIn:NaN}}],['opening:measured-window',{action:'update',fields:{widthIn:11}}],['opening:measured-window',{action:'update',fields:{type:'French'}}],['opening:measured-window',{action:'update',fields:{offsetPct:120}}],['opening:measured-window',{action:'update',fields:{materialMarkup:0}}],['opening:measured-window',{action:'update',fields:{wallId:'absent-wall'}}],
 ['house:main',{action:'update',fields:{widthFt:500}}],['house:main',{action:'update',fields:{visible:'yes'}}],['stairs:primary',{action:'update',fields:{stairWidth:20}}],['stairs:primary',{action:'update',fields:{stairType:'Spiral'}}],['stairs:primary',{action:'update',fields:{stairPosition:'Back'}}],['stairs:primary',{action:'update',fields:{stairEdgeId:'absent-edge'}}],
 ['screen:real-screen',{action:'update',fields:{lengthFt:60}}],['screen:real-screen',{action:'update',fields:{heightFt:9}}],['screen:real-screen',{action:'update',fields:{side:'Back'}}],['screen:real-screen',{action:'update',fields:{panels:2}}],['screen:real-screen',{action:'update',fields:{lengthFt:6}},stockData],['screen:real-screen',{action:'update',fields:{panels:1.2}},stockData],
 [parts.find(p=>p.kind==='beam')!.id,{action:'update',fields:{x:123}}],['deck:1',{action:'update',fields:{widthFt:22}}],['opening:disappeared',{action:'remove'}],
];
for(const [id,operation,fixture=base] of rejections){const before=JSON.stringify(fixture),result=applyComponentEdit(fixture,buildDeckTakeoff(fixture),id,operation);check('error'in result,`Unsupported/out-of-range/non-drawable edit must fail: ${id} ${JSON.stringify(operation)}`);assert.equal(JSON.stringify(fixture),before,'Failed edit must preserve the full original');}
let invoked=false;const getter=Object.defineProperty({},'widthIn',{get(){invoked=true;return 72;},enumerable:true});
check('error'in applyComponentEdit(base,model,'opening:measured-window',{action:'update',fields:getter})&&!invoked,'Hostile field getters are rejected without invocation');
const wrap=validateDesign({...base,wrap:{left:{widthFt:8,runFt:12}}});
check('error'in applyComponentEdit(wrap,buildDeckTakeoff(wrap),'house:main',{action:'update',fields:{offsetIn:10}}),'Wrap-controlled house position cannot pretend to move independently');
const full={...base,houseConfig:{...base.houseConfig!,openings:Array.from({length:24},(_,i)=>({...base.houseConfig!.openings[0],id:`full-${i}`}))}};
check('error'in applyComponentEdit(full,buildDeckTakeoff(full),'opening:full-0',{action:'duplicate'}),'Duplicate respects the existing maximum of twenty-four openings');
console.log(`DECK COMPONENTS OK — ${checks} independent checks of model locations, actual geometry/pricing, narrow edits, persistence and invalid inputs.`);
