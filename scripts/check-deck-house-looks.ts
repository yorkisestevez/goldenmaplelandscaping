import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig,HOUSE_CLADDINGS,DOOR_STYLES} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {houseLayout,roofRiseOver} from '../src/features/deckcraft/components/viewer3d/houseLayout';
import {buildHouseGeometry,blockRoofRise} from '../src/features/deckcraft/components/viewer3d/houseGeometry';
import {getHouseBlocks,getHouseWalls,openingHidden,openingWallId} from '../src/features/deckcraft/houseFootprint';
import {addHouseOpening,MAX_HOUSE_OPENINGS,OPENING_PRESETS,openingLabel,removeHouseOpening,restyleHouseOpening,stylesFor,wallFloorIn,WINDOW_STYLES} from '../src/features/deckcraft/houseOpenings';
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

// 6. Doors and windows in any style can be added and removed at any point: each preset lands on its
// wall in a clear stretch, restyling keeps size and place, and none of it touches the deck or price.
{
  const garageHouse=deck({footprint:{rects:[{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:22,depthFt:20},{id:'bump1',kind:'house',wall:'Front',offsetFt:11,widthFt:8,depthFt:3}]}});
  const plainModel=buildDeckTakeoff(garageHouse),plainTotal=calculateEstimate(garageHouse).total;
  const houseOf=(d:DeckData)=>d.houseConfig!,walls=getHouseWalls(garageHouse);
  let d=garageHouse,n=0;
  for(const p of OPENING_PRESETS){
    const wallId=p.type==='Garage'?'garage1-back':p.type==='Door'?'main-front':'main-left';
    const {houseConfig,added}=addHouseOpening(d,p.key,wallId,`o${n++}`);
    assert(added,`${p.label} can be added`);
    ok(added.type===p.type&&added.style===p.style&&openingWallId(added,houseConfig)===wallId&&!openingHidden(added,getHouseWalls(d),houseConfig),`${p.label} lands on its wall, in view, with its look`);
    ok(near(added.bottomIn,wallFloorIn(d,wallId)+p.sillIn),`${p.label} sits its sill height above that wall's floor`);
    d={...d,houseConfig};
    assert.deepEqual(buildDeckTakeoff(d).quantities,plainModel.quantities);assert.equal(calculateEstimate(d).total,plainTotal);checks+=2;
  }
  // While a wall has room, each new opening goes in a clear stretch: no overlap, at least 12 in apart.
  const spanOf=(x:DeckData,id:string)=>{const h=houseOf(x),o=h.openings.find(q=>q.id===id)!,w=getHouseWalls(x).find(q=>q.id===openingWallId(o,h))!,at=w.lengthIn*o.offsetPct/100;return [at-o.widthIn/2,at+o.widthIn/2] as const;};
  const visibleOn=(x:DeckData,wallId:string)=>houseOf(x).openings.filter(o=>openingWallId(o,houseOf(x))===wallId&&!openingHidden(o,getHouseWalls(x),houseOf(x)));
  const apart=(x:DeckData,wallId:string)=>{const s=visibleOn(x,wallId).map(o=>spanOf(x,o.id)).sort((a,b)=>a[0]-b[0]);return s.every((v,i)=>i===0||v[0]>=s[i-1][1]+12-1e-6);};
  let roomy=garageHouse;for(let i=0;i<3;i++)roomy={...roomy,houseConfig:addHouseOpening(roomy,'Window:Double-hung','main-back',`r${i}`).houseConfig};
  ok(visibleOn(roomy,'main-back').length===3&&apart(roomy,'main-back'),'Windows added to a clear wall sit apart, never overlapping');
  const plainHouse=deck(),between={...plainHouse,houseConfig:addHouseOpening(plainHouse,'Window:Double-hung','main-front','dh').houseConfig};
  ok(visibleOn(between,'main-front').length===4&&apart(between,'main-front'),'A window added among the existing deck-facing openings finds the clear gap between them');
  // An opening hidden behind a bump-out takes no wall space: the deck door behind a narrow bump-out
  // (its centre covered, its edges not) leaves the 96–156 in gap beside the bump-out whole (centre 126 in).
  const narrow=deck({footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:13.5,widthFt:4,depthFt:3}]}}),door=houseOf(narrow).openings.find(o=>o.id==='deck-door')!;
  ok(openingHidden(door,getHouseWalls(narrow),houseOf(narrow)),'The deck door behind the narrow bump-out is hidden');
  const gapFill={...narrow,houseConfig:addHouseOpening(narrow,'Window:Double-hung','main-front','gf').houseConfig},g=spanOf(gapFill,'gf');
  ok(near((g[0]+g[1])/2,126),'A hidden opening reserves no wall space');
  // On a crowded wall the opening goes in the widest gap left, never on top of an existing one's centre.
  const crowded={...garageHouse,houseConfig:addHouseOpening(garageHouse,'Door:French','main-front','fd').houseConfig},fd=spanOf(crowded,'fd'),mid=(fd[0]+fd[1])/2;
  ok(visibleOn(crowded,'main-front').filter(o=>o.id!=='fd').every(o=>{const s=spanOf(crowded,o.id);return mid<s[0]||mid>s[1];}),'A crowded wall still takes the opening, in its widest gap');
  // A crowded wall still takes the opening (the editor then reports the overlap), always where it can be seen.
  ok(houseOf(d).openings.filter(o=>openingWallId(o,houseOf(d))==='main-front'&&o.id.startsWith('o')).every(o=>!openingHidden(o,walls,houseOf(d))),'Openings on the deck-facing wall avoid the stretch behind the bump-out');
  // Restyling keeps size and place; removing takes out only that opening.
  const first=houseOf(d).openings.find(o=>o.id==='o1')!,restyled=restyleHouseOpening(houseOf(d),'o1','Sliding').openings.find(o=>o.id==='o1')!;
  ok(restyled.style==='Sliding'&&restyled.offsetPct===first.offsetPct&&restyled.widthIn===first.widthIn&&restyled.bottomIn===first.bottomIn,'Restyling keeps size and place');
  ok(!('style' in restyleHouseOpening(houseOf(d),'o1',undefined).openings.find(o=>o.id==='o1')!),'Restyling back to the original look drops the style');
  const removed=removeHouseOpening(houseOf(d),'o2');
  ok(removed.openings.length===houseOf(d).openings.length-1&&!removed.openings.some(o=>o.id==='o2'),'Remove takes out only that opening');
  assert.equal(calculateEstimate({...d,houseConfig:removed}).total,plainTotal);checks++;
  // The cap.
  let full=d;for(let i=0;houseOf(full).openings.length<MAX_HOUSE_OPENINGS;i++)full={...full,houseConfig:addHouseOpening(full,'Window:','main-back',`f${i}`).houseConfig};
  ok(addHouseOpening(full,'Window:','main-back','extra').added===null,`No more than ${MAX_HOUSE_OPENINGS} openings`);
  ok(getHouseWalls(d).find(w=>w.id==='bump1-back')!.exposed.length===0&&addHouseOpening(d,'Window:','bump1-back','hidden').added===null,'A wall wholly inside the house takes no openings');
  // Window styles export their own faces; styles survive save and load on their own kind of opening only.
  const win=(style?:string)=>deck({openings:[{id:'w1',type:'Window',facade:'Front',offsetPct:30,bottomIn:48,widthIn:48,heightIn:48,...(style?{style:style as 'Casement'}:{})}]});
  const names=(x:DeckData)=>deckExportMeshes(x,buildDeckTakeoff(x)).map(m=>m.name).filter(q=>q.includes('Window_w1'));
  ok(names(win()).join()==='house_Front_Window_w1_glass','An unstyled window exports its original pane');
  ok(names(win('Double-hung')).includes('house_Front_Window_w1_meeting_rail')&&names(win('Slider')).includes('house_Front_Window_w1_sash')&&names(win('Casement')).includes('house_Front_Window_w1_mullion')&&names(win('Picture')).includes('house_Front_Window_w1_sill')&&names(win('Awning')).includes('house_Front_Window_w1_bottom_rail'),'Each window style exports its own parts');
  for(const style of WINDOW_STYLES)ok(parseDesign(serializeDesign(win(style))).houseConfig!.openings[0].style===style,`${style} windows survive save and load`);
  const mixed=validateDesign(deck({openings:[{id:'a',type:'Door',facade:'Front',offsetPct:30,bottomIn:36,widthIn:36,heightIn:80,style:'Casement' as 'French'},{id:'b',type:'Window',facade:'Front',offsetPct:70,bottomIn:48,widthIn:36,heightIn:36,style:'French'}]})).houseConfig!.openings;
  ok(mixed.every(o=>o.style===undefined),'A window style never sticks to a door, nor a door style to a window');
  ok(openingLabel({type:'Window',style:'Casement'})==='Casement window'&&openingLabel({type:'Door'})==='Glass panel door'&&stylesFor('Window').length===WINDOW_STYLES.length+1,'Plain names and style lists per type');
}

console.log(`HOUSE LOOKS OK — ${checks} roof pitch, ridge, cladding, door and window style, add/remove, export, price-isolation and persistence checks.`);
