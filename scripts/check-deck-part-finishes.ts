import assert from 'node:assert/strict';
// Inlay geometry is a lazy runtime in the app (ensureDesignExtensions); register it before calculating inlay fixtures.
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {parseDesign,pruneEdgeNames,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {buildDeckDesignSubmission,type SendDesignFields} from '../src/features/deckcraft/sendDesign';
import {exposedRim,getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {activeWrap} from '../src/features/deckcraft/lib/wrapGeometry';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {boardFinishPlan,colourRef,partCollections} from '../src/features/deckcraft/boardFinishes';
import {RAILING_COLOURS,UNCONFIRMED_RAILING_LINES,pruneDeckFinishes,railingColours,stairTreadKey} from '../src/features/deckcraft/deckPartFinishes';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {railingScreenHex} from '../src/features/deckcraft/railingScreenColours';
import {STAIR_TREAD_COSTS,type BoardColour,type DeckData,type DeckFinishes,type HouseBlock} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Deck-part finishes (deckPartFinishes.ts): the border boards, the fascia, the stair treads and risers in their own
 * real product colour of the deck's kind, and the railing in one of its system's manufacturer colours. A design without
 * them builds, saves and prices exactly as before. The border is its own stock at its collection's rate, in place of
 * Dark Slate, whose own path is untouched; the stair allowance takes the dearest category of the tread and riser
 * choices, and a line without a rate makes the stairs a quote; fascia over the exposed rim (the house decides which
 * edges it covers, houseContact.ts) is a supplier quote, or the colour of a chosen manufacturer fascia. Railing
 * colours come from railing-finish-provenance.json, never change the rate, and on the eight lines not confirmed in
 * Canada ask the supplier to confirm. Stale values are dropped quietly; nothing is ever priced at $0.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',width:20,length:12,...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
type Estimate=ReturnType<typeof price>;
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='number'?(Object.is(v,-0)||Math.abs(v)<5e-7?0:Math.round(v*1e6)/1e6):v);
const digest=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex').slice(0,20);
const strip=(e:Estimate)=>({...e,model:undefined,yardModel:undefined});
const section=(e:Estimate,title:string)=>e.sections.find(s=>s.title===title);
const finishes=(e:Estimate)=>section(e,'Deck-part finishes');
const MARKUP=1.35,BOARD=5.5/12;
const COCOA=colourRef('tt_prime_plus','Dark Cocoa'),SALT=colourRef('tt_prime_plus','Sea Salt Gray'),HUSK=colourRef('tt_prime_plus','Coconut Husk'),ESPRESSO=colourRef('tt_legacy','Espresso'),IRONWOOD=colourRef('deck_vista','Ironwood');
const QUOTE_LINE=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&m.isComposite&&m.id.startsWith('tt_'))!,QUOTED=colourRef(QUOTE_LINE.id,QUOTE_LINE.colors[0].name);
/** The eight lines the owner shipped without Canadian availability confirmed (2026-09-23). */
const OWNER_UNCONFIRMED=['tt_pinnacle','tt_statement','tt_fulton','tt_reliance','tt_advantage','dk_preassembled','dk_classic_composite','dk_contemporary_composite'];
const railOf=(id:string)=>({catalogueRailingId:id,railingType:RAILING_CATALOGUE.find(r=>r.id===id)!.baseType});
/** Every estimate this check prices with finishes, for the never-$0 sweep at the end. */
const withFinishes:Estimate[]=[];
const priced=(d:DeckData)=>{const e=price(d);withFinishes.push(e);return e;};

// 1. Absent: nothing runs. An empty or all-blank `deckFinishes` builds, draws, saves and prices byte for byte as none,
//    and finishes never touch the takeoff or the hardware.
const plainDesigns:[string,Partial<DeckData>][]=[
  ['rectangle',{}],['two border rows',{pictureFrameRows:2,width:24}],['Dark Slate picture frame',{pattern:'Picture Frame',borderFinish:'Dark Slate'}],
  ['L-shape, two levels, two flights',{shape:'L-Shape',width:20,length:16,levels:2,height:48,height2:24,stairFlights:2}],
  ['wrap',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}}],['manufacturer railing and fascia',{...railOf('tt_classic_composite'),catalogueAccessories:['tt_fascia']}],
  ['accent row and a rug',{pictureFrameRows:1,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:COCOA}],inlays:[{id:'rug-1',kind:'rug',widthFt:6,depthFt:4}]}],
];
for(const [label,patch] of plainDesigns){
  const d=base(patch),e=price(d);
  for(const [variant,blank] of [['{}',{}],['blank parts',{border:undefined,fascia:undefined,treads:undefined,risers:undefined,railingColor:undefined}]] as const){
    const other={...d,deckFinishes:blank as DeckFinishes},eo=price(other);
    ok(digest(strip(e))===digest(strip(eo))&&e.total===eo.total,`${label}: deckFinishes ${variant} prices exactly as none`);
    ok(serializeDesign(other)===serializeDesign(d)&&!serializeDesign(other).includes('deckFinishes')&&validateDesign(other).deckFinishes===undefined,`${label}: deckFinishes ${variant} saves byte for byte as none`);
    ok(JSON.stringify(describeDesign(other,eo).facts)===JSON.stringify(describeDesign(d,e).facts)&&designFeatures(other).join()===designFeatures(d).join(),`${label}: deckFinishes ${variant} adds no fact or funnel label`);
  }
  ok(pruneDeckFinishes(d)===d&&pruneEdgeNames(d).deckFinishes===undefined,`${label}: the prune leaves a design without finishes as it is`);
  ok(!designFeatures(d).some(f=>f==='deck_part_finishes'||f==='deck_railing_colour')&&!e.sections.some(s=>s.title==='Deck-part finishes'),`${label}: no part-finish section or funnel label without finishes`);
  const on={...d,deckFinishes:{fascia:COCOA,treads:SALT,risers:COCOA,...(d.catalogueRailingId?{railingColor:'Matte Black'}:{})}},eo=priced(on);
  const {issues:_i,...model}=e.model,{issues:_j,...modelOn}=eo.model;
  ok(digest(model)===digest(modelOn)&&digest(getHardwareLayout(d,e.model))===digest(getHardwareLayout(on,eo.model)),`${label}: part finishes leave the takeoff and hardware untouched`);
  const finishSupply=(estimate:typeof e)=>estimate.sections.filter(s=>['Deck-part finishes','Stair and level cladding'].includes(s.title)).reduce((n,s)=>n+s.total,0);
  ok(Math.abs((eo.subtotal-finishSupply(eo))-(e.subtotal-finishSupply(e)))<1e-6,`${label}: part colours change only their exact fascia/cladding supply, never construction or railing rates`);
}

// 2. The border in its own colour: every border board, and nothing else, is its own stock at its collection's rate; the
//    main order drops by exactly those boards; a board or row accent still beats it; the deck's own colour changes nothing.
{
  const d=base({pictureFrameRows:1}),on={...d,deckFinishes:{border:ESPRESSO}},m=buildDeckTakeoff(on),plain=price(d);
  const borderKeys=m.levels.flatMap((l,li)=>l.boards.flatMap((b,bi)=>b.role==='border'?[`${li}:${bi}`]:[]));
  const plan=boardFinishPlan(on,m),groups=plan.stock.filter(g=>g.kind==='border');
  ok(borderKeys.length>0&&groups.length===1&&groups[0].boards.map(b=>`${b.level}:${b.index}`).sort().join()===borderKeys.sort().join()&&plan.borderPieces===borderKeys.length&&plan.pieces===0,'Every border board, and only those, is in the border colour group (never counted as accent boards)');
  const e=priced(on),row=finishes(e)?.items.find(i=>i.name==='Border · TimberTech PRO Legacy · Espresso'),stock=e.stockSchedule.find(r=>r.name.startsWith('Border · TimberTech PRO Legacy · Espresso boards'));
  ok(row&&stock&&typeof row.cost==='number'&&Math.abs(row.cost-stock.orderedLf*20*BOARD*MARKUP)<.01&&row.qty===stock.orderedPieces,'The border colour is its own stock row, priced at its collection\'s rate (ordered length × $/sq ft × board width, with the markup)');
  const boards=e.model.levels.flatMap(l=>l.boards),borderLf=boards.filter(b=>b.role==='border').reduce((n,b)=>n+b.length/12,0),mainLf=boards.filter(b=>b.role!=='border').reduce((n,b)=>n+b.length/12,0);
  ok(Math.abs(stock!.installedLf-borderLf)<.01&&Math.abs(e.stockSchedule[0].installedLf-mainLf)<.01&&Math.abs(e.stockSchedule[0].installedLf+stock!.installedLf-mainLf-borderLf)<.01,'Main and border stock independently match the finish-on geometry, with no lost or double-counted boards even when product stock lengths change joints');
  ok(section(e,'Decking')!.items[0].spec.includes('border boards priced separately')&&!e.sections.some(s=>/^Accent/.test(s.title))&&!section(e,'Labour (Construction & Build)')!.items.some(i=>/Accent/.test(i.name)),'The decking row says so; no accent section or accent labour line');
  ok(digest(strip(price({...d,deckFinishes:{border:HUSK}})))===digest(strip(plain)),'A border in the deck\'s own colour changes nothing');
  const address=plan.addresses[0].find(a=>a?.role==='border')!,accent:BoardColour={lv:1,role:'border',scope:'course',course:address.course,colour:SALT};
  const painted=boardFinishPlan({...on,boardColours:[accent]},m),inCourse=plan.addresses[0].filter(a=>a?.role==='border'&&a.course===address.course).length;
  ok(painted.pieces===inCourse&&painted.borderPieces===borderKeys.length-inCourse,'A painted border row beats the border colour (accent, then border colour, then the deck\'s)');
  const q={...d,deckFinishes:{border:QUOTED}},eq=priced(q),qs=finishes(eq)!;
  ok(qs.quoteRequired&&qs.items[0].cost===null&&qs.total===0&&eq.quoteRequired.some(n=>n.startsWith(`Border · ${QUOTE_LINE.name}`)),'A border from a line without a rate is a supplier quote (its boards leave the priced portion), never $0');
  const two=base({pictureFrameRows:2,width:24,levels:2,width2:10,length2:8,height2:20}),m2=buildDeckTakeoff(two),p2=boardFinishPlan({...two,deckFinishes:{border:COCOA}},m2);
  ok(p2.borderPieces===m2.levels.reduce((n,l)=>n+l.boards.filter(b=>b.role==='border').length,0)&&p2.borderPieces>0,'Two border rows on two levels all take the border colour');
}

// 3. Dark Slate: its own path is exactly as before (a quote section with the border length, a stock row and a quote
//    line) whatever the other parts do, and a border colour replaces it.
{
  for(const patch of [{pictureFrameRows:1 as const},{pattern:'Picture Frame' as const},{pictureFrameRows:2 as const,width:24}]){
    const slate=base({...patch,borderFinish:'Dark Slate'}),e=price(slate),m=e.model;
    const lf=m.levels.reduce((n,l)=>n+l.boards.filter(b=>b.role==='border').reduce((s,b)=>s+b.length/12,0),0),sec=section(e,'Picture-frame border finish'),stock=e.stockSchedule.find(r=>r.name.startsWith('Dark Slate border — quote required'));
    ok(lf>0&&sec?.quoteRequired&&sec.total===0&&sec.items.length===1&&sec.items[0].name==='Deckorators Dark Slate'&&sec.items[0].qty===Math.ceil(lf*10)/10&&sec.items[0].cost===null,`Dark Slate (${JSON.stringify(patch)}): a quote section with the border's length`);
    ok(stock&&Math.abs(stock.installedLf-lf)<.01&&e.quoteRequired.includes('Deckorators Dark Slate picture-frame boards')&&!boardFinishPlan(slate,m).stock.some(g=>g.kind==='border'),'Dark Slate: its own stock row and quote line, and no border colour group');
    const parts={...slate,deckFinishes:{fascia:COCOA,treads:SALT}},ep=priced(parts);
    ok(digest(section(ep,'Picture-frame border finish'))===digest(sec)&&digest(ep.stockSchedule.find(r=>r.name.startsWith('Dark Slate border')))===digest(stock)&&digest(section(ep,'Decking'))===digest(section(e,'Decking')),'Dark Slate: fascia and stair colours leave its section, stock and the decking order byte for byte');
    const both={...slate,deckFinishes:{border:ESPRESSO}},eb=priced(both);
    ok(!section(eb,'Picture-frame border finish')&&!eb.quoteRequired.includes('Deckorators Dark Slate picture-frame boards')&&finishes(eb)?.items.some(i=>i.name.startsWith('Border · TimberTech PRO Legacy')),'A border colour replaces the Dark Slate border');
    const saved=validateDesign(both);
    ok(saved.borderFinish==='Matching'&&saved.deckFinishes?.border===ESPRESSO&&saved.pictureFrameRows===slate.pictureFrameRows,'Loading both keeps the border colour and clears Dark Slate');
  }
  const materials=read('src/features/deckcraft/designer/steps/MaterialsStep.tsx');
  ok(materials.includes("e.target.value==='Dark Slate'?{pictureFrameRows:data.pictureFrameRows===2?2:1,deckFinishes:{...data.deckFinishes,border:undefined}}"),'Choosing Dark Slate clears a border colour (and a border colour clears Dark Slate)');
}

// 4. Treads and risers: the dearest category of the two choices (a part without one is the deck's); a line without a
//    rate makes the stairs a supplier quote; the deck's own kind prices exactly as before.
{
  const PINE=colourRef('pressure_treated','Pressure Treated'),CEDAR=colourRef('cedar','Western Red Cedar');
  const cases:[string,(string|undefined)[],string][]=[['pine',[CEDAR,undefined],'cedar'],['pine',[undefined,COCOA],'composite'],['composite',[PINE,CEDAR],'cedar'],['cedar',[PINE,PINE],'pine'],['pine',[COCOA,CEDAR],'composite'],['cedar',[undefined,undefined],'cedar'],['composite',[CEDAR,undefined],'composite']];
  for(const [deck,parts,want] of cases)ok(stairTreadKey(deck,parts,STAIR_TREAD_COSTS)===want,`A ${deck} deck with treads/risers ${parts.map(p=>p?.split(':')[0]??'unset').join('/')} uses the ${want} per-riser category (the dearest of the two)`);
  ok(stairTreadKey('pine',[CEDAR,undefined],{pine:50,cedar:40,composite:85})==='pine','The category follows the rate table, not the name');
  const d=base({stairFlights:2}),plain=section(price(d),'Stairs')!,risers=Number(plain.items[0].qty);
  ok(risers>0&&Math.abs(plain.total-risers*STAIR_TREAD_COSTS.composite*MARKUP)<.01,'The stairs are priced per riser at the deck\'s category');
  const on={...d,deckFinishes:{treads:ESPRESSO,risers:SALT}},es=section(priced(on),'Stairs')!;
  ok(es.total===plain.total&&!es.quoteRequired&&es.items[0].spec.endsWith('Treads in Espresso (TimberTech PRO Legacy). Risers in Sea Salt Gray (TimberTech EDGE Prime+).'),'Treads and risers of the deck\'s kind price exactly as before, and the stairs row names them');
  for(const part of ['treads','risers'] as const){
    const q={...d,deckFinishes:{[part]:QUOTED}},eq=priced(q),sq=section(eq,'Stairs')!;
    ok(sq.quoteRequired&&sq.total===0&&sq.items.every(i=>i.cost===null)&&eq.quoteRequired.includes(`Stair treads and risers in ${QUOTE_LINE.name}`),`${part} from a line without a rate make the Stairs section a supplier quote`);
  }
  const none={...base({stairFlights:0}),deckFinishes:{treads:QUOTED}};
  ok(!price(none).quoteRequired.some(n=>n.startsWith('Stair treads and risers')),'With no stairs, a tread colour quotes nothing');
  ok(partCollections(base({deckingMaterial:'cedar',deckingColor:'Western Red Cedar'})).map(m=>m.id).join()==='cedar'&&partCollections(base({deckingMaterial:'pressure_treated',deckingColor:'Pressure Treated'})).map(m=>m.id).join()==='pressure_treated','A wood deck keeps its own species for every part');
  const composite=partCollections(base());
  ok(composite[0].id==='tt_prime_plus'&&composite.slice(1).every(m=>m.isComposite&&!m.isHidden)&&composite.some(m=>m.costPerSqft===null)&&composite.length===DECKING_CATALOGUE.filter(m=>m.isComposite&&!m.isHidden).length,'A composite deck offers every composite line, supplier-quote lines included');
}

// 5. Fascia: over the exposed rim only. The house decides which edges it covers (houseContact.ts) for plain, narrow,
//    bump-out, garage and wrap houses; the quote row's length is that rim, and a manufacturer fascia takes the colour.
const house=(widthFt:number,depthFt:number)=>({...getHouseConfig({...base(),width:20}),widthFt,depthFt});
const block=(b:HouseBlock)=>b;
const houses:[string,Partial<DeckData>][]=[
  ['a plain house across the back',{width:16,length:12}],
  ['a narrow house (the deck runs past it)',{width:30,length:12,housePlacement:{anchor:'left',offsetIn:0},houseConfig:house(20,16)}],
  ['a bump-out',{width:16,length:12,houseConfig:{...house(26,16),footprint:{rects:[block({id:'bump1',kind:'house',wall:'Front',offsetFt:9,widthFt:8,depthFt:3})]}}}],
  ['a bump-out on a wide deck',{width:24,length:14,housePlacement:{anchor:'center',offsetIn:0},houseConfig:{...house(20,16),footprint:{rects:[block({id:'bump1',kind:'house',wall:'Front',offsetFt:6,widthFt:8,depthFt:4})]}}}],
  ['an attached garage face',{width:30,length:12,housePlacement:{anchor:'left',offsetIn:0},houseConfig:{...house(20,16),footprint:{rects:[block({id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:20,depthFt:22})]}}}],
  ['a left wrap',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}}],
  ['a two-corner wrap',{width:22,length:12,wrap:{left:{widthFt:8,runFt:10},right:{widthFt:10,runFt:12}}}],
  ['a porch wrap',{width:34,length:12,wrap:{right:{widthFt:8,runFt:10},porchRight:{depthFt:6,runFt:10}}}],
];
const along=(r:{a:{x:number;y:number};b:{x:number;y:number}},c:{a:{x:number;y:number};b:{x:number;y:number};lengthIn:number})=>{
  const ux=(c.b.x-c.a.x)/c.lengthIn,uy=(c.b.y-c.a.y)/c.lengthIn,off=(p:{x:number;y:number})=>Math.abs((p.x-c.a.x)*uy-(p.y-c.a.y)*ux),t=(p:{x:number;y:number})=>(p.x-c.a.x)*ux+(p.y-c.a.y)*uy;
  if(off(r.a)>.5||off(r.b)>.5)return 0;
  return Math.max(0,Math.min(c.lengthIn,Math.max(t(r.a),t(r.b)))-Math.max(0,Math.min(t(r.a),t(r.b))));
};
for(const [label,patch] of houses)for(const deckType of ['Attached','Freestanding'] as const){
  const d=base({...patch,deckType,stairFlights:0,height:48,deckFinishes:{fascia:COCOA}}),e=priced(d),m=e.model;
  if(patch.wrap&&deckType==='Attached')ok(activeWrap(d),`${label}: the wrap is active`);
  const fp=m.levels[0].footprint,contact=getHouseContact(d,fp),o=fp.outline,edge=(i:number)=>{const p=o[i],q=o[(i+1)%o.length];return Math.hypot(q.x-p.x,q.y-p.y);};
  const expected=o.reduce((n,_,i)=>contact.isContactEdge(i)?n:n+edge(i),0),full=o.reduce((n,_,i)=>n+edge(i),0),rim=exposedRim(d,m);
  const rimIn=rim.reduce((n,r)=>n+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),0),row=finishes(e)?.items.find(i=>i.name==='Fascia · Dark Cocoa (TimberTech EDGE Prime+)');
  ok(Math.abs(rimIn-expected)<.1,`${label} (${deckType}): the exposed rim is the outline less the house contacts (${(rimIn/12).toFixed(2)} of ${(expected/12).toFixed(2)} ft)`);
  ok(row&&row.cost!==null&&row.cost>0&&row.unit==='boards'&&e.quoteRequired.includes('Fascia fasteners and delivery (supplier quote)')&&!e.quoteRequired.includes('Fascia boards (supplier quote)'),`${label} (${deckType}): the fascia row is stock-priced from its DeckMart SKU; fasteners stay a supplier quote`);
  ok(rim.every(r=>contact.contacts.every(c=>along({a:{x:r.a.x,y:r.a.z},b:{x:r.b.x,y:r.b.z}},c)<.5)),`${label} (${deckType}): no fascia runs along a wall the house covers`);
  if(deckType==='Attached')ok(contact.contacts.length>0&&expected<full-1,`${label}: the house covers part of the attached deck's rim`);
  else ok(contact.contacts.length===0&&Math.abs(rimIn-full)<.1,`${label}: a freestanding deck has fascia all round`);
  // The same rim feeds a manufacturer fascia, which then carries the colour instead of a row of its own.
  const cat={...d,catalogueAccessories:['tt_fascia']},ec=priced(cat),catRow=section(ec,'Manufacturer deck accessories')?.items.find(i=>i.name==='TimberTech fascia boards');
  const layout=catalogueAccessoryLayout(cat,ec.model),catIn=layout.fascia.reduce((n,f)=>n+Math.hypot(f.b.x-f.a.x,f.b.z-f.a.z),0);
  ok(Math.abs(catIn-rimIn)<1e-6&&catRow?.qty===Math.ceil(rimIn/12*10)/10&&catRow?.spec.startsWith('Colour: Dark Cocoa (TimberTech EDGE Prime+). ')&&catRow.cost===null&&!finishes(ec)?.items.some(i=>i.name.startsWith('Fascia · '))&&!ec.quoteRequired.includes('Fascia boards (supplier quote)'),`${label} (${deckType}): a manufacturer fascia over the same rim takes the colour, with no second fascia row`);
}
{
  const cat=base({catalogueAccessories:['dk_fascia']}),spec=section(price(cat),'Manufacturer deck accessories')!.items.find(i=>i.name==='Deckorators fascia boards')!.spec;
  ok(!spec.startsWith('Colour:')&&spec.startsWith('Collection-matched fascia.'),'Without a fascia colour the manufacturer fascia row reads as before');
  const two=base({levels:2,width2:10,length2:8,height2:20,stairFlights:0,deckFinishes:{fascia:COCOA}}),e2=priced(two),rim2=exposedRim(two,e2.model).reduce((n,r)=>n+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),0);
  const main=e2.model.levels[0],contact=getHouseContact(two,main.footprint),mainRim=(main.rim??[]).filter(r=>!contact.onContact({x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z})).reduce((n,r)=>n+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),0);
  const fascia2=finishes(e2)!.items.find(i=>i.name.startsWith('Fascia · '))!;
  ok(e2.model.levels.length>1&&rim2>mainRim+1&&fascia2.unit==='boards'&&fascia2.cost!==null&&fascia2.cost>0,'A second level\'s rim is all exposed and stock-priced with the fascia boards');
  const unsourced=priced(base({deckFinishes:{fascia:colourRef('tt_harvest','Kona')}}));
  const kona=finishes(unsourced)?.items.find(i=>i.name.startsWith('Fascia · '));
  ok(kona&&kona.cost===null&&kona.unit==='lf'&&unsourced.quoteRequired.includes('Fascia boards (supplier quote)'),'An unsourced fascia colour stays a supplier quote');
}

// 6. Railing colours: every colour offered is in railing-finish-provenance.json for its system (name, source, retrieval
//    date and screen colour), and every rail colour recorded there is offered. A colour never changes the rate, always
//    asks the supplier to confirm availability and any premium, and on the owner's eight unconfirmed lines says so.
const provenance=JSON.parse(read('src/features/deckcraft/railing-finish-provenance.json')) as {retrieved:string;systems:{id:string;name:string;sourceUrl:string;canada:string;railColours:{name:string;sourceUrl:string;retrieved:string;screenHex:string}[]}[]};
ok(/^\d{4}-\d{2}-\d{2}$/.test(provenance.retrieved)&&provenance.systems.length===RAILING_CATALOGUE.length&&RAILING_CATALOGUE.every(r=>provenance.systems.filter(s=>s.id===r.id).length===1),'The provenance file has one entry for each of the 19 manufacturer railing systems');
ok(Object.keys(RAILING_COLOURS).length===RAILING_CATALOGUE.length&&Object.keys(RAILING_COLOURS).every(id=>RAILING_CATALOGUE.some(r=>r.id===id)),'Colours are offered for exactly the catalogue\'s systems');
ok(OWNER_UNCONFIRMED.join()===UNCONFIRMED_RAILING_LINES.join()&&provenance.systems.filter(s=>s.canada==='unconfirmed').map(s=>s.id).sort().join()===[...OWNER_UNCONFIRMED].sort().join()&&provenance.systems.every(s=>s.canada==='unconfirmed'||s.canada==='listed'),'The unconfirmed lines are the owner\'s eight, in the code and in the provenance file');
let railChecks=0;
for(const system of RAILING_CATALOGUE){
  const record=provenance.systems.find(s=>s.id===system.id)!,offered=railingColours(system.id);
  ok(offered.length>0&&new Set(offered).size===offered.length&&/^https:\/\/www\.(timbertech|deckorators)\.com\//.test(record.sourceUrl),`${system.id}: its colours are offered once each, from a manufacturer source`);
  for(const colour of offered){
    const p=record.railColours.find(x=>x.name===colour);
    ok(p&&p.screenHex===railingScreenHex(system.id,colour)&&/^#[0-9a-f]{6}$/.test(p.screenHex)&&/^https:\/\//.test(p.sourceUrl)&&/^\d{4}-\d{2}-\d{2}$/.test(p.retrieved),`${system.id}: ${colour} is in the provenance file with its source, retrieval date and screen colour ${p?.screenHex}`);
  }
  ok(record.railColours.every(p=>offered.includes(p.name)),`${system.id}: every rail colour the manufacturer lists is offered`);
  const e0=price(base(railOf(system.id))),rail0=section(e0,'Railing System')!;
  ok(!e0.flags.some(f=>/^Railing colour|not confirmed as sold in Canada/.test(f)),`${system.id}: no colour, no colour note`);
  for(const colour of offered){
    const d=base({...railOf(system.id),deckFinishes:{railingColor:colour}}),e=priced(d),rail=section(e,'Railing System')!;
    ok(Math.abs(e.subtotal-e0.subtotal)<1e-9&&digest(rail.items)===digest(rail0.items)&&rail.quoteRequired===rail0.quoteRequired,`${system.id} · ${colour}: the railing section, its rate and its quote are unchanged`);
    const unconfirmed=OWNER_UNCONFIRMED.includes(system.id),canada=e.flags.some(f=>f.includes('not confirmed as sold in Canada'));
    ok(e.flags.includes(`Railing colour ${colour} (${system.name}): the railing rate is unchanged${unconfirmed?'. This line is not confirmed as sold in Canada':''}; confirm availability and any colour premium with the supplier.`),`${system.id} · ${colour}: a review note asks the supplier to confirm availability and any colour premium`);
    ok(canada===unconfirmed,`${system.id} · ${colour}: ${unconfirmed?'carries':'does not carry'} the not-confirmed-in-Canada note`);
    ok(describeDesign(d,e).facts.includes(`Railing colour: ${colour} (${system.name}); screen colour illustrative`),`${system.id} · ${colour}: the design facts name the colour as illustrative`);
    railChecks++;
  }
}

// 7. Stale values are dropped quietly on load and on every edit, never thrown; only malformed values are refused.
{
  const d=base({...railOf('tt_classic_composite'),deckFinishes:{railingColor:'Matte Espresso'}});
  ok(validateDesign(d).deckFinishes?.railingColor==='Matte Espresso','A colour of the design\'s railing system is kept');
  const moved={...d,...railOf('dk_rapid')};let loaded:DeckData|undefined;
  assert.doesNotThrow(()=>{loaded=validateDesign(moved);});checks++;
  ok(loaded!.deckFinishes===undefined&&!serializeDesign(moved).includes('deckFinishes'),'After a change of railing system its old colour is dropped quietly, and nothing is saved');
  ok(pruneEdgeNames(deckReleaseData(moved)).deckFinishes===undefined,'The edit path (pruneEdgeNames) drops it too');
  ok(validateDesign({...d,catalogueRailingId:undefined,railingType:'Aluminum'}).deckFinishes===undefined,'A railing colour without a manufacturer system is dropped');
  ok(validateDesign({...d,deckFinishes:{railingColor:'Chartreuse'}}).deckFinishes===undefined,'A colour name the system does not offer is dropped, not refused');
  ok(JSON.stringify(validateDesign({...moved,deckFinishes:{railingColor:'Matte Espresso',fascia:COCOA}}).deckFinishes)===JSON.stringify({fascia:COCOA}),'Only the stale colour goes; the others stay');
  ok(validateDesign({...base({deckingMaterial:'cedar',deckingColor:'Western Red Cedar'}),deckFinishes:{fascia:COCOA,treads:ESPRESSO,border:SALT}}).deckFinishes===undefined,'Composite part colours on a wood deck are dropped quietly');
  const kept=validateDesign({...base({deckingMaterial:'deck_vista',deckingColor:'Dunewood'}),deckFinishes:{fascia:COCOA,treads:QUOTED}});
  ok(kept.deckFinishes?.fascia===COCOA&&kept.deckFinishes?.treads===QUOTED,'Composite part colours stay on another composite deck');
  for(const [label,bad] of [['an unknown colour',{fascia:'nope:Red'}],['a colour not in its collection',{treads:'tt_prime_plus:Red'}],['a colour that is not text',{border:7}],['a railing colour that is not text',{railingColor:7}],['an overlong railing colour',{railingColor:'x'.repeat(61)}]] as const)
    assert.throws(()=>validateDesign({...base(),deckFinishes:bad}),undefined,`Rejects ${label}`),checks++;
  assert.throws(()=>validateDesign({...base(),deckFinishes:'Dark Cocoa'}),undefined,'Rejects finishes that are not an object');checks++;
  const full=base({pictureFrameRows:1,...railOf('dk_contemporary'),deckFinishes:{border:ESPRESSO,fascia:COCOA,treads:SALT,risers:COCOA,railingColor:'Bronze'}});
  ok(JSON.stringify(parseDesign(serializeDesign(full)).deckFinishes)===JSON.stringify(full.deckFinishes)&&serializeDesign(parseDesign(serializeDesign(full)))===serializeDesign(full),'Every part and the railing colour survive a save and load, byte for byte');
  const link=await encodeDesignLink(full,'https://goldenmaplelandscaping.ca'),opened=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);
  ok(JSON.stringify(opened.deckFinishes)===JSON.stringify(full.deckFinishes),'…and a share link');
  const same=pruneDeckFinishes(full);ok(same===full,'The prune leaves a design with nothing stale as it is');
}

// 8. Mixed brands: a part from another manufacturer than the decking asks to confirm fastener compatibility.
{
  const mixed=priced({...base(),deckFinishes:{fascia:IRONWOOD}}),own=priced({...base(),deckFinishes:{fascia:COCOA,border:ESPRESSO,treads:SALT}});
  ok(mixed.flags.includes('Deck parts from another manufacturer than the decking: confirm fastener compatibility with the supplier.'),'A Deckorators part on a TimberTech deck asks the supplier to confirm fastener compatibility');
  ok(!own.flags.some(f=>f.includes('confirm fastener compatibility')),'Parts from the decking\'s own manufacturer add no such note');
}

// 9. Outputs: the design facts and proposal, a sent design's sample request and the funnel labels.
{
  const d=base({pictureFrameRows:1,...railOf('dk_contemporary'),deckFinishes:{border:ESPRESSO,fascia:COCOA,treads:SALT,railingColor:'Bronze'}}),e=priced(d),described=describeDesign(d,e);
  const fact='Deck parts: border boards in Espresso (TimberTech PRO Legacy); fascia in Dark Cocoa (TimberTech EDGE Prime+); stair treads in Sea Salt Gray (TimberTech EDGE Prime+)';
  ok(described.facts.includes(fact)&&described.proposalFacts.includes(fact)&&described.summary.includes(fact),'The design facts, summary and proposal name each part\'s colour');
  ok(described.priceLabel==='Priced portion only'&&e.sections.some(s=>s.title==='Deck-part finishes')&&e.quoteRequired.includes('Fascia fasteners and delivery (supplier quote)'),'With sourced fascia supply and a fastener quote, the price reads as the priced portion only; the proposal and PDF list the section');
  const fields:SendDesignFields={name:'A',email:'a@example.com',phone:'7053008015',address:'Barrie',notes:'',offers:false,botField:'',timeline:'',budget:'',samples:true};
  const sent=buildDeckDesignSubmission(fields,{data:d,estimate:e,summary:described.summary,reviewItems:[],link:'https://goldenmaplelandscaping.ca/deck-designer#d',sentAt:new Date(0),consent:null});
  ok(sent.details.includes('Samples: please bring Coconut Husk and the finish colours: Espresso (TimberTech PRO Legacy), Dark Cocoa (TimberTech EDGE Prime+), Sea Salt Gray (TimberTech EDGE Prime+)'),'A sample request lists the part colours');
  const accented={...d,boardColours:[{lv:1 as const,role:'field' as const,scope:'course' as const,course:'r3',colour:COCOA}]},ea=price(accented);
  ok(buildDeckDesignSubmission(fields,{data:accented,estimate:ea,summary:'s',reviewItems:[],link:'l',sentAt:new Date(0),consent:null}).details.includes('Samples: please bring Coconut Husk and the finish colours: Espresso (TimberTech PRO Legacy), Dark Cocoa (TimberTech EDGE Prime+), Sea Salt Gray (TimberTech EDGE Prime+)'),'With accent boards too, each colour is asked for once');
  const plain=base();
  ok(buildDeckDesignSubmission(fields,{data:plain,estimate:price(plain),summary:'s',reviewItems:[],link:'l',sentAt:new Date(0),consent:null}).details.includes('Samples: please bring a Coconut Husk sample'),'Without part colours the sample request reads as before');
  ok(designFeatures(d).includes('deck_part_finishes')&&designFeatures(d).includes('deck_railing_colour')&&!designFeatures(base({...railOf('dk_contemporary'),deckFinishes:{railingColor:'Bronze'}})).includes('deck_part_finishes'),'The funnel counts part colours and a railing colour apart');
  const rates=unconfirmedRates();
  ok(rates.some(r=>r.id==='fascia-boards'&&r.status==='estimate')&&rates.some(r=>r.id==='railing-colour'&&r.status==='owner-decision'),'The register identifies the sourced fascia benchmarks and outstanding railing colour premium');
}

// 10. Never $0: every row these finishes add or change is priced above zero or left blank for a quote.
{
  let rows=0;
  for(const e of withFinishes)for(const s of e.sections)for(const i of s.items){
    if(!(s.title==='Deck-part finishes'||s.title==='Stairs'||s.title==='Railing System'||/^Colour: /.test(i.spec)))continue;
    ok(i.cost===null||i.cost>0,`${s.title} · ${i.name}: priced above $0 or a quote, never $0`);rows++;
  }
  ok(rows>100,`Swept ${rows} rows`);
}

// 11. Wiring: pure modules, the lazy panel and railing picker, the 3D parts and the check chain.
{
  for(const f of ['src/features/deckcraft/deckPartFinishes.ts','src/features/deckcraft/boardFinishes.ts','src/features/deckcraft/catalogueAccessories.ts','src/features/deckcraft/houseContact.ts'])
    ok(!/from ['"]three|@react-three/.test(read(f)),`${f} does not import three.js`);
  const designer=designerSource(),bundle=read('scripts/check-deck-bundle.ts'),stairs=read('src/features/deckcraft/designer/steps/StairsStep.tsx');
  ok(/lazy\(loadDeckFinishesPanel\)/.test(designer)&&/for\(const load of \[[^\]]*\bloadDeckFinishesPanel\b[^\]]*\]\)/.test(designer)&&bundle.includes('/^DeckFinishesPanel-/'),'The deck-part finishes panel loads on demand, preloaded after the page settles, never with the page');
  ok(stairs.includes('lazy(()=>loadDeckFinishesPanel().then(m=>({default:m.RailingColourField})))'),'The railing colour picker loads with the panel, on the stairs step');
  const imports=/from\s+['"][^'"]*railing-finish-provenance/;
  ok(!imports.test(designer)&&!['deckPartFinishes.ts','calculations.ts','designPersistence.ts','components/viewer3d/Deck3DViewer.tsx'].some(f=>imports.test(read(`src/features/deckcraft/${f}`))),'The provenance file is a record the check holds the colours to, not page weight');
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx');
  ok(viewer.includes("usePartMaterial(partRef(data,'fascia')??")&&viewer.includes('<Members items={edgeMembers} material={materials.wood} name="rim-and-fascia"')&&viewer.includes('<Slabs slabs={finishedFascia} material={fasciaMat} courses={false} eased name="rim-and-fascia"')&&viewer.includes('<Slabs slabs={accessoryFascia} material={fasciaMat} courses={false} eased name="selected-manufacturer-fascia"')&&viewer.includes("<FinishedBoards items={stairBoards.filter(b=>!stairBorder||b.role!=='border')} material={treadMat}/>")&&viewer.includes("<FinishedBoards items={stairBoards.filter(b=>b.role==='border')} material={borderMaterial}/>")&&viewer.includes('<FinishedBoards items={drawnRisers} material={riserMat}/>')&&viewer.includes('<Cladding3D data={data} model={model} material={fasciaMat}'),'In 3D the framing keeps raw lumber while mitered fascia, supplier fascia, stair and level cladding, treads and risers take their own swatch when set');
  ok(viewer.includes('const railMat=railColour??(data.railingType===')&&viewer.includes('railingScreenHex(rail.system.id,rail.colour)'),'The 3D railing takes its colour\'s screen approximation');
  const screen=/from\s+['"][^'"]*railingScreenColours/;
  ok(!screen.test(designer.replace(read('src/features/deckcraft/designer/DeckFinishesPanel.tsx'),''))&&!['deckPartFinishes.ts','calculations.ts','designPersistence.ts','designFacts.ts','sendDesign.ts'].some(f=>screen.test(read(`src/features/deckcraft/${f}`))),'Screen colours load with the 3D view and the finishes panel, not with the page');
  ok(/"check:deck":[^\n]*check-deck-part-finishes\.ts/.test(read('package.json')),'This check runs in check:deck');
}

console.log(`DECK PART FINISHES OK — absent-means-nothing on ${plainDesigns.length} designs, the border split and Dark Slate, tread and riser categories, fascia on ${houses.length*2} houses and decks, ${railChecks} railing colours on ${RAILING_CATALOGUE.length} systems against their provenance, pruning, outputs and never $0; ${checks} checks.`);
