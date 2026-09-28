import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig,HOUSE_CLADDINGS} from '../src/features/deckcraft/houseSettings';
import {getHouseWalls,MAX_HOUSE_BLOCKS} from '../src/features/deckcraft/houseFootprint';
import {buildHouseGeometry,houseWallSpecs,type HouseWallSpec} from '../src/features/deckcraft/components/viewer3d/houseGeometry';
import {houseWallParts} from '../src/features/deckcraft/components/viewer3d/houseWallParts';
import {SKIN_PIECE_CAP,facadeSkins,gableCourses,openingShapes,wallSkin} from '../src/features/deckcraft/components/viewer3d/houseCladdingSkins';
import {WAINSCOT_CAP,splitAtBand,wainscotBand,wainscotCap} from '../src/features/deckcraft/components/viewer3d/houseWainscot';
import {resolveWallFinish} from '../src/features/deckcraft/houseFinishes';
import {blockFinishFor,facadeFinish,finishSource,gableLook,hasWallFinishes,houseFinishFor,houseWallIds,isGableEnd,wholeHouseFinish} from '../src/features/deckcraft/houseWallFinishes';
import {EXTERIOR_LOOKS,LOOK_FIELDS,applyLook,exteriorSummary,ownFinishes,wearsLook,withoutOwnFinishes} from '../src/features/deckcraft/houseLooks';
import {paletteName} from '../src/features/deckcraft/housePalette';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {WAINSCOT_HEIGHT_IN,parseDesign,pruneEdgeNames,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {deckReleaseData,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {ProposalSheet} from '../src/features/deckcraft/ProposalSheet';
import {HOUSE_CASES,ORIGINAL_CLADDINGS,SKIN_WALLS,exactDigest,shapesFor} from './deck-house-finishes-cases';
import type {Box} from '../src/features/deckcraft/deckTakeoff';
import type {DeckData,HouseBlock,HouseCladding,HouseConfig,HouseFinish,HouseOpening} from '../src/features/deckcraft/types';

/**
 * Finishes track F5: per-wall and per-block finishes, wainscots, gable accents and exterior looks (appearance
 * only, never priced).
 * 1. Absent means unchanged: every wall resolves to the whole house, the facade and the export draw exactly as
 *    before (the F4 golden), and saves and links gain nothing.
 * 2. A wall takes its own finish, else its block's, else the whole house's, taken whole.
 * 3. Loading refuses malformed finishes, enforces the wainscot height, drops walls of removed blocks (on load and on
 *    every edit) and so keeps at most 28; everything round-trips through a save and a share link.
 * 4. A wainscot's pieces, the wall above it and its cap stay finite, inside the wall and clear of openings.
 * 5. Looks change appearance fields only; neither they nor any finish moves a quantity, a price or the estimate key.
 * 6. The proposal says "Exterior (appearance only, not priced)" when the house is dressed, and nothing otherwise.
 * 7. Wiring: the 3D picking and outline, the lazy code, and the studio's controls.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const eq=(a:unknown,b:unknown,message:string)=>{assert.deepEqual(a,b,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');
const base=getHouseConfig(DEFAULT_DECK);
const blocks={rects:[
  {id:'bump1',kind:'house' as const,wall:'Front' as const,offsetFt:4,widthFt:8,depthFt:3,storeys:1 as const,roofShape:'Gable' as const},
  {id:'wing1',kind:'house' as const,wall:'Back' as const,offsetFt:0,widthFt:14,depthFt:12},
  {id:'garage1',kind:'garage' as const,wall:'Right' as const,offsetFt:0,widthFt:22,depthFt:20,storeys:1 as const,floorHeightIn:4},
] as HouseBlock[]};
const deck=(patch:Partial<HouseConfig>={},deckPatch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...deckPatch,houseConfig:{...base,widthFt:32,depthFt:26,...patch}});
const garageDoor:HouseOpening={id:'gd',type:'Garage',facade:'Back',wallId:'garage1-back',offsetPct:50,bottomIn:0,widthIn:180,heightIn:84,style:'Panel'};
const STONE:HouseFinish={cladding:'Fieldstone',color:'#8e8b84'},BRICK:HouseFinish={cladding:'Brick',color:'#9a4b3a'},SHAKES:HouseFinish={cladding:'Cedar shakes',color:'#9a9d98'};
const W36={cladding:'Ledgestone' as HouseCladding,color:'#cdb38a',heightIn:36};
/** A house with a finish at every level: the whole house (wainscot, gable accent), the garage, and two walls. */
const dressed=deck({footprint:{rects:blocks.rects.map(b=>b.id==='garage1'?{...b,finish:BRICK}:b)},openings:[...base.openings,garageDoor],wainscot:W36,gableAccent:{cladding:'Cedar shakes',color:'#b59b78'},
  wallFinishes:{'garage1-back':{...SHAKES,wainscot:{...W36,heightIn:24}},'main-front':{...STONE,gable:{cladding:'Siding',color:'#e8e1d2'}}}});
const NEW_KEYS=/"(wallFinishes|wainscot|gableAccent|finish)"/;

// 1. Absent means unchanged.
{
  const golden=JSON.parse(readFileSync(new URL('./deck-house-finishes-golden.json',import.meta.url),'utf8')) as {house:Record<string,{parts:number;digest:string}>};
  for(const [name,d] of Object.entries(HOUSE_CASES)){
    const parts=buildHouseGeometry(d,d.width*12).parts;
    eq({parts:parts.length,digest:exactDigest(parts)},golden.house[name],`${name}: the export builds exactly as before (F4 golden)`);
    const config=getHouseConfig(d);
    ok(!hasWallFinishes(config),`${name}: no wall finishes`);
    for(const w of houseWallSpecs(d,config)){
      const f=facadeFinish(config,w.wall.id);
      assert.deepEqual(f,{wall:resolveWallFinish(config),trim:config.trimColor,openings:config},`${name} ${w.wall.id}: the whole house's finish, as before`);
      assert.deepEqual(gableLook(config,w.wall.id),{cladding:config.cladding,color:config.claddingColor});checks+=2;
    }
    const saved=serializeDesign(d);
    ok(!NEW_KEYS.test(saved),`${name}: a save gains no finish fields`);
    eq(parseDesign(saved),validateDesign(d),`${name}: saves and loads unchanged`);
    ok(pruneEdgeNames(d)===d||!!d.stairEdgeId,`${name}: an edit leaves the house untouched`);
  }
  // Without a wainscot the facade's pieces are exactly the F4 skins, for every cladding and wall.
  for(const cladding of HOUSE_CLADDINGS)for(const [wall,w] of Object.entries(SKIN_WALLS)){
    const shapes=shapesFor(w.span,w.openings);
    eq(facadeSkins(cladding,w.span,w.height,shapes,w.hidden),{skin:wallSkin(cladding,w.span,w.height,shapes,w.hidden)},`${cladding}/${wall}: no wainscot, the same pieces as before`);
  }
  const link=await encodeDesignLink(HOUSE_CASES['blocks/bump-wing-garage'],'https://example.test');
  ok(!NEW_KEYS.test(serializeDeckReleaseDesign(await decodeDesignLink(designLinkFromHash(new URL(link).hash)!))),'A share link gains no finish fields');
  ok(!designFeatures(deck()).includes('deck_house_exterior'),'A plain house is not counted as dressed');
}

// 2. Resolution: the wall's own, else its block's, else the whole house's, taken whole.
{
  const h=dressed.houseConfig!;
  eq(houseFinishFor(h,'garage1-back'),h.wallFinishes!['garage1-back'],'A wall with its own finish takes it');
  eq(houseFinishFor(h,'garage1-front'),BRICK,'A wall of a block with a finish takes the block\'s');
  eq(houseFinishFor(h,'wing1-back'),{cladding:h.cladding,color:h.claddingColor,wainscot:W36,gable:h.gableAccent},'A wall of a block without one takes the whole house\'s');
  eq(houseFinishFor(h,'main-left'),wholeHouseFinish(h),'A main-house wall without one takes the whole house\'s');
  eq(houseFinishFor(h,'main-front'),h.wallFinishes!['main-front'],'The deck-facing wall takes its own');
  ok(!houseFinishFor(h,'main-front').wainscot&&!houseFinishFor(h,'garage1-front').wainscot,'A finish is taken whole: its own finish carries no house wainscot');
  eq(['garage1-back','garage1-front','wing1-left','main-front'].map(id=>finishSource(h,id)),['wall','block','house','wall'],'Where each finish comes from');
  eq(blockFinishFor(h,'garage1'),BRICK,'The garage has its own finish');
  eq(blockFinishFor(h,'wing1'),wholeHouseFinish(h),'The wing follows the house');
  // A wall's finish beats its block's, which beats the house's, even when all three are set.
  const all={...h,wallFinishes:{'garage1-left':STONE}};
  ok(houseFinishFor(all,'garage1-left')===STONE&&houseFinishFor(all,'garage1-right')===BRICK&&houseFinishFor(all,'main-back').cladding===h.cladding,'Wall, then block, then house');
  eq(gableLook(h,'main-front'),{cladding:'Siding',color:'#e8e1d2'},'A wall\'s own gable accent');
  eq(gableLook(h,'garage1-front'),{cladding:'Brick',color:'#9a4b3a'},'Without an accent the wall\'s cladding carries on into its gable');
  eq(gableLook(h,'wing1-left'),h.gableAccent,'The house\'s gable accent on walls that follow the house');
  const f=facadeFinish(h,'garage1-back');
  ok(f.wall.cladding==='Cedar shakes'&&f.wall.color==='#9a9d98'&&f.wainscot?.cladding==='Ledgestone'&&f.wainscot.heightIn===24&&f.trim===h.trimColor&&f.openings===h,'The facade gets the wall\'s look, its wainscot and the house trim');
  eq(houseWallIds(h).length,16,'Four walls per block');
  ok(hasWallFinishes(h)&&hasWallFinishes({...base,wainscot:W36})&&hasWallFinishes({...base,footprint:{rects:[{...blocks.rects[0],finish:STONE}]}}),'Any finish counts');
  // Gable ends: across the ridge of a gable roof.
  const specs=houseWallSpecs(dressed,h),ends=specs.filter(isGableEnd).map(s=>s.wall.id).sort();
  eq(ends,['bump1-back','bump1-front','garage1-left','garage1-right','main-back','main-front','wing1-back','wing1-front'],'Gable ends: across each gable ridge (the garage\'s runs side to side; the wing takes the house\'s gable roof)');
}

// 3. Loading: malformed refused, limits enforced, stale walls dropped, at most 28, round trips.
{
  const load=(patch:Partial<HouseConfig>)=>validateDesign(deck({footprint:blocks,openings:[...base.openings,garageDoor],...patch})).houseConfig!;
  const good=load({wallFinishes:{'main-front':STONE,'ghost1-back':BRICK,'garage1-back':SHAKES}});
  eq(Object.keys(good.wallFinishes!).sort(),['garage1-back','main-front'],'A wall of a block that is gone is dropped quietly');
  ok(!('wallFinishes' in load({wallFinishes:{'ghost1-back':BRICK}})),'Only stale walls: no wall finishes at all');
  for(const heightIn of WAINSCOT_HEIGHT_IN)ok(load({wainscot:{...W36,heightIn}}).wainscot!.heightIn===heightIn,`A ${heightIn} in wainscot loads`);
  const bad:[string,Partial<HouseConfig>|Record<string,unknown>][]=[
    ['a wainscot under 12 in',{wainscot:{...W36,heightIn:11}}],['a wainscot over 72 in',{wainscot:{...W36,heightIn:73}}],['a wainscot with no height',{wainscot:{cladding:'Brick',color:'#9a4b3a'}}],
    ['an unknown cladding',{wallFinishes:{'main-front':{cladding:'Vinyl',color:'#9a4b3a'}}}],['a bad colour',{wallFinishes:{'main-front':{cladding:'Brick',color:'red'}}}],['a short hex',{gableAccent:{cladding:'Brick',color:'#fff'}}],
    ['a bad wall id',{wallFinishes:{'main-top':STONE}}],['a capitalised wall id',{wallFinishes:{'Main-front':STONE}}],['a list',{wallFinishes:[STONE]}],['a bad wall wainscot',{wallFinishes:{'main-front':{...STONE,wainscot:{...W36,heightIn:80}}}}],
    ['a bad gable accent',{wallFinishes:{'main-front':{...STONE,gable:{cladding:'Thatch',color:'#9a4b3a'}}}}],['a bad block finish',{footprint:{rects:[{...blocks.rects[0],finish:{cladding:'Brick'}}]}}],
  ];
  for(const [what,patch] of bad)assert.throws(()=>load(patch as Partial<HouseConfig>),`${what} is refused`),checks++;
  // Every wall of a seven-block house (28), plus walls of blocks that are gone: exactly the 28 stay.
  const six:HouseBlock[]=Array.from({length:MAX_HOUSE_BLOCKS},(_,i)=>({id:`wing${i+1}`,kind:'house',wall:(['Back','Left','Right'] as const)[i%3],offsetFt:(i>>1)*6,widthFt:5,depthFt:4}));
  const everyWall=Object.fromEntries(['main',...six.map(b=>b.id),'ghost1','ghost2'].flatMap(id=>['front','back','left','right'].map(side=>[`${id}-${side}`,{...STONE,wainscot:{...W36,heightIn:12+(id.length%10)*6}}])));
  const full=load({footprint:{rects:six},wallFinishes:everyWall});
  eq(Object.keys(full.wallFinishes!).length,28,'At most 28 walls keep a finish: seven blocks of four');
  eq(houseWallIds(full).sort(),Object.keys(full.wallFinishes!).sort(),'Exactly the walls the house has');
  // Every edit drops the walls of a block that was just removed.
  const withGarage=deckReleaseData(deck({footprint:blocks,wallFinishes:{'garage1-back':SHAKES,'main-front':STONE}}));
  const removed=pruneEdgeNames(deckReleaseData({...withGarage,houseConfig:{...withGarage.houseConfig!,footprint:{rects:blocks.rects.filter(b=>b.id!=='garage1')}}}));
  eq(Object.keys(removed.houseConfig!.wallFinishes!),['main-front'],'Removing the garage drops its wall finishes at once');
  const bare=pruneEdgeNames(deckReleaseData({...withGarage,houseConfig:{...withGarage.houseConfig!,footprint:{rects:blocks.rects.filter(b=>b.id!=='garage1')},wallFinishes:{'garage1-back':SHAKES}}}));
  ok(!NEW_KEYS.test(serializeDesign(bare)),'With none left, nothing is saved');
  ok(pruneEdgeNames(withGarage)===withGarage,'An edit that removes nothing changes nothing');
  // Save, load and share.
  const d=deckReleaseData(dressed);
  eq(parseDesign(serializeDesign(d)).houseConfig,validateDesign(d).houseConfig,'Every finish survives a save and load');
  eq(validateDesign(d).houseConfig!.wallFinishes,dressed.houseConfig!.wallFinishes,'Nothing is lost on the way');
  const link=await encodeDesignLink(d,'https://example.test'),opened=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);
  ok(serializeDeckReleaseDesign(opened)===serializeDeckReleaseDesign(d),'Every finish survives a share link');
  const every=deckReleaseData(deck({footprint:{rects:six},wallFinishes:Object.fromEntries(Object.entries(everyWall).filter(([id])=>!id.startsWith('ghost')).map(([id,f])=>[id,{...f,gable:{cladding:'Siding',color:'#e8e1d2'}}]))}));
  const longest=await encodeDesignLink(every,'https://example.test');
  ok(longest.length<40000,`28 fully dressed walls still share in a link of ${longest.length} characters (under 40,000)`);
}

// 4. Wainscot geometry: finite, inside the wall, clear of openings and hidden stretches, with a cap on the joint.
{
  const E=1e-6;
  const inside=(b:Box,span:number,y0:number,y1:number)=>[b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)&&b.w>0&&b.h>0&&b.d>0&&b.x-b.w/2>=-span/2-E&&b.x+b.w/2<=span/2+E&&b.y-b.h/2>=y0-E&&b.y+b.h/2<=y1+E;
  const overlaps=(b:Box,l:number,r:number,lo:number,hi:number)=>b.x+b.w/2>l+E&&b.x-b.w/2<r-E&&b.y+b.h/2>lo+E&&b.y-b.h/2<hi-E;
  let walls=0;
  for(const [name,w] of Object.entries(SKIN_WALLS)){
    if(name==='largest')continue;
    const shapes=shapesFor(w.span,w.openings),parts=houseWallParts(w.span,w.height,w.openings,w.hidden);
    // Clear of openings (and their casings, by `margin`) and of stretches inside another block. The six original
    // claddings keep their F4 loops verbatim (the golden holds them), which skip a hidden stretch by piece centre.
    const clear=(b:Box,cladding?:HouseCladding,margin=0)=>shapes.every(o=>!overlaps(b,o.x-o.w/2-margin,o.x+o.w/2+margin,o.y-o.h/2-margin,o.y+o.h/2+margin))
      &&w.hidden.every(([l,r])=>cladding&&ORIGINAL_CLADDINGS.includes(cladding)?!(b.x>l+E&&b.x<r-E):!overlaps(b,l,r,-1,w.height+1));
    for(const heightIn of [12,36,72])for(const band of HOUSE_CLADDINGS)for(const cladding of name==='openings'?HOUSE_CLADDINGS:(['Siding','Brick','Fibre-cement lap'] as HouseCladding[])){
      const tag=`${cladding} over ${heightIn} in ${band}/${name}`,top=wainscotBand(heightIn,w.height),s=facadeSkins(cladding,w.span,w.height,shapes,w.hidden,{cladding:band,heightIn});
      assert(s.band&&s.band.top===top&&top===Math.min(heightIn,w.height-12),`${tag}: the band's top`);
      assert(s.band.skin.pieces.every(b=>inside(b,w.span,0,top)&&clear(b,band)),`${tag}: the wainscot stays in its band, clear of openings`);
      assert(s.skin.pieces.every(b=>inside(b,w.span,top,w.height)&&clear(b,cladding)),`${tag}: the wall's cladding stays above the band, clear of openings`);
      assert(s.band.skin.pieces.length<=SKIN_PIECE_CAP&&s.skin.pieces.length<=SKIN_PIECE_CAP,`${tag}: under the piece cap`);
      assert(s.band.cap.every(b=>inside(b,w.span,top-WAINSCOT_CAP.h/2,top+WAINSCOT_CAP.h/2)&&b.y===top&&clear(b,undefined,3)),`${tag}: the cap on the joint, clear of every opening and its casing`);
      checks+=5;walls++;
    }
    for(const heightIn of [12,36,72]){
      const top=wainscotBand(heightIn,w.height),{lower,upper}=splitAtBand(parts,top),area=(bs:Box[])=>bs.reduce((n,b)=>n+b.w*b.h,0);
      ok(Math.abs(area(lower)+area(upper)-area(parts))<1e-6&&lower.every(b=>b.y+b.h/2<=top+E)&&upper.every(b=>b.y-b.h/2>=top-E),`${name}: the wall splits at ${top} in with nothing lost`);
      ok(wainscotCap(w.span,top,w.openings,w.hidden).reduce((n,b)=>n+b.w,0)>0||w.openings.length>0,`${name}: a cap along the band`);
    }
  }
  // A cap meets an opening: it stops at the casing on each side.
  const cap=wainscotCap(120,36,[{offsetPct:50,widthIn:36,bottomIn:0,heightIn:80}],[]);
  eq(cap.map(b=>[b.x-b.w/2,b.x+b.w/2]),[[-60,-21],[21,60]],'The cap stops 3 in out from a door\'s edges');
  ok(wainscotCap(120,36,[{offsetPct:50,widthIn:36,bottomIn:48,heightIn:40}],[]).length===1,'A window above the band leaves the cap whole');
  ok(walls>100,`${walls} wainscot combinations checked`);
  // Gable courses stay inside their triangle.
  for(const cladding of HOUSE_CLADDINGS){const c=gableCourses(cladding,300,108,72);ok(c.every(b=>b.y-b.h/2>=108-E&&b.y+b.h/2<=180+E&&b.w<=300*(1-(b.y+b.h/2-108)/72)+E&&b.w>0),`${cladding}: gable courses inside the triangle`);}
  // The export: a wainscot splits the wall's parts; the names of a wall without one never change.
  const plain=deck({footprint:blocks,openings:[...base.openings,garageDoor]});
  const shape=(d:DeckData)=>JSON.stringify(buildHouseGeometry(d,d.width*12).parts.map(p=>[p.name,p.vertices,p.faces]));
  const recoloured:DeckData={...plain,houseConfig:{...plain.houseConfig!,wallFinishes:{'main-front':STONE},footprint:{rects:blocks.rects.map(b=>({...b,finish:BRICK}))}}};
  ok(shape(recoloured)===shape(plain),'Finishes without a wainscot never move or rename an exported part');
  const parts=buildHouseGeometry(recoloured,recoloured.width*12).parts;
  ok(parts.filter(p=>p.name.startsWith('Front_wall_')).every(p=>p.color===STONE.color)&&parts.filter(p=>p.name.startsWith('garage1_back_wall_')).every(p=>p.color===BRICK.color)&&parts.filter(p=>p.name.startsWith('Back_wall_')).every(p=>p.color===base.claddingColor),'Each exported wall carries its own colour');
  const banded:DeckData={...plain,houseConfig:{...plain.houseConfig!,wainscot:W36}},bp=buildHouseGeometry(banded,banded.width*12).parts;
  const top=(p:{vertices:number[][]})=>Math.min(...p.vertices.map(v=>v[1])),high=(p:{vertices:number[][]})=>Math.max(...p.vertices.map(v=>v[1]));
  ok(bp.some(p=>p.name.startsWith('Front_wainscot_0'))&&bp.some(p=>p.name.startsWith('Front_wainscot_cap_'))&&bp.some(p=>p.name.startsWith('garage1_back_wainscot_cap_')),'The wainscot and its cap are their own exported parts');
  ok(bp.filter(p=>/_wall_\d+$/.test(p.name)).every(p=>top(p)>=36-1e-6)&&bp.filter(p=>/_wainscot_\d+$/.test(p.name)).every(p=>high(p)<=36+1e-6),'Exported wall parts sit above the band, wainscot parts below it');
  const deckParts=(d:DeckData)=>JSON.stringify(deckExportMeshes(d,buildDeckTakeoff(d)).filter(m=>!m.name.startsWith('house_')));
  ok(deckParts(banded)===deckParts(plain),'The exported deck is untouched');
}

// 5. Looks: appearance fields only, never a price, a quantity or the estimate key.
{
  eq(EXTERIOR_LOOKS.map(l=>l.name),['Modern farmhouse','Muskoka cottage','Contemporary','Classic Ontario brick','Coastal'],'The five looks');
  const APPEARANCE=['cladding','claddingColor','wainscot','gableAccent','roofFinish','roofColor','trimColor','fasciaColor','soffitColor','gutterColor','doorColor','windowColor','garageDoorColor'];
  ok(LOOK_FIELDS.every(k=>APPEARANCE.includes(k)),'A look only ever sets appearance fields');
  const houses=[deck(),deck({footprint:blocks,openings:[...base.openings.map(o=>({...o,color:'#2f6a6a'})),garageDoor],roofPitch:9,ridge:'x',storeys:2}),dressed];
  for(const look of EXTERIOR_LOOKS){
    ok(Object.keys(look.set).every(k=>(LOOK_FIELDS as readonly string[]).includes(k)),`${look.name}: sets only look fields`);
    const hexes=[look.set.claddingColor,look.set.roofColor,look.set.trimColor,look.set.wainscot?.color,look.set.gableAccent?.color,...['fasciaColor','soffitColor','gutterColor','doorColor','windowColor','garageDoorColor'].map(k=>look.set[k as 'doorColor'])].filter((x):x is string=>!!x);
    ok(hexes.every(h=>paletteName(h)),`${look.name}: every colour is a named palette colour`);
    for(const d of houses){
      const house=d.houseConfig!,next=applyLook(house,look),changed=[...new Set([...Object.keys(house),...Object.keys(next)])].filter(k=>JSON.stringify(house[k as keyof HouseConfig])!==JSON.stringify(next[k as keyof HouseConfig]));
      ok(changed.every(k=>APPEARANCE.includes(k)),`${look.name}: changes ${changed.join(', ')}, appearance only`);
      ok(wearsLook(next,look)&&JSON.stringify(applyLook(next,look))===JSON.stringify(next),`${look.name}: applied, and applying it again changes nothing`);
      const after:DeckData={...d,houseConfig:next};
      eq(validateDesign(after).houseConfig,parseDesign(serializeDesign(after)).houseConfig,`${look.name}: saves and loads`);
      eq(buildDeckTakeoff(after).quantities,buildDeckTakeoff(d).quantities,`${look.name}: no quantity moves`);
      const [a,b]=[calculateEstimate(after),calculateEstimate(d)];
      eq(a.sections.map(s=>[s.title,s.total]),b.sections.map(s=>[s.title,s.total]),`${look.name}: no price moves`);
      ok(a.total===b.total,`${look.name}: the same total`);
      ok(JSON.stringify(next.wallFinishes)===JSON.stringify(house.wallFinishes)&&JSON.stringify(next.openings)===JSON.stringify(house.openings)&&JSON.stringify(next.footprint)===JSON.stringify(house.footprint),`${look.name}: walls, blocks, doors and windows keep their own finishes`);
    }
  }
  ok(ownFinishes(dressed.houseConfig!)===3&&ownFinishes(withoutOwnFinishes(dressed.houseConfig!))===0,'Own finishes are counted and can be reset');
  const reset=withoutOwnFinishes(dressed.houseConfig!),changed=Object.keys(dressed.houseConfig!).filter(k=>JSON.stringify(dressed.houseConfig![k as keyof HouseConfig])!==JSON.stringify(reset[k as keyof HouseConfig]));
  eq(changed.sort(),['footprint','wallFinishes'],'Resetting own finishes touches only the wall and block finishes (and opening colours)');
  // Every finish is appearance only.
  const plain=deck({footprint:blocks,openings:[...base.openings,garageDoor]}),total=calculateEstimate(plain).total,quantities=buildDeckTakeoff(plain).quantities;
  for(const d of [dressed,{...plain,houseConfig:{...plain.houseConfig!,wainscot:{...W36,heightIn:72}}},{...plain,houseConfig:{...plain.houseConfig!,footprint:{rects:blocks.rects.map(b=>({...b,finish:SHAKES}))}}}]){
    eq(buildDeckTakeoff(d).quantities,quantities,'A wall finish moves no quantity');ok(calculateEstimate(d).total===total,'A wall finish moves no price');
  }
  // The estimate key leaves the house's looks out: all of houseConfig, and a block's finish in the house fit.
  const estimateHook=read('features/deckcraft/designer/useDeckEstimate.ts'),fit=/houseFit:[^\n]*?rects\.map\(b=>\[([^\]]*)\]\)/.exec(estimateHook);
  ok(/houseConfig:undefined/.test(estimateHook)&&fit&&!/finish|wainscot|gable|wallFinishes/.test(fit[1])&&!/wallFinishes|wainscot|gableAccent/.test(estimateHook),'The estimate key never sees a wall finish, wainscot, gable accent or look');
  ok(designFeatures(dressed).includes('deck_house_exterior')&&designFeatures(deck({wainscot:W36})).includes('deck_house_exterior'),'The funnel counts dressed houses');
}

// 6. The proposal's exterior line.
{
  const plain=deckReleaseData(structuredClone(DEFAULT_DECK));
  ok(exteriorSummary(plain)===null&&exteriorSummary(deck())===null,'A house in the studio\'s own look has no exterior line');
  ok(exteriorSummary({...dressed,houseVisible:false})===null,'A hidden house has none');
  const line=exteriorSummary(dressed)!;
  ok(line.startsWith('Exterior (appearance only, not priced): ')&&!/\$|\d+\s*%/.test(line),'Labelled appearance only, not priced, and never a price');
  ok(/Walls: .* over a 36 in Ledgestone wainscot/.test(line)&&/Garage: Brick in Red clay/.test(line)&&/House, deck-facing wall: Fieldstone in Grey stone, Siding gables in Linen/.test(line)&&/Roof: /.test(line),`It names the walls, wainscot, garage, the wall of its own and the roof: ${line}`);
  const looks=EXTERIOR_LOOKS.map(l=>exteriorSummary({...deck(),houseConfig:applyLook(deck().houseConfig!,l)}));
  ok(looks.every(l=>l&&!/#[0-9A-F]{6}/.test(l)),'Every look is described by colour names, not hex codes');
  const render=(data:DeckData)=>{const estimate=calculateEstimate(data);return renderToStaticMarkup(createElement(ProposalSheet,{data,estimate,facts:['Deck area: 192 sq ft'],reviewItems:[],image:null,date:'September 24, 2026'}));};
  ok(render(dressed).includes('Exterior (appearance only, not priced)'),'The printable proposal carries the line');
  ok(!render(plain).includes('Exterior (appearance'),'…and a plain design\'s proposal does not');
  ok(/exteriorSummary\(data\)/.test(read('pages/DeckDesigner.tsx'))&&/import\('\.\.\/features\/deckcraft\/houseLooks'\)/.test(read('pages/DeckDesigner.tsx')),'The PDF gets the same line, its code loaded with the PDF engine');
}

// 7. Wiring: picking walls in 3D, the outline, lazy code, and the studio.
{
  const facade=read('features/deckcraft/components/viewer3d/HouseFacade.tsx'),house=read('features/deckcraft/components/viewer3d/House3D.tsx'),panel=read('features/deckcraft/designer/PreviewPanel.tsx'),viewer=read('features/deckcraft/components/viewer3d/Deck3DViewer.tsx');
  ok(/onSelectHouseWall&&\(\(e:ThreeEvent<MouseEvent>\)=>\{if\(e\.delta>4\)return;e\.stopPropagation\(\);onSelectHouseWall\(wallId\)/.test(facade),'A click on a wall (not an orbit drag) picks it');
  ok(/onSelectHouseWall=\{exteriorOpen\?setHouseWall:undefined\}/.test(panel)&&/selectedHouseWallId=\{exteriorOpen\?houseWall:undefined\}/.test(panel),'Walls can be picked in 3D only while the exterior studio is open');
  ok(/picked&&<PickedWall/.test(facade)&&/raycast=\{\(\)=>null\}/.test(facade)&&/selectedHouseWallId===blockId/.test(facade),'The picked wall (or every wall of a picked block) is outlined, never in the way of a click');
  ok(/picked-wall-outline/.test(viewer)&&/o\.visible=false/.test(viewer),'The proposal snapshot leaves the outline out');
  ok(/finish=\{facadeFinish\(config,f\.wall\.id\)\}/.test(house)&&/accents=\{accents\.filter/.test(house)&&/walls\.filter\(isGableEnd\)/.test(house),'Each wall and gable end, main house and blocks, draws its own resolved finish');
  ok(/name="wall-with-actual-opening-cutouts"/.test(facade)&&/name=\{look\.partName\}/.test(facade)&&/name="wainscot-cap"/.test(facade),'The wall keeps its part names; the wainscot adds its own');
  for(const p of ['houseWallFinishes.ts','houseLooks.ts','components/viewer3d/houseWainscot.ts','components/viewer3d/houseCladdingSkins.ts'])ok(!/from ['"](three|@react-three)/.test(read(`features/deckcraft/${p}`)),`${p} stays free of three.js`);
  // The page never loads the looks or the finish resolver: only the studio, the 3D view, the proposal and the export.
  const route=['pages/DeckDesigner.tsx','features/deckcraft/designer/PreviewPanel.tsx','features/deckcraft/designer/useDeckDesign.ts','features/deckcraft/designer/useDeckEstimate.ts','features/deckcraft/designPersistence.ts','features/deckcraft/designFacts.ts','features/deckcraft/deckAnalytics.ts','features/deckcraft/houseFinishes.ts','features/deckcraft/proposalPdf.ts'];
  for(const p of route)ok(!/^import[^;]*from ['"][./]*(features\/deckcraft\/)?(houseLooks|houseWallFinishes|housePalette)['"]/m.test(read(p)),`${p} never imports the looks, palette or finish resolver up front`);
  const studio=read('features/deckcraft/designer/ExteriorStudio.tsx');
  ok(/tabButton\('looks','Looks'\)/.test(studio)&&/EXTERIOR_LOOKS\.map/.test(studio)&&/applyLook\(house,l\)/.test(studio),'The studio has a Looks tab with every look');
  ok(/aria-label="Walls to finish"/.test(studio)&&/The whole house/.test(studio)&&/A whole block/.test(studio)&&/One wall/.test(studio),'The walls tab picks the whole house, a block or a wall');
  ok(/aria-label="Wainscot height"/.test(studio)&&/WAINSCOT_HEIGHT_IN/.test(studio)&&/Gable accent/.test(studio),'Wainscot (cladding, colour, height within the limits) and gable accent controls');
  ok(/Apply to the whole house/.test(studio)&&/applyToBlock/.test(studio)&&/Reset this wall/.test(studio)&&/resetBlock/.test(studio),'Apply to a block or the whole house, and reset');
  ok(/appearance only|never priced/i.test(studio)&&/never changes a size, a shape or the price/.test(studio),'The studio says looks and finishes are appearance only');
  // Walls a customer can see and pick are exactly the houseWallSpecs walls with an exposed stretch.
  const d=HOUSE_CASES['blocks/bump-wing-garage'],specs:HouseWallSpec[]=houseWallSpecs(d,getHouseConfig(d));
  eq(specs.map(s=>s.wall.id),getHouseWalls(d).map(w=>w.id),'Wall ids come from houseWallSpecs');
  ok(ORIGINAL_CLADDINGS.length===6,'The original claddings are unchanged');
}

console.log(`HOUSE WALLS OK — per-wall, per-block and whole-house finishes resolve wall > block > house; walls of removed blocks drop (at most 28 kept); wainscots stay in the wall and clear of openings; ${EXTERIOR_LOOKS.length} looks touch appearance only; no price, quantity or estimate-key change; absent fields change nothing; ${checks} checks.`);
