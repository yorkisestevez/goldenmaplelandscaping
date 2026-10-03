import type {DeckData} from './types';
import type {Box,DeckTakeoff,Member} from './deckTakeoff';

export type DrySpaceSystem='trex-rainescape'|'timbertech-dryspace';
export interface DrySpaceSelection {enabled:boolean;system:DrySpaceSystem;outletSide:'Left'|'Right';finish:'Black'|'White'|'Bone'}
export const DEFAULT_DRY_SPACE:DrySpaceSelection={enabled:false,system:'trex-rainescape',outletSide:'Right',finish:'Black'};
export const DRY_SPACE_PRODUCTS=[
 {id:'trex-rainescape' as const,name:'Trex RainEscape',position:'Above-joist troughs · before decking',pitchInPerFt:.25,finishes:['Black'] as DrySpaceSelection['finish'][],guide:'https://trexrainescape.com/installation/',sheet:'https://trexrainescape.com/wp-content/uploads/2025/05/Trex-Rainescape-Instruction-Sheet-ENG-May-2025.pdf',supplier:'https://www.deckmasters.ca/under_Deck_Drainage-trex.html'},
 {id:'timbertech-dryspace' as const,name:'TimberTech DrySpace',position:'Below-joist V-panels · new or existing deck',pitchInPerFt:.125,finishes:['White','Bone'] as DrySpaceSelection['finish'][],guide:'https://assets.timbertech.com/content/dam/wp-content/timbertech-dryspace-install.pdf',sheet:'https://www.timbertech.com/resources/installation-guides/',supplier:'https://www.deckmasters.ca/under_Deck_timbertech.html'},
];
export const DRY_SPACE_ALTERNATIVES=[
 {name:'TUFTEX DeckDrain',detail:'Below-joist corrugated panels and slope brackets. Canadian retail listings exist; confirm Ontario stock. Reference only, not modeled.',source:'https://us.onduline.com/sites/onduline_us/files/2020-05/tuftex-deckdrain-traditional-installation-1214.pdf',supplier:'https://us.onduline.com/en/diy/store-locator-roofing-and-building-panels'},
 {name:'Craft-Bilt aluminum decking',detail:'Ontario-extruded interlocking decking with drainage channels. This replaces the walking surface; it is not an under-composite add-on. Reference only.',source:'https://craft-bilt.com/products/aluminum-decking/',supplier:'https://craft-bilt.com/products-category/decking/'},
];
/** Import only configuration, never caller-supplied approvals, prices or slope overrides. */
export function validateDrySpace(raw:unknown):DrySpaceSelection|undefined {
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid dry-space selection.');
 const r=raw as Record<string,unknown>,p=DRY_SPACE_PRODUCTS.find(p=>p.id===r.system);
 if(typeof r.enabled!=='boolean'||!p||!['Left','Right'].includes(String(r.outletSide))||!p.finishes.includes(r.finish as DrySpaceSelection['finish']))throw new Error('Unsupported dry-space system, finish or outlet side.');
 return {enabled:r.enabled,system:p.id,outletSide:r.outletSide as DrySpaceSelection['outletSide'],finish:r.finish as DrySpaceSelection['finish']};
}
export interface DrySpaceRow {name:string;qty:number;unit:string;spec:string}
export interface DrySpaceLayout {boxes:Box[];members:Member[];rows:DrySpaceRow[];issues:string[];selected:boolean;modeled:boolean;quoteRequired:boolean;product:typeof DRY_SPACE_PRODUCTS[number];runIn:number;fallIn:number;minClearanceIn:number;modeledBays:number;blockedBays:number;outletCount:number;uncoveredDepthIn:number;installationSteps:string[]}
const round=(n:number)=>Math.round(n*100)/100;
export function buildDrySpace(data:DeckData,model:DeckTakeoff):DrySpaceLayout {
 const selection=validateDrySpace(data.drySpace),s=selection??DEFAULT_DRY_SPACE,product=DRY_SPACE_PRODUCTS.find(p=>p.id===s.system)!,trex=s.system==='trex-rainescape';
 const result:DrySpaceLayout={boxes:[],members:[],rows:[],issues:[],selected:s.enabled,modeled:false,quoteRequired:s.enabled,product,runIn:0,fallIn:0,minClearanceIn:0,modeledBays:0,blockedBays:0,outletCount:0,uncoveredDepthIn:0,installationSteps:trex?[
  'Before decking: coordinate the ledger flashing, all blocking, post penetrations and trough/downspout layout with the current RainEscape guide. Do not cut or remove structural blocking to fit this preview.',
  'Use RainEscape troughs, downspouts, butyl caulk and 4 in RainEscape tape. Trex Protect and other tape brands are not substitutes. Protect every seam and fastener penetration.',
  'Form a smooth pitched trough toward each funnel. No lengthwise splicing. Align the outlet about 1 in into the separately sized gutter; provide gutter outlets every 12–14 ft.',
  'Use compatible vertical screws / flat-bottomed hidden clips; no spiked or angled clips, nails or drilling over the membrane. Water-test before decking and again after decking.',
 ]:[
  'Survey existing joists, beam locations, underside obstructions and drainage discharge. Use the kit sized for the actual 12 or 16 in on-center framing; narrowed bays require the guide’s field detail.',
  'Set the bracket line to fall 1/8 in per foot away from the house. Fit ledger F-brackets, combo brackets and V-panels per the manufacturer; allow movement in the fastener slots.',
  'Do not run panels over a beam or splice to extend them. Terminate panels at least 3 in before the beam/fascia and combo brackets 1 in before a beam; route the water into a coordinated gutter.',
  'Keep ventilation and cleaning access open. Do not enclose the perimeter with walls or vent dryers/exhaust into the cavity. This is not a waterproof roof or conditioned-room assembly.',
 ]};
 if(!s.enabled)return result;
 const issue=(text:string)=>result.issues.push(text),level=model.levels[0];
 issue('Planning preview and quote quantities only: manufacturer installation instructions, flashing, gutter sizing, local discharge rules, electrical work and permit scope require project review. No waterproof-room or permit approval is implied.');
 if(data.shape!=='Rectangle'||data.levels!==1||data.deckType!=='Attached'||!level){issue('No drainage geometry: this first layout supports a single rectangular attached main deck only. Landings and stairs are not covered.');return result;}
 if(data.installation?.framing&&data.installation.framing!=='Pressure-treated lumber'){issue('No drainage geometry: this layout is restricted to timber framing; metal/engineered-wood attachment needs a system-specific detail.');return result;}
 const joists=[...level.joists].sort((a,b)=>a.a.x-b.a.x);
 if(joists.length<2||joists.some(j=>Math.abs(j.a.x-j.b.x)>.01)){issue('No drainage geometry: joists must run perpendicular to the house ledger.');return result;}
 const minZ=Math.min(...joists.map(j=>Math.min(j.a.z,j.b.z)))+1.5,maxZ=Math.max(...joists.map(j=>Math.max(j.a.z,j.b.z)))-1.5,joistBottom=joists[0].a.y-joists[0].depth/2,joistTop=joists[0].a.y+joists[0].depth/2;
 let endZ=maxZ-(trex?5:3);
 if(!trex){const firstBeam=Math.min(...level.beams.filter(b=>Math.abs(b.a.z-b.b.z)<.01&&b.a.z>minZ+3).map(b=>b.a.z-b.width/2));if(Number.isFinite(firstBeam)){endZ=Math.min(endZ,firstBeam-3);result.uncoveredDepthIn=round(maxZ-endZ);issue(`DrySpace terminates 3 in before the first beam; the remaining ${result.uncoveredDepthIn.toFixed(1)} in toward the fascia is NOT covered. A separate cantilever/gutter detail is required.`);}}
 const run=endZ-minZ;result.runIn=round(run);result.fallIn=round(run/12*product.pitchInPerFt);
 if(run<12||run>192){issue('No drainage geometry: this uninterrupted panel/trough run must fit within 1–16 ft. Longer decks require separately detailed collection zones, never a spliced panel.');return result;}
 if(trex&&result.fallIn>4){issue('No drainage geometry: the trough would exceed the documented 4 in depth envelope.');return result;}
 const width=level.footprint.bounds.w,rows=result.rows;
 const add=(name:string,qty:number,unit:string,spec:string)=>rows.push({name,qty:round(qty),unit,spec});
 const highY=trex?joistTop-.05:joistBottom-1.625,lowY=highY-result.fallIn;
 if(Math.min(lowY-.7,joistBottom-1.5)-3<=0){issue('No drainage geometry: the required system/gutter drop reaches the modeled grade. Verify measured clearance and a different discharge design.');return result;}
 // Seven thin longitudinal strips approximate an open V, not a false flat ceiling.
 for(let i=0;i<joists.length-1;i++){
  const a=joists[i],b=joists[i+1],left=a.a.x+a.width/2,right=b.a.x-b.width/2,clear=right-left;
  if(clear<3||clear>15.01){result.blockedBays++;continue;}
  if(trex&&level.blocking.some(m=>Math.max(m.a.x,m.b.x)>left+.05&&Math.min(m.a.x,m.b.x)<right-.05&&Math.max(m.a.z,m.b.z)+m.width/2>minZ&&Math.min(m.a.z,m.b.z)-m.width/2<endZ&&Math.max(m.a.y,m.b.y)+m.depth/2>lowY-.1)){result.blockedBays++;continue;}
  result.modeledBays++;
  for(let strip=0;strip<7;strip++){
   const x=left+clear*(strip+.5)/7,v=1-Math.abs((strip+.5)/7*2-1),aY=trex?highY:highY-v*.55,bY=trex?highY-result.fallIn*v:lowY-v*.55;
   result.members.push({a:{x,y:aY,z:minZ},b:{x,y:bY,z:endZ},width:clear/7+.02,depth:.04,role:trex?'rainescape-trough':'dryspace-v-panel'});
  }
  if(trex){result.boxes.push({x:(left+right)/2,y:(lowY+joistBottom-1)/2,z:endZ+1,w:Math.min(4,clear),h:Math.max(.2,lowY-joistBottom+1),d:2});}
  else for(const x of [left-.25,right+.25])result.members.push({a:{x,y:highY+.35,z:minZ},b:{x,y:lowY+.35,z:endZ+2},width:.5,depth:.12,role:'dryspace-combo-bracket'});
 }
 if(result.blockedBays)issue(`${result.blockedBays} joist bays are NOT drawn: ${trex?'full-depth/breaker/edge blocking interrupts the trough, or the bay is outside the modeled range. Obtain the manufacturer blocking/ladder/post detail without removing required structure.':'bay is too narrow or wide for this conservative preview. Obtain the manufacturer filler/trim detail.'}`);
 if(!result.modeledBays){issue('No unobstructed bays remain. The selection is retained for review, but no installed drainage quantity or completed dry area is claimed.');return result;}
 result.modeled=true;
 const gutterZ=endZ+(trex?1:1.5),gutterTop=Math.min(lowY-.7,joistBottom-1.5),outlets=Math.ceil(width/144);result.outletCount=outlets;
 // Schematic open U gutters are split into <=12 ft collection zones; never a single wide-deck outlet.
 for(let zone=0;zone<outlets;zone++){
  const x0=width*zone/outlets,x1=width*(zone+1)/outlets,outletX=s.outletSide==='Left'?x0+2:x1-2,drop=(x1-x0)/12*.125,y0=gutterTop-(s.outletSide==='Left'?drop:0),y1=gutterTop-(s.outletSide==='Right'?drop:0);
  for(const z of [gutterZ-2,gutterZ+2])result.members.push({a:{x:x0,y:y0-1.5,z},b:{x:x1,y:y1-1.5,z},width:.05,depth:3,role:'collection-gutter'});
  result.members.push({a:{x:x0,y:y0-3,z:gutterZ},b:{x:x1,y:y1-3,z:gutterZ},width:4,depth:.05,role:'collection-gutter'});
  const bottom=Math.min(y0,y1)-3;result.minClearanceIn=result.minClearanceIn?Math.min(result.minClearanceIn,bottom):bottom;
  const stairsConflict=model.flights.some(f=>outletX>=Math.min(f.start.x,f.end.x)-f.width/2-3&&outletX<=Math.max(f.start.x,f.end.x)+f.width/2+3&&gutterZ>=Math.min(f.start.z,f.end.z)-3&&gutterZ<=Math.max(f.start.z,f.end.z)+3);
  const postConflict=level.supports.some(p=>Math.abs(p.x-outletX)<5&&Math.abs(p.z-gutterZ)<5);
  if(bottom<=12||stairsConflict||postConflict){issue(`Outlet ${zone+1} discharge is NOT drawn: insufficient height or a stair/post conflict. Revise its route before installation.`);continue;}
  result.boxes.push({x:outletX,y:(bottom+6)/2,z:gutterZ,w:2,h:bottom-6,d:3});
  result.members.push({a:{x:outletX,y:6,z:gutterZ},b:{x:outletX,y:3,z:gutterZ+18},width:2,depth:3,role:'discharge-outlet'});
 }
 if(result.minClearanceIn<80)issue(`Illustrative gutter clearance is only ${result.minClearanceIn.toFixed(1)} in above the flat model grade. This is not a usable-room/headroom approval; verify actual terrain and access.`);
 add(trex?'RainEscape uninterrupted troughs':'DrySpace V-panels',result.modeledBays,'bay',`${(run/12).toFixed(2)} ft modeled run; select 12 or 16 ft stock after field measurement`);
 if(trex){add('RainEscape bay downspouts',result.modeledBays,'each','Trim/extend to project joist depth; outlet approximately 1 in into gutter');add('RainEscape 4 in tape, butyl caulk, wall/post flashing',1,'review set','Exact seam lengths, penetrations and accessory quantities require manufacturer takeoff; no substitute tape');}
 else {add('DrySpace combo bracket paths',result.modeledBays*2,'side run','Shared joist combo/double profiles and trim/filler requirements must be reconciled by supplier');add('DrySpace ledger F-bracket cuts',result.modeledBays,'bay','Cut to actual clear opening per guide');}
 add('Collection gutters',width/12,'lf','4 × 3 in preview envelope, 1/8 in/ft illustrative fall—not hydraulic sizing');add('Gutter outlets / discharge routes',outlets,'each','12 ft collection zones in preview; confirm downpipe size, storm intensity, legal discharge and cleaning access');
 issue('The V-panels/troughs, brackets, funnels and gutter envelopes are schematic—not manufacturer shop drawings. Flat modeled grade is not a site drainage plan. Water-test all bays, inspect penetrations and keep outlets serviceable.');
 if(trex&&data.fasteningSystem==='Hidden')issue('Hidden fastener compatibility is unresolved: RainEscape forbids angled/spiked clips. Verify the exact selected clip and fastening direction before ordering.');
 if(!trex)issue('DrySpace must not be boxed in by perimeter skirting/walls. Coordinate open ventilation and access; it does not protect the upper joist faces like an above-joist membrane.');
 return result;
}
