import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {DECK_AREA,deckDesignerHref,deckSizeForArea,designHash,estimatorDeckHref,readDeckArea} from '../src/features/deckcraft/estimatorHandoff';
import {deckFromDesign,drawnDeck,starterDeck} from '../src/features/deckcraft/estimatorDeck';
import {DESIGN_LINK_PARAM,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {MATERIAL_TIERS} from '../src/features/deckcraft/types';
import {withDeckPrecise,withDeckRange} from '../src/utils/deckInEstimate';
import {computeEstimate,type EstimateInput} from '../src/utils/estimateEngine';
import {decodeBuild,encodeBuild} from '../src/utils/buildPermalink';
import {designerSource} from './deck-designer-source';

/**
 * One deck price on the site (owner decision 2026-09-23): the deck designer's. The cost estimator never prices a
 * deck with a rate of its own: choosing a deck opens the designer inside the estimator, and a full backyard's deck
 * is the designer's price (a starter deck at the chosen area until the visitor draws theirs), added to the
 * estimate's totals (owner decision 2026-09-28). The deck figures the site quotes are the designer's own,
 * recomputed here so a rate change cannot leave them behind.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const dollars=(n:number)=>`$${(Math.round(n/100)*100).toLocaleString('en-CA')}`;
const cents=(n:number)=>Math.round(n*100);

// 1. The cost-estimator FAQ quotes the designer's price for the deck it describes.
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
  ok(/<Link to="\/deck-designer">3D deck designer<\/Link> opens right here, the one deck price on this site/.test(page),'The page tells visitors where decks are priced');
}

// 2. The hand-off: an area becomes a 4:3 deck of about that size, and only a clean area is read.
{
  ok(JSON.stringify(deckSizeForArea(300))==='{"width":20,"length":15}','300 sq ft starts as a 20 × 15 ft deck');
  for(let sqft=DECK_AREA.min;sqft<=DECK_AREA.max;sqft+=10){
    const {width,length}=deckSizeForArea(sqft);
    ok(Number.isInteger(width)&&Number.isInteger(length)&&width>=length&&width<=60&&length>=8&&Math.abs(width*length-sqft)/sqft<.06,`${sqft} sq ft becomes ${width} × ${length} ft, within 6%`);
  }
  ok(deckDesignerHref(300)==='/deck-designer?sqft=300'&&deckDesignerHref(612.4)==='/deck-designer?sqft=612','The designer link carries the area');
  ok([undefined,NaN,50,2500,'300',null].every(v=>deckDesignerHref(v)==='/deck-designer'),'A missing or out-of-range area opens the designer as usual');
  ok(estimatorDeckHref(300)==='/cost-estimator?type=deck&sqft=300'&&[undefined,NaN,50,2500,'300',null].every(v=>estimatorDeckHref(v)==='/cost-estimator?type=deck'),'The estimator\'s deck link carries a clean area only');
  ok(readDeckArea('?sqft=300')===300&&readDeckArea('?city=barrie&sqft=1000')===1000&&readDeckArea('?studio=deck&sqft=640')===640,'The designer reads the handed-over area');
  ok(['','?sqft=','?sqft=abc','?sqft=99','?sqft=2001','?sqft=300.5','?sqft=-300','?sqft=3e2'].every(s=>readDeckArea(s)===null),'Anything else is ignored');
  ok(designHash('1zAbC_-')===`#${DESIGN_LINK_PARAM}=1zAbC_-`&&designLinkFromHash(designHash('1zAbC_-'))==='1zAbC_-','The estimator opens a drawn deck through the designer\'s own link hash');
}

// 3. Wiring: the estimator never prices a deck with a rate of its own, and every way in opens the designer here.
{
  const estimator=read('src/components/Estimator.tsx'),hero=read('src/components/HeroEstimator.tsx'),designer=designerSource(),studio=read('src/features/deckcraft/EstimatorDeckStudio.tsx');
  ok(/const pricedElements = useMemo\(\(\) => selectedElements\.filter\(e => e !== 'deck'\), \[selectedElements\]\);/.test(estimator)&&estimator.includes('projectType, selectedElements: pricedElements, sizes'),'The estimator\'s engine prices every chosen element except the deck');
  ok(!/installedPerSqft|DECK_BRANDS|showDeckPicker/.test(estimator),'The estimator has no deck rate or deck brand picker');
  ok(!/from '\.\.\/features\/deckcraft\/(estimatorDeck|deckRelease|calculations|EstimatorDeckStudio)'/.test(estimator)&&estimator.includes("const loadEstimatorDeck = () => import('../features/deckcraft/estimatorDeck');")&&estimator.includes("lazy(() => import('../features/deckcraft/EstimatorDeckStudio'))"),'The designer and its price engine load only when a deck is chosen, never with the estimator');
  ok(estimator.includes('withDeckPrecise(estimate.precise, deckCents)')&&estimator.includes('...withDeckRange(widenTotals(estimate, confidence), deckCents)')&&estimator.includes('withDeckRange(widenTotals(computeEstimate({ ...build, ...patch }), confidence), deckCents)'),'A full backyard\'s deck is in every total: the invoice, the range and every scenario range');
  ok(estimator.includes("const hasDeckElement = projectType === 'full' && selectedElements.includes('deck');")&&estimator.includes('const deckInBuild = hasDeckElement ? deck : null;'),'Only a full backyard with a deck carries one');
  ok(estimator.includes('buildPermalink({ ...build, selectedElements }, targetBudget, deckInBuild?.design)'),'A saved estimate keeps the deck, with its drawn design');
  ok(/if \(saved && onlyDeck\(saved\.projectType, saved\.selectedElements\)\) \{[\s\S]{0,500}studio: 'deck'[\s\S]{0,500}hash: saved\.deckDesign \? designHash\(saved\.deckDesign\)/.test(estimator),'A saved deck-only estimate reopens its deck in the designer, here');
  ok(/if \(searchParams\.get\('type'\) === 'deck'\) \{[\s\S]{0,240}prev\.set\('studio', 'deck'\)/.test(estimator),'A ?type=deck link opens the designer here, keeping its area for the designer to read');
  ok(estimator.includes("if (step === 1 && projectType === 'deck') { openStudio('deck', 'type'); return; }")&&/if \(step === 2 && onlyDeck\(projectType, selectedElements\)\) \{ openStudio\('deck', 'full_only'/.test(estimator),'Choosing a deck, or a backyard that is only a deck, opens the designer here');
  ok(/\{el === 'deck' \? \(\s*<>\s*\{deck\?\.source !== 'design' && renderSizeInputs\(el\)\}\s*\{renderDeckCard\(\)\}/.test(estimator)&&/onClick=\{\(\) => openStudio\('full', 'design'/.test(estimator),'A full backyard\'s deck shows its designer price and opens the designer without losing the estimate');
  ok(/if \(studio\) \{\s*return \(\s*<Suspense fallback=\{<StudioLoading \/>\}>\s*<EstimatorDeckStudio mode=\{studio\}/.test(estimator)&&estimator.includes('const studio: StudioMode | null = !mounted ? null'),'The studio takes over the page only after mount, after every hook has run');
  ok(studio.includes("import {DeckCraftWorkspace} from '../../pages/DeckDesigner';")&&/<DeckCraftWorkspace embed=\{\{renderBar:/.test(studio)&&studio.includes('drawnDeck(data,estimate)'),'The studio is the /deck-designer workspace itself, and hands back the deck exactly as it priced it');
  ok(/export default function DeckDesigner\(\)\{\s*return <DeckCraftWorkspace\/>;\s*\}/.test(designer)&&designer.includes('{embed?embed.renderBar({data,estimate}):<SEO title="Design Your Deck in 3D'),'The /deck-designer page is the same workspace, with its own title only when not embedded');
  ok(/if \(projectType === 'deck'\) \{ navigate\(estimatorDeckHref\(sqft\)\); return; \}/.test(hero),'The home-page quick estimator opens the designer in the estimator');
  ok(/const area=readDeckArea\(window\.location\.search\),link=designLinkFromHash\(window\.location\.hash\);/.test(designer)&&designer.includes('if(!link&&!stored){update(size);')&&designer.includes("query.delete('sqft')"),'The designer starts a new visitor at the handed-over size, never replaces a saved or shared design, and clears the size from the address');
}

// 4. The deck in an estimate is the designer's price, to the cent, and the totals reconcile.
await (async()=>{
  for(const sqft of [100,300,612,1000,2000]){
    const deck=starterDeck(sqft),data=deckReleaseData({...structuredClone(DEFAULT_DECK),...deckSizeForArea(sqft)});
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

console.log(`DECK SITE PRICE OK — one deck price: the FAQ quotes the designer, the estimator opens it and adds its price, ${checks} checks.`);
