import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {CURRENT_BUILD_RULES} from '../src/features/deckcraft/buildRules';
import {boardMaxOverhangIn,finishedFasciaOffset,pictureFrameCompatibility,pictureFrameOverhang} from '../src/features/deckcraft/lib/finishedFootprint';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {exposedRim} from '../src/features/deckcraft/houseContact';
import {fasciaSlabs} from '../src/features/deckcraft/components/viewer3d/fasciaSlabs';
import {FASCIA_PROUD_IN} from '../src/features/deckcraft/lib/finishedFootprint';

// Owner 2026-10-30: the picture frame on a new deck overhangs the fascia by the most its board's install guide allows
// (TimberTech Advanced PVC 0.5 in; TimberTech Composite and Deckorators Surestone 1 in), and the fascia has its own
// thickness over the rim. Saved designs keep the overhang and fascia they were quoted with.
let checks=0;const ok=(cond:unknown,msg:string)=>{assert(cond,msg);checks++;};
const fresh=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...patch});

ok(DEFAULT_DECK.buildRules===CURRENT_BUILD_RULES&&!('pictureFrameOverhangIn' in DEFAULT_DECK),'A new design leaves the overhang to its board');
ok(DEFAULT_DECK.deckingMaterial==='tt_harvest'&&pictureFrameOverhang(fresh())===.5,'The default Harvest (Advanced PVC) frame overhangs 0.5 in');
for(const board of ['tt_vintage','tt_landmark','tt_harvest_plus'])ok(boardMaxOverhangIn(fresh({deckingMaterial:board}))===.5,`${board} (Advanced PVC) allows 0.5 in`);
for(const board of ['tt_prime_plus','tt_reserve','deck_voyage','deck_summit'])ok(pictureFrameOverhang(fresh({deckingMaterial:board}))===1,`${board} frames overhang 1 in by default`);
ok(pictureFrameCompatibility(fresh()).every(n=>!n.includes('exceeds'))&&pictureFrameCompatibility(fresh({deckingMaterial:'tt_prime_plus'})).every(n=>!n.includes('exceeds')),'The default overhang never trips a manufacturer limit');
ok(pictureFrameOverhang(fresh({pictureFrameOverhangIn:0}))===0&&pictureFrameOverhang(fresh({pictureFrameOverhangIn:1.5}))===1.5,'An overhang the user sets wins');
ok(pictureFrameOverhang(fresh({autoLighting:{border:true}}))===2.5,'Border lighting keeps its 2.5 in mounting space');

// The fascia: its own thickness over the rim on a new design; the rim face on an old one.
ok(finishedFasciaOffset(fresh())===1.525,'A new design finishes the rim with a fascia board (outer face 1.525 in from the rim centre line)');
ok(finishedFasciaOffset(fresh({buildRules:'2026-10-walls',pictureFrameOverhangIn:0}))===.75,'A 2026-10-walls save keeps the rim-face fascia');

// The finished outline: every exposed edge sits fascia + overhang out from the rim centre line.
{const d=fresh({deckType:'Freestanding',width:16,length:12}),l=buildDeckTakeoff(d).levels[0],xs=l.deckingFootprint!.outline.map(p=>p.x),ys=l.deckingFootprint!.outline.map(p=>p.y),s=l.footprint.outline;
  const grow=Math.min(...s.map(p=>p.x))-Math.min(...xs);
  ok(Math.abs(grow-2.025)<1e-6&&Math.abs(Math.max(...ys)-Math.max(...s.map(p=>p.y))-2.025)<1e-6,`A freestanding Harvest deck's frame edge sits 1.525 + 0.5 in past the rim centre line (got ${grow})`);}

// The 3D fascia stands proud only where a fascia goes: the rim the house does not cover. Along the ledger it stays the rim.
{const d=fresh({deckType:'Attached',width:16,length:12}),m=buildDeckTakeoff(d),exposed=new Set(exposedRim(d,m)),rim=m.levels[0].rim??[],slabs=fasciaSlabs(m,FASCIA_PROUD_IN,exposed);
  ok(rim.length>exposed.size&&exposed.size>0,'The attached deck has a house-side rim and exposed rim');
  ok(slabs.every((s,i)=>Math.abs(s.thick-(rim[i].width+(exposed.has(rim[i])?FASCIA_PROUD_IN:0)))<1e-9),'Exposed rim slabs carry the fascia thickness; house-side rim slabs keep the rim thickness');}

// Saving and reopening.
const back=parseDesign(serializeDesign(fresh()));
ok(back.buildRules===CURRENT_BUILD_RULES&&back.pictureFrameOverhangIn===undefined&&pictureFrameOverhang(back)===.5,'A new design reopens still following its board');
ok(pictureFrameOverhang(parseDesign(serializeDesign(fresh({deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk'}))))===1,'Changing the board after reopening still follows the board');
ok(validateDesign({...fresh(),pictureFrameOverhangIn:undefined}).pictureFrameOverhangIn===undefined,'An in-app edit that clears the overhang back to the board default validates');
const walls=validateDesign({...fresh(),buildRules:'2026-10-walls',pictureFrameOverhangIn:0});
ok(walls.buildRules==='2026-10-walls'&&pictureFrameOverhang(walls)===0,'A 2026-10-walls save keeps its flush frame');
const wallsBare=validateDesign((({pictureFrameOverhangIn:_o,...rest})=>({...rest,buildRules:'2026-10-walls'}))(fresh()));
ok(pictureFrameOverhang(wallsBare)===0,'A 2026-10-walls design missing the key keeps the flush frame it was created with');
ok(pictureFrameOverhang(validateDesign({width:16,length:12,pictureFrameRows:1}))===1.5,'A legacy save keeps 1.5 in');
console.log(`Picture-frame overhang default: ${checks} checks passed.`);
