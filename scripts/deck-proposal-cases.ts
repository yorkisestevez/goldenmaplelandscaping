import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import type {DeckData} from '../src/features/deckcraft/types';

/**
 * Designs the proposal checks (check-deck-proposal.ts, the printable sheet; check-deck-pdf.ts, the PDF) both run: the
 * default deck, one with the customer's name and address, a wrap with a porch, bump-outs and a garage, three levels
 * with a lit screen, every supplier-quote path, and the showcase: a three-level cascade with angled corners, a
 * picture frame, inlays and a medallion, part finishes, glass railing in a colour, a pergola, lighting in four zones,
 * a lit HIDEAWAY screen, skirting, a dressed house and a backyard with allowances. The showcase is read through the
 * design-file parser, as an import is, so it is a design a customer can really have.
 */
const house=getHouseConfig({...structuredClone(DEFAULT_DECK),width:20});
const design=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});

export const SHOWCASE_CONFIG={
  customerName:'The Cascade',projectAddress:'',
  deckType:'Attached',municipality:'Barrie',siteType:'Standard',soilCondition:'Clay',buildSeason:'Spring-Summer',intendedLoad:'Standard',foundation:'Helical Piles',foundationDepthIn:48,
  shape:'Rectangle',levels:3,width:30,length:14,height:30,cornerChamfers:{frontLeftFt:4,frontRightFt:4},
  width2:20,length2:12,height2:18,level2Position:'Front',level2Offset:50,level2FullStep:true,
  level3:{widthFt:16,lengthFt:10,heightIn:8,parent:2,position:'Front',offsetPct:50,fullStep:true},
  deckingMaterial:'tt_vintage',deckingColor:'Weathered Teak',pattern:'Picture Frame',pictureFrameRows:2,pictureFrameOverhangIn:1,borderFinish:'Matching',
  boardWidth:5.5,framingSize:'2x10',joistSpacing:12,fasteningSystem:'Hidden',hasInlay:false,inlayLf:0,
  inlays:[
    {id:'dining-rug',kind:'rug',dxFt:-1,dyFt:1,widthFt:10,depthFt:5,frameRows:1,pattern:'Herringbone',frame:'tt_vintage:Dark Hickory',fill:'tt_vintage:English Walnut'},
    {id:'lounge-compass',kind:'medallion',level:2,diameterFt:6,style:'compass',frame:'tt_vintage:Dark Hickory',fill:'tt_vintage:Mahogany'},
    {id:'terrace-band',kind:'band',level:3,direction:'across',boards:2,fill:'tt_vintage:Dark Hickory'}],
  deckFinishes:{border:'tt_vintage:Dark Hickory',fascia:'tt_vintage:Dark Hickory',risers:'tt_vintage:Dark Hickory',railingColor:'Black'},
  railingType:'Glass Panels',catalogueRailingId:'tt_impression_glass',catalogueAccessories:['tt_fascia','tt_concealoc'],
  stairFlights:1,stairType:'Straight',stairPosition:'Front',stairOffset:50,stairWidth:96,stairTurn:'Right',landingDepthIn:48,
  skirting:{style:'Horizontal boards',colour:'tt_vintage:Dark Hickory',clearanceIn:2,accessPanels:1},
  pergolaSqft:160,benchLf:8,hasDrainage:false,hasDemo:false,
  privacyScreens:[{id:'screen-left',side:'Left',lengthFt:6.75,heightFt:6,offsetPct:0,lights:true,product:'hideaway',design:'Horizon',finish:'Black',panels:2}],
  autoLighting:{posts:true,stairs:true,stairStyle:'evo_hyde'},
  lightingSystem:{wireDistance:120,selectedItems:[{productId:'smart_hub150',qty:1},{productId:'fusion',qty:12,zone:'deck'},{productId:'sway_pendant',qty:3,zone:'house'},{productId:'liv',qty:6,zone:'landscape'},{productId:'scope',qty:3,zone:'landscape'},{productId:'puck',qty:24,zone:'posts',auto:true}]},
  lightingPreviewOn:true,sceneLighting:'Evening',houseVisible:true,
  houseConfig:{widthFt:46,depthFt:32,storeys:2,storeyHeightIn:132,roofShape:'Gable',ridge:'x',roofPitch:9,roofFinish:'Metal',roofColor:'#2a2c2e',
    cladding:'Board & batten',claddingColor:'#f1ede3',trimColor:'#f7f6f1',fasciaColor:'#1f2021',gutterColor:'#1f2021',doorColor:'#9b7147',windowColor:'#1f2021',garageDoorColor:'#9b7147',
    footprint:{rects:[{id:'garage1',kind:'garage',wall:'Left',offsetFt:6,widthFt:24,depthFt:24,storeys:1,roofShape:'Gable'}]},
    openings:[{id:'patio-door',type:'Door',facade:'Front',offsetPct:50,bottomIn:30,widthIn:144,heightIn:96,style:'Sliding'}]},
  terrainConfig:{widthFt:250,depthFt:250,elevationIn:0,slopePct:0},
  yardFeatures:[
    {id:'terrace',kind:'patio',name:'Lower terrace',enabled:true,xFt:15,zFt:49,widthFt:22,depthFt:16,heightIn:0,rotationDeg:0,productId:'permacon-brooklyn',color:'#b8b1a4'},
    {id:'seat-wall',kind:'retaining-wall',name:'Seat wall',enabled:true,xFt:15,zFt:58.5,widthFt:22,depthFt:1.5,heightIn:20,rotationDeg:0,productId:'segmental-concrete',color:'#8f877b'},
    {id:'waterfall',kind:'water-feature',name:'Pondless waterfall',enabled:true,xFt:42,zFt:34,widthFt:8,depthFt:6,heightIn:36,rotationDeg:0,productId:'pondless-waterfall',color:'#657478'}],
  yardAllowances:{finish:'premium',firePit:'gas',kitchen:'full',turfSqft:0,lighting:true},
};
export const showcase=():DeckData=>parseDeckReleaseDesign(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:SHOWCASE_CONFIG}));

export const PROPOSAL_CASES:Record<string,()=>DeckData>={
  default:()=>design(),
  named:()=>design({customerName:'Pat Example',projectAddress:'1 Sample Road, Barrie'}),
  wrapPorch:()=>design({width:22,length:12,height:36,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},right:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:14}}}),
  bumpGarage:()=>design({width:30,length:16,houseConfig:{...house,widthFt:30,depthFt:24,floorHeightIn:40,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:8,widthFt:10,depthFt:4},{id:'garage1',kind:'garage',wall:'Left',offsetFt:-6,widthFt:20,depthFt:22}]}}}),
  threeLevels:()=>design({levels:3,height:60,height2:36,width2:14,length2:10,level3:{widthFt:10,lengthFt:8,heightIn:12,parent:2,position:'Front',offsetPct:40},privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:true}],autoLighting:{posts:true,stairs:true}}),
  quotes:()=>design({catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType,catalogueAccessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported&&a.kind!=='fastener').map(a=>a.id),pictureFrameRows:1,pattern:'Picture Frame',borderFinish:'Dark Slate'}),
  showcase,
};
