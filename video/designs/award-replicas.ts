// DeckCraft replicas of award-winning multi-level decks, built from the projects' published descriptions (the award
// photos themselves are the builders' and NADRA's; nothing of theirs is copied here). Each design is validated like a
// customer upload, and gets a share link that opens it in the designer. Where a description is silent (decking colour,
// railing on some), the choice is ours and marked "our pick" in replicas.json.
// Run: npx tsx video/designs/award-replicas.ts  →  video/designs/award/<slug>.json + replicas.json
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {validateDesign} from '../../src/features/deckcraft/designPersistence';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign} from '../../src/features/deckcraft/deckRelease';
import {encodeDesignLink} from '../../src/features/deckcraft/designLink';
import {newPergola} from '../../src/features/deckcraft/pergolaCatalog';
import type {DeckData,HouseConfig,YardFeature} from '../../src/features/deckcraft/types';

const out=new URL('./award/',import.meta.url).pathname;mkdirSync(out,{recursive:true});
const bases=JSON.parse(readFileSync(new URL('../../scripts/deck-level-junction-designs.json',import.meta.url),'utf8')) as Record<string,DeckData>;
const ORIGIN='https://goldenmaplelandscaping.ca';

/** A walkout house: the lower storey opens at grade under the deck, the main floor opens onto the deck. */
function walkoutHouse(base:HouseConfig,deckIn:number,widthFt:number):HouseConfig{
  const s=deckIn;
  return {...structuredClone(base),widthFt,storeys:3,storeyHeightIn:s,floorHeightIn:s,openings:[
    {id:'patio-door',type:'Door',facade:'Front',offsetPct:50,bottomIn:s,widthIn:144,heightIn:96,style:'Sliding'},
    {id:'main-win-l',type:'Window',facade:'Front',offsetPct:22,bottomIn:s+24,widthIn:72,heightIn:66,style:'Picture'},
    {id:'main-win-r',type:'Window',facade:'Front',offsetPct:78,bottomIn:s+24,widthIn:72,heightIn:66,style:'Picture'},
    {id:'walkout-door',type:'Door',facade:'Front',offsetPct:50,bottomIn:0,widthIn:144,heightIn:96,style:'Sliding'},
    {id:'lower-win-l',type:'Window',facade:'Front',offsetPct:22,bottomIn:30,widthIn:60,heightIn:54,style:'Picture'},
    {id:'lower-win-r',type:'Window',facade:'Front',offsetPct:78,bottomIn:30,widthIn:60,heightIn:54,style:'Picture'},
    ...[20,40,60,80].map((offsetPct,i)=>({id:`up-${i+1}`,type:'Window' as const,facade:'Front' as const,offsetPct,bottomIn:2*s+30,widthIn:48,heightIn:60,style:'Casement' as const})),
  ]} as HouseConfig;
}
/** Pavers under the main deck: the dry room the drainage system makes. */
const underPatio=(widthFt:number,lengthFt:number):YardFeature=>({id:'under-deck-patio',kind:'patio',name:'Under-deck patio',enabled:true,xFt:widthFt/2,zFt:lengthFt/2,widthFt:widthFt-2,depthFt:lengthFt-1,heightIn:0,rotationDeg:0,productId:'permacon-brooklyn',color:'#b8b1a4'});
const DRYSPACE={drainage:'dryspace',ceiling:'none',scope:'all',gravel:false,gravelDepthIn:3,floorMesh:false} as const;

interface Replica {slug:string;name:string;after:string;award:string;source:string;published:string[];modelled:string[];notModelled:string[];design:DeckData}
const kemp=bases.Kempenfelt,cascade=bases.Cascade;

const replicas:Replica[]=[
  {slug:'lakefront-heights',name:'Lakefront Heights',after:'Casey Fence and Deck (Frederick, MD)',award:'NADRA National Deck Awards 2022, second place',
    source:'https://www.nadra.org/awards/2022-awards',
    published:['Multi-level deck on a lakefront home, built at extreme height','Over 700 sq ft of under-deck drain system','Dark bronze gutters chosen to blend with the rail system','No staircase: access from the house'],
    modelled:['Main deck at 10 ft over a walkout patio, lower tier at 7 ft','TimberTech DrySpace under both tiers (troughs, gutter and downspout drawn)','TimberTech Impression Rail in Dark Bronze to match the gutters','Paver patio under the deck with a walkout slider at grade','No grade stair, as built','Decking: TimberTech AZEK Landmark Castle Gate (our pick; not published)'],
    notModelled:['The lake and steep driveway site','Under-deck ceiling finish (DeckCraft draws the troughs, not a soffit)'],
    design:{...structuredClone(kemp),levels:2,width:30,length:14,height:120,width2:20,length2:10,height2:84,level2Position:'Front',level2Offset:50,level2FullStep:false,
      deckingMaterial:'tt_landmark',deckingColor:'Castle Gate',deckFinishes:{border:'tt_landmark:American Walnut',fascia:'tt_landmark:American Walnut',risers:'tt_landmark:American Walnut',railingColor:'Dark Bronze'},
      catalogueRailingId:'tt_impression_express',railingType:'Aluminum',stairFlights:0,skirting:undefined,underDeck:DRYSPACE,hasDrainage:true,
      houseConfig:{...walkoutHouse(kemp.houseConfig!,120,48),claddingColor:'#e9e6df',gutterColor:'#4a3b2c'},yardFeatures:[underPatio(30,14)],
      autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},sceneLighting:'Daylight'}},
  {slug:'virginia-cascade',name:'Virginia Cascade',after:'Deckscapes of Virginia (Catharpin, VA)',award:'NADRA National Deck Awards 2024, Closed Porch, second place (tie)',
    source:'https://www.nadra.org/awards/2024-awards/closed-porch',
    published:['Raised porch 30 ft deep and 22 ft wide with a cathedral roof, heaters and a masonry fireplace','Open deck beyond the porch with an under-deck drainage system','Stairs down to a swim spa surrounded by a lower deck','The design continues down to a patio'],
    modelled:['Upper deck at 10 ft over a walkout patio, with a louvered aluminum roof and screens standing in for the porch','DrySpace under the upper and middle tiers','Middle tier at 5 ft, then the spa-level deck at 2 ft (three tiers, stairs generated between them)','Paver terrace and seat wall at grade below the spa deck','Decking: TimberTech AZEK Vintage Mahogany; glass rail (our picks; not published)'],
    notModelled:['The porch\'s shingled cathedral roof, heaters and fireplace (DeckCraft has pergolas, not roofed porches)','The swim spa itself (no spa object; its deck is modelled)'],
    design:{...structuredClone(cascade),levels:3,width:30,length:16,height:120,width2:24,length2:12,height2:60,level2Position:'Front',level2Offset:50,level2FullStep:false,
      level3:{widthFt:20,lengthFt:14,heightIn:24,parent:2,position:'Front',offsetPct:50,fullStep:false},
      deckingMaterial:'tt_vintage',deckingColor:'Mahogany',deckFinishes:{border:'tt_vintage:Dark Hickory',fascia:'tt_vintage:Dark Hickory',risers:'tt_vintage:Dark Hickory',railingColor:'Black'},
      catalogueRailingId:'tt_impression_glass',railingType:'Glass Panels',underDeck:DRYSPACE,hasDrainage:true,skirting:undefined,
      pergola:{...newPergola('lousol-junior'),xFt:9,zFt:8},
      houseConfig:walkoutHouse(kemp.houseConfig!,120,46),
      yardFeatures:[underPatio(30,16),...(cascade.yardFeatures??[]).filter(f=>f.kind!=='water-feature').map(f=>f.kind==='patio'?{...f,zFt:f.zFt+14}:{...f,zFt:f.zFt+14})],
      autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},sceneLighting:'Evening'}},
  {slug:'nova-scotia-terraces',name:'Nova Scotia Terraces',after:'Archadeck Outdoor Living of Nova Scotia',award:'Archadeck Outdoor Living Design Excellence Award, first of 40+ entries',
    source:'https://www.timbertech.com/news/timbertech-deck-in-nova-scotia-wins-the-archadeck-outdoor-livings-design-excellence-award/',
    published:['Multi-level, multi-functional deck over 1,000 sq ft','TimberTech Legacy decking in Pecan with a Mocha accent','TimberTech Evolutions Rail Contemporary in Traditional Walnut','TimberTech riser lights','Dining area, outdoor kitchen, sitting area and fire pit; ocean view and original stone walls'],
    modelled:['Three terraces over 1,000 sq ft: dining (upper), sitting with built-in benches (middle), and a lower landing terrace','TimberTech PRO Legacy Pecan field with Mocha picture-frame border, fascia and risers','Riser lights on every stair (In-Lite Evo Hyde) and post lights','Natural stone retaining wall standing in for the original stone walls','Railing: TimberTech Classic Composite in Matte Espresso, the closest current TimberTech rail to Evolutions Contemporary in Traditional Walnut'],
    notModelled:['Outdoor kitchen and fire pit (not 3D objects in DeckCraft)','The ocean view'],
    design:{...structuredClone(kemp),levels:3,width:30,length:18,height:42,width2:24,length2:14,height2:22,level2Position:'Front',level2Offset:40,level2FullStep:true,
      level3:{widthFt:14,lengthFt:12,heightIn:42,parent:1,position:'Right',offsetPct:60,fullStep:false},
      deckingMaterial:'tt_legacy',deckingColor:'Pecan',pattern:'Picture Frame',pictureFrameRows:1,deckFinishes:{border:'tt_legacy:Mocha',fascia:'tt_legacy:Mocha',risers:'tt_legacy:Mocha',railingColor:'Matte Espresso'},
      catalogueRailingId:'tt_classic_composite',railingType:'TT Classic',benchLf:16,stairWidth:72,
      skirting:{style:'Horizontal boards',colour:'tt_legacy:Mocha',clearanceIn:2,accessPanels:1},
      yardFeatures:[{id:'stone-wall',kind:'retaining-wall',name:'Stone wall',enabled:true,xFt:-6,zFt:20,widthFt:24,depthFt:1.5,heightIn:30,rotationDeg:90,productId:'segmental-concrete',color:'#8f877b'}],
      autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},lightingSystem:{wireDistance:90,selectedItems:[{productId:'smart_hub150',qty:1},{productId:'fusion',qty:10,zone:'deck'}]},sceneLighting:'Evening'}},
];

const summary=[];
for(const r of replicas){
  const design=deckReleaseData(validateDesign({...r.design,customerName:'',projectAddress:''}));
  const estimate=calculateDeckReleaseEstimate(design);
  const notes=(estimate.model as unknown as {issues?:string[]}).issues??[];
  writeFileSync(out+r.slug+'.json',serializeDeckReleaseDesign(design)+'\n');
  const link=await encodeDesignLink(design,ORIGIN);
  const {design:_d,...meta}=r;
  summary.push({...meta,constructionNotes:notes,sqft:Math.round(estimate.model.quantities.area),levels:estimate.model.levels.filter(l=>l.kind==='deck').length,link,linkChars:link.length});
  console.log(`${r.name}: ${Math.round(estimate.model.quantities.area)} sq ft, ${design.levels} levels, link ${link.length} chars, ${notes.length} construction note(s)`);
}
writeFileSync(out+'replicas.json',JSON.stringify(summary,null,2)+'\n');
