import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {DEFAULT_DECK,NEW_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {DECK_AREA,deckSizeForArea,designFromHash,designHash,estimatorDeckHref,readDeckArea} from '../src/features/deckcraft/estimatorHandoff';
import {deckFromDesign,drawnDeck,starterDeck} from '../src/features/deckcraft/estimatorDeck';
import {DESIGN_LINK_PARAM,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {MATERIAL_TIERS,type DeckData} from '../src/features/deckcraft/types';
import {QUICK_DECK_DEFAULT,QUICK_DECK_FT,QUICK_HEIGHTS,QUICK_MATERIALS,QUICK_RAILINGS,normalizeQuickDeck,quickDeckForArea,railingAllowed,type QuickDeck} from '../src/features/deck-estimator/quickDeck';
import {priceQuickDeck,quickDeckFromData,quickDeckFromDesign,quickDeckWithLink} from '../src/features/deck-estimator/quickDeckPrice';
import {withDeckPrecise,withDeckRange} from '../src/utils/deckInEstimate';
import {computeEstimate,type EstimateInput} from '../src/utils/estimateEngine';
import {decodeBuild,encodeBuild} from '../src/utils/buildPermalink';
import {designerSource} from './deck-designer-source';

/**
 * One deck price on the site (owner decision 2026-09-23): DeckCraft's price engine. The 3D designer itself is the
 * owner's private tool (owner decision 2026-11-11: "local only"): it stays out of the production build, and visitors
 * price a deck in the light deck estimator inside the cost estimator, which runs the same engine without the 3D. A
 * full backyard's deck is that engine's price (a starter deck at the chosen area until the visitor sets theirs), added
 * to the estimate's totals (owner decision 2026-09-28). The deck figures the site quotes are the engine's own,
 * recomputed here so a rate change cannot leave them behind.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const dollars=(n:number)=>`$${(Math.round(n/100)*100).toLocaleString('en-CA')}`;
const cents=(n:number)=>Math.round(n*100);

// 1. The cost-estimator FAQ quotes the engine's price for the deck it describes.
{
  const page=read('src/pages/CostEstimator.tsx');
  const answer=/"name": "What does a composite deck cost in Simcoe County\?",[\s\S]*?"text": "([^"]+)"/.exec(page)?.[1]??'';
  const deck={...structuredClone(DEFAULT_DECK),width:20,length:15,height:18},walkout={...deck,height:96};
  const material=MATERIAL_TIERS.find(m=>m.id===deck.deckingMaterial)!;
  ok(deck.deckType==='Attached'&&deck.railingType==='Aluminum'&&deck.stairFlights===1&&deck.pictureFrameRows===1&&answer.includes(`20 × 15 ft (300 sq ft) attached deck 18 in off the ground in ${material.name} decking, with aluminum railing, one stair and a one-row picture-frame border`),`The FAQ describes the deck it prices, in the designer's words (${material.name})`);
  const ground=calculateDeckReleaseEstimate(deck),high=calculateDeckReleaseEstimate(walkout);
  ok(answer.includes(`has a priced portion of about ${dollars(ground.subtotal)} before HST`),`The FAQ's ground-level price is the designer's priced portion (${dollars(ground.subtotal)} before HST)`);
  ok(answer.includes(`the same deck 8 ft up as a walkout has a priced portion of about ${dollars(high.subtotal)}`),`The FAQ's walkout price is the designer's priced portion (${dollars(high.subtotal)})`);
  ok(ground.quoteRequired.length>0===answer.includes('confirmed by supplier quote'),'The FAQ says what is left to a supplier quote exactly when the designer leaves something to one');
  ok(!/\$\d+\s*\/\s*sq\s*ft/i.test(answer)&&!/19,500|30,500/.test(answer),'The FAQ no longer quotes the estimator\'s flat deck rate');
  ok(answer.startsWith('Our deck estimator gives the one deck price on this site:'),'The FAQ sends visitors to the deck estimator, not the private designer');
  ok(/Choose a composite deck and our deck estimator opens right here, the one deck price on this site\./.test(page)&&!page.includes('/deck-designer'),'The page tells visitors where decks are priced, and never links the private designer');
}

// 2. The hand-off: an area becomes a 4:3 deck of about that size, and only a clean area is read.
{
  ok(JSON.stringify(deckSizeForArea(300))==='{"width":20,"length":15}','300 sq ft starts as a 20 × 15 ft deck');
  for(let sqft=DECK_AREA.min;sqft<=DECK_AREA.max;sqft+=10){
    const {width,length}=deckSizeForArea(sqft);
    ok(Number.isInteger(width)&&Number.isInteger(length)&&width>=length&&width<=60&&length>=8&&Math.abs(width*length-sqft)/sqft<.06,`${sqft} sq ft becomes ${width} × ${length} ft, within 6%`);
  }
  ok(estimatorDeckHref(300)==='/cost-estimator?type=deck&sqft=300'&&[undefined,NaN,50,2500,'300',null].every(v=>estimatorDeckHref(v)==='/cost-estimator?type=deck'),'The estimator\'s deck link carries a clean area only');
  ok(readDeckArea('?sqft=300')===300&&readDeckArea('?city=barrie&sqft=1000')===1000&&readDeckArea('?studio=deck&sqft=640')===640,'The designer reads the handed-over area');
  ok(['','?sqft=','?sqft=abc','?sqft=99','?sqft=2001','?sqft=300.5','?sqft=-300','?sqft=3e2'].every(s=>readDeckArea(s)===null),'Anything else is ignored');
  ok(designHash('1zAbC_-')===`#${DESIGN_LINK_PARAM}=1zAbC_-`&&designLinkFromHash(designHash('1zAbC_-'))==='1zAbC_-','The estimator opens a drawn deck through the designer\'s own link hash');
  ok(['',`#${DESIGN_LINK_PARAM}=`,designHash('1zAbC_-'),`#x=1&${DESIGN_LINK_PARAM}=1jQ`,'#d','#other=1zAbC'].every(h=>designFromHash(h)===designLinkFromHash(h)),'The deck estimator reads a deck link from the address exactly as the designer does');
}

// 3. Wiring: the estimator never prices a deck with a rate of its own, every way in opens the light deck estimator
// here, and nothing a visitor loads reaches the private 3D designer.
{
  const estimator=read('src/components/Estimator.tsx'),hero=read('src/components/HeroEstimator.tsx'),designer=designerSource();
  const quick=readdirSync(new URL('../src/features/deck-estimator/',import.meta.url)).map(f=>read(`src/features/deck-estimator/${f}`)).join('\n');
  ok(/const pricedElements = useMemo\(\(\) => selectedElements\.filter\(e => e !== 'deck'\), \[selectedElements\]\);/.test(estimator)&&estimator.includes('projectType, selectedElements: pricedElements, sizes'),'The estimator\'s engine prices every chosen element except the deck');
  ok(!/installedPerSqft|DECK_BRANDS|showDeckPicker/.test(estimator),'The estimator has no deck rate or deck brand picker');
  ok(!/from '\.\.\/features\/(deckcraft\/(estimatorDeck|deckRelease|calculations)|deck-estimator\/(DeckQuickEstimator|quickDeckPrice))'/.test(estimator)&&estimator.includes("const loadEstimatorDeck = () => import('../features/deckcraft/estimatorDeck');")&&/const DeckQuickEstimator = lazy\(\(\) => \{\s*void import\('\.\.\/features\/deck-estimator\/quickDeckPrice'\)[^\n]*\n\s*return import\('\.\.\/features\/deck-estimator\/DeckQuickEstimator'\);/.test(estimator),'The deck estimator and its price engine load only when a deck is chosen, never with the estimator, and both at once');
  ok(!/EstimatorDeckStudio|pages\/DeckDesigner|DeckCraftWorkspace/.test(estimator)&&!/deckcraft\/(designer|components)\/|pages\/DeckDesigner|DeckCraftWorkspace|from 'three'|@react-three/.test(quick),'Neither the estimator nor the deck estimator imports the 3D designer');
  ok(/import\('\.\/quickDeckPrice'\)/.test(read('src/features/deck-estimator/DeckQuickEstimator.tsx'))&&!/^import (?!type )[^\n]*from '\.\/quickDeckPrice'/m.test(read('src/features/deck-estimator/DeckQuickEstimator.tsx')),'The deck estimator draws its form at once and loads the price engine beside it');
  ok(estimator.includes('withDeckPrecise(estimate.precise, deckCents)')&&estimator.includes('...withDeckRange(widenTotals(estimate, confidence), deckCents)')&&estimator.includes('withDeckRange(widenTotals(computeEstimate({ ...build, ...patch }), confidence), deckCents)'),'A full backyard\'s deck is in every total: the invoice, the range and every scenario range');
  ok(estimator.includes("const hasDeckElement = projectType === 'full' && selectedElements.includes('deck');")&&estimator.includes('const deckInBuild = hasDeckElement ? deck : null;'),'Only a full backyard with a deck carries one');
  ok(estimator.includes('buildPermalink({ ...build, selectedElements }, targetBudget, deckInBuild?.design)'),'A saved estimate keeps the deck, with its drawn design');
  ok(/if \(saved && onlyDeck\(saved\.projectType, saved\.selectedElements\)\) \{[\s\S]{0,500}studio: 'deck'[\s\S]{0,500}hash: saved\.deckDesign \? designHash\(saved\.deckDesign\)/.test(estimator),'A saved deck-only estimate reopens its deck in the deck estimator, here');
  ok(/if \(searchParams\.get\('type'\) === 'deck'\) \{[\s\S]{0,320}next\.set\('studio', 'deck'\);\s*navigate\(\{ search: `\?\$\{next\}`, hash: window\.location\.hash \}, \{ replace: true \}\);/.test(estimator),'A ?type=deck link opens the deck estimator here, keeping its area and any shared deck in the address');
  ok(estimator.includes("if (step === 1 && projectType === 'deck') { openStudio('deck', 'type'); return; }")&&/if \(step === 2 && onlyDeck\(projectType, selectedElements\)\) \{ openStudio\('deck', 'full_only'/.test(estimator),'Choosing a deck, or a backyard that is only a deck, opens the deck estimator here');
  ok(/\{el === 'deck' \? \(\s*<>\s*\{deck\?\.source !== 'design' && renderSizeInputs\(el\)\}\s*\{renderDeckCard\(\)\}/.test(estimator)&&/onClick=\{\(\) => openStudio\('full', 'design'/.test(estimator),'A full backyard\'s deck shows its engine price and opens the deck estimator without losing the estimate');
  ok(/if \(studio\) \{\s*return \(\s*<Suspense fallback=\{<StudioLoading \/>\}>\s*<DeckQuickEstimator mode=\{studio\} initialDesign=\{deck\?\.design\}/.test(estimator)&&estimator.includes('const studio: StudioMode | null = !mounted ? null'),'The deck estimator takes over the page only after mount, after every hook has run, and opens a backyard\'s own deck');
  ok(/if \(projectType === 'deck'\) \{ navigate\(estimatorDeckHref\(sqft\)\); return; \}/.test(hero),'The home-page quick estimator opens the deck estimator');
  ok(/if \(projectType === 'deck'\) \{\s*navigate\(estimatorDeckHref\(sqft\)\);\s*return;\s*\}/.test(read('src/components/home/blocks/InstantEstimate.tsx')),'The home page estimate panel opens the deck estimator');
  ok(/const area=readDeckArea\(window\.location\.search\),link=designLinkFromHash\(window\.location\.hash\);/.test(designer)&&designer.includes('if(!link&&!stored){update(size);')&&designer.includes("query.delete('sqft')"),'The private designer still starts at a handed-over size and never replaces a saved or shared design');
  // The designer is the owner's private tool: out of the production build, and its old address sends visitors on.
  const routes=read('src/routes.ts'),netlify=read('netlify.toml');
  ok(/process\.env\.GM_DECKCRAFT_ROUTE !== 'off'/.test(routes)&&/route\('deck-designer', 'pages\/DeckDesigner\.tsx'\)/.test(routes),'The /deck-designer route is built only when GM_DECKCRAFT_ROUTE is not "off"');
  ok(/\[build\.environment\][^[]*GM_DECKCRAFT_ROUTE = "off"/.test(netlify),'Netlify builds the live site without the designer');
  for(const from of ['/deck-designer','/deck-designer/*'])ok(new RegExp(`\\[\\[redirects\\]\\]\\s*from = "${from.replace(/[*/]/g,'\\$&')}"\\s*to = "/cost-estimator/\\?type=deck"\\s*status = 301\\s*force = true`).test(netlify),`${from} sends visitors to the deck estimator (forced 301)`);
  const linksIn=(dir:string):string[]=>readdirSync(new URL(`../${dir}/`,import.meta.url),{withFileTypes:true}).flatMap(e=>e.isDirectory()?linksIn(`${dir}/${e.name}`):/\.(tsx?|json)$/.test(e.name)&&read(`${dir}/${e.name}`).includes('/deck-designer')?[`${dir}/${e.name}`]:[]);
  const PRIVATE_OK=['src/pages/DeckDesigner.tsx','src/root.tsx','src/data/sophieTeasers.ts'];
  ok(['src/pages','src/components','src/data','src/utils'].flatMap(linksIn).every(f=>PRIVATE_OK.includes(f)),`No public page, component or fact points at /deck-designer (${['src/pages','src/components','src/data','src/utils'].flatMap(linksIn).filter(f=>!PRIVATE_OK.includes(f)).join(', ')})`);
}

// 4. The deck in an estimate is the engine's price, to the cent, and the totals reconcile.
await (async()=>{
  for(const sqft of [100,300,612,1000,2000]){
    const deck=starterDeck(sqft),data=deckReleaseData({...structuredClone(NEW_DECK),...deckSizeForArea(sqft)});
    ok(deck.source==='starter'&&deck.subtotalCents===cents(calculateDeckReleaseEstimate(data).subtotal),`A ${sqft} sq ft starter deck is the designer's own price for its default deck at that size (${deck.subtotalCents} cents)`);
    ok(Math.abs(deck.areaSqft-sqft)/sqft<.06&&!deck.design&&deck.backyardCents===0,`A ${sqft} sq ft starter deck is about that area (${deck.areaSqft} sq ft), with no drawn design or backyard`);
  }
  const data=deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:15,height:18}),estimate=calculateDeckReleaseEstimate(data);
  const drawn=await drawnDeck(data,estimate);
  ok(drawn.source==='design'&&drawn.subtotalCents===cents(estimate.subtotal)&&typeof drawn.design==='string'&&/^1[zj]/.test(drawn.design),'A drawn deck is priced exactly as the designer showed it and carries its share link');
  ok(drawn.label.includes('20 × 15 ft')&&drawn.label.includes('18 in above grade'),`A drawn deck says what it is: ${drawn.label}`);
  const reopened=await deckFromDesign(drawn.design!);
  ok(reopened.subtotalCents===drawn.subtotalCents&&reopened.design===drawn.design,'A saved estimate\'s drawn deck reopens at the same price');
  const input=(elements:string[])=>({projectType:'full',selectedElements:elements,sizes:{patio:500,deck:300},details:{},conditions:{access:false,slope:false,drainage:false,levels:false},location:'barrie',tier:'mid',paverBrandId:'permacon-mondrian-plus',deckBrandId:'timbertech-prime',addOns:[]}) as EstimateInput;
  const p=computeEstimate(input(['patio'])).precise!,withDeck=withDeckPrecise(p,drawn.subtotalCents)!;
  ok(withDeck.subtotalCents===p.subtotalCents+drawn.subtotalCents&&withDeck.hstCents===Math.round(withDeck.subtotalCents*0.13)&&withDeck.grandTotalCents===withDeck.subtotalCents+withDeck.hstCents&&withDeck.deckCents===drawn.subtotalCents,'The invoice adds the deck as its own line: subtotal, HST on it and the total reconcile to the cent');
  ok(Object.entries(p.perCategoryCents).every(([k,v])=>withDeck.perCategoryCents[k as keyof typeof p.perCategoryCents]===v)&&withDeck.addOnsCents===p.addOnsCents,'The engine\'s own lines are untouched');
  const noDeck=withDeckPrecise(p,0)!;
  ok(noDeck.subtotalCents===p.subtotalCents&&noDeck.hstCents===p.hstCents&&noDeck.grandTotalCents===p.grandTotalCents&&withDeckPrecise(null,5000)===null,'No deck, no change; no invoice stays no invoice');
  const range=withDeckRange({low:20000,high:31000},drawn.subtotalCents),deckDollars=drawn.subtotalCents/100;
  ok(range.low===Math.round((20000+deckDollars)/250)*250&&range.high===Math.round((31000+deckDollars)/250)*250&&range.low%250===0,'The range adds the deck to both ends, on the estimator\'s $250 steps');
  ok(withDeckRange({low:0,high:0},drawn.subtotalCents).low===0&&withDeckRange({low:20000,high:31000},0).high===31000,'An empty range stays empty, and no deck changes nothing');
  const build=input(['patio','deck']);
  ok(decodeBuild(encodeBuild(build,null,drawn.design))?.deckDesign===drawn.design&&decodeBuild(encodeBuild(build,null))?.deckDesign===null,'A saved estimate carries a drawn deck, and one without reopens as before');
  ok(decodeBuild(encodeBuild(build,null,'<script>'))?.deckDesign===null,'A malformed deck design in a link is ignored');
})();

// 5. The light deck estimator: every choice is a real DeckCraft deck, priced by the engine to the cent.
await (async()=>{
  // Its options: the priced composite and PVC collections, the railings the engine prices in full, four heights.
  const priced=DECKING_CATALOGUE.filter(m=>!m.isHidden&&m.isComposite&&m.costPerSqft!==null).map(m=>m.id);
  ok(isDeepStrictEqual(QUICK_MATERIALS.map(m=>m.id),priced)&&priced.includes(QUICK_DECK_DEFAULT.material),`The decking choices are every priced composite and PVC collection (${priced.length})`);
  ok(!QUICK_MATERIALS.some(m=>['pressure_treated','cedar'].includes(m.id)),'No wood decking: the project is a composite deck');
  ok(!QUICK_RAILINGS.some(r=>(r.value as string)==='Frameless Glass')&&QUICK_RAILINGS.some(r=>r.value==='None'),'No railing that is left to a supplier quote; no railing at all is a choice');
  ok(QUICK_HEIGHTS.map(h=>h.inches).join()==='18,36,60,96','Four heights: low, raised, high and walkout');
  ok(railingAllowed('None',18)&&!railingAllowed('None',36)&&railingAllowed('Aluminum',96),'No railing only below the 600 mm guard height');

  // At a handed-over area it opens on the designer's own starter deck: the same deck, the same cents.
  ok(isDeepStrictEqual(quickDeckForArea(null),QUICK_DECK_DEFAULT)&&QUICK_DECK_DEFAULT.width===NEW_DECK.width&&QUICK_DECK_DEFAULT.length===NEW_DECK.length&&QUICK_DECK_DEFAULT.height===NEW_DECK.height,'Without an area it opens on the designer\'s new deck');
  for(const sqft of [100,300,612,2000]){
    const q=quickDeckForArea(sqft),size=deckSizeForArea(sqft),starter=starterDeck(sqft);
    ok(q.width===size.width&&q.length===size.length,`${sqft} sq ft opens as ${size.width} × ${size.length} ft`);
    ok(priceQuickDeck(q).deck.subtotalCents===starter.subtotalCents,`At ${sqft} sq ft its price is the designer's starter deck, to the cent (${starter.subtotalCents})`);
  }

  // Each choice is the patch the designer's own editors apply (selectPatch, collectionPatch), priced by the engine.
  const q0=quickDeckForArea(300),base={...structuredClone(NEW_DECK),width:20,length:15};
  const engine=(patch:Partial<DeckData>)=>cents(calculateDeckReleaseEstimate(deckReleaseData({...base,...patch})).subtotal);
  const cases:[Partial<QuickDeck>,Partial<DeckData>,string][]=[
    [{},{},'the starter deck'],
    [{height:96},{height:96},'a walkout'],
    [{height:18,railing:'None'},{height:18,railingType:'None'},'a low deck with no railing'],
    [{railing:'Glass Panels'},{railingType:'Glass Panels'},'glass panels'],
    [{deckType:'Freestanding'},{deckType:'Freestanding'},'a freestanding deck'],
    [{stairs:0},{stairFlights:0},'no stairs'],
    [{stairs:2},{stairFlights:2},'two stairs'],
    [{skirting:false},{skirting:undefined},'no skirting'],
    [{removeOld:true},{hasDemo:true},'an old deck removed'],
    [{border:false},{pictureFrameRows:0,borderFinish:'Matching'},'no picture-frame border'],
    [{material:'tt_reserve'},{deckingMaterial:'tt_reserve',deckingColor:'Antique Leather'},'TimberTech PRO Reserve'],
    [{width:24,length:12,height:60,material:'deck_vista',railing:'Cable',stairs:2},{width:24,length:12,height:60,deckingMaterial:'deck_vista',deckingColor:'Dunewood',railingType:'Cable',stairFlights:2},'a mix of choices'],
  ];
  for(const [change,patch,name] of cases)ok(priceQuickDeck({...q0,...change}).deck.subtotalCents===engine(patch),`${name}: the deck estimator's price is the designer's, to the cent`);
  const p=priceQuickDeck(q0);
  ok(p.hstCents===Math.round(p.deck.subtotalCents*0.13)&&p.totalCents===p.deck.subtotalCents+p.hstCents,'Subtotal, 13% HST and total reconcile to the cent');
  ok(p.deck.label.startsWith('300 sq ft')&&p.deck.label.includes('20 × 15 ft')&&p.deck.label.includes('36 in above grade'),`It says what the deck is: ${p.deck.label}`);

  // Choices are held to what can be built and priced.
  const held=normalizeQuickDeck({...q0,width:100,length:2.4,height:30,railing:'None',stairs:5 as 2,material:'pressure_treated'});
  ok(held.width===QUICK_DECK_FT.width.max&&held.length===QUICK_DECK_FT.length.min&&held.height===36&&held.railing===QUICK_DECK_DEFAULT.railing&&held.stairs===2&&held.material===QUICK_DECK_DEFAULT.material,`Sizes are held to the limits, a height snaps to the nearest choice, no railing above guard height takes the default railing, an unknown collection the default (${JSON.stringify(held)})`);
  ok(normalizeQuickDeck({...q0,height:18,railing:'None'}).railing==='None'&&normalizeQuickDeck({...q0,width:20.4}).width===20,'A low deck may have no railing; sizes are whole feet');

  // A deck's link reopens the same choices at the same price; an older drawn design opens as its nearest light deck.
  for(const [change] of cases){
    const q=normalizeQuickDeck({...q0,...change}),linked=await quickDeckWithLink(q);
    ok(linked.source==='design'&&typeof linked.design==='string'&&linked.subtotalCents===priceQuickDeck(q).deck.subtotalCents,`A deck handed on carries its link and its price (${JSON.stringify(change)})`);
    ok(isDeepStrictEqual(await quickDeckFromDesign(linked.design!),q),`Its link reopens the same choices (${JSON.stringify(change)})`);
    ok((await deckFromDesign(linked.design!)).subtotalCents===linked.subtotalCents,'A saved estimate reprices it to the same cents');
  }
  const older=quickDeckFromData(deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:15,height:30,deckType:'Floating',railingType:'Trex Select',stairFlights:3}));
  ok(isDeepStrictEqual(older,{width:20,length:15,height:36,deckType:'Freestanding',material:'tt_harvest',railing:'Aluminum',stairs:2,skirting:false,removeOld:false,border:true}),`An older design opens as its nearest light deck (${JSON.stringify(older)})`);
})();

console.log(`DECK SITE PRICE OK — one deck price: the FAQ quotes the engine, the deck estimator prices with it to the cent, the 3D designer stays private, ${checks} checks.`);
