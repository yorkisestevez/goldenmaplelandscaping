import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {getHouseBlocks,getHouseWalls,houseOutline,normalizeHouseBlocks,openingHidden,openingWallId} from '../src/features/deckcraft/houseFootprint';
import {signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {activeWrap,wrapBlockers,porchStairForDoor} from '../src/features/deckcraft/lib/wrapGeometry';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import type {DeckData,HouseBlock,HouseConfig} from '../src/features/deckcraft/types';

/**
 * Phase 6a: houses with bump-outs, L-wings and an attached garage. The house outline, walls,
 * openings, exports and persistence follow the blocks; the deck itself does not change yet.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const deck=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...patch});
const base=getHouseConfig(DEFAULT_DECK);
const withBlocks=(rects:HouseBlock[],patch:Partial<HouseConfig>={},deckPatch:Partial<DeckData>={})=>deck({...deckPatch,houseConfig:{...base,widthFt:30,depthFt:24,...patch,footprint:{rects}}});
const area=(polys:{x:number;y:number}[][])=>polys.reduce((n,p)=>n+signedArea(p),0);
const exposedLen=(d:DeckData,id:string)=>getHouseWalls(d).find(w=>w.id===id)!.exposed.reduce((n,[a,b])=>n+b-a,0);

// 1. Geometry: union area, exposed walls, for an L, a T, a front bump-out and a side garage.
{
  const L=withBlocks([{id:'wing1',kind:'house',wall:'Back',offsetFt:0,widthFt:12,depthFt:14}]);
  const {x0}=getHousePlacement(L),wing=getHouseBlocks(L)[1].rect;
  ok(wing.x0===x0&&wing.x1===x0+144&&wing.y1===-288&&wing.y0===-288-168,'An L-wing on the street side sits flush with the left corner');
  ok(Math.abs(area(houseOutline(L))-(360*288+144*168))<1,'L-house outline area is the sum of its blocks');
  ok(houseOutline(L).length===1&&houseOutline(L)[0].length===6,'L-house outline is one six-sided polygon');
  ok(Math.abs(exposedLen(L,'main-back')-(360-144))<.01&&exposedLen(L,'wing1-front')===0,'The wall shared by the main block and the wing is interior');
  ok(Math.abs(exposedLen(L,'wing1-left')-168)<.01,'The wing continues the left side wall');

  const T=withBlocks([{id:'wing1',kind:'house',wall:'Back',offsetFt:-4,widthFt:38,depthFt:10}]);
  ok(Math.abs(area(houseOutline(T))-(360*288+456*120))<1,'T-house outline area');
  ok(exposedLen(T,'main-back')===0&&Math.abs(exposedLen(T,'wing1-front')-(456-360))<.01,'A wider cross-wing hides the whole street wall and shows its own overhangs');

  const bump=withBlocks([{id:'bump1',kind:'house',wall:'Front',offsetFt:10,widthFt:10,depthFt:3}]);
  const r=getHouseBlocks(bump)[1].rect;
  ok(r.y0===0&&r.y1===36&&r.x1-r.x0===120,'A bump-out on the deck-facing wall reaches toward the deck');
  ok(Math.abs(exposedLen(bump,'main-front')-240)<.01&&exposedLen(bump,'bump1-back')===0&&exposedLen(bump,'bump1-left')===36,'Bump-out hides its stretch of the deck-facing wall');

  const garage=withBlocks([{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:22,depthFt:20}]);
  const g=getHouseBlocks(garage)[1];
  ok(g.rect.x0===getHousePlacement(garage).x1&&g.rect.y1===0&&g.rect.y0===-264&&g.kind==='garage'&&g.storeys===1,'A side garage sits flush with the deck-facing wall, one storey');
  ok(Math.abs(exposedLen(garage,'main-right')-24)<.01,'Garage longer than the side wall leaves only the hidden stretch covered');
  ok(g.ridge==='x'&&getHouseBlocks(bump)[1].ridge==='z','Cross-gables: ridges run out from the main block');

  // Clamping keeps a block attached, whatever the offset.
  const far=normalizeHouseBlocks({...base,widthFt:30,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:90,widthFt:10,depthFt:3}]}})[0];
  ok(far.offsetFt*12===360-24,'A block keeps at least 24 in of its wall');
}

// 2. Openings: by wall id, hidden on a covered stretch, legacy facade still works.
{
  const garage=withBlocks([{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:22,depthFt:20}],{openings:[...base.openings,
    {id:'gdoor',type:'Garage',facade:'Back',wallId:'garage1-back',style:'Carriage',offsetPct:50,bottomIn:0,widthIn:180,heightIn:84},
    {id:'covered',type:'Window',facade:'Right',offsetPct:50,bottomIn:48,widthIn:36,heightIn:36},
    {id:'stale',type:'Window',facade:'Left',wallId:'gone1-back',offsetPct:50,bottomIn:48,widthIn:36,heightIn:36}]});
  const house=getHouseConfig(garage),walls=getHouseWalls(garage),o=(id:string)=>house.openings.find(q=>q.id===id)!;
  ok(openingWallId(o('gdoor'),house)==='garage1-back'&&openingWallId(o('deck-door'),house)==='main-front','Openings resolve to their wall; old designs use the facade');
  ok(openingWallId(o('stale'),house)==='main-left','A wall id whose block is gone falls back to the facade wall');
  ok(openingHidden(o('covered'),walls,house)&&!openingHidden(o('gdoor'),walls,house),'An opening on a covered stretch is flagged hidden');
  const meshes=deckExportMeshes(garage,buildDeckTakeoff(garage)).map(m=>m.name);
  ok(meshes.includes('house_garage1_back_Garage_gdoor_panel')&&meshes.includes('house_garage1_roof')&&meshes.includes('house_garage1_foundation'),'Garage exports its door, roof and plinth');
  ok(!meshes.some(m=>m.includes('_covered_')),'A hidden opening is not exported');
  ok(meshes.some(m=>m.startsWith('house_garage1_right_wall_'))&&meshes.some(m=>m.startsWith('house_garage1_back_wall_')),'Garage walls export under the block name');
}

// 3. The main block builds exactly as before; blocks that do not touch the deck change no price.
{
  const plain=deck({houseConfig:{...base,widthFt:30,depthFt:24}}),plainModel=buildDeckTakeoff(plain);
  const L=withBlocks([{id:'wing1',kind:'house',wall:'Back',offsetFt:0,widthFt:12,depthFt:14},{id:'garage1',kind:'garage',wall:'Left',offsetFt:0,widthFt:22,depthFt:20}]);
  const main=(d:DeckData)=>deckExportMeshes(d,buildDeckTakeoff(d)).filter(m=>m.name.startsWith('house_')&&!/^house_(wing1|garage1)_/.test(m.name)&&!/_wall_/.test(m.name));
  assert.deepEqual(main(L),main(plain));checks++;
  const Lmodel=buildDeckTakeoff(L);
  assert.deepEqual(Lmodel.quantities,plainModel.quantities);checks++;
  ok(calculateEstimate(L).total===calculateEstimate(plain).total,'Blocks away from the deck leave the price unchanged');
  ok(!Lmodel.issues.some(i=>i.includes('reaches')),'Blocks away from the deck raise no overlap issue');
  // Appearance of blocks and the garage door never prices.
  const styled=withBlocks([{id:'wing1',kind:'house',wall:'Back',offsetFt:0,widthFt:12,depthFt:14,storeys:2,roofShape:'Flat'},{id:'garage1',kind:'garage',wall:'Left',offsetFt:0,widthFt:22,depthFt:20,roofShape:'Hip'}],{openings:[...base.openings,{id:'gd',type:'Garage',facade:'Back',wallId:'garage1-back',style:'Glass',offsetPct:40,bottomIn:0,widthIn:96,heightIn:84}]});
  ok(calculateEstimate(styled).total===calculateEstimate(L).total,'Block storeys, roofs and garage door style never change the price');
  // The yard sees the whole house: a patio inside the garage is reported, the same patio beside a plain house is not.
  const {x0}=getHousePlacement(L),patio={id:'p1',kind:'patio' as const,name:'Patio',enabled:true,xFt:(x0-120)/12,zFt:-10,widthFt:4,depthFt:4,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#aaa69b'};
  const warns=(d:DeckData)=>buildYardModel({...d,yardFeatures:[patio]}).features.flatMap(f=>f.warnings);
  ok(warns(L).some(w=>w.includes('overlaps the house footprint'))&&!warns(plain).some(w=>w.includes('overlaps the house footprint')),'Yard features are checked against the whole house outline');
}

// 4. A block reaching into a freestanding deck is reported; an attached deck is notched around it (6b).
{
  const bump=[{id:'bump1',kind:'house' as const,wall:'Front' as const,offsetFt:10,widthFt:10,depthFt:3}];
  ok(buildDeckTakeoff(withBlocks(bump,{},{deckType:'Freestanding'})).issues.some(i=>i.includes('bump-out reaches')&&i.includes('freestanding')),'A bump-out into a freestanding deck raises an issue');
  ok(!buildDeckTakeoff(withBlocks(bump,{},{deckType:'Attached'})).issues.some(i=>i.includes('reaches')),'An attached deck is notched instead');
}

// 5. Wraps pause on a conflicting block and name why; a block clear of the wing does not.
{
  const wrap={right:{widthFt:8,runFt:10}};
  const clash=withBlocks([{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:22,depthFt:20}],{},{width:22,length:12,wrap});
  ok(!activeWrap(clash)&&wrapBlockers(clash).some(b=>b.includes('right wing would run into the garage')),'A garage on the wrapped wall pauses the wrap');
  const clear=withBlocks([{id:'garage1',kind:'garage',wall:'Right',offsetFt:12,widthFt:10,depthFt:20}],{},{width:22,length:12,wrap});
  ok(!!activeWrap(clear),'A garage set back past the wing run leaves the wrap working');
  const corner=withBlocks([{id:'bump1',kind:'house',wall:'Front',offsetFt:28,widthFt:2,depthFt:3}],{},{width:22,length:12,wrap});
  ok(!activeWrap(corner)&&wrapBlockers(corner).some(b=>b.includes('wrapped right corner')),'A bump-out at a wrapped corner pauses the wrap');
  const porch=withBlocks([{id:'wing1',kind:'house',wall:'Back',offsetFt:24,widthFt:6,depthFt:10}],{},{width:22,length:12,wrap:{right:{widthFt:8,runFt:10},porchRight:{depthFt:6,runFt:10}}});
  ok(!activeWrap(porch)&&wrapBlockers(porch).some(b=>b.includes('right porch would run into')),'A street-side wing in the porch path pauses the wrap');
  // A street door found by wall id still opens the porch stair.
  const door=withBlocks([],{openings:[...base.openings,{id:'street-door',type:'Door',facade:'Back',wallId:'main-back',offsetPct:10,bottomIn:36,widthIn:36,heightIn:80}]},{width:22,length:12,wrap:{right:{widthFt:8,runFt:10},porchRight:{depthFt:6,runFt:10}}});
  ok(porchStairForDoor(door)?.doorId==='street-door','A street door named by wall id opens the porch stair');
}

// 6. Persistence: round trip, allowlisted fields, bad values rejected, never thrown for UI states.
{
  const d=withBlocks([{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:22,depthFt:20,storeys:1,floorHeightIn:4,roofShape:'Gable'},{id:'bump1',kind:'house',wall:'Front',offsetFt:90,widthFt:10,depthFt:3}],{openings:[...base.openings,{id:'gd',type:'Garage',facade:'Back',wallId:'garage1-back',style:'Carriage',offsetPct:50,bottomIn:0,widthIn:180,heightIn:84}]});
  const back=parseDesign(serializeDesign(d)),h=back.houseConfig!;
  ok(h.footprint?.rects.length===2&&h.footprint.rects[0].floorHeightIn===4&&h.footprint.rects[0].roofShape==='Gable','Blocks survive save and load');
  ok(h.footprint!.rects[1].offsetFt*12===360-24,'Saved blocks are clamped to stay attached');
  const gd=h.openings.find(o=>o.id==='gd')!;
  ok(gd.wallId==='garage1-back'&&gd.style==='Carriage'&&gd.type==='Garage','Garage door wall, type and style survive save and load');
  const orphan=validateDesign({...d,houseConfig:{...d.houseConfig!,footprint:undefined}});
  ok(orphan.houseConfig!.openings.find(o=>o.id==='gd')!.wallId===undefined,'An opening whose block is gone drops its wall id');
  assert.throws(()=>validateDesign({...d,houseConfig:{...d.houseConfig!,footprint:{rects:[{id:'main',kind:'house',wall:'Front',offsetFt:0,widthFt:10,depthFt:3}]}}}));checks++;
  assert.throws(()=>validateDesign({...d,houseConfig:{...d.houseConfig!,footprint:{rects:[{id:'b1',kind:'shed',wall:'Front',offsetFt:0,widthFt:10,depthFt:3}]}}} as never));checks++;
  assert.throws(()=>validateDesign({...d,houseConfig:{...d.houseConfig!,openings:[{...gd,style:'Barn'}]}} as never));checks++;
  const emptied=validateDesign({...d,houseConfig:{...d.houseConfig!,footprint:{rects:[]}}});
  ok(emptied.houseConfig!.footprint===undefined,'An empty block list saves as a plain house');
}

console.log(`HOUSE SHAPE OK — ${checks} checks: L, T, bump-out and garage outlines, walls, openings, exports, price, wraps and persistence.`);
