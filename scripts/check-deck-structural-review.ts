import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {CURRENT_BUILD_RULES,usesCurrentBuildRules,usesSizedPiers,usesStructuralReview,usesWallLedgerRule} from '../src/features/deckcraft/buildRules';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {CODE_REFERENCES} from '../src/features/deckcraft/drawings/codeReferences';
import {buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {joistSpanLimitIn} from '../src/features/deckcraft/structure/spanTables';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const design=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...patch});
const estimate=(patch:Partial<DeckData>={})=>calculateEstimate(design(patch));
const flags=(patch:Partial<DeckData>={})=>estimate(patch).flags.join('\n');
const has=(patch:Partial<DeckData>,text:string)=>ok(flags(patch).includes(text),`flags include ${text}`);
const lacks=(patch:Partial<DeckData>,text:string)=>ok(!flags(patch).includes(text),`flags omit ${text}`);

ok(CURRENT_BUILD_RULES==='2026-10-walls'&&usesCurrentBuildRules(DEFAULT_DECK)&&usesStructuralReview(DEFAULT_DECK)&&usesSizedPiers(DEFAULT_DECK)&&usesWallLedgerRule(DEFAULT_DECK),'New designs use the structural review, with sized piers and the wall ledger rule, on top of the 2026-10 takeoff');
ok(usesStructuralReview({buildRules:'2026-10-piers'})&&usesSizedPiers({buildRules:'2026-10-piers'})&&!usesWallLedgerRule({buildRules:'2026-10-piers'}),'A 2026-10-piers save keeps its review and piers, and the whole-house ledger rule');
ok(usesStructuralReview({buildRules:'2026-10-struct'})&&!usesSizedPiers({buildRules:'2026-10-struct'}),'A 2026-10-struct save keeps the structural review and its price-book pier rate');
ok(usesCurrentBuildRules({buildRules:'2026-10'})&&!usesStructuralReview({buildRules:'2026-10'}),'A 2026-10 save keeps the takeoff and skips the structural review');

const saved=estimate({buildRules:'2026-10'});
const live=estimate();
ok(saved.model.levels[0].reference.beam.size==='2x10'&&saved.model.levels[0].reference.beam.plies===3,'A 2026-10 deck still uses a joist-depth 3-ply 2x10 beam');
ok(live.model.levels[0].reference.beam.size==='2x12'&&live.model.levels[0].reference.beam.plies===2,'A new deck sizes the beam apart from the joists: 2-ply 2x12');
ok(!saved.model.foundationSupports.some(f=>f.pierRadiusIn),'A 2026-10 footing stays the schematic pier');
ok((live.model.foundationSupports[0].pierRadiusIn??0)>6,'A new footing is wider than the drawn 12 in pier');
const flash=estimate().sections.flatMap(s=>s.items).find(i=>i.name==='Ledger Flashing');
const savedFlash=saved.sections.flatMap(s=>s.items).find(i=>i.name==='Ledger Flashing');
ok(!!flash&&typeof flash.qty==='number'&&flash.qty>0&&(flash.cost??0)>0,'Attached ledger flashing is priced on a new design');
ok(!savedFlash,'A 2026-10 attached deck does not gain that flashing line');
has({},'Footings size');
lacks({buildRules:'2026-10'},'Footings size');
lacks({},'outside the Barrie');
lacks({},'Stair rise');
lacks({},'Handrail required');
lacks({},'Guard required');
lacks({},'Knee bracing');

has({railingType:'None',height:36},'Guard required');
has({railingType:'None',height:36},'9.8.8.1');
lacks({railingType:'None',height:20},'Guard required');
lacks({railingType:'None',height:36,buildRules:'2026-10'},'Guard required');
has({railingType:'Aluminum',height:36,railDefault:false},'Guard required');

const heavy=estimate({intendedLoad:'Heavy'});
const standard=estimate();
ok(heavy.model.levels[0].reference.codeSized===false,'Heavy-load framing is marked as not span-table sized');
has({intendedLoad:'Heavy'},'Heavy point or area load');
ok(heavy.sections.some(s=>s.items.some(i=>i.name==='Engineering Review'&&i.cost===1500)),'The engineering allowance stays $1,500');
ok(Math.abs(heavy.subtotal-standard.subtotal-1500)<1,'A heavy load adds the engineering allowance and does not reprice the frame');
ok(estimate({intendedLoad:'Heavy',buildRules:'2026-10'}).model.levels[0].reference.codeSized!==false,'A 2026-10 heavy load keeps the old framing presentation');

const brickHouse={...getHouseConfig(design()),cladding:'Brick' as const};
has({houseConfig:brickHouse},'Ledger blocked');
ok(estimate({houseConfig:brickHouse}).model.levels[0].reference.beamRows.some(row=>row.kind==='house'),'Brick veneer frames a house-side beam instead of a ledger');
ok(!estimate({houseConfig:brickHouse}).sections.flatMap(s=>s.items).find(i=>i.name==='Ledger Flashing'),'A blocked ledger is not priced for flashing');
lacks({houseConfig:brickHouse,buildRules:'2026-10'},'Ledger blocked');
// 2026-10-21 (owner): the wall the deck fastens to decides, not the whole house. A new design reads that wall's own
// finish, then its block's, then the house's; a save from before keeps the whole-house rule and its price.
{
 const BRICK_WALL={cladding:'Brick' as const,color:'#9a4b3a'},SIDING_WALL={cladding:'Siding' as const,color:'#e8e1d2'},sided=getHouseConfig(design());
 const flashed=(patch:Partial<DeckData>)=>estimate(patch).sections.flatMap(s=>s.items).some(i=>i.name==='Ledger Flashing'),houseBeam=(patch:Partial<DeckData>)=>estimate(patch).model.levels[0].reference.beamRows.some(row=>row.kind==='house');
 const sidingDeckWall={...brickHouse,wallFinishes:{'main-front':SIDING_WALL}},brickDeckWall={...sided,wallFinishes:{'main-front':BRICK_WALL}},brickOtherWall={...sided,wallFinishes:{'main-back':BRICK_WALL}};
 lacks({houseConfig:sidingDeckWall},'Ledger blocked');ok(flashed({houseConfig:sidingDeckWall})&&!houseBeam({houseConfig:sidingDeckWall}),'A brick house whose deck wall is siding takes a ledger and its flashing');
 has({houseConfig:brickDeckWall},'Ledger blocked: the wall the deck meets is Brick');ok(houseBeam({houseConfig:brickDeckWall})&&!flashed({houseConfig:brickDeckWall}),'A sided house whose deck wall is brick frames a house-side beam, with no ledger flashing');
 lacks({houseConfig:brickOtherWall},'Ledger blocked');ok(estimate({houseConfig:brickOtherWall}).total===standard.total,'Brick on a wall the deck does not meet keeps the price');
 const brickBump={...sided,footprint:{rects:[{id:'bump1',kind:'house' as const,wall:'Front' as const,offsetFt:4,widthFt:8,depthFt:3,finish:BRICK_WALL}]}};
 has({houseConfig:brickBump},'Ledger blocked');ok(!flags({houseConfig:{...brickBump,footprint:{rects:brickBump.footprint.rects.map(({finish:_finish,...b})=>b)}}}).includes('Ledger blocked'),'A brick bump-out the deck meets blocks the ledger through its block finish; the same bump-out in siding does not');
 const piers=(h:typeof sided)=>estimate({houseConfig:h,buildRules:'2026-10-piers'});
 lacks({houseConfig:brickDeckWall,buildRules:'2026-10-piers'},'Ledger blocked');ok(piers(brickDeckWall).total===estimate({buildRules:'2026-10-piers'}).total,'A 2026-10-piers save with a brick deck wall keeps its price');
 has({houseConfig:sidingDeckWall,buildRules:'2026-10-piers'},'Ledger blocked: the house cladding is Brick');
}

has({height:144,framingSize:'2x8'},'Knee bracing');
has({height:144,framingSize:'2x8'},'6x6 posts are inadequate');
has({height:144,framingSize:'2x8'},'9.17.4.1');
has({deckType:'Freestanding',height:96},'Freestanding stability');
lacks({height:36},'Knee bracing');
lacks({height:36},'Freestanding stability');

has({municipality:'Toronto'},'Toronto is outside the Barrie');
has({municipality:'Toronto'},'SB-1');
has({municipality:'Simcoe County'},'Penetanguishene');
has({municipality:'Burlington-Oakville'},'outside the Barrie');
has({municipality:'Rural-Other'},'outside the Barrie');
lacks({municipality:'Toronto',buildRules:'2026-10'},'outside the Barrie');

has({foundationDepthIn:36},'9.12.2.2');
lacks({foundationDepthIn:36,foundation:'Helical Piles'},'9.12.2.2');
lacks({foundationDepthIn:36,foundation:'Deck Blocks'},'9.12.2.2');
lacks({foundationDepthIn:36,deckType:'Floating'},'9.12.2.2');
lacks({},'9.12.2.2');

has({stairTreadDepthIn:8},'Stair run');
has({stairRiserCount:3},'Stair rise');
has({stairRiserCount:10},'Stair rise');
has({railingType:'None'},'Handrail required');
has({railingType:'None'},'9.8.7.1');
lacks({stairTreadDepthIn:8,buildRules:'2026-10'},'Stair run');

ok(joistSpanLimitIn('2x10',16,'Hem-Fir')>joistSpanLimitIn('2x10',16,'SPF'),'Hem-Fir joists span farther than S-P-F');
ok(joistSpanLimitIn('2x10',16,'D.Fir-L')===joistSpanLimitIn('2x10',16,'Hem-Fir'),'D.Fir-L No. 1/No. 2 with bridging matches Hem-Fir');
has({framingSpecies:'Hem-Fir'},'Beam spans stay on S-P-F');
has({framingSpecies:'D.Fir-L'},'D.Fir-L');
lacks({},'Beam spans stay on S-P-F');
ok(estimate({framingSpecies:'Hem-Fir'}).model.levels[0].reference.beam.size==='2x12','A Hem-Fir joist deck still picks its beam from the S-P-F table');

ok(CODE_REFERENCES.length===8&&CODE_REFERENCES.every(ref=>ref.status==='confirm'),'The eight code references stay on confirm');
for(const [id,clause] of [['joists','9.23.4.2'],['beams','9.23.4.2'],['blocking','9.23.9.4'],['posts','9.17.4.1'],['guards','9.8.8.1'],['stairs','9.8.4.1'],['barrie','9.8.8.1'],['springwater','Springwater']] as const){
  ok(CODE_REFERENCES.find(ref=>ref.id===id)?.citation.includes(clause),`${id} cites ${clause}`);
}
const noRail=estimate({railingType:'None',height:36});
const set=buildPermitSet({data:design({railingType:'None',height:36}),model:noRail.model,reviewItems:noRail.flags,date:'QA',priceBook:'QA',materialName:'Wood',railingName:'None'});
ok(set.reviewItems.some(item=>item.includes('9.8.8.1')),'The permit set carries the guard review');
ok(set.sheets.find(sheet=>sheet.id==='G-0')!.items.some(item=>item.kind==='text'&&item.text.includes('DRAFT')),'Permit sheets still say DRAFT');
ok(set.sheets.find(sheet=>sheet.id==='S-2')!.notes.some(note=>note.includes('2-ply 2x12')),'The framing sheet names the independent beam');
ok(noRail.model.levels[0].reference.codeSized!==false,'A missing guard does not mark ordinary framing as unsized');

const hostData=deckReleaseData(design({railingType:'None',height:36}));
let state:DeckAgentHostState={data:hostData,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true,estimate:calculateEstimate(hostData)};
const api=createDeckAgentController({getState:()=>state,commitDesign:()=>{},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:()=>Promise.resolve(),actions:{},shareOrigin:'http://localhost'});
ok(api.read().issues.some(item=>item.includes('Guard required')&&item.includes('9.8.8.1')),'window.deckcraft read() includes the guard review');

console.log(`STRUCTURAL REVIEW OK — ${checks} checks`);
