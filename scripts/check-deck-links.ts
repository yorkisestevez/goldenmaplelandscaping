import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {DOOR_STYLES} from '../src/features/deckcraft/houseSettings';
import {GARAGE_DOOR_STYLES,WINDOW_STYLES} from '../src/features/deckcraft/houseOpenings';
import {DesignLinkError,MAX_DESIGN_LINK_CHARS,decodeDesignLink,designLinkFromHash,designLinkJson,designToKeep,encodeDesignLink,transformBytes,withoutPersonalDetails} from '../src/features/deckcraft/designLink';
import type {DeckData,HouseOpening} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Share links: a design survives the trip through a link exactly, never carries the customer's
 * name or address, and a damaged, hostile or future link is turned away politely.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const ORIGIN='https://example.test';
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const design=(patch:Partial<DeckData>):DeckData=>deckReleaseData({...base(),...patch});
const house=getHouseConfig({...base(),width:20});
const b64=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const deflate=async(text:string|Uint8Array)=>transformBytes(typeof text==='string'?new TextEncoder().encode(text):text,new CompressionStream('deflate'));
const valueOf=(link:string)=>designLinkFromHash(new URL(link).hash)!;
async function rejects(value:string,why:string,match?:RegExp){
  await assert.rejects(decodeDesignLink(value),(error:unknown)=>error instanceof DesignLinkError&&(!match||match.test((error as Error).message)),why);checks++;
}

// Every kind of design the studio can make.
const openings:HouseOpening[]=[
  ...DOOR_STYLES.map((style,i):HouseOpening=>({id:`door${i}`,type:'Door',facade:'Front',offsetPct:15+i*30,bottomIn:30,widthIn:36,heightIn:80,style})),
  ...WINDOW_STYLES.map((style,i):HouseOpening=>({id:`win${i}`,type:'Window',facade:(['Left','Right','Back'] as const)[i%3],offsetPct:20+i*12,bottomIn:48,widthIn:36,heightIn:48,style})),
  ...GARAGE_DOOR_STYLES.slice(0,1).map((style):HouseOpening=>({id:'gar0',type:'Garage',facade:'Back',offsetPct:70,bottomIn:0,widthIn:108,heightIn:84,style})),
];
const scenarios:Record<string,DeckData>={};
for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)
  for(const pattern of ['Straight','Diagonal','Picture Frame','Herringbone'] as const)
    for(const deckType of ['Attached','Freestanding'] as const)
      scenarios[`${shape}/${pattern}/${deckType}`]=design({shape,pattern,deckType,width:24,length:20,height:48,cutoutWidth:8,cutoutLength:6,cutoutWidth2:4,cutoutLength2:4});
Object.assign(scenarios,{
  'stairs/landing-2-flights':design({stairType:'Landing',stairFlights:2,height:90,stairPosition:'Left'}),
  'backyard/allowances':design({yardAllowances:{finish:'premium',firePit:'gas',kitchen:'full',turfSqft:750,lighting:true}}),
  'stairs/winder':design({stairType:'Winder',stairTurn:'Left',height:60}),
  'levels/split':design({levels:2,level2Position:'Front',height2:29,width2:16,length2:8,level2FullStep:true}),
  'levels/three':design({levels:3,height2:30,width2:14,length2:10,level3:{widthFt:10,lengthFt:8,heightIn:12,parent:2,position:'Front',offsetPct:50}}),
  'wrap/left':design({width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:10}}}),
  'wrap/both+porches':design({width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},right:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10},porchRight:{depthFt:8,runFt:10}}}),
  'house/bump-out+garage+styles':design({width:30,length:16,houseConfig:{...house,widthFt:30,depthFt:24,storeys:2,roofShape:'Hip',roofPitch:8,ridge:'x',cladding:'Brick',openings,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:8,widthFt:10,depthFt:4},{id:'garage1',kind:'garage',wall:'Left',offsetFt:0,widthFt:20,depthFt:22}]}},housePlacement:{anchor:'center',offsetIn:24}}),
  'extras/lighting+screens':design({autoLighting:{posts:true,stairs:true,stairStyle:'evo_flex'},stairWidth:48,lightingSystem:{wireDistance:40,selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'ace',qty:2,zone:'landscape'},{productId:'hub100',qty:1}]},privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:true},{id:'s2',side:'Right',lengthFt:8,heightFt:6,offsetPct:50,lights:false,product:'hideaway',design:'Hexx',finish:'Black',panels:2}],lightingZoneEnabled:{house:false}}),
  'extras/catalogue':design({catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType,catalogueAccessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported&&a.kind!=='fastener').map(a=>a.id),pictureFrameRows:1,borderFinish:'Dark Slate',pictureFrameOverhangIn:0.5,hasInlay:true,inlayLf:12,benchLf:8,pergolaSqft:64,hasDemo:true,hasDrainage:true}),
  'site/all-options':design({municipality:'Toronto',siteType:'Hillside',soilCondition:'Clay',foundation:'Helical Piles',foundationDepthIn:84,buildSeason:'Winter',intendedLoad:'Heavy',framingSize:'2x12',joistSpacing:12,boardWidth:3.5,fasteningSystem:'Hidden',sceneLighting:'Evening',lightingPreviewOn:false,houseVisible:false}),
});

// 1. Every design comes back exactly, at the same price, and the same design always gives the same link.
let longest=0;
for(const [name,d] of Object.entries(scenarios)){
  const link=await encodeDesignLink(d,ORIGIN);
  ok(link.startsWith(`${ORIGIN}/deck-designer#d=1z`),`${name}: a compressed version-1 link to the designer`);
  const back=await decodeDesignLink(valueOf(link));
  assert.equal(serializeDeckReleaseDesign(back),serializeDeckReleaseDesign(withoutPersonalDetails(d)),`${name}: the design survives the link byte for byte`);checks++;
  assert.equal(calculateDeckReleaseEstimate(back).total,calculateDeckReleaseEstimate(d).total,`${name}: same price after the link`);checks++;
  assert.equal(await encodeDesignLink(d,ORIGIN),link,`${name}: the same design gives the same link`);checks++;
  longest=Math.max(longest,link.length);
}
ok(longest<3000,`The longest scenario link (${longest} characters) stays under 3,000`);

// 2. The customer's name, project address and scope of work never travel in a link.
{
  const d=design({customerName:'Jane Q Customer',projectAddress:'12 Example Crescent',scopeOfWork:'Private scope text'});
  const json=designLinkJson(d);
  ok(!json.includes('Jane Q Customer')&&!json.includes('12 Example Crescent')&&!json.includes('Private scope text'),'Personal details are left out of the link');
  ok(!/customerName|projectAddress|scopeOfWork/.test(json),'The personal fields are absent, not just blank');
  const back=await decodeDesignLink(valueOf(await encodeDesignLink(d,ORIGIN)));
  ok(back.customerName===''&&back.projectAddress===''&&back.scopeOfWork===DEFAULT_DECK.scopeOfWork,'A shared design opens without anyone’s details');
  // A hand-made link that does carry them still opens without them.
  const crafted='1z'+b64(await deflate(serializeDeckReleaseDesign(d)));
  const opened=await decodeDesignLink(crafted);
  ok(opened.customerName===''&&opened.projectAddress===''&&opened.scopeOfWork===DEFAULT_DECK.scopeOfWork,'Details slipped into a link are dropped on opening');
}

// 3. Without CompressionStream the link is plain JSON and still opens.
{
  const saved=globalThis.CompressionStream;
  (globalThis as {CompressionStream?:unknown}).CompressionStream=undefined;
  try{
    const d=scenarios['wrap/left'],link=await encodeDesignLink(d,ORIGIN);
    ok(link.includes('#d=1j'),'An uncompressed link is marked j');
    assert.equal(serializeDeckReleaseDesign(await decodeDesignLink(valueOf(link))),serializeDeckReleaseDesign(d));checks++;
  }finally{(globalThis as {CompressionStream?:unknown}).CompressionStream=saved;}
}

// 4. Damaged, hostile and future links are refused with a customer-facing message; nothing else is thrown.
{
  const good=valueOf(await encodeDesignLink(scenarios['Rectangle/Straight/Attached'],ORIGIN));
  await rejects('','An empty link');
  await rejects('2'+good.slice(1),'A link from a newer studio',/newer version/);
  // A valid design body behind an unknown encoding letter is still refused (only z and j exist).
  await rejects('1x'+b64(new TextEncoder().encode(designLinkJson(scenarios['Rectangle/Straight/Attached']))),'An unknown encoding',/damaged/);
  await rejects('1z'+good.slice(2,40)+'*'+good.slice(41),'A character outside base64url',/damaged/);
  await rejects('1z'+good.slice(2,2+4*20+1),'Base64 of an impossible length',/damaged/);
  await rejects(good.slice(0,good.length-12),'A truncated link',/damaged/);
  await rejects('1z'+b64(Uint8Array.from({length:64},(_,i)=>(i*37+11)&255)),'Random bytes',/damaged/);
  await rejects('1z'+b64(await deflate('not a design')),'Compressed text that is not JSON',/damaged/);
  await rejects('1z'+b64(await deflate(JSON.stringify({format:'something-else',version:1,configuration:{}}))),'The wrong file format',/damaged/);
  await rejects('1z'+b64(await deflate(JSON.stringify({format:'golden-maple-deck-design',version:1,configuration:{width:999}}))),'An out-of-range value is refused by validateDesign',/width/);
  await rejects('1j'+b64(Uint8Array.from([0xff,0xfe,0xfd])),'Bytes that are not UTF-8',/damaged/);
  await rejects('1j'+'A'.repeat(MAX_DESIGN_LINK_CHARS),'A link longer than the limit',/too long/);
  // A few kilobytes that inflate to megabytes stop at the design size limit instead of filling memory.
  const bomb=await deflate(new Uint8Array(20_000_000));
  ok(bomb.length<30_000,'The test bomb is small enough to fit in a link');
  await rejects('1z'+b64(bomb),'A decompression bomb');
  await assert.rejects(transformBytes(bomb,new DecompressionStream('deflate'),1000),(e:unknown)=>e instanceof DesignLinkError,'Inflating stops at the byte limit');checks++;
}

// 5. The hash reader only answers to the design parameter.
{
  ok(designLinkFromHash('#d=1zabc')==='1zabc','Reads #d=');
  ok(designLinkFromHash('d=1zabc')==='1zabc','Reads a hash without the #');
  ok(designLinkFromHash('#utm=1&d=1zabc')==='1zabc','Reads d among other hash parameters');
  ok(designLinkFromHash('#deck-live-preview')===null&&designLinkFromHash('')===null&&designLinkFromHash('#d=')===null,'Ignores page anchors, an empty hash and an empty value');
}

// 6. Opening a second link never overwrites the visitor's own design.
{
  ok(designToKeep(null,'own','shared')==='own','The first link keeps the visitor’s design');
  ok(designToKeep('own','shared-1','shared-2')===null,'A second link keeps the original, not the first shared design');
  ok(designToKeep(null,'same','same')===null,'Opening a link to the same design keeps nothing');
  ok(designToKeep(null,null,'shared')===null,'No working design, nothing to keep');
}

// 7. The page opens links only through decodeDesignLink and shares only through ShareDesignLink.
{
  const page=designerSource();
  const share=readFileSync(new URL('../src/features/deckcraft/ShareDesignLink.tsx',import.meta.url),'utf8');
  ok(/decodeDesignLink(File)?\(/.test(page)&&page.includes('designLinkFromHash(window.location.hash)'),'The page reads links through the link module');
  ok(page.includes('designToKeep(')&&page.includes('DESIGN_LINK_BACKUP_KEY'),'The page keeps the visitor’s design before opening a link');
  ok((page.match(/<ShareDesignLink /g)??[]).length===2,'Share controls in the design tools and on the estimate step');
  ok(share.includes('encodeDesignLink(data)')&&/name and project address are not included/.test(share),'The share control builds the link and says what it leaves out');
}

console.log(`DECK LINKS OK — ${Object.keys(scenarios).length} designs round-trip exactly (longest link ${longest} chars); ${checks} privacy, rejection and wiring checks.`);
