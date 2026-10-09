import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {BORDER_LIGHTING,BORDER_SUPPORT_QUOTE,borderLightingPlan} from '../src/features/deckcraft/borderLighting';
import {finishedFasciaOffset,pictureFrameOverhang} from '../src/features/deckcraft/lib/finishedFootprint';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {levelJunctions} from '../src/features/deckcraft/lib/levelJunctions';
import {activeLightingItems,syncAutoLighting} from '../src/features/deckcraft/lightingSystem';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {serializeDesign,parseDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {packFixtureLights} from '../src/features/deckcraft/fixtureLight';
import {lightingLines} from '../src/features/deckcraft/proposalModel';

let checks=0;
const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const near=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<1e-6,message);
const base:DeckData={...structuredClone(DEFAULT_DECK),width:20,length:12,height:48,pictureFrameRows:1,pictureFrameOverhangIn:.5,autoLighting:{border:true},lightingSystem:{wireDistance:0,selectedItems:[]}};
const scenarios:DeckData[]=[];
for(const deckType of ['Attached','Freestanding'] as const)for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)for(const stairPosition of ['Front','Left','Right'] as const)scenarios.push({...base,deckType,shape,stairPosition,cutoutWidth:5,cutoutLength:4,cutoutWidth2:4,cutoutLength2:3});
scenarios.push({...base,levels:2,width2:8,length2:8,height2:24,level2Position:'Front',level2FullStep:true});
scenarios.push({...base,levels:3,width2:8,length2:8,height2:30,level2Position:'Left',level3:{parent:1,widthFt:8,lengthFt:8,heightIn:24,position:'Right',offsetPct:50,fullStep:true}});
scenarios.push({...base,cornerChamfers:{frontLeftFt:3,frontRightFt:3}});
scenarios.push({...base,deckType:'Freestanding',width:4,length:4,stairFlights:0,levels:1});
scenarios.push({...base,width:18,houseConfig:{widthFt:10,depthFt:20,storeys:1,storeyHeightIn:132,roofShape:'Gable',roofFinish:'Shingles',roofColor:'#424748',cladding:'Siding',claddingColor:'#c5c7be',trimColor:'#f0eee6',openings:[]},housePlacement:{anchor:'left',offsetIn:24}});
const proof=[];
for(const design of scenarios){
  const model=buildDeckTakeoff(design),plan=borderLightingPlan(design,model),contact=getHouseContact(design,model.levels[0].footprint),junctions=levelJunctions(model.levels);
  ok(plan.mounts.length<=30,'Quantity respects preview cap');
  for(const mount of plan.mounts){
    const level=model.levels[mount.level],a=level.footprint.outline[mount.edge],b=level.footprint.outline[(mount.edge+1)%level.footprint.outline.length];
    ok(level.kind==='deck','Only actual deck levels acquire border mounts');
    ok(mount.level!==0||!contact.isContactEdge(mount.edge)&&!contact.isFlushEdge?.(mount.edge),'House contact and flush edges stay clear');
    ok(mount.along-BORDER_LIGHTING.lengthIn/2>=mount.span[0]+6-1e-6&&mount.along+BORDER_LIGHTING.lengthIn/2<=mount.span[1]-6+1e-6,'Full uncut fixture fits span with end clearance');
    const len=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/len,z:(b.y-a.y)/len},worldA={x:a.x+level.offset.x,z:a.y+level.offset.z};
    near((mount.x-worldA.x)*u.z-(mount.z-worldA.z)*u.x,finishedFasciaOffset(design)+1.25,'Fixture is concealed within 2.5in overhang beyond actual fascia');
    near(mount.y,level.top-1-BORDER_LIGHTING.heightIn/2,'Housing top sits flush under border board');
    for(const j of junctions){
      const off=Math.abs((worldA.x+u.x*mount.along-j.a.x)*j.u.y-(worldA.z+u.z*mount.along-j.a.y)*j.u.x),t=(worldA.x+u.x*mount.along-j.a.x)*j.u.x+(worldA.z+u.z*mount.along-j.a.y)*j.u.y;
      ok(!(off<.5&&t>0&&t<j.length),'Internal level joins have no border lights');
    }
  }
  for(const mount of plan.mounts)for(const other of plan.mounts)if(mount!==other&&mount.level===other.level&&mount.edge===other.edge&&mount.span[0]===other.span[0]&&mount.span[1]===other.span[1])ok(Math.abs(mount.along-other.along)>=BORDER_LIGHTING.lengthIn+2-1e-6,'Fixture housings do not overlap on short eligible spans');
  const extras=extrasLayout(design,model);
  ok(extras.fixtures.filter(f=>f.zone==='border').length===plan.mounts.length,'Rendered/CAD layout and mounted quantity agree');
  const active=activeLightingItems(design,model).find(p=>p.zone==='border');
  ok((active?.qty??0)===plan.mounts.length,'Priced supply follows actual mounted count');
  if(active)near(active.cost!,132,'Sourced EVO HYDE supply remains 132 CAD');
  const prices=calculateEstimate(design),section=prices.sections.find(s=>s.title==='in-lite® Lighting System');
  if(active){
    near(section!.total,132*active.qty*(1+(design.materialMarkup??35)/100),'Only documented fixture supply priced when no installation rate or wire distance selected');
    ok(prices.quoteRequired.includes(BORDER_SUPPORT_QUOTE),'Custom support and connections remain an outstanding quote');
    ok(section!.items.some(i=>i.cost===null&&i.name.includes('installation')),'Fixture installation remains explicit rather than zero-priced');
    ok(lightingLines(design).some(line=>line===`Picture-frame edge: ${active.qty} × EVO HYDE 550`),'Proposal sheet and PDF feature list use the same actual border quantity');
    const packed=packFixtureLights(extras.fixtures,{evening:true,enabled:true});
    ok(packed.count===plan.mounts.length,'Night surface-light shader receives every border fixture');
    const exported=deckExportMeshes(design,model).filter(m=>m.name.startsWith('light_evo_hyde_550_'));
    ok(exported.length===plan.mounts.length,'Every actual border fixture reaches model export');
    exported.forEach((mesh,i)=>{near(mesh.vertices.reduce((n,v)=>n+v.x,0)/mesh.vertices.length,plan.mounts[i].x,'Export envelope x agrees with actual mount');near(mesh.vertices.reduce((n,v)=>n+v.y,0)/mesh.vertices.length,plan.mounts[i].y,'Export envelope y agrees with actual mount');near(mesh.vertices.reduce((n,v)=>n+v.z,0)/mesh.vertices.length,plan.mounts[i].z,'Export envelope z agrees with actual mount');});
  }
  proof.push({shape:design.shape,deckType:design.deckType,stairPosition:design.stairPosition,levels:design.levels,mounts:plan.mounts.length,supplyBeforeMarkup:plan.mounts.length*132,coordinates:plan.mounts});
}
near(pictureFrameOverhang(base),2.5,'Selected custom border shows mounting-space concept');
near(pictureFrameOverhang({...base,autoLighting:{border:false}}),.5,'Turning option off restores ordinary saved overhang');
{
  const litStairs={...base,autoLighting:{border:true,stairs:true}},model=buildDeckTakeoff(litStairs),border=borderLightingPlan(litStairs,model);
  const counts={posts:model.railing.posts.length,stairs:model.treads.length,privacy:0,border:border.availableMounts.length};
  const synced=syncAutoLighting({...litStairs,autoLighting:{border:true}},counts);
  ok(model.stairSupport.treadNosingIn===2.5,'Lit step-up noses use the same 2.5 in mounting space as the border');
  ok(synced.some(i=>i.zone==='stairs'&&i.auto&&i.qty===counts.stairs),'Border lighting also installs under-step lights on every tread');
  const one:DeckData={...structuredClone(DEFAULT_DECK),pictureFrameRows:1,pictureFrameOverhangIn:.5,height:7,stairFlights:1,autoLighting:{border:true,stairs:true}};
  const oneModel=buildDeckTakeoff(one),oneCounts={posts:0,stairs:oneModel.treads.length,privacy:0,border:0};
  ok(oneModel.flights[0]?.risers===1&&oneModel.treads.length===1,'A one-riser step-up gets a nosing tread when lighting is on');
  ok(oneModel.stairSupport.treadNosingIn===2.5,'One-riser step-up nose matches the lighting mounting space');
  const oneLit:DeckData={...one,lightingSystem:{wireDistance:0,selectedItems:syncAutoLighting(one,oneCounts)}};
  ok(extrasLayout(oneLit,oneModel).fixtures.some(f=>f.zone==='stairs'),'One-riser step-up receives an under-step light');
  const dark:DeckData={...structuredClone(DEFAULT_DECK),height:7,stairFlights:1};
  ok(buildDeckTakeoff(dark).treads.length===0,'Without lighting, a one-riser step-up stays a rim riser with no extra tread');
}
const loaded=parseDesign(serializeDesign(base));
ok(loaded.autoLighting?.border&&loaded.pictureFrameOverhangIn===.5,'Saved/share design preserves choice and ordinary overhang');
const manual={...base,lightingSystem:{wireDistance:0,selectedItems:[{productId:'evo_hyde_550',qty:2,zone:'stairs' as const},{productId:'wedge',qty:1,zone:'posts' as const}]}};
const model=buildDeckTakeoff(manual),border=borderLightingPlan(manual,model),synced=syncAutoLighting(manual,{posts:0,stairs:0,privacy:0,border:border.mounts.length});
ok(synced.some(i=>i.productId==='evo_hyde_550'&&i.qty===2&&i.zone==='stairs'&&!i.auto),'Manual same-SKU stair choice survives border option');
ok(synced.some(i=>i.productId==='wedge'&&i.qty===1&&!i.auto),'Other manual choices preserved');
ok(synced.some(i=>i.productId==='hub100'&&i.qty===1&&i.auto),'Border option includes existing transformer unless manually supplied');
ok(!synced.some(i=>i.zone==='border'),'Derived border mounts do not pollute saved manual product selection');
const disabled={...base,lightingZoneEnabled:{border:false}},off=calculateEstimate(disabled);
ok(!activeLightingItems(disabled).some(i=>i.zone==='border')&&!extrasLayout(disabled,off.model).fixtures.some(i=>i.zone==='border'),'Zone toggle excludes border supply and rendering');
ok(off.quoteRequired.includes(BORDER_SUPPORT_QUOTE),'Selected custom structural border still requires support detail when lights disabled');
const reel={...base,lightingSystem:{wireDistance:100,selectedItems:[{productId:'cbl_25_14_2',qty:2}]}};
ok(!calculateEstimate(reel).sections.find(s=>s.title==='in-lite® Lighting System')?.items.some(i=>i.name==='Low-voltage cable'),'Purchased reels do not double-charge generic cable allowance');
assert.throws(()=>validateDesign({...base,lightingSystem:{wireDistance:0,selectedItems:[{productId:'evo_hyde_550',qty:30,zone:'border'}]}}));checks++;
// The proof goes to the outer research workspace's outputs/ when this checkout sits in it; a site checkout or CI
// runner has no such folder, and the check itself never depends on it.
const proofDir=new URL('../../../outputs/',import.meta.url);
if(existsSync(proofDir))writeFileSync(new URL('deckcraft-border-lighting-proof.json',proofDir),JSON.stringify({checks,scenarios:proof},null,2));
console.log(`Deck-border lighting: PASS (${checks} checks, ${proof.length} designs; placement/supply/night/export/persistence parity)`);
