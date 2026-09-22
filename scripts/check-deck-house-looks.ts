import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig,HOUSE_CLADDINGS,DOOR_STYLES} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {houseLayout,roofRiseOver} from '../src/features/deckcraft/components/viewer3d/houseLayout';
import {buildHouseGeometry,blockRoofRise} from '../src/features/deckcraft/components/viewer3d/houseGeometry';
import {getHouseBlocks} from '../src/features/deckcraft/houseFootprint';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import type {DeckData,HouseConfig} from '../src/features/deckcraft/types';

/**
 * Phase 7: house looks. Roof pitch and ridge direction, claddings and door styles change the house
 * drawing and the export, never the deck, its quantities or its price.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const base=getHouseConfig(DEFAULT_DECK);
const deck=(patch:Partial<HouseConfig>={},deckPatch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...deckPatch,houseConfig:{...base,widthFt:30,depthFt:24,...patch}});
const near=(a:number,b:number,tol=1e-6)=>Math.abs(a-b)<tol;
const part=(d:DeckData,name:string)=>buildHouseGeometry(d,d.width*12).parts.find(p=>p.name===name);
const top=(d:DeckData,name='roof')=>Math.max(...part(d,name)!.vertices.map(v=>v[1]));

// 1. Roof pitch: rise = half the span × pitch / 12; without a pitch the original 0.24 × span.
{
  const W=360,D=288,h=base.storeys*base.storeyHeightIn;
  ok(near(houseLayout(deck(),0).roofRise,W*.24),'No pitch keeps the original gable height');
  for(const pitch of [3,6,9,12]){
    const d=deck({roofPitch:pitch});
    ok(near(houseLayout(d,0).roofRise,W/2*pitch/12)&&near(top(d),h+W/2*pitch/12),`Gable at ${pitch}/12 rises half the span × ${pitch}/12`);
    ok(near(houseLayout(deck({roofPitch:pitch,roofShape:'Hip'}),0).roofRise,Math.min(W,D)/2*pitch/12),`Hip at ${pitch}/12 rises over the shorter span`);
  }
  ok(houseLayout(deck({roofPitch:12,roofShape:'Flat'}),0).roofRise===6,'A flat roof ignores the pitch');
  ok(top(deck({roofPitch:12}))>top(deck({roofPitch:4})),'A steeper pitch draws a taller roof');
  ok(near(roofRiseOver(100,6),25)&&near(roofRiseOver(100),24),'Pitch formula');
  // Attached blocks follow the house pitch.
  const withBump=deck({roofPitch:8,footprint:{rects:[{id:'wing1',kind:'house',wall:'Back',offsetFt:0,widthFt:12,depthFt:14}]}});
  const wing=getHouseBlocks(withBump)[1];
  ok(near(blockRoofRise(wing,8),144/2*8/12)&&near(top(withBump,'wing1_roof'),wing.wallHeightIn+144/2*8/12),'Attached blocks use the house pitch');
}

// 2. Ridge direction: front to back puts the gables on the deck-facing and street walls (the original);
// side to side puts them on the side walls.
{
  const {x0,x1}=getHousePlacement(deck());
  const apexes=(d:DeckData)=>{const g=part(d,'gable_walls')!,max=Math.max(...g.vertices.map(v=>v[1]));return g.vertices.filter(v=>near(v[1],max));};
  const front=apexes(deck()),side=apexes(deck({ridge:'x'}));
  ok(front.every(v=>near(v[0],(x0+x1)/2))&&front.some(v=>near(v[2],0))&&front.some(v=>near(v[2],-288)),'Front-to-back ridge: gable apexes over the deck-facing and street walls');
  ok(side.every(v=>near(v[2],-144))&&side.some(v=>near(v[0],x0))&&side.some(v=>near(v[0],x1)),'Side-to-side ridge: gable apexes over the side walls');
  const ridge=(d:DeckData)=>{const r=part(d,'roof')!,max=Math.max(...r.vertices.map(v=>v[1]));return r.vertices.filter(v=>near(v[1],max));};
  ok(ridge(deck({ridge:'x'})).every(v=>near(v[2],-144))&&near(houseLayout(deck({ridge:'x',roofPitch:6}),0).roofRise,288/2*6/12),'Side-to-side ridge runs along x over the depth');
  ok(ridge(deck({ridge:'y'})).every(v=>near(v[0],(x0+x1)/2)),'ridge y is the original look');
}

// 3. Door styles export their own faces; an unstyled door keeps the original glass panel.
{
  const door=(style?:string)=>deck({openings:[{id:'d1',type:'Door',facade:'Front',offsetPct:50,bottomIn:36,widthIn:72,heightIn:84,...(style?{style:style as 'French'}:{})}]});
  const names=(d:DeckData)=>deckExportMeshes(d,buildDeckTakeoff(d)).map(m=>m.name).filter(n=>n.includes('Door_d1'));
  ok(names(door()).join()==='house_Front_Door_d1_glass','An unstyled door exports its original glass panel');
  ok(names(door('Single')).includes('house_Front_Door_d1_slab')&&names(door('Single')).includes('house_Front_Door_d1_lite'),'A single door exports a slab and a lite');
  ok(names(door('French')).includes('house_Front_Door_d1_stile'),'French doors export their centre stile');
  ok(names(door('Sliding')).includes('house_Front_Door_d1_sash')&&names(door('Sliding')).includes('house_Front_Door_d1_meeting_stile'),'A sliding door exports its sash');
}

// 4. Appearance never changes the deck or its price.
{
  const plain=deck(),model=buildDeckTakeoff(plain),total=calculateEstimate(plain).total;
  const looks:Partial<HouseConfig>[]=[
    ...[3,7,12].map(roofPitch=>({roofPitch})),{ridge:'x'},{ridge:'x',roofPitch:10,roofShape:'Gable'},
    ...HOUSE_CLADDINGS.map(cladding=>({cladding})),
    ...DOOR_STYLES.map(style=>({openings:base.openings.map(o=>o.type==='Door'?{...o,style}:o)})),
  ];
  for(const look of looks){
    const d=deck(look);
    assert.deepEqual(buildDeckTakeoff(d).quantities,model.quantities);
    assert.equal(calculateEstimate(d).total,total);checks+=2;
  }
  // …while the house export does change.
  const houseMeshes=(d:DeckData)=>JSON.stringify(deckExportMeshes(d,buildDeckTakeoff(d)).filter(m=>m.name.startsWith('house_')));
  ok(houseMeshes(deck({roofPitch:10}))!==houseMeshes(plain)&&houseMeshes(deck({ridge:'x'}))!==houseMeshes(plain),'Pitch and ridge change the exported house');
}

// 5. Persistence: every look round-trips; out-of-range values are rejected; a style only sticks to its own kind of opening.
{
  for(const cladding of HOUSE_CLADDINGS){const d=deck({cladding,roofPitch:9,ridge:'x'}),back=parseDesign(serializeDesign(d)).houseConfig!;ok(back.cladding===cladding&&back.roofPitch===9&&back.ridge==='x',`${cladding}, pitch and ridge survive save and load`);}
  const styled=deck({openings:[{id:'d1',type:'Door',facade:'Front',offsetPct:40,bottomIn:36,widthIn:72,heightIn:84,style:'Sliding'},{id:'g1',type:'Garage',facade:'Front',offsetPct:80,bottomIn:0,widthIn:96,heightIn:84,style:'French'},{id:'w1',type:'Window',facade:'Front',offsetPct:10,bottomIn:48,widthIn:36,heightIn:36,style:'Carriage'}]});
  const o=validateDesign(styled).houseConfig!.openings;
  ok(o.find(q=>q.id==='d1')!.style==='Sliding'&&o.find(q=>q.id==='g1')!.style===undefined&&o.find(q=>q.id==='w1')!.style===undefined,'A door style sticks to doors only; mismatched styles are dropped');
  for(const bad of [{roofPitch:2},{roofPitch:13},{ridge:'z'},{cladding:'Vinyl'}])assert.throws(()=>validateDesign(deck(bad as Partial<HouseConfig>)),JSON.stringify(bad)),checks++;
  assert.throws(()=>validateDesign(deck({openings:[{id:'d1',type:'Door',facade:'Front',offsetPct:40,bottomIn:36,widthIn:72,heightIn:84,style:'Barn' as 'French'}]})));checks++;
  ok(validateDesign(deck()).houseConfig!.roofPitch===undefined&&validateDesign(deck()).houseConfig!.ridge===undefined,'Older designs stay without a pitch or ridge');
}

console.log(`HOUSE LOOKS OK — ${checks} roof pitch, ridge, cladding, door style, export, price-isolation and persistence checks.`);
