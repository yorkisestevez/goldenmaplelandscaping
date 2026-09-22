import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {getHouseContact,exposedHouseLine,availableStairSides} from '../src/features/deckcraft/houseContact';
import {getHousePlacement,MIN_HOUSE_OVERLAP_IN} from '../src/features/deckcraft/housePlacement';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {privacySides} from '../src/features/deckcraft/privacyScreens';
import {unsupportedJoistEnds} from '../src/features/deckcraft/constructionDetails';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const deck=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...patch});
const house=(patch:Partial<ReturnType<typeof getHouseConfig>>)=>({...getHouseConfig(DEFAULT_DECK),...patch});

// 1. Positioning a house that still covers the whole back edge changes nothing but its 3D position.
{
  const plain=deck(),centred=deck({housePlacement:{anchor:'center',offsetIn:0}});
  assert.deepEqual(buildDeckTakeoff(centred).quantities,buildDeckTakeoff(plain).quantities);
  ok(calculateEstimate(centred).total===calculateEstimate(plain).total,'A covering house changes no quantity or price');
}

// 2. A 12 ft house on a 20 ft deck: 12 ft of ledger, 8 ft of exposed back edge framed and railed.
const wide=deck({width:20,houseConfig:house({widthFt:12}),housePlacement:{anchor:'left',offsetIn:0},catalogueAccessories:['tt_protac_flashing']});
const unplaced=deck({width:20,houseConfig:house({widthFt:12})});
{
  const m=buildDeckTakeoff(wide),fp=m.levels[0].footprint,contact=getHouseContact(wide,fp);
  ok(contact.ledgerLf===12,'Ledger stops at the house corner');
  ok(fp.outline.some(p=>p.x===144&&p.y===0),'The back edge is split at the house corner');
  assert.deepEqual(exposedHouseLine(wide,fp,contact),[[144,240]]);checks++;
  ok(getHardwareLayout(wide,m).ledgerBolts.length===12&&getHardwareLayout(wide,m).ledgerBolts.every(b=>b.x<144),'Ledger bolts only along the house');
  const flashing=catalogueAccessoryLayout(wide,m).rows.find(r=>r.id==='tt_protac_flashing');
  ok(flashing?.qty===12,'Flashing only along the house');
  const railGain=m.quantities.railingLf-buildDeckTakeoff(unplaced).quantities.railingLf;
  ok(Math.abs(railGain-8)<.05,`The exposed 8 ft back stretch is railed (gain ${railGain.toFixed(2)} ft)`);
  const sideBeam=m.levels[0].beams.filter(b=>b.role==='house-side-beam');
  ok(sideBeam.length>0&&sideBeam.every(b=>Math.min(b.a.x,b.b.x)>=144-.01&&Math.max(b.a.x,b.b.x)<=240+.01),'A house-side beam spans only the exposed stretch');
  ok(m.levels[0].supports.some(p=>p.x>144&&p.z<12),'Posts carry the house-side beam');
  ok(unsupportedJoistEnds(m.levels[0],contact).length===0,'Every joist end bears on the ledger or a beam');
  ok(!m.railing.rails.some(r=>contact.onContact({x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z})),'No railing along the ledger');
  ok(calculateEstimate(wide).total>calculateEstimate(unplaced).total,'Exposed framing and railing are priced');
  ok(availableStairSides(wide).includes('Back')&&privacySides(wide).includes('Back'),'The exposed back stretch can take stairs and screens');
  const backStairs=buildDeckTakeoff({...wide,stairPosition:'Back'});
  ok(backStairs.flights.length>0&&backStairs.flights.every(f=>f.start.x>144&&f.start.z<1),'Back stairs open on the exposed stretch, never through the house');
  const framed=buildDeckTakeoff({...wide,pictureFrameRows:1});
  ok(framed.levels[0].deckingFootprint!.outline.every(p=>p.y>=-1e-6),'The picture frame stays flush along the whole back line');
}

// 3. Anchor maths and the minimum ledger overlap.
{
  const W=240,HW=144,at=(anchor:'left'|'center'|'right',offsetIn:number)=>getHousePlacement({...unplaced,housePlacement:{anchor,offsetIn}});
  ok(at('left',0).x0===0&&at('right',0).x1===W&&at('center',24).x0===W/2-HW/2+24,'Anchors: left edge, right edge, centre plus shift');
  ok(at('left',-10000).x1===MIN_HOUSE_OVERLAP_IN&&at('left',10000).x0===W-MIN_HOUSE_OVERLAP_IN,'The house always keeps 2 ft against an attached deck');
}

// 4. Door-sill step-down (only once the floor height is set; 7.75 in is the studio's existing riser limit).
{
  const issues=(height:number,floorHeightIn?:number)=>calculateEstimate(deck({height,houseConfig:house({floorHeightIn})})).flags.join(' ');
  ok(!/door sill/i.test(issues(36)),'No sill check until the floor height is set');
  ok(!/door sill/i.test(issues(36,40)),'A 4 in step-down is fine');
  ok(/above the house floor/.test(issues(44,40)),'A deck above the sill is flagged');
  ok(/more than one 7.75 in step/.test(issues(30,40)),'A drop over one riser is flagged');
  ok(!/door sill/i.test(calculateEstimate(deck({deckType:'Freestanding',height:60,houseConfig:house({floorHeightIn:40})})).flags.join(' ')),'Freestanding decks are not checked against the door');
}

// 5. Appearance never prices; house size and position can.
{
  const base=calculateEstimate(wide).total;
  const restyled=calculateEstimate({...wide,houseConfig:house({widthFt:12,roofShape:'Hip',cladding:'Brick',claddingColor:'#884422',storeys:2,openings:[]})}).total;
  ok(restyled===base,'Roof, cladding, colour, storeys and openings never change the price');
  ok(calculateEstimate({...wide,houseConfig:house({widthFt:18})}).total<base,'A wider house means more ledger, less exposed framing');
}

// 6. Save/load and validation.
{
  const saved={...wide,houseConfig:house({widthFt:12,floorHeightIn:40})};
  const back=parseDesign(serializeDesign(saved));
  assert.deepEqual(back.housePlacement,saved.housePlacement);assert.equal(back.houseConfig?.floorHeightIn,40);checks++;
  assert.throws(()=>validateDesign({...saved,housePlacement:{anchor:'middle',offsetIn:0}}));
  assert.throws(()=>validateDesign({...saved,housePlacement:{anchor:'left',offsetIn:1e9}}));
  assert.throws(()=>validateDesign({...saved,houseConfig:{...saved.houseConfig,floorHeightIn:999}}));checks+=3;
}

// 7. Every notch wing and curved strip is framed as its own zone with its own beam, so no joist
//    end is left without a ledger or beam. Only a curved front on a flush-beam (low) deck, which
//    allows almost no cantilever, still needs a curved beam and stays flagged.
{
  const sizes=[{width:16,length:12,height:36},{width:24,length:20,height:72,cutoutWidth:8,cutoutLength:8,cutoutWidth2:4,cutoutLength2:4}];
  for(const size of sizes)for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)for(const deckType of ['Attached','Freestanding'] as const)for(const pattern of ['Straight','Picture Frame','Diagonal','Herringbone'] as const){
    const d=deck({...size,shape,deckType,pattern}),m=buildDeckTakeoff(d),main=m.levels[0];
    ok(unsupportedJoistEnds(main,getHouseContact(d,main.footprint)).length===0,`${shape} ${size.width}×${size.length} ${deckType} ${pattern}: every joist end bears`);
  }
  const lShape=buildDeckTakeoff(deck({shape:'L-Shape'})),wingX=16*12-8*12,wingDepth=12*12-6*12;
  ok((lShape.levels[0].zones?.length??1)===2,'An L-shape frames its notch wing as a separate zone');
  ok(lShape.levels[0].beams.some(b=>Math.min(b.a.x,b.b.x)>=wingX-1&&b.a.z<wingDepth),'The notch wing has its own beam inside the wing');
  ok(lShape.levels[0].supports.some(p=>p.x>wingX&&p.z<wingDepth),'Posts carry the wing beam');
  ok(!calculateEstimate(deck({shape:'L-Shape'})).flags.some(f=>/do not bear/.test(f)),'The L-shape no longer needs a bearing warning');
  const flushCurve=deck({shape:'Curved',height:12,deckType:'Floating'});
  ok(calculateEstimate(flushCurve).flags.some(f=>/do not bear/.test(f)),'A flush-beam curved front is honestly flagged for a curved beam');
}
console.log(`DECK HOUSE OK — ${checks} house position, ledger, exposed-edge framing, door-sill, pricing and persistence checks.`);
