import '../src/features/deckcraft/yardModelAdvancedRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {loadYardAssembliesRuntime} from '../src/features/deckcraft/yardFinishedSettings';
import {buildYardModel,yardClip} from '../src/features/deckcraft/yardModel';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {buildElevationProfile,elevationProfileSpecs} from '../src/features/deckcraft/elevationProfiles';
import {siteProfileDrawingItems} from '../src/features/deckcraft/drawings/siteProfiles';

await loadYardAssembliesRuntime();
let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const near=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<1e-5,`${message}: ${a} vs ${b}`);
const flight:YardFeature={id:'solid-stair-profile',kind:'patio',name:'Stone stair profile fixture',enabled:true,xFt:60,zFt:60,widthFt:8,depthFt:8,heightIn:3,rotationDeg:0,productId:'permacon-melville',color:'#aaa69b',finishedElevationIn:24,stoneSteps:{lowerElevationIn:0,riserCount:4,treadRunIn:24,stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:.125,productName:'Entered planning stock',support:{kind:'full-step',courses:[0,1,2,3]}}};
const project=(feature:YardFeature):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,stairFlights:0,railingType:'None',deckType:'Freestanding',terrainConfig:{widthFt:250,depthFt:250,elevationIn:-12,slopePct:0},yardFeatures:[feature]});
for(const rotationDeg of [0,37]){
 const data=project({...flight,rotationDeg}),yard=buildYardModel(data),feature=yard.features[0],specs=elevationProfileSpecs(data),outSpec=specs.find(s=>s.id===`${flight.id}-out`)!;
 ok(!feature.excluded,'Entered stair fixture is modeled');
 const out=buildElevationProfile(data,outSpec,yard);
 for(const [station,level] of [[12,6],[36,12],[60,18],[84,24]]){
  const point=out.points.find(p=>Math.abs(p.stationIn-station)<1e-5);
  ok(point,'Every tread has a midpoint section measurement');near(point!.finishedIn!,level,'Finished profile follows actual equal-rise treads');
 }
 ok(out.solids?.some(s=>s.stonePart==='support-step'),'Full-step supports appear in the derived section');
 near(out.solids!.filter(s=>s.stonePart==='support-step').length,6,'Longitudinal section contains all six supporting courses');
 for(const solid of out.solids!){const box=feature.boxes.find(b=>b.id===solid.id)!;near(solid.topIn,box.y+box.h/2,'Section solid top is the physical box top');near(solid.bottomIn,box.y-box.h/2,'Section solid bottom is the physical box bottom');ok(solid.endIn>solid.startIn,'Section solid is a positive clipped interval');}
 const across=buildElevationProfile(data,specs.find(s=>s.id===`${flight.id}-across`)!,yard);
 ok(across.points.some(p=>p.finishedIn===18),'Across section samples its actual intersecting tread instead of upper landing');
 ok(!across.points.some(p=>p.finishedIn===24),'Across section does not invent the upper tread level');
 const deck=buildDeckTakeoff(data),allSpecs=elevationProfileSpecs(data,deck).filter(s=>!s.poolRef),expected=allSpecs.reduce((n,s)=>n+(buildElevationProfile(data,s,yard).solids?.length??0),0),drawing=siteProfileDrawingItems(data,deck,{x:0,y:0});
 near(drawing.filter(item=>item.kind==='poly'&&item.closed&&(item.layer==='C-FNSH'||item.layer==='C-FORM')).length,expected,'Measured section drawing contains every derived stair solid');
}
const data=project(flight),yard=buildYardModel(data),outSpec=elevationProfileSpecs(data).find(s=>s.id===`${flight.id}-out`)!;
const hole=[{x:672,y:706},{x:768,y:706},{x:768,y:718},{x:672,y:718}],hollow={...yard,features:yard.features.map(f=>({...f,footprints:yardClip(f.footprints,[hole],'difference')}))},holed=buildElevationProfile(data,outSpec,hollow);
ok(holed.points.some(p=>p.stationIn>34&&p.stationIn<46&&p.finishedIn===null),'A clipped hole remains an explicit finished-surface gap');
ok(!holed.solids!.some(s=>s.startIn<40&&s.endIn>40),'Clipped holes remove the corresponding stair section solids');
const excluded=buildElevationProfile(data,outSpec,{...yard,features:yard.features.map(f=>({...f,excluded:true}))});
ok(excluded.points.every(p=>p.finishedIn===null)&&excluded.solids?.length===0,'Excluded flights provide no finished surface or solids');
const disabled=buildElevationProfile(project({...flight,enabled:false}),outSpec,yard);
ok(disabled.points.every(p=>p.finishedIn===null)&&disabled.solids?.length===0,'Disabled flights provide no finished surface or solids');
const filler={...flight,stoneSteps:{...flight.stoneSteps!,support:{kind:'filler' as const,courses:[0,1,2,3],stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,jointIn:.125,productName:'Entered planning filler'}}},fillerData=project(filler),fillerProfile=buildElevationProfile(fillerData,outSpec,buildYardModel(fillerData));
ok(fillerProfile.solids?.some(s=>s.stonePart==='filler'),'Filler blocks appear as actual section solids');
const legacy=structuredClone(flight);delete legacy.stoneSteps!.support;
const legacyData=project(legacy),legacyProfile=buildElevationProfile(legacyData,outSpec,buildYardModel(legacyData));
ok(legacyProfile.solids?.some(s=>s.stonePart==='tread')&&!legacyProfile.solids?.some(s=>s.stonePart==='support-step'||s.stonePart==='filler'),'Legacy aggregate flights show treads without invented solid supports');
console.log(`Stone-step profile checks passed: ${checks}.`);
