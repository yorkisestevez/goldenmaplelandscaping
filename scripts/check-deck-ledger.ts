import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {splitSubtotal} from '../src/features/deckcraft/backyard';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {dollars,type DeckEstimate} from '../src/features/deckcraft/designFacts';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {DECKING_CATALOGUE,MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {priceBookLabel} from '../src/features/deckcraft/priceBook';
import type {DeckData,PrivacyScreen} from '../src/features/deckcraft/types';
import {GROUP_MS} from '../src/features/deckcraft/designer/designHistory';
import PriceLedger from '../src/features/deckcraft/designer/PriceLedger';
import {isBuilderQuote,priceLedger,quoteLabel,sectionPriceEffect,type Ledger,type QuoteKind} from '../src/features/deckcraft/designer/priceLedgerModel';
import {SECTIONS,SECTION_BY_ID,ownsTitle} from '../src/features/deckcraft/designer/sections';
import {EMPTY_CHANGES,MAX_CHANGES,announceChange,changeLedger,changeValue,describeChange,describeEdit,priceState,signedDollars,type ChangeAction,type ChangeLedgerState,type PriceState} from '../src/features/deckcraft/designer/useChangeLedger';
import {DEFAULT_FEATURE_LABOUR,mergeFeatureLabour} from '../src/features/deckcraft/featureLabour';
import {legacyScenarios} from './deck-legacy-scenarios';
const quoteFeatures=mergeFeatureLabour(undefined,{
  scopes:{
    accent:{...DEFAULT_FEATURE_LABOUR.scopes.accent,mode:'quote'},
    medallion:{...DEFAULT_FEATURE_LABOUR.scopes.medallion,mode:'quote'},
    customInlay:{...DEFAULT_FEATURE_LABOUR.scopes.customInlay,mode:'quote'},
  },
});

/**
 * The price schedule (designer/priceLedgerModel.ts and PriceLedger.tsx) and "Your changes" (useChangeLedger.ts).
 * The schedule is the owner's honesty rule made visible: every figure is an engine number, under the engine's title and
 * in its order; the priced lines add up to the subtotal; HST and the total are the engine's; every selection still to be
 * quoted is listed once with a supplier or builder tag; and nothing unpriced ever reads $0. Each engine section title
 * belongs to exactly one design section, so a new title with no section fails here. On the legacy parity designs the
 * schedule shows the figures the old breakdown did.
 */
let checks=0;
const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const design=(patch:Partial<DeckData>={})=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
const HST=/^HST/;
const text=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,'\'').replace(/&quot;/g,'"').replace(/\s+/g,' ');
// "$0" standing alone (not $0.50, $0,… or $05).
const ZERO=/\$0(?![\d.,])/;

// 1. Every title the engine can give an estimate section (read from calculations.ts), HST aside, belongs to exactly one
// design section, and every title a section claims is one the engine can give.
{
  const engine=read('src/features/deckcraft/calculations.ts')+'\n'+read('src/features/deckcraft/underDeckPricing.ts')+'\n'+read('src/features/deckcraft/quoteResolutions.ts')+'\n'+read('src/features/deckcraft/pergolaPricing.ts');
  const titles=[...engine.matchAll(/title:\s*([^,\n]+?),/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'|`([^`$]*)\$\{/g)].map(t=>t[1]??`${t[2]}*`));
  const owners=(t:string)=>t.endsWith('*')?SECTIONS.filter(s=>s.ledger.includes(t)):SECTIONS.filter(s=>ownsTitle(s,t));
  ok(titles.length>=18&&titles.includes('HST (13%)')&&titles.includes('Structural Framing (*')&&titles.includes('Yard · *'),`The engine's section titles are read (${titles.length})`);
  for(const t of titles)ok(owners(t).length===(HST.test(t)?0:1),`"${t}" belongs to ${HST.test(t)?'no section':'exactly one section'} (got ${owners(t).map(s=>s.name).join(', ')||'none'})`);
  for(const s of SECTIONS)for(const t of s.ledger)ok(titles.includes(t)||titles.some(x=>!x.endsWith('*')&&ownsTitle(s,x)&&(t.endsWith('*')?x.startsWith(t.slice(0,-1)):x===t)),`${s.name} claims "${t}", a title the engine gives`);
}

// 2. About forty designs covering every quote path.
const house=getHouseConfig(design({width:20}));
const unrated=DECKING_CATALOGUE.filter(m=>m.costPerSqft===null&&!m.isHidden);
const rated=(id:string)=>DECKING_CATALOGUE.find(m=>m.id===id)!;
const colour=(id:string,i=0)=>`${id}:${rated(id).colors[i].name}`;
const quotedDeck=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&m.isComposite&&m.colors.length>1)!;
const nullLight=LIGHTING_CATALOGUE.find(p=>p.id==='hyve_22'&&(p.cost===null||p.laborCost===null))!;
ok(nullLight&&unrated.length>=3,'The catalogues have unpriced lighting and decking to test with');
const patio={id:'patio-1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:20,depthFt:16,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'};
const wall={id:'wall-1',kind:'retaining-wall' as const,name:'Retaining wall',enabled:true,xFt:10,zFt:42,widthFt:16,depthFt:1,heightIn:24,rotationDeg:0,productId:'segmental-concrete',color:'#aaaaaa'};
const pond={id:'pond-1',kind:'water-feature' as const,name:'Pond',enabled:true,xFt:28,zFt:34,widthFt:6,depthFt:6,heightIn:24,rotationDeg:0,productId:'pond',color:'#657478'};
const odd={...patio,id:'patio-2',zFt:52,productId:'not-a-paver'};
const screen:PrivacyScreen={id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:false};
const hideaway:PrivacyScreen={id:'s2',side:'Right',lengthFt:8,heightFt:6,offsetPct:50,lights:false,product:'hideaway',design:'Hexx',finish:'Black',panels:2};
const designs:[string,Partial<DeckData>][]=[
  ['the default deck',{}],
  ['a large L-shape on two levels',{width:24,length:16,shape:'L-Shape',levels:2}],
  ['no stairs and no railing',{stairFlights:0,railingType:'None'}],
  ['glass railing, two flights',{railingType:'Glass Panels',stairFlights:2}],
  ['an add-on deck with hidden fasteners',{deckType:'Add-on',fasteningSystem:'Hidden'}],
  ['a floating deck',{deckType:'Floating',height:12}],
  ['helical piles',{foundation:'Helical Piles',foundationDepthIn:84}],
  ...unrated.slice(0,3).map((m):[string,Partial<DeckData>]=>[`${m.name} decking (no rate)`,{deckingMaterial:m.id,deckingColor:m.colors[0].name}]),
  [`${unrated[0].name} decking with a bench, a pergola and a slatted screen`,{deckingMaterial:unrated[0].id,deckingColor:unrated[0].colors[0].name,benchLf:8,pergolaSqft:64,privacySqft:48}],
  ...RAILING_CATALOGUE.filter((_r,i)=>i%4===0).map((r):[string,Partial<DeckData>]=>[`${r.name} railing`,{catalogueRailingId:r.id,railingType:r.baseType}]),
  ['every manufacturer accessory',{catalogueAccessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported).map(a=>a.id)}],
  ['hidden clips from a manufacturer on an add-on deck with flashing tape',{deckType:'Add-on',catalogueAccessories:['tt_concealoc','tt_protac_flashing']}],
  ['a Dark Slate border',{pictureFrameRows:1,borderFinish:'Dark Slate'}],
  ['accent boards',{width:20,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:'tt_prime_plus:Dark Cocoa'}]}],
  ['accent boards as builder quote',{width:20,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:'tt_prime_plus:Dark Cocoa'}],featureLabour:quoteFeatures}],
  // A deck in a collection without a rate takes its own colours as accents: a supplier quote too.
  ['accent boards from a collection without a rate',{width:20,deckingMaterial:quotedDeck.id,deckingColor:quotedDeck.colors[0].name,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:colour(quotedDeck.id,1)}]}],
  ['a framed rug and a diamond',{width:20,length:16,inlays:[{id:'a',kind:'rug',widthFt:6,depthFt:4,dxFt:-4},{id:'d',kind:'diamond',widthFt:4,depthFt:4,dxFt:5}]}],
  ['a band and a compass medallion',{width:20,length:16,inlays:[{id:'b',kind:'band',direction:'across',boards:2},{id:'m',kind:'medallion',diameterFt:5,style:'compass'}]}],
  ['medallion labour as builder quote',{width:20,length:16,inlays:[{id:'m',kind:'medallion',diameterFt:5,style:'compass'}],featureLabour:quoteFeatures}],
  ['a porch wrap',{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10}}}],
  ['a wrap round both corners',{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},right:{widthFt:6,runFt:6}}}],
  ['priced lighting',{lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hub100',qty:1}]}}],
  ['lighting with an unpriced fixture',{lightingSystem:{wireDistance:20,selectedItems:[{productId:nullLight.id,qty:4,zone:'deck'},{productId:'hub100',qty:1}]}}],
  ['post and step lights',{autoLighting:{posts:true,stairs:true},lightingSystem:{wireDistance:20,selectedItems:[{productId:'puck',qty:10,zone:'posts',auto:true},{productId:'evo_hyde',qty:4,zone:'stairs',auto:true},{productId:'hub100',qty:1,auto:true}]}}],
  ['a slatted screen and a manufacturer screen',{privacySqft:48,privacyScreens:[screen,hideaway]}],
  ['every extra',{benchLf:8,privacySqft:48,pergolaSqft:64,hasDrainage:true,hasDemo:true}],
  ['under-deck supply and installation',{height:108,underDeck:{drainage:'rainescape',ceiling:'pvc',scope:'main',gravel:true,gravelDepthIn:3,floorMesh:true}}],
  ['integrated under-deck ceiling',{height:108,underDeck:{drainage:'dryspace',ceiling:'none',scope:'all',gravel:false,gravelDepthIn:3,floorMesh:false}}],
  ['lattice skirting',{height:48,skirting:{style:'Lattice',clearanceIn:2,accessPanels:1}}],
  ['board skirting',{height:30,skirting:{style:'Horizontal boards',clearanceIn:2}}],
  ['a border in its own colour',{pictureFrameRows:1,deckFinishes:{border:'tt_legacy:Espresso'}}],
  ['a border from a collection without a rate',{pictureFrameRows:1,deckFinishes:{border:colour('tt_premier_plus')}}],
  ['fascia boards',{deckFinishes:{fascia:'tt_harvest:Kona'}}],
  ['priced fascia boards',{deckFinishes:{fascia:'tt_prime_plus:Dark Cocoa'}}],
  ['stair treads from a line without a rate',{deckFinishes:{treads:'tt_terrain_plus:Dark Oak'}}],
  ['a railing colour',{catalogueRailingId:'tt_classic_composite',railingType:'TT Classic',deckFinishes:{railingColor:'Matte Black'}}],
  ['Terrain decking on a freestanding deck (stair veneer connections)',{deckType:'Freestanding',deckingMaterial:'tt_terrain',deckingColor:rated('tt_terrain').colors[0].name,height:48}],
  ['a patio, a wall and a pond',{yardFeatures:[patio,wall,pond]}],
  ['a patio of an unknown paver',{yardFeatures:[odd]}],
  ['backyard allowances alone',{yardAllowances:{finish:'mid',firePit:'wood',kitchen:'basic',turfSqft:500,lighting:true}}],
  ['a backyard with allowances',{yardFeatures:[patio],yardAllowances:{finish:'premium',firePit:'gas',kitchen:'none',turfSqft:0,lighting:true}}],
  ['everything at once',{width:20,length:16,catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType,pictureFrameRows:1,deckFinishes:{treads:'tt_terrain_plus:Dark Oak',fascia:'tt_prime_plus:Dark Cocoa'},inlays:[{id:'m',kind:'medallion',diameterFt:5,style:'round'}],skirting:{style:'Lattice',clearanceIn:2},yardFeatures:[pond],privacyScreens:[hideaway]}],
];

/** A null yard allowance, worded as the engine words one (yardTakeoff.ts) when the estimator adds nothing for it. */
const NULL_ALLOWANCE_NOTE='The estimator has no allowance for this here; builder quote required.';
ok(read('src/features/deckcraft/yardTakeoff.ts').includes(`'${NULL_ALLOWANCE_NOTE}'`),'The engine still words a null allowance as a builder quote');
function withNullAllowance(e:DeckEstimate):DeckEstimate{
  const x=structuredClone(e),s=x.sections.find(t=>t.title.startsWith('Yard · ')&&t.title.includes('(estimator allowance)'))!;
  const lost=s.total;s.total=0;s.quoteRequired=true;s.description=NULL_ALLOWANCE_NOTE;s.items=s.items.map(i=>({...i,cost:null,spec:NULL_ALLOWANCE_NOTE}));
  x.quoteRequired=[...x.quoteRequired,s.items[0].name];x.subtotal-=lost;x.hst=x.subtotal*.13;x.total=x.subtotal+x.hst;
  const hst=x.sections.find(t=>HST.test(t.title))!;hst.total=x.hst;hst.items[0].cost=x.hst;
  return x;
}

const estimates:[string,DeckEstimate][]=designs.map(([label,patch])=>[label,calculateDeckReleaseEstimate(design(patch))]);
estimates.push(['a null yard allowance (as the engine words one)',withNullAllowance(estimates.find(([l])=>l==='backyard allowances alone')![1])]);
ok(estimates.length>=40,`About forty designs (${estimates.length})`);

const kinds=new Map<string,QuoteKind>();
const render=(ledger:Ledger,variant:'column'|'full')=>renderToStaticMarkup(createElement(PriceLedger,{ledger,variant,...(variant==='column'?{changes:[],onFullList:()=>{}}:{})}));
for(const [label,e] of estimates){
  const L=priceLedger(e),engineLines=e.sections.filter(s=>!HST.test(s.title)),hst=e.sections.find(s=>HST.test(s.title))!;
  // The figures are the engine's.
  const sum=L.lines.reduce((n,l)=>n+l.amount,0);
  ok(Math.abs(sum-e.subtotal)<.005&&L.subtotal===e.subtotal,`${label}: the priced lines add up to the subtotal (${sum.toFixed(2)} / ${e.subtotal.toFixed(2)})`);
  ok(L.hst===e.hst&&hst.total===e.hst&&L.hstTitle===hst.title,`${label}: HST is the engine's ${hst.title}`);
  ok(L.total===e.total&&Math.abs(sum+L.hst-L.total)<.01,`${label}: the total is the engine's, lines plus HST`);
  // In the engine's order and titles; only a section with nothing in it is left out.
  const kept=engineLines.filter(s=>L.lines.some(l=>l.title===s.title));
  ok(L.lines.map(l=>l.title).join('|')===kept.map(s=>s.title).join('|'),`${label}: the lines keep the engine's titles and order`);
  ok(engineLines.filter(s=>!kept.includes(s)).every(s=>s.total<.005&&s.items.every(i=>!(Number(i.qty)>0))),`${label}: only sections with nothing in them are left out`);
  for(const line of L.lines){
    const owners=SECTIONS.filter(s=>ownsTitle(s,line.title));
    ok(owners.length===1&&line.section===owners[0].id,`${label}: "${line.title}" belongs to one design section (${owners.map(s=>s.name).join(', ')||'none'})`);
    const source=engineLines.find(s=>s.title===line.title)!,unpriced=source.items.filter(i=>i.cost===null&&Number(i.qty)>0);
    ok(line.amount===source.total,`${label}: "${line.title}" is the engine's amount`);
    ok((line.quotes.length>0)===(!!source.quoteRequired||unpriced.length>0),`${label}: "${line.title}" is tagged exactly when part of it is a quote`);
    ok(!ZERO.test(line.text)&&(line.quotes.length&&line.amount<.005?/quote/.test(line.text)&&!line.text.includes('$'):true),`${label}: "${line.title}" never reads $0 (${line.text})`);
    ok(line.items.filter(i=>i.quote).length===unpriced.length&&line.items.every(i=>!i.quote||unpriced.some(u=>u.name===i.name)),`${label}: every unpriced item in "${line.title}" carries a tag`);
    for(const item of unpriced)kinds.set(`item:${item.name}`,isBuilderQuote(item)?'builder':'supplier');
  }
  // Every selection still to be quoted, once, tagged.
  const wanted=[...new Set(e.quoteRequired)];
  ok(L.quotes.length===wanted.length&&L.quotes.every((q,i)=>q.label===wanted[i]),`${label}: every quote is listed once (${L.quotes.length} of ${wanted.length})`);
  ok(L.totalLabel===(wanted.length?'Priced portion including HST':'Including HST'),`${label}: the total says whether anything is still to be quoted`);
  for(const q of L.quotes)kinds.set(q.label,q.kind);
  // What the page renders: the column and the full list.
  for(const variant of ['column','full'] as const){
    const html=render(L,variant),words=text(html);
    ok(!ZERO.test(words),`${label} (${variant}): nothing reads $0`);
    const list=/<ul aria-labelledby="[^"]+q">([\s\S]*?)<\/ul>/.exec(html)?.[1]??'',items=list.split('<li>').slice(1);
    ok(items.length===wanted.length&&items.every(li=>/^<span class="dd-tag" data-kind="(supplier|builder)">(Supplier|Builder) quote<\/span>/.test(li)),`${label} (${variant}): the quote list has one tagged line per quote`);
    for(const q of L.quotes)ok(items.filter(li=>text(li).trim().endsWith(quoteLabel(q.label))).length>=1,`${label} (${variant}): "${q.label}" is in the quote list`);
    ok(words.includes(`Priced subtotal ${dollars(e.subtotal)}`)&&words.includes(`${hst.title} ${dollars(e.hst)}`)&&words.includes(`${L.totalLabel} ${dollars(e.total)}`),`${label} (${variant}): subtotal, HST and total are shown`);
    ok(html.includes(priceBookLabel())&&html.includes('planning estimate, not a quote'),`${label} (${variant}): the price-book stamp and the footnote`);
    const split=splitSubtotal(e);
    ok(split.backyard?words.includes(`Deck subtotal ${dollars(split.deck)}`)&&words.includes(`Backyard subtotal ${dollars(split.backyard)}`):!words.includes('Deck subtotal'),`${label} (${variant}): deck and backyard subtotals only with a backyard`);
    ok(/role="status" aria-live="off" aria-labelledby="[^"]+">\$[\d,]+</.test(html),`${label} (${variant}): the priced subtotal is a status that does not announce itself`);
  }
  // The section rows' price effects come from the schedule: they add up, and never read $0.
  const rows=SECTIONS.reduce((n,s)=>n+L.lines.filter(l=>l.section===s.id).reduce((m,l)=>m+l.amount,0),0);
  ok(Math.abs(rows-e.subtotal)<.005,`${label}: the section rows add up to the priced subtotal`);
  for(const s of SECTIONS){
    const effect=sectionPriceEffect(s,L),quoted=L.lines.some(l=>l.section===s.id&&l.quotes.length);
    ok(!effect||!ZERO.test(effect.text),`${label}: ${s.name} never shows $0 (${effect?.text})`);
    if(quoted)ok(effect&&(effect.kind==='quote'||effect.text.endsWith(' + quote')),`${label}: ${s.name} says part of it is a quote (${effect?.text})`);
  }
}
{
  const plain=priceLedger(calculateDeckReleaseEstimate(design()));
  ok(sectionPriceEffect(SECTION_BY_ID.house,plain)?.text==='Looks never priced; size can move the ledger'&&sectionPriceEffect(SECTION_BY_ID.proposal,plain)===null,'The House row says looks are never priced; the proposal has no price of its own');
  ok(plain.stamp===`${priceBookLabel()} · CAD · before HST`,'The stamp names the price book, the currency and that HST is extra');
}

// 3. Every quote path is covered.
const all=estimates.map(([,e])=>e),has=(title:string,test:(s:DeckEstimate['sections'][number])=>boolean)=>all.some(e=>e.sections.some(s=>s.title.startsWith(title)&&test(s)));
const paths:[string,boolean][]=[
  ['catalogue decking',has('Decking',s=>!!s.quoteRequired&&s.total===0)],
  ['catalogue railing',has('Railing System',s=>!!s.quoteRequired&&s.total===0)],
  ['manufacturer accessories',has('Manufacturer deck accessories',s=>!!s.quoteRequired)],
  ['manufacturer hidden clips',has('Hardware & Fasteners',s=>!!s.quoteRequired&&s.total>0)],
  ['a flashing line nulled by an accessory',has('Add-ons & Extras',s=>s.items.some(i=>i.name==='Ledger Flashing'&&i.cost===null))],
  ['Dark Slate border',has('Picture-frame border finish',s=>!!s.quoteRequired)],
  ['accent boards (builder labour)',all.some(e=>e.quoteRequired.includes('Accent-colour board labour (builder quote)'))],
  ['accent boards (priced man-hours)',all.some(e=>e.sections.some(s=>s.title.startsWith('Labour')&&s.items.some(i=>i.name==='Accent-colour board labour'&&i.cost!==null&&Number(i.cost)>0)))],
  ['accent boards without a rate',has('Accent-colour boards',s=>s.items.some(i=>i.cost===null))],
  ['inlays',has('Accent colours & inlays',()=>true)],
  ['medallion labour (builder quote mode)',all.some(e=>e.quoteRequired.includes('Medallion inlay labour (builder quote)'))],
  ['medallion labour (priced man-hours)',all.some(e=>e.sections.some(s=>s.title.startsWith('Labour')&&s.items.some(i=>i.name==='Medallion inlay labour'&&i.cost!==null&&Number(i.cost)>0)))],
  ['porch wrap priced in labour',all.some(e=>e.sections.some(s=>s.title.startsWith('Labour')&&s.total>0)&&!e.quoteRequired.some(q=>/Porch-wrap/.test(q)))],
  ['lighting quote',has('in-lite',s=>!!s.quoteRequired)],
  ['priced lighting',has('in-lite',s=>!s.quoteRequired&&s.total>0)],
  ['manufacturer privacy screen',has('Add-ons & Extras',s=>s.items.some(i=>i.name==='Manufacturer privacy screen'))],
  ['extras with a finish to quote',all.some(e=>e.quoteRequired.includes('Built-in Bench with selected finish'))],
  ['F7 skirting',has('Deck skirting',s=>!s.quoteRequired&&s.total>0&&s.items.every(i=>i.cost!==null&&Number(i.cost)>0))],
  ['under-deck known supplies and installation with pending site details',has('Under-deck options',s=>s.total>0&&!!s.quoteRequired&&s.items.some(i=>i.name==='Under-deck installation planning allowance'&&Number(i.cost)>0))],
  ['legacy drainage replaced without duplicate charge',all.some(e=>e.sections.some(s=>s.title==='Under-deck options'))&&!all.some(e=>e.sections.flatMap(s=>s.items).some(i=>i.name==='Drainage System'))],
  ['F6 border boards',has('Deck-part finishes',s=>s.items.some(i=>i.cost!==null))],
  ['F6 border without a rate',has('Deck-part finishes',s=>s.items.some(i=>i.cost===null&&!i.name.startsWith('Fascia')))],
  ['F6 fascia',all.some(e=>e.quoteRequired.includes('Fascia boards (supplier quote)'))],
  ['F6 quote-only treads',all.some(e=>e.quoteRequired.some(q=>q.startsWith('Stair treads and risers in')))],
  ['terrain stair connections',has('Terrain stair support connections',()=>true)],
  ['connector quotes',all.some(e=>e.quoteRequired.includes('Support post timber')||e.quoteRequired.includes('Splice fasteners'))],
  ['priced yard',has('Yard · ',s=>s.total>0)],
  ['unpriced yard lines',has('Yard · ',s=>!!s.quoteRequired)],
  ['yard allowances',has('Yard · ',s=>s.title.includes('(estimator allowance)')&&s.total>0)],
  ['a null yard allowance',has('Yard · ',s=>s.title.includes('(estimator allowance)')&&!!s.quoteRequired)],
];
for(const [path,covered] of paths)ok(covered,`The designs cover ${path}`);

// 4. Builder or supplier, as the engine words it.
const expect=(label:string,kind:QuoteKind)=>ok(kinds.get(label)===kind,`"${label.replace(/^item:/,'')}" is a ${kind} quote (got ${kinds.get(label)??'none'})`);
for(const label of ['Accent-colour board labour (builder quote)','Medallion inlay labour (builder quote)','Fire pit, wood-burning (estimator allowance)'])expect(label,'builder');
for(const label of ['Support post timber','Deckorators Dark Slate picture-frame boards','Fascia boards (supplier quote)','Stair treads and risers in TimberTech Composite Terrain+','Built-in Bench with selected finish',unrated[0].name,RAILING_CATALOGUE[0].name,`${nullLight.name} supply and installation`])expect(label,'supplier');
for(const item of ['Accent-colour board labour','Medallion inlay labour'])expect(`item:${item}`,'builder');
for(const item of ['Manufacturer privacy screen','Deckorators Dark Slate'])expect(`item:${item}`,'supplier');
ok([...kinds.keys()].every(k=>!/Porch-wrap|Deck skirting|Skirting /.test(k)),'Porch wrap and skirting are priced, not quote tags');
for(const [label,kind] of kinds)if(!label.startsWith('item:')){
  if(/\(builder quote\)/.test(label))ok(kind==='builder',`"${label}" says builder quote and is one`);
  if(/\(supplier quote\)/.test(label))ok(kind==='supplier',`"${label}" says supplier quote and is one`);
}
ok(quoteLabel('Deck skirting (builder quote)')==='Deck skirting'&&quoteLabel('Fascia boards (supplier quote)')==='Fascia boards'&&quoteLabel('Support post timber')==='Support post timber','A listed quote drops the words its tag already says');

// 5. On the legacy parity designs the schedule shows the old breakdown's figures (EstimateStep's .dd-breakdown, R1).
{
  let compared=0;
  for(const [name,patch] of Object.entries(legacyScenarios())){
    const e=calculateDeckReleaseEstimate(design(patch)),L=priceLedger(e),old=e.sections.filter(s=>!HST.test(s.title));
    ok(L.lines.map(l=>l.title).join('|')===old.map(s=>s.title).join('|'),`${name}: the same lines as the old breakdown`);
    for(const s of old){
      const line=L.lines.find(l=>l.title===s.title)!,was=s.quoteRequired&&s.total===0?'Supplier quote required':dollars(s.total);
      ok(was==='Supplier quote required'?line.quotes.length>0&&line.amount===0&&!line.text.includes('$'):line.text===was||line.text===`${was} + quote`,`${name}: "${s.title}" shows the old figure (${was} / ${line.text})`);
      if(s.quoteRequired&&s.total>0)ok(line.text===`${was} + quote`,`${name}: "${s.title}" still says part of it is a quote`);
    }
    const split=splitSubtotal(e);
    ok(split.backyard?L.split?.deck===split.deck&&L.split.backyard===split.backyard:L.split===null,`${name}: the same deck and backyard subtotals`);
    ok(dollars(L.hst)===dollars(e.sections.find(s=>HST.test(s.title))!.total)&&L.totalLabel===(e.quoteRequired.length?'Priced portion including HST':'Including HST')&&dollars(L.total)===dollars(e.total),`${name}: the same HST, total label and total`);
    compared++;
  }
  ok(compared===213,`All 213 legacy parity designs compared (${compared})`);
}

// 6. Your changes: the pure reducer behind useChangeLedger.
{
  const P=(subtotal:number,...quotes:[string,QuoteKind][]):PriceState=>({subtotal,quotes:quotes.map(([label,kind])=>({label,kind}))});
  const run=(actions:ChangeAction[],from:ChangeLedgerState=EMPTY_CHANGES)=>actions.reduce(changeLedger,from);
  const edit=(key:string,now:number,label='Deck width',value?:string):ChangeAction=>({type:'edit',key,label,value,now});
  const price=(p:PriceState):ChangeAction=>({type:'price',price:p});
  ok(signedDollars(1240)==='+$1,240'&&signedDollars(-380)==='−$380','Deltas read "+$1,240" and "−$380" (a true minus sign)');
  // The subtotal at the moment of an edit, then every estimate after it (the lighting sync) counts toward that edit.
  let s=run([price(P(30000)),edit('width',1000,'Deck width','20 ft'),price(P(31240)),price(P(31300))]);
  ok(s.records.length===1&&s.records[0].before.subtotal===30000&&s.records[0].after.subtotal===31300,'An edit keeps the subtotal before it; later estimates (the lighting sync) update it');
  ok(describeChange(s.records[0]).effect==='+$1,300'&&describeChange(s.records[0]).label==='Deck width → 20 ft','The record reads "+$1,300 · Deck width → 20 ft"');
  ok(s.records.length===1&&run([price(P(0))]).records.length===0,'Estimates alone make no record');
  // Grouping: the same fields within GROUP_MS are one gesture; other fields, or a pause, are another.
  s=run([price(P(30000)),edit('width',1000),price(P(30100)),edit('width',1000+GROUP_MS-1,'Deck width','22 ft'),price(P(30400))]);
  ok(s.records.length===1&&s.records[0].before.subtotal===30000&&s.records[0].after.subtotal===30400&&s.records[0].value==='22 ft','Edits to the same fields within 500 ms join one record');
  ok(run([price(P(30000)),edit('width',1000),edit('width',1000+GROUP_MS)]).records.length===2,'The same fields after 500 ms are a new record');
  ok(run([price(P(30000)),edit('width',1000),edit('length',1100)]).records.length===2,'Different fields are separate records');
  ok(run([price(P(30000)),edit('width',1000),{type:'undo',now:1100},edit('width',1200)]).records.map(r=>r.kind).join()==='edit,undo,edit','Undo is a record of its own and ends a gesture');
  s=run([price(P(30000)),edit('width',1000),price(P(31000)),{type:'undo',now:2000},price(P(30000)),{type:'redo',now:3000},price(P(31000))]);
  ok(s.records.map(r=>`${r.label} ${describeChange(r).effect}`).join('|')==='Deck width +$1,000|Undo −$1,000|Redo +$1,000','Undo and redo show what they did to the price');
  // A new design clears the list; the next edit starts from the new design's price.
  s=run([price(P(30000)),edit('width',1000),price(P(31000)),{type:'loaded',now:2000},price(P(45000)),edit('length',3000),price(P(45000))]);
  ok(s.records.length===2&&s.records[0].label==='New design loaded'&&describeChange(s.records[0]).effect===''&&s.records[1].before.subtotal===45000&&describeChange(s.records[1]).effect==='No price change','A new design clears the list with "New design loaded"');
  // Quote flips.
  const flip=(before:PriceState,after:PriceState)=>describeChange(run([price(before),edit('catalogueRailingId',1,'Manufacturer railing','TimberTech Impression Rail Express'),price(after)]).records[0]);
  let d=flip(P(30000),P(20160,['TimberTech Impression Rail Express','supplier']));
  ok(d.effect==='Now a supplier quote'&&d.note==='priced total −$9,840'&&d.kind==='quote','A choice that turns a section into a quote reads "Now a supplier quote" (priced total −$9,840)');
  d=flip(P(30000),P(30000,['Deck skirting (builder quote)','builder']));
  ok(d.effect==='Now a builder quote'&&d.note==='','A builder quote with no priced change reads "Now a builder quote"');
  ok(flip(P(1),P(1,['a','supplier'],['b','builder'])).effect==='Now supplier and builder quotes','Both kinds at once say so');
  d=flip(P(20160,['TimberTech Impression Rail Express','supplier']),P(30000));
  ok(d.effect==='+$9,840'&&d.note==='1 fewer to quote','Going back to a priced choice shows the delta and one fewer selection to quote');
  ok(flip(P(30000),P(30000.4)).effect==='No price change','Under 50 cents is no price change');
  ok(announceChange(run([price(P(30000)),edit('railingType',1,'Railing style','Glass Panels'),price(P(31240))]).records[0])==='Railing style: Glass Panels. +$1,240. Priced subtotal $31,240.','One sentence announces a change');
  // The list keeps the most recent changes.
  s=run([price(P(1)),...Array.from({length:MAX_CHANGES+5},(_,i)=>edit(`f${i}`,i*1000))]);
  ok(s.records.length===MAX_CHANGES&&s.records.at(-1)!.key===`f${MAX_CHANGES+4}`,`At most ${MAX_CHANGES} changes, the newest kept`);
  // What an edit is called.
  const base=design() as unknown as Record<string,unknown>;
  ok(describeEdit({width:base.width},base)===null&&describeEdit({customerName:'Jane'},base)===null,'An edit that changes nothing, or only your own details, is not listed');
  ok(JSON.stringify(describeEdit({width:20},base))===JSON.stringify({key:'width',label:'Deck width',value:'20 ft'}),'A size edit names the field and its value in feet');
  ok(describeEdit({deckingMaterial:unrated[0].id,deckingColor:unrated[0].colors[0].name},base)?.label==='Collection'&&describeEdit({deckingMaterial:unrated[0].id,deckingColor:unrated[0].colors[0].name},base)?.value===unrated[0].name,'A collection edit reads "Collection → <collection name>"');
  const railing=describeEdit({deckFinishes:{...(base.deckFinishes as object),railingColor:'Matte Black'}},base);
  ok(railing?.label==='Railing colour'&&railing.value==='Matte Black'&&railing.key==='deckFinishes.railingColor','A railing colour is named on its own, not as a deck-part finish');
  ok(describeEdit({someNewField:1} as Record<string,unknown>,base)?.label==='Design change','A field with no name reads "Design change"');
  ok(changeValue('catalogueRailingId',undefined)==='None'&&changeValue('hasDemo',true)==='Yes'&&changeValue('houseConfig',{})===undefined,'Values read plainly; objects are not spelled out');
  // With the engine: a priced upgrade, a downgrade and a flip to a supplier quote.
  const effect=(from:Partial<DeckData>,to:Partial<DeckData>)=>describeChange(run([price(priceState(priceLedger(calculateDeckReleaseEstimate(design(from))))),edit('x',1),price(priceState(priceLedger(calculateDeckReleaseEstimate(design(to)))))]).records[0]);
  ok(/^\+\$[\d,]+$/.test(effect({},{railingType:'Glass Panels'}).effect),'Glass railing is a "+$" change');
  ok(/^−\$[\d,]+$/.test(effect({},{stairFlights:0}).effect),'Removing the stairs is a "−$" change');
  d=effect({},{catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType});
  ok(d.effect==='Now a supplier quote'&&/^priced total −\$[\d,]+$/.test(d.note),`A manufacturer railing reads "Now a supplier quote" (${d.note})`);
}

// 7. The page: the schedule replaces the big total, the finish row and the quote notice; every edit, undo, redo and new
// design is noted for Your changes; the price bar opens the drawer.
{
  const page=read('src/pages/DeckDesigner.tsx'),preview=read('src/features/deckcraft/designer/PreviewPanel.tsx'),estimate=read('src/features/deckcraft/designer/steps/EstimateStep.tsx'),bar=read('src/features/deckcraft/designer/WorkspacePrice.tsx'),list=read('src/features/deckcraft/designer/SectionList.tsx'),css=read('src/features/deckcraft/designer/workspace.css');
  ok(!/dd-live-price|dd-quote-notice|dd-finish/.test(preview),'The preview no longer carries its own total, finish row or quote notice');
  ok(estimate.includes('<PriceLedger ledger={ledger} variant="full"/>')&&!estimate.includes('dd-breakdown'),'Proposal & files shows the full price list in place of the old breakdown');
  ok(page.includes('const schedule=useMemo(()=>priceLedger(estimate),[estimate]);')&&page.includes('WorkspacePrice')&&page.includes('onQuoteReview={()=>setQuoteReviewOpen(true)}')&&page.includes('ledger={schedule}')&&page.includes('<SectionList data={data} ledger={schedule} '),'The page builds one schedule for the persistent price bar, the inspector and the full list');
  ok(/changes\.edit\(patch,data\);\s*applyUpdate\(patch\);/.test(page),'Every edit is noted before it is applied');
  ok(page.includes('const replace=(next:DeckData)=>{changes.loaded();replaceDesign(next);};')&&/onReplaced:\(\)=>\{closeSections\(\);changes\.loaded\(\);(?:clearJobContext\(\);)?\}/.test(page),'Import, start over, links and going back to your own design clear the list');
  ok(page.includes('const undo=()=>{if(canUndo)changes.undo();undoDesign();},redo=()=>{if(canRedo)changes.redo();redoDesign();};'),'Undo and redo are noted');
  ok(page.includes('useEffect(()=>{notePrice(priceState(schedule));},[schedule,notePrice]);')&&page.includes('<ChangeAnnouncer record={changes.records.at(-1)}/>'),'Every estimate reaches the list, and the newest change is announced');
  ok(list.includes('sectionPriceEffect(section,ledger)'),'The section rows take their price effect from the schedule');
  const drawer=read('src/features/deckcraft/designer/PriceLedger.tsx');
  ok(drawer.includes('onKeyDown={trap}')&&drawer.includes('close.current?.focus();')&&drawer.includes('return ()=>{opener.current?.focus();};')&&/if\(e\.key==='Escape'\)\{e\.preventDefault\(\);onClose\(\);return;\}/.test(drawer)&&drawer.includes('last.focus()')&&drawer.includes('first.focus()'),'The drawer traps focus itself: in on opening, Tab looping, Escape closing, back to the price bar');
  ok(bar.includes('aria-haspopup="dialog"')&&bar.includes('<LedgerDrawer ')&&bar.includes('ledger.quotes.length'),'The price bar shows the quote count and opens the schedule drawer');
  ok(css.includes('.dd-workspace-price')&&bar.includes('aria-label="Priced subtotal"')&&bar.includes('aria-label="Still to be quoted: not in the planning total"')&&bar.includes('These costs are not included in the priced total.')&&bar.includes('<LedgerDrawer ledger={ledger} changes={changes}'),'The persistent price bar shows the priced portion, keeps outstanding quotes visible, and opens the same complete ledger on every screen');
}

console.log(`DECK LEDGER OK — ${estimates.length} designs and 213 legacy designs: engine figures in engine order, lines add up, one HST and total, every quote listed once and tagged, nothing unpriced at $0, every title owned by one section; Your changes grouped, reset and worded; ${checks} checks.`);
