import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {DECK_AREA,deckDesignerHref,deckSizeForArea,readDeckArea} from '../src/features/deckcraft/estimatorHandoff';
import {MATERIAL_TIERS} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * One deck price on the site (owner decision 2026-09-23): the deck designer's. The cost estimator and the
 * home-page quick estimator never price a deck; they hand it to the designer with its area, and the deck
 * figures the site quotes are the designer's own, recomputed here so a rate change cannot leave them behind.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const dollars=(n:number)=>`$${(Math.round(n/100)*100).toLocaleString('en-CA')}`;

// 1. The cost-estimator FAQ quotes the designer's price for the deck it describes.
{
  const page=read('src/pages/CostEstimator.tsx');
  const answer=/"name": "What does a composite deck cost in Simcoe County\?",[\s\S]*?"text": "([^"]+)"/.exec(page)?.[1]??'';
  const deck={...structuredClone(DEFAULT_DECK),width:20,length:15,height:18},walkout={...deck,height:96};
  const material=MATERIAL_TIERS.find(m=>m.id===deck.deckingMaterial)!;
  ok(deck.deckType==='Attached'&&deck.railingType==='Aluminum'&&deck.stairFlights===1&&answer.includes(`20 × 15 ft (300 sq ft) attached deck 18 in off the ground in ${material.name} decking, with aluminum railing and one stair`),`The FAQ describes the deck it prices, in the designer's words (${material.name})`);
  const ground=calculateDeckReleaseEstimate(deck),high=calculateDeckReleaseEstimate(walkout);
  ok(answer.includes(`has a priced portion of about ${dollars(ground.subtotal)} before HST`),`The FAQ's ground-level price is the designer's priced portion (${dollars(ground.subtotal)} before HST)`);
  ok(answer.includes(`the same deck 8 ft up as a walkout has a priced portion of about ${dollars(high.subtotal)}`),`The FAQ's walkout price is the designer's priced portion (${dollars(high.subtotal)})`);
  ok(ground.quoteRequired.length>0===answer.includes('confirmed by supplier quote'),'The FAQ says what is left to a supplier quote exactly when the designer leaves something to one');
  ok(!/\$\d+\s*\/\s*sq\s*ft/i.test(answer)&&!/19,500|30,500/.test(answer),'The FAQ no longer quotes the estimator\'s flat deck rate');
  ok(/<Link to="\/deck-designer">3D deck designer<\/Link>, the one deck price on this site/.test(page),'The page tells visitors where decks are priced');
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
  ok(readDeckArea('?sqft=300')===300&&readDeckArea('?city=barrie&sqft=1000')===1000,'The designer reads the handed-over area');
  ok(['','?sqft=','?sqft=abc','?sqft=99','?sqft=2001','?sqft=300.5','?sqft=-300','?sqft=3e2'].every(s=>readDeckArea(s)===null),'Anything else is ignored');
}

// 3. Wiring: the estimator never prices a deck, and every way in hands the deck over.
{
  const estimator=read('src/components/Estimator.tsx'),hero=read('src/components/HeroEstimator.tsx'),designer=designerSource();
  ok(/const pricedElements = useMemo\(\(\) => selectedElements\.filter\(e => e !== 'deck'\), \[selectedElements\]\);/.test(estimator)&&estimator.includes('projectType, selectedElements: pricedElements, sizes'),'The estimator prices every chosen element except the deck');
  ok(!/installedPerSqft|DECK_BRANDS|showDeckPicker/.test(estimator),'The estimator has no deck rate or deck brand picker');
  ok(estimator.includes('buildPermalink({ ...build, selectedElements }, targetBudget)'),'A saved estimate keeps the deck as a choice');
  ok(/if \(saved && onlyDeck\(saved\.projectType, saved\.selectedElements\)\) \{[\s\S]{0,120}navigate\(deckDesignerHref\(saved\.sizes\.deck\), \{ replace: true \}\);/.test(estimator),'A saved deck-only estimate opens the designer at its size');
  ok(/if \(searchParams\.get\('type'\) === 'deck'\) \{[\s\S]{0,120}navigate\(deckDesignerHref\(Number\(searchParams\.get\('sqft'\)\)\), \{ replace: true \}\);/.test(estimator),'A ?type=deck link opens the designer at its size');
  ok(estimator.includes("if (step === 1 && projectType === 'deck') {")&&/if \(step === 2 && onlyDeck\(projectType, selectedElements\)\) \{[^}]*navigate\(deckDesignerHref\(sizes\.deck\)\)/.test(estimator),'Choosing a deck, or a backyard that is only a deck, opens the designer');
  ok(/\{el === 'deck' \? renderDeckHandoff\(\) : renderDetailQuestions\(el\)\}/.test(estimator)&&/projectType === 'full' && selectedElements\.includes\('deck'\) && \(\s*<div className="mt-6">\{renderDeckHandoff\(\)\}<\/div>/.test(estimator)&&/href=\{deckDesignerHref\(sizes\.deck\)\}\s*target="_blank"/.test(estimator),'A full backyard\'s deck says where it is priced, at its size, without losing the estimate');
  ok(/if \(projectType === 'deck'\) \{ navigate\(deckDesignerHref\(sqft\)\); return; \}/.test(hero),'The home-page quick estimator sends decks to the designer');
  ok(/const area=readDeckArea\(window\.location\.search\),link=designLinkFromHash\(window\.location\.hash\);/.test(designer)&&designer.includes('if(!link&&!stored){update(size);')&&designer.includes("query.delete('sqft')"),'The designer starts a new visitor at the handed-over size, never replaces a saved or shared design, and clears the size from the address');
}

console.log(`DECK SITE PRICE OK — one deck price: the FAQ quotes the designer, every estimator path hands decks over, ${checks} checks.`);
