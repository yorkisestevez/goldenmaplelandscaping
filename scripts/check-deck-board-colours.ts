import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink,MAX_DESIGN_LINK_CHARS} from '../src/features/deckcraft/designLink';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {buildDeckDesignSubmission,type SendDesignFields} from '../src/features/deckcraft/sendDesign';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {accentCollections,boardFinishPlan,colourRef,deckColourRef,MAX_BOARD_COLOURS,parseColourRef} from '../src/features/deckcraft/boardFinishes';
import {describeBoardPlace,paintAddress,paintBoard} from '../src/features/deckcraft/boardPaint';
import type {BoardColour,DeckData} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Accent-colour boards: one board or a whole row in another real product colour. A design without them builds,
 * saves and prices exactly as before. Boards are found by where they sit (lib/boardAddress.ts), so a choice
 * survives resizing, a collection change and stair or railing edits, and a change that moves the boards leaves
 * it unmatched, never on another board. Each accent colour is ordered as its own boards at its own collection's
 * rate, a collection without a rate is a supplier quote, and fitting the boards is a builder-quote labour line.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',width:20,length:12,...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
const COCOA=colourRef('tt_prime_plus','Dark Cocoa'),SALT=colourRef('tt_prime_plus','Sea Salt Gray');
const row=(course:string,colour=COCOA,lv:1|2|3=1):BoardColour=>({lv,role:'field',scope:'course',course,colour});
const accentSection=(e:ReturnType<typeof price>)=>e.sections.find(s=>s.title==='Accent-colour boards');
const labourItem=(e:ReturnType<typeof price>)=>e.sections.find(s=>s.title==='Labour (Construction & Build)')?.items.find(i=>i.name==='Accent-colour board labour');
const strip=(e:ReturnType<typeof price>)=>JSON.stringify({...e,model:undefined,yardModel:undefined});

// 1. No accent boards: nothing changes, and an empty list is not saved.
{
  const d=base(),empty={...d,boardColours:[]};
  ok(strip(price(d))===strip(price(empty)),'An empty accent list prices exactly like none');
  ok(validateDesign(empty).boardColours===undefined&&!serializeDesign(empty).includes('boardColours'),'An empty accent list is not saved');
  ok(serializeDesign(d)===serializeDesign(empty),'A design without accent boards saves byte for byte as before');
  ok(!accentSection(price(d))&&!labourItem(price(d)),'No accent section or labour line without accent boards');
}

// 2. Addresses: every deck board has one; straight rows count from the house without gaps; herringbone pieces,
//    breakers and border rows are each named once.
const shapes:Partial<DeckData>[]=[{},{shape:'L-Shape',width:24,length:16,cutoutWidth:8,cutoutLength:6},{cornerChamfers:{frontLeftFt:4}},{shape:'Custom',customFront:[{x:20,y:8},{x:15,y:8},{x:15,y:14},{x:5,y:14},{x:5,y:8},{x:0,y:8}]}];
const patterns:Partial<DeckData>[]=[{pattern:'Straight'},{pattern:'Diagonal'},{pattern:'Herringbone'},{pattern:'Picture Frame'},{pattern:'Straight',pictureFrameRows:2,width:30}];
let addressed=0;
for(const shape of shapes)for(const pattern of patterns){
  const d=base({...shape,...pattern}),model=buildDeckTakeoff(d),plan=boardFinishPlan(d,model),level=model.levels[0],addresses=plan.addresses[0];
  const label=`${d.shape}/${d.pattern}/${d.pictureFrameRows} borders`;
  ok(level.boards.every((b,i)=>b.role==='inlay'||!!addresses[i]),`${label}: every deck board has an address`);
  addressed+=addresses.length;
  if(d.pattern==='Straight'||d.pattern==='Picture Frame'){
    const rows=[...new Set(addresses.filter(a=>a?.role==='field').map(a=>Number(a!.course.slice(1))))].sort((a,b)=>a-b);
    ok(addresses.filter(a=>a?.role==='field').every(a=>/^r\d+$/.test(a!.course))&&rows.every((r,i)=>r===i),`${label}: straight rows are r0, r1, … from the house with no gap`);
    // Pieces of one row never overlap along it (the address really is one row).
    for(const r of rows){const pieces=addresses.filter(a=>a?.role==='field'&&a.course===`r${r}`).map(a=>[a!.from,a!.to]).sort((a,b)=>a[0]-b[0]);ok(pieces.every((p,i)=>i===0||p[0]>=pieces[i-1][1]-.01),`${label}: row ${r}'s pieces sit end to end`);}
  }
  if(d.pattern==='Herringbone'){const courses=addresses.filter(a=>a?.role==='field').map(a=>a!.course);ok(new Set(courses).size===courses.length&&addresses.every(a=>!a||a.role!=='field'||!a.rowPaint),`${label}: every herringbone piece is its own place, with no row painting`);}
  const breakers=[...new Set(addresses.filter(a=>a?.role==='breaker').map(a=>a!.course))].sort();
  ok(breakers.every((k,i)=>k===`k${i}`)&&breakers.length===level.breakers.length,`${label}: breakers are k0, k1, … from the left`);
  const borderRows=new Set(addresses.filter(a=>a?.role==='border').map(a=>a!.course.split('.')[0]));
  const expected=d.pictureFrameRows||(d.pattern==='Picture Frame'?1:0);
  ok(borderRows.size===expected&&[...borderRows].every(r=>/^e[01]$/.test(r)),`${label}: ${expected} border row(s) named e0/e1`);
}
{
  const d=base({width:20,length:12,wrap:{left:{widthFt:8,runFt:12}}}),wm=buildDeckTakeoff(d),plan=boardFinishPlan(d,wm);
  ok(!!wm.levels[0].wrapZones&&plan.addresses[0].every((a,i)=>!!a||wm.levels[0].boards[i].role==='inlay')&&plan.addresses[0].some(a=>a?.course.startsWith('a90:')),'A wrap-around deck addresses every board, its wing rows by their own lines');
  const d2=base({levels:2,width2:10,length2:8,height2:20}),m2=buildDeckTakeoff(d2),p2=boardFinishPlan(d2,m2),second=m2.levels.findIndex(l=>l.kind==='deck'&&l.index===1);
  ok(second>0&&p2.addresses[second].every(a=>a?.lv===2),'A second level\'s boards are level 2');
}

// 3. A choice survives resizing, a collection change and stair or railing edits.
const d0=base(),m0=buildDeckTakeoff(d0),target=boardFinishPlan(d0,m0).addresses[0].findIndex(a=>a?.role==='field'&&a.course==='r5');
const piece=paintBoard(d0,m0,{level:0,index:target},COCOA,'piece');
ok('boardColours' in piece&&piece.boardColours?.length===1&&piece.boardColours[0].scope==='piece'&&piece.boardColours[0].at!==undefined,'Painting one board saves one choice with its place along the row');
const painted={...d0,boardColours:(piece as {boardColours:BoardColour[]}).boardColours};
ok(describeBoardPlace(painted.boardColours[0])==='One board in row 6 from the house','The choice is named in plain words');
for(const [label,patch] of [['wider and deeper',{width:24,length:14}],['another stair',{stairFlights:2,stairPosition:'Left' as const}],['a new railing',{railingType:'Glass Panels' as const}]] as const){
  const d={...painted,...patch},plan=boardFinishPlan(d,buildDeckTakeoff(d));
  ok(plan.pieces===1&&plan.unmatched.length===0,`One painted board stays painted after ${label}`);
}
{
  const rowed={...d0,boardColours:[row('r5')]},plan=boardFinishPlan(rowed,m0);
  const rowPieces=plan.addresses[0].filter(a=>a?.course==='r5').length;
  ok(plan.pieces===rowPieces&&rowPieces>0,'Painting a row colours every piece in it');
  const narrow={...rowed,width:12};ok(boardFinishPlan(narrow,buildDeckTakeoff(narrow)).pieces>0,'A painted row stays painted when the deck narrows');
}

// Changing to shorter stock inserts a breaker through the saved marker; never silently repaint another piece.
{
 // TimberTech Prime has no manufacturer listing on file, so it keeps the 16 ft planning allowance (deckingStock.ts).
 const shorter={...painted,deckingMaterial:'tt_prime',deckingColor:'Maritime Gray'},plan=boardFinishPlan(shorter,buildDeckTakeoff(shorter));
 ok(plan.pieces===0&&plan.unmatched.length===1&&price(shorter).flags.some(f=>f.includes('no longer lines up with a board')),'An accent displaced by a new stock-length breaker is reported unmatched, never moved');
}

// 4. Never moved: when the boards move, the choice is unmatched, not drawn or priced, and says so.
{
  const plain=price(base());
  const moved:[string,DeckData][]=[['a pattern change',{...painted,pattern:'Diagonal'}],['the row leaving the deck',{...base({length:4}),boardColours:[row('r20')]}],['an unknown row',{...base(),boardColours:[row('r90')]}]];
  for(const [label,d] of moved){
    const plan=boardFinishPlan(d,buildDeckTakeoff(d)),e=price(d);
    ok(plan.pieces===0&&plan.unmatched.length===1,`After ${label}, the choice is unmatched`);
    ok(!accentSection(e)&&!labourItem(e)&&e.flags.some(f=>f.includes('no longer lines up with a board')),`After ${label}, nothing is priced and a review note says why`);
  }
  const back={...painted,pattern:'Diagonal' as const,boardColours:painted.boardColours};const again={...back,pattern:'Straight' as const};
  ok(boardFinishPlan(again,buildDeckTakeoff(again)).pieces===1,'Changing the pattern back brings the choice back');
  const gone={...base(),boardColours:[row('r90')]};ok(price(gone).subtotal===plain.subtotal,'An unmatched choice changes no price');
}

// 5. Painting rules: a single board beats its row; a row clears the single boards in it; the deck colour erases.
{
  const rowed={...d0,boardColours:[row('r5')]},plan=boardFinishPlan(rowed,m0),address=plan.addresses[0].find(a=>a?.course==='r5')!;
  const one=paintAddress(rowed,address,deckColourRef(rowed),'piece')!;
  ok(one.length===2&&boardFinishPlan({...rowed,boardColours:one},m0).pieces===plan.pieces-1,'The deck colour on one board of a painted row returns that board to the deck colour');
  const same=paintAddress(rowed,address,COCOA,'piece');ok(same?.length===1,'Painting a board the colour it already has adds nothing');
  const mixed=paintAddress({...rowed,boardColours:one},address,SALT,'course')!;ok(mixed.length===1&&mixed[0].scope==='course'&&mixed[0].colour===SALT,'Painting a row replaces the single-board choices in it');
  ok(paintAddress({...rowed,boardColours:mixed},address,deckColourRef(rowed),'course')===undefined,'Painting a row the deck colour erases it');
  const full=Array.from({length:MAX_BOARD_COLOURS},(_,i)=>({lv:1 as const,role:'field' as const,scope:'piece' as const,course:'r0',at:i*2+1000,colour:COCOA}));
  ok(paintAddress({...d0,boardColours:full},address,SALT,'piece')===null,`A design holds at most ${MAX_BOARD_COLOURS} choices`);
  const herring=base({pattern:'Herringbone'}),hm=buildDeckTakeoff(herring),hi=hm.levels[0].boards.findIndex(b=>(b.role??'field')==='field');
  const hp=paintBoard(herring,hm,{level:0,index:hi},COCOA,'course') as {boardColours:BoardColour[]};ok(hp.boardColours[0].scope==='piece','Herringbone paints one piece even when a row is asked for');
  ok('error' in paintBoard(base({hasInlay:true,inlayLf:8}),buildDeckTakeoff(base({hasInlay:true,inlayLf:8})),{level:0,index:buildDeckTakeoff(base({hasInlay:true,inlayLf:8})).levels[0].boards.findIndex(b=>b.role==='inlay')},COCOA,'piece'),'The legacy centre inlay takes no accent colour');
}

// 6. Only real colours this deck can take: its own collection, and priced collections of the same kind.
{
  ok(accentCollections(base())[0].id==='tt_prime_plus'&&accentCollections(base()).slice(1).every(m=>m.isComposite&&m.costPerSqft!==null&&!m.isHidden),'A composite deck takes its own colours and other priced composite collections');
  ok(accentCollections(base({deckingMaterial:'cedar'})).map(m=>m.id).join()==='cedar','A wood deck keeps its own species (its gap and stock length set the layout)');
  const unpriced=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&m.isComposite)!;
  ok(!accentCollections(base()).some(m=>m.id===unpriced.id),'A collection without a rate is not offered on another collection\'s deck');
  const d={...base(),boardColours:[row('r3',colourRef(unpriced.id,unpriced.colors[0].name))]};ok(boardFinishPlan(d,buildDeckTakeoff(d)).unmatched.length===1,'A saved colour this deck cannot take is not applied');
}

// 7. Pricing: each colour is ordered as its own boards at its collection's rate; labour is a builder quote.
{
  const plain=price(base()),plainDeck=plain.sections.find(s=>s.title==='Decking')!;
  const own={...base(),boardColours:[row('r3')]},e=price(own),acc=accentSection(e)!,deck=e.sections.find(s=>s.title==='Decking')!;
  const stock=e.stockSchedule.filter(r=>r.name.includes('accent boards'));
  ok(acc&&acc.items.length===1&&stock.length===1&&Number(deck.items[0].qty)<Number(plainDeck.items[0].qty),'An accent colour gets its own stock row and the main order drops');
  const rate=9.00*(5.5/12)*1.35;
  ok(Math.abs((acc.items[0].cost as number)-stock[0].orderedLf*rate)<.01,'An accent colour is priced at its collection\'s rate, ordered length × $/sq ft × board width, with the markup');
  const mainStock=e.stockSchedule[0],installedLf=e.model.levels.flatMap(l=>l.boards).reduce((n,b)=>n+b.length/12,0);
  ok(Math.abs(mainStock.installedLf+stock[0].installedLf-installedLf)<.01&&Math.abs(Number(deck.items[0].cost)-mainStock.orderedLf*rate)<.01,'Main and accent orders partition every modeled board exactly once and each uses its actual ordered-length collection rate');
  const other={...base(),boardColours:[row('r3'),row('r5',colourRef('tt_reserve','Antique Leather'))]},eo=price(other),acc2=accentSection(eo)!;
  const reserveRow=eo.stockSchedule.find(r=>r.name.startsWith('TimberTech PRO Reserve · Antique Leather'))!;
  const reserveRate=DECKING_CATALOGUE.find(m=>m.id==='tt_reserve')!.costPerSqft!;
  ok(acc2.items.length===2&&Math.abs((acc2.items[1].cost as number)-reserveRow.orderedLf*reserveRate*(5.5/12)*1.35)<.01,'Another collection is priced at its current sourced rate');
  const lab=labourItem(e)!;
  ok(lab&&lab.cost===null&&lab.qty===boardFinishPlan(own,e.model).pieces&&e.quoteRequired.includes('Accent-colour board labour (builder quote)'),'Fitting accent boards is a builder-quote labour line, never $0');
  ok(describeDesign(own,e).priceLabel==='Priced portion only','With a builder-quote line the price reads as the priced portion only');
  ok(eo.sections.flatMap(s=>s.items).every(i=>i.cost!==0||!/ccent/.test(i.name)),'No accent line is priced at $0');
  // A deck in a collection without a rate: its own colours as accents are a supplier quote too.
  const q=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&m.isComposite&&m.colors.length>1)!;
  const quoted={...base({deckingMaterial:q.id,deckingColor:q.colors[0].name}),boardColours:[row('r3',colourRef(q.id,q.colors[1].name))]},eq=price(quoted),accq=accentSection(eq)!;
  ok(accq.quoteRequired&&accq.items[0].cost===null&&eq.quoteRequired.some(n=>n.includes('accent boards')),'Accent boards from a collection without a rate are a supplier quote');
  const dk={...base(),boardColours:[row('r3',colourRef('deck_vista',DECKING_CATALOGUE.find(m=>m.id==='deck_vista')!.colors[0].name))]};
  ok(price(dk).flags.some(f=>f.includes('different manufacturer')),'Mixing manufacturers adds a review note on gap, fasteners and warranty');
  const slate={...base({pictureFrameRows:1,borderFinish:'Dark Slate'}),boardColours:[{lv:1 as const,role:'border' as const,scope:'course' as const,course:'e0.f0',colour:COCOA}]};
  ok(boardFinishPlan(slate,buildDeckTakeoff(slate)).pieces===0,'Dark Slate borders are their own product and take no accent colour');
}

// 8. Saving: validated, one choice per place (the last wins), bounded, and shared links stay short enough.
{
  const two=[{lv:1,role:'field',scope:'piece',course:'r3',at:60.3,colour:COCOA},{lv:1,role:'field',scope:'piece',course:'r3',at:60.3,colour:SALT}];
  const back=parseDesign(serializeDesign({...base(),boardColours:two as BoardColour[]}));
  ok(back.boardColours?.length===1&&back.boardColours[0].colour===SALT&&back.boardColours[0].at===60.5,'One choice per place survives a round trip (the last one, at a half-inch place)');
  for(const [label,bad] of [['an unknown colour',{...two[0],colour:'nope:Red'}],['a colour not in its collection',{...two[0],colour:'tt_prime_plus:Red'}],['a bad place',{...two[0],course:'<x>'}],['a bad level',{...two[0],lv:4}],['a bad scope',{...two[0],scope:'all'}],['a board with no place along its row',{...two[0],at:undefined}]] as const)
    assert.throws(()=>validateDesign({...base(),boardColours:[bad]}),undefined,`Rejects ${label}`),checks++;
  assert.throws(()=>validateDesign({...base(),boardColours:Array.from({length:MAX_BOARD_COLOURS+1},(_,i)=>({...two[0],at:i}))}));checks++;
  const full=Array.from({length:MAX_BOARD_COLOURS},(_,i)=>({lv:1 as const,role:'field' as const,scope:'piece' as const,course:`r${i%40}`,at:12+i*3.5,colour:i%2?COCOA:SALT}));
  const link=await encodeDesignLink({...base(),boardColours:full},'https://goldenmaplelandscaping.ca');
  ok(link.length<=MAX_DESIGN_LINK_CHARS,`${MAX_DESIGN_LINK_CHARS}-character link cap holds ${MAX_BOARD_COLOURS} accent boards (${link.length})`);
  ok(Buffer.byteLength(serializeDesign({...base(),boardColours:full}))<100_000,'A design file with the most accent boards stays under 100 KB');
}

// 9. Words and outputs: the design facts, the sample request and the funnel name the accent boards.
{
  const d={...base(),boardColours:[row('r3')]},e=price(d),facts=describeDesign(d,e).facts;
  ok(facts.some(f=>/^Accent boards: \d+ in Dark Cocoa \(TimberTech EDGE Prime\+\)$/.test(f)),'The design facts name the accent colour and count');
  ok(!describeDesign(base(),price(base())).facts.some(f=>f.startsWith('Accent boards')),'No accent fact without accent boards');
  ok(designFeatures(d).includes('deck_board_colours')&&!designFeatures(base()).includes('deck_board_colours'),'The funnel counts accent boards');
  const fields:SendDesignFields={name:'A',email:'a@example.com',phone:'7053008015',address:'Barrie',notes:'',offers:false,botField:'',timeline:'',budget:'',samples:true};
  const sent=buildDeckDesignSubmission(fields,{data:d,estimate:e,summary:'s',reviewItems:[],link:'https://goldenmaplelandscaping.ca/deck-designer#d',sentAt:new Date(0),consent:null});
  ok(/Samples: please bring Coconut Husk and the accent colours: Dark Cocoa \(TimberTech EDGE Prime\+\)/.test(sent.details),'A sample request includes the accent colours');
}

// 10. Wiring: pure modules, the 3D picking, the lazy panel and the plan legend.
{
  for(const f of ['src/features/deckcraft/lib/boardAddress.ts','src/features/deckcraft/boardFinishes.ts','src/features/deckcraft/boardPaint.ts'])ok(!/from ['"]three|@react-three/.test(read(f)),`${f} does not import three.js`);
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx'),designer=designerSource(),plan=read('src/features/deckcraft/ConstructionPlan.tsx');
  ok(viewer.includes('if(e.delta>4)return;')&&viewer.includes('if(!pick)return {};'),'A board click paints only when the tool is on, and an orbit drag never paints');
  ok(viewer.includes("!b.accent&&(!darkBorder||b.role!=='border')")&&viewer.includes('<AccentBoards key={g.ref}'),'Accent boards are drawn with their own product swatch, apart from the deck colour');
  ok(/lazy\(loadBoardColourPanel\)/.test(designer)&&read('scripts/check-deck-bundle.ts').includes('/^BoardColourPanel-/'),'The accent-board panel loads on demand, off the page\'s first load');
  ok(designer.includes("useEffect(()=>{if(!open.has('boards'))setBoardPaintState(null);},[open]);"),'Closing Boards & finish puts the tool down');
  ok(plan.includes("accentFill(i,j)??'none'")&&plan.includes('Accent boards:'),'The plan shades accent boards and names their colours');
  ok(!parseColourRef('tt_prime_plus:Nope')&&parseColourRef(COCOA)?.color.name==='Dark Cocoa','Colour references resolve only to real catalogue colours');
}

console.log(`DECK BOARD COLOURS OK — ${addressed} board addresses over ${shapes.length*patterns.length} designs, stability, never-moved, painting rules, collections, pricing, saving, outputs and wiring; ${checks} checks.`);
