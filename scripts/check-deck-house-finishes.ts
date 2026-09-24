import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig,HOUSE_CLADDINGS,ROOF_FINISHES,ROOF_FINISH_LABELS} from '../src/features/deckcraft/houseSettings';
import {buildHouseGeometry,openingFaces} from '../src/features/deckcraft/components/viewer3d/houseGeometry';
import {GABLE_COURSE,SKIN_PIECE_CAP,openingShapes,wallSkin} from '../src/features/deckcraft/components/viewer3d/houseCladdingSkins';
import {ROOF_LOOK,ROOF_TEXTURE_SIZE,roofPixels} from '../src/features/deckcraft/components/viewer3d/roofTextures';
import {HOUSE_COLOUR_FIELDS,houseTrimColors,openingColors,resolveWallFinish,shade} from '../src/features/deckcraft/houseFinishes';
import {HOUSE_PALETTE,PALETTE_FOR,PALETTE_NOTE,paletteName} from '../src/features/deckcraft/housePalette';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {HOUSE_CASES,ORIGINAL_CLADDINGS,SKIN_WALLS,exactDigest,shapesFor} from './deck-house-finishes-cases';
import {designerSource} from './deck-designer-source';
import type {DeckData,HouseCladding,HouseConfig,HouseOpening} from '../src/features/deckcraft/types';

/**
 * Finishes track F4: exterior basics (appearance only, never priced).
 * 1. Existing houses draw exactly as before: the exported house parts, the six original claddings' pieces and the
 *    two original roof textures match deck-house-finishes-golden.json, captured before this work, bit for bit.
 * 2. The resolvers give the studio's original colours when no finish is chosen, and the chosen colour when one is.
 * 3. The seven newer claddings stay finite, inside their wall, clear of openings and under the piece cap.
 * 4. The five newer roofs are real, distinct greyscale textures.
 * 5. Every finish saves, loads and shares; malformed values are refused; absent fields add nothing.
 * 6. No finish moves the deck, its quantities or its price; the export picks up the colours.
 * 7. Wiring: the lazy studio, the 3D view reading the resolvers, and a named, illustrative palette.
 * Run with --update only when a change to the original drawing is owner-approved.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const GOLDEN=new URL('./deck-house-finishes-golden.json',import.meta.url),update=process.argv.includes('--update');
const NEWER=HOUSE_CLADDINGS.filter(c=>!ORIGINAL_CLADDINGS.includes(c));
const base=getHouseConfig(DEFAULT_DECK);
const deck=(patch:Partial<HouseConfig>={},deckPatch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...deckPatch,houseConfig:{...base,widthFt:30,depthFt:24,...patch}});

// 1. The golden: today's code against the drawing captured before exterior finishes existed.
{
  const current={
    house:Object.fromEntries(Object.entries(HOUSE_CASES).map(([name,d])=>{const parts=buildHouseGeometry(d,d.width*12).parts;return [name,{parts:parts.length,digest:exactDigest(parts)}];})),
    skins:Object.fromEntries(ORIGINAL_CLADDINGS.flatMap(cladding=>Object.entries(SKIN_WALLS).map(([wall,w])=>{const {pieces}=wallSkin(cladding,w.span,w.height,shapesFor(w.span,w.openings),w.hidden);return [`${cladding}/${wall}`,{pieces:pieces.length,digest:exactDigest(pieces)}];}))),
    roof:{Shingles:exactDigest(Array.from(roofPixels('Shingles'))),Metal:exactDigest(Array.from(roofPixels('Metal')))},
  };
  if(update||!existsSync(GOLDEN)){
    assert(update,'deck-house-finishes-golden.json is missing: it was captured from the code before F4 and must not be regenerated silently.');
    const note=JSON.parse(readFileSync(GOLDEN,'utf8')).note;
    writeFileSync(GOLDEN,JSON.stringify({note,...current},null,1)+'\n');console.log('House finishes golden rewritten (owner-approved change only).');
  }
  const golden=JSON.parse(readFileSync(GOLDEN,'utf8')) as typeof current;
  for(const group of ['house','skins','roof'] as const){
    ok(Object.keys(golden[group]).sort().join()===Object.keys(current[group]).sort().join(),`${group}: the same cases as the golden`);
    for(const [name,value] of Object.entries(current[group]))assert.deepEqual(value,(golden[group] as Record<string,unknown>)[name],`${group} ${name} draws exactly as before exterior finishes`),checks++;
  }
  // The shapes the facade uses are the ones the golden was captured with.
  const w=SKIN_WALLS.openings;
  assert.deepEqual(openingShapes(w.span,w.openings),shapesFor(w.span,w.openings));checks++;
}

// 2. Resolvers: the original colours when nothing is chosen; the choice when something is.
{
  const originals={slab:'#4a5452',doorPanels:'#56615f',frenchFrames:'#f0eee6',slidingFrames:'#3c4442',windowFrame:'#e9e6dc',mullions:'#38413f',garage:'#e4e2da',garagePanels:'#d6d3ca',carriagePanels:'#cfccc2',glassGarage:'#50585a',garageGlass:'#9fb2b5',handle:'#8e958f',hardware:'#68716d'};
  for(const type of ['Door','Window','Garage'] as const)assert.deepEqual(openingColors(base,{type}),originals,`${type}: original colours`),checks++;
  ok(Object.values(houseTrimColors(base)).every(c=>c===base.trimColor),'Fascia, soffit and gutters follow the trim colour by default');
  const t=houseTrimColors({...base,fasciaColor:'#111111',soffitColor:'#222222',gutterColor:'#333333'});
  ok(t.trim===base.trimColor&&t.fascia==='#111111'&&t.soffit==='#222222'&&t.gutter==='#333333','Fascia, soffit and gutter colours apply on their own');
  const coloured={...base,doorColor:'#8b2320',windowColor:'#1f2021',garageDoorColor:'#25334a'};
  const door=openingColors(coloured,{type:'Door'}),win=openingColors(coloured,{type:'Window'}),garage=openingColors(coloured,{type:'Garage'});
  ok(door.slab==='#8b2320'&&door.frenchFrames==='#8b2320'&&door.slidingFrames==='#8b2320'&&door.mullions==='#8b2320'&&door.doorPanels!==door.slab&&door.windowFrame===originals.windowFrame,'A door colour paints the door, not the windows');
  ok(win.windowFrame==='#1f2021'&&win.mullions==='#1f2021'&&win.slab===originals.slab,'A window colour paints the window frame and bars');
  ok(garage.garage==='#25334a'&&garage.glassGarage==='#25334a'&&garage.garagePanels!==garage.garage&&garage.garageGlass===originals.garageGlass,'A garage-door colour paints the garage door; its glass stays glass');
  ok(openingColors(coloured,{type:'Door',color:'#2f6a6a'}).slab==='#2f6a6a','An opening\'s own colour wins over the house colour');
  ok(door.handle===originals.handle&&door.hardware===originals.hardware,'Handles and hardware keep their metal colours');
  ok(shade('#808080',1)==='#ffffff'&&shade('#808080',-1)==='#000000'&&shade('#123456',0)==='#123456','shade() mixes toward white or black');
  // The original claddings keep their wall colours, part names and shading.
  const expected:Record<string,[string,string,boolean]>={Brick:['#b8b2a7','individual-brick-courses',true],Siding:['cladding','siding-courses',false],Stone:['#8f8a80','stone-cladding',true],Stucco:['cladding','stucco-cladding',false],'Board & batten':['cladding','board-batten-cladding',false],'Vertical siding':['cladding','vertical-siding-cladding',false]};
  for(const cladding of ORIGINAL_CLADDINGS){const f=resolveWallFinish({...base,cladding,claddingColor:'#abcdef'}),[backing,name,variation]=expected[cladding];ok(f.backing===(backing==='cladding'?'#abcdef':backing)&&f.color==='#abcdef'&&f.partName===name&&f.variation===variation&&f.roughness===.82&&f.metalness===0,`${cladding}: original wall colour, part name and shading`);}
  for(const cladding of NEWER){const f=resolveWallFinish({...base,cladding,claddingColor:'#abcdef'});ok(f.color==='#abcdef'&&/^#[0-9a-f]{6}$/.test(f.backing)&&f.partName.endsWith('-cladding')&&f.roughness>0&&f.roughness<=1&&f.metalness>=0&&f.metalness<=1,`${cladding}: a complete look`);}
  ok(resolveWallFinish({...base,cladding:'Horizontal metal'}).metalness>0,'Metal cladding reads as metal');
  assert.deepEqual([ROOF_LOOK.Shingles,ROOF_LOOK.Metal],[{metalness:0,roughness:.92,bumpScale:.12},{metalness:.6,roughness:.4,bumpScale:.06}]);checks++;
}

// 3. The newer claddings: finite, inside the wall, clear of openings and hidden stretches, under the cap.
{
  const inside=(b:{x:number;y:number;w:number;h:number},span:number,height:number)=>b.x-b.w/2>=-span/2-1e-6&&b.x+b.w/2<=span/2+1e-6&&b.y-b.h/2>=-1e-6&&b.y+b.h/2<=height+1e-6;
  const overlaps=(b:{x:number;y:number;w:number;h:number},l:number,r:number,lo:number,hi:number)=>b.x+b.w/2>l+1e-6&&b.x-b.w/2<r-1e-6&&b.y+b.h/2>lo+1e-6&&b.y-b.h/2<hi-1e-6;
  const digests=new Map<string,HouseCladding>();
  for(const cladding of NEWER)for(const [wall,w] of Object.entries(SKIN_WALLS)){
    const shapes=shapesFor(w.span,w.openings),{pieces,simplified}=wallSkin(cladding,w.span,w.height,shapes,w.hidden);
    ok(pieces.length<=SKIN_PIECE_CAP&&(!simplified||pieces.length===0),`${cladding}/${wall}: at most ${SKIN_PIECE_CAP} pieces, or a plain wall`);
    if(wall!=='largest')ok(!simplified&&pieces.length>0,`${cladding}/${wall}: clad in pieces`);
    ok(pieces.every(b=>[b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)&&b.w>0&&b.h>0&&b.d>0&&b.z>0&&b.z-b.d/2>-.01),`${cladding}/${wall}: finite pieces on the wall face`);
    ok(pieces.every(b=>inside(b,w.span,w.height)),`${cladding}/${wall}: every piece inside the wall`);
    ok(pieces.every(b=>shapes.every(o=>!overlaps(b,o.x-o.w/2,o.x+o.w/2,o.y-o.h/2,o.y+o.h/2))),`${cladding}/${wall}: openings left clear`);
    ok(pieces.every(b=>w.hidden.every(([l,r])=>!overlaps(b,l,r,-1,w.height+1))),`${cladding}/${wall}: stretches inside another block left clear`);
    assert.deepEqual(wallSkin(cladding,w.span,w.height,shapes,w.hidden),{pieces,simplified});checks++;
    if(wall==='openings'){const d=exactDigest(pieces);ok(!digests.has(d),`${cladding} looks different from ${digests.get(d)}`);digests.set(d,cladding);}
  }
  for(const cladding of ORIGINAL_CLADDINGS){const w=SKIN_WALLS.openings,d=exactDigest(wallSkin(cladding,w.span,w.height,shapesFor(w.span,w.openings),w.hidden).pieces);ok(!digests.has(d),`${cladding} differs from the newer claddings`);}
  // Pieces are cut round openings, never left out: the 8 in just above and below each door and window is clad
  // about as densely as the wall as a whole (no bare band where a course meets an opening).
  const covered=(pieces:{x:number;y:number;w:number;h:number}[],x0:number,x1:number,y0:number,y1:number)=>{
    const near=pieces.filter(b=>b.x+b.w/2>x0&&b.x-b.w/2<x1&&b.y+b.h/2>y0&&b.y-b.h/2<y1);let hit=0,n=0;
    for(let y=y0+.25;y<y1;y+=.5)for(let x=x0+.25;x<x1;x+=.5){n++;if(near.some(b=>Math.abs(x-b.x)<=b.w/2&&Math.abs(y-b.y)<=b.h/2))hit++;}
    return n?hit/n:1;
  };
  for(const cladding of NEWER)for(const wall of ['openings','garage'] as const){
    const w=SKIN_WALLS[wall],shapes=shapesFor(w.span,w.openings),{pieces}=wallSkin(cladding,w.span,w.height,shapes,w.hidden);
    const open=shapes.reduce((a,o)=>a+o.w*o.h,0),whole=covered(pieces,-w.span/2,w.span/2,0,w.height)*w.span*w.height/(w.span*w.height-open);
    for(const o of shapes)for(const [y0,y1] of [[o.y+o.h/2,Math.min(w.height,o.y+o.h/2+8)],[Math.max(0,o.y-o.h/2-8),o.y-o.h/2]])if(y1-y0>=4)
      ok(covered(pieces,o.x-o.w/2,o.x+o.w/2,y0,y1)>=.75*whole,`${cladding}/${wall}: clad right up to ${o.id}, ${y0>=o.y?'above':'below'} it`);
  }
  const big=SKIN_WALLS.largest;
  ok(wallSkin('Roman brick',big.span,big.height,[],[]).simplified,'A huge Roman-brick wall is simplified to a plain wall');
  ok(wallSkin('Brick',big.span,big.height,[],[]).pieces.length>SKIN_PIECE_CAP,'The original brick is never capped, so it draws as it always has');
  const originalGable:Record<string,number>={Brick:2.625,Siding:7,Stone:8,Stucco:0,'Board & batten':0,'Vertical siding':0};
  ok(HOUSE_CLADDINGS.every(c=>Number.isFinite(GABLE_COURSE[c])&&GABLE_COURSE[c]>=0)&&ORIGINAL_CLADDINGS.every(c=>GABLE_COURSE[c]===originalGable[c]),'Every cladding has a gable course; the originals are unchanged');
}

// 4. Roof textures: greyscale, opaque, real texture, all different.
{
  const seen=new Map<string,string>();
  for(const finish of ROOF_FINISHES){
    const px=roofPixels(finish),n=ROOF_TEXTURE_SIZE*ROOF_TEXTURE_SIZE;
    ok(px.length===n*4,`${finish}: a 256 px texture`);
    let grey=true,opaque=true,min=255,max=0,sum=0;
    for(let i=0;i<n;i++){const r=px[i*4];if(r!==px[i*4+1]||r!==px[i*4+2])grey=false;if(px[i*4+3]!==255)opaque=false;min=Math.min(min,r);max=Math.max(max,r);sum+=r;}
    ok(grey&&opaque,`${finish}: greyscale and opaque`);
    ok(max-min>40&&sum/n>120,`${finish}: visible texture, light enough to carry the roof colour`);
    const d=exactDigest(Array.from(px));ok(!seen.has(d),`${finish} differs from ${seen.get(d)}`);seen.set(d,finish);
    ok(ROOF_FINISH_LABELS[finish]&&ROOF_LOOK[finish],`${finish}: a label and a surface look`);
  }
  ok(ROOF_FINISHES[0]==='Shingles'&&ROOF_FINISHES.includes('Metal'),'The original finishes keep their stored values');
}

// 5. Saving, loading and sharing.
{
  const full:Partial<HouseConfig>={cladding:'Cedar shakes',roofFinish:'Clay tile',fasciaColor:'#111111',soffitColor:'#f7f6f1',gutterColor:'#4b3b2e',doorColor:'#8b2320',windowColor:'#1f2021',garageDoorColor:'#25334a',
    openings:base.openings.map((o,i)=>i===0?{...o,color:'#2f6a6a'}:o)};
  const back=parseDesign(serializeDesign(deck(full))).houseConfig!;
  for(const key of [...HOUSE_COLOUR_FIELDS,'cladding','roofFinish'] as const)ok(back[key]===full[key],`${key} survives save and load`);
  ok(back.openings[0].color==='#2f6a6a'&&back.openings.slice(1).every(o=>o.color===undefined),'An opening\'s own colour survives save and load');
  for(const cladding of HOUSE_CLADDINGS)ok(parseDesign(serializeDesign(deck({cladding}))).houseConfig!.cladding===cladding,`${cladding} survives save and load`);
  for(const roofFinish of ROOF_FINISHES)ok(parseDesign(serializeDesign(deck({roofFinish}))).houseConfig!.roofFinish===roofFinish,`${roofFinish} survives save and load`);
  const plain=validateDesign(deck()).houseConfig!;
  ok(HOUSE_COLOUR_FIELDS.every(k=>!(k in plain))&&plain.openings.every(o=>!('color' in o)),'A design without finishes gains no new fields');
  for(const bad of [{cladding:'Vinyl'},{roofFinish:'Thatch'},{doorColor:'red'},{soffitColor:'#fff'},{gutterColor:12},{windowColor:'#12345g'}])assert.throws(()=>validateDesign(deck(bad as Partial<HouseConfig>)),JSON.stringify(bad)),checks++;
  assert.throws(()=>validateDesign(deck({openings:[{...base.openings[0],color:'blue'}]})),'A bad opening colour is refused');checks++;
  const d=deck(full),link=await encodeDesignLink(d,'https://example.test'),opened=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);
  ok(serializeDeckReleaseDesign(opened)===serializeDeckReleaseDesign(d),'Every finish survives a share link');
}

// 6. Appearance only: the deck, its quantities and its price never move; the export picks up the colours.
{
  const plain=deck(),model=buildDeckTakeoff(plain),total=calculateEstimate(plain).total;
  const looks:Partial<HouseConfig>[]=[
    ...HOUSE_CLADDINGS.map(cladding=>({cladding})),...ROOF_FINISHES.map(roofFinish=>({roofFinish})),
    ...HOUSE_COLOUR_FIELDS.map(k=>({[k]:'#5a3f2b'})),{openings:base.openings.map(o=>({...o,color:'#2f6a6a'}))},
  ];
  for(const look of looks){const d=deck(look);assert.deepEqual(buildDeckTakeoff(d).quantities,model.quantities);assert.equal(calculateEstimate(d).total,total);checks+=2;}
  const deckParts=(d:DeckData)=>JSON.stringify(deckExportMeshes(d,buildDeckTakeoff(d)).filter(m=>!m.name.startsWith('house_')));
  ok(deckParts(deck({cladding:'Fieldstone',roofFinish:'Slate',doorColor:'#8b2320'}))===deckParts(plain),'The exported deck is untouched by house finishes');
  const housePart=(d:DeckData,name:string)=>buildHouseGeometry(d,d.width*12).parts.find(p=>p.name===name)!;
  const shaped=(d:DeckData)=>JSON.stringify(buildHouseGeometry(d,d.width*12).parts.map(p=>[p.name,p.vertices,p.faces]));
  const styled=deck({openings:[{id:'d1',type:'Door',facade:'Front',offsetPct:40,bottomIn:36,widthIn:36,heightIn:84,style:'Single'},{id:'w1',type:'Window',facade:'Front',offsetPct:80,bottomIn:48,widthIn:40,heightIn:48,style:'Double-hung'}]});
  const painted:DeckData={...styled,houseConfig:{...styled.houseConfig!,doorColor:'#8b2320',windowColor:'#1f2021',soffitColor:'#f7f6f1',roofFinish:'Clay tile',cladding:'Norman brick'}};
  ok(shaped(painted)===shaped(styled),'Finishes never move a house part in the export');
  ok(housePart(painted,'Front_Door_d1_slab').color==='#8b2320'&&housePart(painted,'Front_Window_w1_meeting_rail').color==='#1f2021'&&housePart(painted,'soffit').color==='#f7f6f1','The export carries the door, window and soffit colours');
  const g:HouseOpening={id:'g',type:'Garage',facade:'Front',offsetPct:50,bottomIn:0,widthIn:96,heightIn:84};
  ok(openingFaces(g,0,42)[0][1]==='#e4e2da'&&openingFaces(g,0,42,openingColors({garageDoorColor:'#25334a'},g))[0][1]==='#25334a','Garage doors export in their colour');
  ok(designFeatures(plain).every(f=>f!=='deck_house_exterior')&&designFeatures(deck({roofFinish:'Slate'})).includes('deck_house_exterior')&&designFeatures(deck({doorColor:'#8b2320'})).includes('deck_house_exterior'),'The funnel records designs with exterior finishes');
}

// 7. Wiring, the palette and the lazy studio.
{
  const read=(p:string)=>readFileSync(new URL(`../src/features/deckcraft/${p}`,import.meta.url),'utf8'),designer=designerSource();
  const facade=read('components/viewer3d/HouseFacade.tsx'),house=read('components/viewer3d/House3D.tsx'),geometry=read('components/viewer3d/houseGeometry.ts');
  ok(/wallSkin\(/.test(facade)&&/resolveWallFinish\(/.test(facade)&&/openingColors\(/.test(facade),'The facade draws from the cladding skins and colour resolvers');
  ok(!/#(56615f|3c4442|f0eee6|8e958f|68716d|38413f|cfccc2|d6d3ca|50585a|9fb2b5|b8b2a7|8f8a80)/i.test(facade),'No opening or mortar colour is hard-coded in the facade any more');
  ok(/!o\.style&&openingColour\(config,o\)&&<HouseParts items=\{openingFrame\(o\)\}/.test(facade),'An original glass door or window gets a frame only once it has a colour');
  ok(/roofPixels\(/.test(house)&&/houseTrimColors\(/.test(house)&&!/config\.trimColor/.test(house),'The 3D house reads roof textures and trim colours from their modules');
  ok(/openingColors\(config,o\)/.test(geometry)&&/trim\.soffit/.test(geometry),'The export reads the same colours');
  for(const p of ['houseFinishes.ts','housePalette.ts','components/viewer3d/houseCladdingSkins.ts','components/viewer3d/roofTextures.ts'])ok(!/from ['"](three|@react-three)/.test(read(p)),`${p} stays free of three.js`);
  ok(/lazy\(\s*loadExteriorStudio\s*\)/.test(designer)&&/export const loadExteriorStudio=\(\)=>import\(['"]\.\.?\/?.*ExteriorStudio['"]\)/.test(designer),'The exterior studio loads on demand');
  ok(/loadExteriorStudio/.test(readFileSync(new URL('../src/pages/DeckDesigner.tsx',import.meta.url),'utf8')),'The studio is preloaded with the other panels');
  ok(/ExteriorStudio-/.test(readFileSync(new URL('./check-deck-bundle.ts',import.meta.url),'utf8')),'The bundle check keeps the studio out of the first load');
  const studio=read('designer/ExteriorStudio.tsx');
  ok(/appearance only|never priced/i.test(studio)&&studio.includes('PALETTE_NOTE'),'The studio says finishes are looks only, with illustrative colours');
  ok(/HOUSE_CLADDINGS/.test(studio)&&/ROOF_FINISHES/.test(studio)&&/HOUSE_COLOUR_FIELDS/.test(studio),'The studio offers every cladding, roof and colour');
  ok(/onOpenExterior/.test(read('HouseEditor.tsx'))&&/onOpenExterior/.test(read('HouseOpeningsBar.tsx')),'The studio opens from the house section and beside the doors and windows');
  // The palette: about 60 named, valid colours, including the studio's own defaults.
  const all=HOUSE_PALETTE.flatMap(g=>g.colours);
  ok(all.length>=55&&all.length<=70,`${all.length} named colours`);
  ok(all.every(c=>/^#[0-9a-f]{6}$/.test(c.hex)&&c.name.length>1),'Every palette colour has a name and a six-digit hex');
  ok(HOUSE_PALETTE.every(g=>new Set(g.colours.map(c=>c.name)).size===g.colours.length&&new Set(g.colours.map(c=>c.hex)).size===g.colours.length),'No repeats within a palette group');
  ok(paletteName(base.claddingColor)&&paletteName(base.roofColor)&&paletteName(base.trimColor)&&paletteName('#4a5452'),'The studio defaults are in the palette, so a customer can go back');
  ok(/illustrative/i.test(PALETTE_NOTE)&&/confirm with samples/i.test(PALETTE_NOTE),'The palette is labelled illustrative');
  ok(Object.values(PALETTE_FOR).every(ids=>ids.every(id=>HOUSE_PALETTE.some(g=>g.id===id))),'Every colour picker offers real palette groups');
}

console.log(`HOUSE FINISHES OK — ${Object.keys(HOUSE_CASES).length} houses, ${ORIGINAL_CLADDINGS.length*Object.keys(SKIN_WALLS).length} original wall skins and 2 roofs exactly as before; ${NEWER.length} newer claddings, ${ROOF_FINISHES.length-2} newer roofs, colours, saving, sharing, price isolation, export and wiring; ${checks} checks.`);
