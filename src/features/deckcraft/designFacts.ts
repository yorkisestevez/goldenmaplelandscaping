import {exposedHouseLine,getHouseContact} from './houseContact';
import {getHouseBlocks,normalizeHouseBlocks} from './houseFootprint';
import {getHouseConfig} from './houseSettings';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from './manufacturerCatalog';
import {screenOn,screenProduct} from './privacyScreens';
import {activeWrap,describeWrap,WRAP_EDGE_NAMES} from './lib/wrapGeometry';
import {activeCornerChamfers,chamferShapeWords,describeChamfers} from './lib/cornerChamfers';
import {describeBackyard,splitSubtotal} from './backyard';
import type {calculateEstimate} from './calculations';
import type {DeckData} from './types';

export type DeckEstimate=ReturnType<typeof calculateEstimate>;
export type DeckMaterial=(typeof DECKING_CATALOGUE)[number];
export const dollars=(n:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);

/** The deck's shape in a few words: a wrap-around, a rectangle with angled corners, or the shape name. */
export const shapeWords=(data:DeckData,wrapped:boolean)=>{const c=wrapped?null:activeCornerChamfers(data);return wrapped?'Wrap-around':c?`Rectangle with ${chamferShapeWords(c)}`:data.shape;};
/**
 * The plain-language description of a design: the same words on the estimate step, in the summary
 * download, on the proposal and in a design sent to Golden Maple, built once from the design and its estimate.
 */
export function describeDesign(data:DeckData,estimate:DeckEstimate){
  const houseConfig=getHouseConfig(data),wrap=activeWrap(data),screens=data.privacyScreens??[];
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)??DECKING_CATALOGUE[0];
  const catalogueRail=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId);
  const railingName=catalogueRail?.name??data.railingType;
  const quoteRequired=estimate.quoteRequired??[];
  const priceLabel=quoteRequired.length?'Priced portion only':'Current planning estimate';
  const mainFootprint=estimate.model.levels[0].footprint,ledger=getHouseContact(data,mainFootprint),pastHouseFt=exposedHouseLine(data,mainFootprint,ledger).reduce((n,[a,b])=>n+(b-a)/12,0);
  const placedHouse=data.housePlacement,sillIn=houseConfig.floorHeightIn;
  const edgeName=(id?:string)=>id?(WRAP_EDGE_NAMES[id]??id).toLowerCase():undefined;
  const l3=data.levels>2?data.level3:undefined,chamfers=wrap?null:activeCornerChamfers(data);
  const split=splitSubtotal(estimate);
  const onScreens=screens.filter(screenOn),autoLights=data.lightingSystem.selectedItems.filter(i=>i.auto&&i.zone);
  const facts=[
    `Deck area: ${estimate.model.quantities.area.toFixed(0)} sq ft`,
    data.shape==='L-Shape'?`L-shape with a ${data.cutoutWidth} × ${data.cutoutLength} ft corner cut-out at the front right`:data.shape==='Multi-corner'?`Two corner cut-outs: ${data.cutoutWidth} × ${data.cutoutLength} ft (front right) and ${data.cutoutWidth2} × ${data.cutoutLength2} ft (front left)`:data.shape==='Curved'?'Curved front edge':wrap?`Main deck ${data.width} × ${data.length} ft along the deck-facing wall, with wrap-around wings`:`Rectangle ${data.width} × ${data.length} ft${chamfers?` with ${describeChamfers(chamfers)}`:''}`,
    ...(data.levels>1?[`Second level ${data.width2} × ${data.length2} ft at ${data.height2} in, off the ${edgeName(data.level2EdgeId)??String(data.level2Position??'Front').toLowerCase()+' side'}${data.level2FullStep?', joined by a full-width step':''}`]:[]),
    ...(l3?[`Third level ${l3.widthFt} × ${l3.lengthFt} ft at ${l3.heightIn} in, off the ${l3.parent===2?'second level':'main deck'} (${(l3.parent===1&&edgeName(l3.edgeId))||l3.position.toLowerCase()+' side'})${l3.fullStep?', joined by a full-width step':''}`]:[]),
    ...(wrap?[describeWrap(wrap)]:[]),
    ledger.contacts.length?`Attached to the house with ${ledger.ledgerLf.toFixed(1)} ft of ledger${ledger.contacts.length>1&&wrap?` (${ledger.contacts.filter(c=>c.kind==='ledger'&&c.blockId==='main').map(c=>`${(c.lengthIn/12).toFixed(1)} ft on the ${c.wall==='front'?'deck-facing':c.wall==='far'?'street-side':c.wall+' side'} wall`).join(', ')})`:''}${pastHouseFt>0?`; ${pastHouseFt.toFixed(1)} ft of the back edge extends past the house (railing, beam and posts)`:''}${getHouseBlocks(data).slice(1).filter(k=>ledger.contacts.some(c=>c.blockId===k.id)).map(k=>{const mine=ledger.contacts.filter(c=>c.blockId===k.id),face=mine.filter(c=>c.kind==='ledger').reduce((n,c)=>n+c.lengthIn,0)/12,sides=mine.filter(c=>c.kind==='flush');return k.kind==='garage'?`; ${face.toFixed(1)} ft of that ledger is on the attached garage wall`:`; deck notched around a ${((k.rect.x1-k.rect.x0)/12).toFixed(1)} × ${((k.rect.y1-Math.max(0,k.rect.y0))/12).toFixed(1)} ft bump-out: ${face.toFixed(1)} ft of ledger on its face${sides.length?`, ${sides.length} × ${(sides[0].lengthIn/12).toFixed(1)} ft bolted flush wall${sides.length>1?'s':''}`:''}`;}).join('')}`:'Freestanding: no ledger on the house',
    `House ${houseConfig.widthFt} × ${houseConfig.depthFt} ft, ${houseConfig.storeys}-storey, ${wrap?'between the wrap-around wings':placedHouse?(placedHouse.anchor==='center'?'centred on the deck':`lined up with the deck's ${placedHouse.anchor} end`)+(placedHouse.offsetIn?`, shifted ${(Math.abs(placedHouse.offsetIn)/12).toFixed(1)} ft ${placedHouse.offsetIn>0?'right':'left'}`:''):'centred on the deck'}${sillIn!==undefined?`; door sill ${sillIn} in above grade`:''}${normalizeHouseBlocks(houseConfig).map(b=>`; ${b.kind==='garage'?'attached garage':b.wall==='Front'?'bump-out':'wing'} ${b.widthFt} × ${b.depthFt} ft on the ${{Front:'deck-facing wall',Back:'street side',Left:'left side',Right:'right side'}[b.wall]}`).join('')}`,
    ...(onScreens.length?[`Privacy screens: ${onScreens.map(s=>{const p=screenProduct(s);return `${s.side.toLowerCase()} edge ${p.panel?`${p.name.replace(' privacy screen','')} ${s.design}, ${s.panels} panel${s.panels===1?'':'s'}`:`slatted ${s.lengthFt} × ${s.heightFt} ft`}${s.lights?', lit':''}`;}).join('; ')}`]:[]),
    ...(()=>{const yard=describeBackyard(estimate.yardModel);return yard?[yard]:[];})(),
    ...(autoLights.length?[`Lighting: ${autoLights.map(i=>`${i.qty} × ${i.zone==='posts'?'post-cap lights':i.zone==='stairs'?'under-step lights':i.zone==='privacy'?'screen lights':'lights'}`).join(', ')}`]:[]),
  ];
  const summary=[`Deck: ${data.width} × ${data.length} ft, ${data.height} in above grade`,`${shapeWords(data,!!wrap)}, ${data.levels} level(s), ${data.deckType}`,...facts,`${material.name} — ${data.deckingColor}`,`${data.pattern} boards; ${railingName} railing`,`${data.stairFlights} stair flight(s), ${data.stairWidth} in wide; ${data.stairType}`,`${data.foundation}; ${data.municipality}; ${data.siteType}`,`${priceLabel}: ${split.backyard?`deck ${dollars(split.deck)} + backyard ${dollars(split.backyard)} = `:''}${dollars(estimate.subtotal)} + HST (${dollars(estimate.total)} including HST)${quoteRequired.length?'; Excludes supplier quotes: '+quoteRequired.join(', '):''}`].join('\n');
  const proposalFacts=[`${data.width} × ${data.length} ft ${wrap?'wrap-around':data.shape.toLowerCase()} deck${chamfers?` with ${chamferShapeWords(chamfers)}`:''}, ${data.height} in above grade, ${data.deckType.toLowerCase()}`,`${material.name} · ${data.deckingColor}, ${data.pattern.toLowerCase()} boards${data.pictureFrameRows?` with ${data.pictureFrameRows} border row${data.pictureFrameRows>1?'s':''}`:''}`,`${railingName} railing · ${data.stairFlights} stair flight${data.stairFlights===1?'':'s'}${data.stairFlights?`, ${data.stairWidth} in wide, ${data.stairType.toLowerCase()}`:''}`,...facts];
  return {facts,summary,proposalFacts,priceLabel,quoteRequired,material,railingName};
}
