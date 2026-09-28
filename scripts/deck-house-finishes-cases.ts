import {createHash} from 'node:crypto';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import type {DeckData,HouseCladding,HouseConfig,HouseOpening} from '../src/features/deckcraft/types';

/**
 * The houses and walls whose drawing is fingerprinted in deck-house-finishes-golden.json. The golden was taken
 * from the code as it was before the exterior finishes work (commit 7e5124b plus F3, which does not touch the
 * house), so the six original claddings, the two original roofs and every exported house part stay bit-identical.
 * Shared by check-deck-house-finishes.ts and the one-time capture; never import the new finishes code here.
 */
export const ORIGINAL_CLADDINGS:HouseCladding[]=['Siding','Brick','Stone','Stucco','Board & batten','Vertical siding'];

/** Exact (unrounded) fingerprint: any change to any number changes it. */
export const exactDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);

const base=getHouseConfig(DEFAULT_DECK);
const house=(patch:Partial<HouseConfig>={},deck:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),...deck,houseConfig:{...base,widthFt:32,depthFt:26,...patch}});
const door=(id:string,offsetPct:number,style?:HouseOpening['style'],wallId?:string):HouseOpening=>({id,type:'Door',facade:'Front',offsetPct,bottomIn:36,widthIn:style==='Single'?36:72,heightIn:84,...(style?{style}:{}),...(wallId?{wallId}:{})});
const win=(id:string,facade:HouseOpening['facade'],offsetPct:number,style?:HouseOpening['style'],wallId?:string):HouseOpening=>({id,type:'Window',facade,offsetPct,bottomIn:48,widthIn:40,heightIn:48,...(style?{style}:{}),...(wallId?{wallId}:{})});
const blocks={rects:[
  {id:'bump1',kind:'house' as const,wall:'Front' as const,offsetFt:4,widthFt:8,depthFt:3,storeys:1 as const,roofShape:'Hip' as const},
  {id:'wing1',kind:'house' as const,wall:'Back' as const,offsetFt:0,widthFt:14,depthFt:12},
  {id:'garage1',kind:'garage' as const,wall:'Right' as const,offsetFt:0,widthFt:22,depthFt:20,storeys:1 as const,floorHeightIn:4},
]};

/** Whole houses, as exported (buildHouseGeometry). */
export const HOUSE_CASES:Record<string,DeckData>={
  default:structuredClone(DEFAULT_DECK),
  hidden:{...structuredClone(DEFAULT_DECK),houseVisible:false},
  ...Object.fromEntries(ORIGINAL_CLADDINGS.map(cladding=>[`cladding/${cladding}`,house({cladding,claddingColor:'#8a6f5a',trimColor:'#fbfaf5',roofColor:'#2f3437'})])),
  'roof/hip-metal-2':house({roofShape:'Hip',roofFinish:'Metal',storeys:2,storeyHeightIn:108}),
  'roof/flat-3':house({roofShape:'Flat',storeys:3,storeyHeightIn:100}),
  'roof/gable-x-9':house({ridge:'x',roofPitch:9}),
  'roof/gable-4':house({roofPitch:4,widthFt:44,depthFt:30}),
  'openings/every-style':house({openings:[
    door('d0',30),door('d1',45,'Single'),door('d2',62,'French'),door('d3',80,'Sliding'),
    win('w0','Left',20),win('w1','Left',50,'Double-hung'),win('w2','Left',80,'Casement'),
    win('w3','Right',20,'Picture'),win('w4','Right',50,'Slider'),win('w5','Right',80,'Awning'),win('w6','Back',50,'Casement'),
  ]}),
  'blocks/bump-wing-garage':house({footprint:blocks,roofPitch:7,openings:[
    ...base.openings,
    ...(['Panel','Carriage','Flush','Glass'] as const).map((style,i):HouseOpening=>({id:`g${i}`,type:'Garage',facade:'Back',wallId:'garage1-back',offsetPct:12+i*25,bottomIn:0,widthIn:60,heightIn:84,style})),
    win('bw','Front',50,'Double-hung','bump1-front'),win('ww','Back',50,'Slider','wing1-back'),
  ]}),
  'placement/left':house({widthFt:24},{housePlacement:{anchor:'left',offsetIn:30}}),
  'house/wide-tall':house({widthFt:60,depthFt:40,storeys:2,storeyHeightIn:120,roofShape:'Hip'}),
  'deck/l-shape':house({},{shape:'L-Shape',cutoutWidth:6,cutoutLength:5}),
  'deck/wrap':house({widthFt:24,depthFt:28},{width:16,wrap:{left:{widthFt:8,runFt:12},right:{widthFt:8,runFt:12}}}),
};

export interface SkinWall {span:number;height:number;openings:HouseOpening[];hidden:[number,number][]}
const at=(id:string,type:HouseOpening['type'],offsetPct:number,bottomIn:number,widthIn:number,heightIn:number):HouseOpening=>({id,type,facade:'Front',offsetPct,bottomIn,widthIn,heightIn});
/** Single walls, as the 3D view clads them. */
export const SKIN_WALLS:Record<string,SkinWall>={
  plain:{span:360,height:108,openings:[],hidden:[]},
  openings:{span:300,height:216,openings:[at('d','Door',50,36,72,84),at('w1','Window',15,48,36,48),at('w2','Window',85,120,48,54)],hidden:[]},
  hidden:{span:240,height:96,openings:[at('w','Window',80,40,30,36)],hidden:[[-60,20]]},
  garage:{span:600,height:324,openings:[at('g','Garage',30,0,192,96),at('w','Window',80,200,40,48)],hidden:[]},
  odd:{span:157.3,height:101.7,openings:[at('e','Window',5,.5,28.4,33.3)],hidden:[[60,78.65]]},
  largest:{span:1200,height:900,openings:[],hidden:[]},
};
/** Openings as the facade places them (HouseFacade.tsx): centre x along the wall, centre y above grade. */
export const shapesFor=(span:number,openings:HouseOpening[])=>openings.map(o=>({...o,x:-span/2+span*o.offsetPct/100,y:o.bottomIn+o.heightIn/2,w:o.widthIn,h:o.heightIn}));
