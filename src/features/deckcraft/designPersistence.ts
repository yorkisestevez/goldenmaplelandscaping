import { DEFAULT_DECK } from './defaults';
import {validateInstallation} from './installationSystem';
import {validateRailingReview} from './railingJobPack';
import {validateSkirting} from './skirting';
import {validateDrySpace} from './drySpace';
import {validateBoardFinishes} from './boardFinishes';
import { type DeckData, type HouseConfig, type HouseOpening, type YardFeature } from './types';
import {PATIO_PRODUCTS,WALL_PRODUCTS,WATER_PRODUCTS} from './yardSettings';
import {clampHouseOpening} from './houseSettings';
import { LIGHTING_CATALOGUE } from './lightingCatalogue';
import type {LightingPlacementOverride} from './lightingPlacement';
import {PRIVACY_SCREEN_PRODUCTS,type PrivacyScreenSelection} from './privacyScreens';
import { DECKING_CATALOGUE, RAILING_CATALOGUE, MANUFACTURER_ACCESSORIES } from './manufacturerCatalog';

export const DESIGN_STORAGE_KEY = 'golden-maple.deck-studio.design.v1';
export const MAX_DESIGN_BYTES = 100_000;
const enums: Partial<Record<keyof DeckData, readonly (string | number)[]>> = {
  boardStockLengthIn:[144,192,240],breakerLayout:['Auto','Center'],
  cutoutCorner:['Left','Right'],
  deckType:['Attached','Freestanding','Floating','Add-on'], municipality:['Toronto','Barrie','Simcoe County','Burlington-Oakville','Rural-Other'],
  siteType:['Standard','Waterfront-Lakefront','Hillside','Urban Tight','Island-Ferry'],soilCondition:['Unknown','Sandy','Clay','Shallow Bedrock','Fill'],
  buildSeason:['Spring-Summer','Fall','Winter'],intendedLoad:['Standard','Heavy'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],
  shape:['Rectangle','L-Shape','Multi-corner','Curved'],levels:[1,2],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],
  framingSize:['2x8','2x10','2x12'],boardWidth:[5.5,3.5],joistSpacing:[12,16],fasteningSystem:['Face','Hidden'],pictureFrameRows:[0,1,2],
  railingType:['None','Wood Picket','Aluminum','Cable','Glass Panels','Trex Select','Trex Transcend','Fortress AL13','TT Classic','TT Impression'],
  stairFlights:[0,1,2,3],stairType:['Straight','Winder','Landing'],stairPosition:['Front','Left','Right','Back'],
  sceneLighting:['Daylight','Evening'],level2Position:['Front','Left','Right'],stairTurn:['Left','Right'],
  borderFinish:['Matching','Dark Slate'],
  railingHardwareFinish:['Black','Satin'],
};
const ranges: Partial<Record<keyof DeckData, readonly [number,number]>> = {
  width:[4,60],length:[4,60],height:[8,144],width2:[4,40],length2:[4,40],height2:[8,144],
  cutoutWidth:[0,48],cutoutLength:[0,48],cutoutWidth2:[0,48],cutoutLength2:[0,48],
  foundationDepthIn:[24,144],stairWidth:[36,120],stairOffset:[0,100],inlayLf:[0,200],
  benchLf:[0,100],privacySqft:[0,500],pergolaSqft:[0,600],
  pictureFrameOverhangIn:[0,1.5],
  landingAfterRisers:[1,18],
  houseWallHeightIn:[96,240],houseDoorOffset:[0,100],houseDoorWidthIn:[30,144],level2Offset:[0,100],landingDepthIn:[36,120],
};
const booleans = ['hasInlay','hasDrainage','hasDemo','houseVisible','lightingPreviewOn','landingStraight'] as const;
const texts = ['customerName','projectAddress','scopeOfWork'] as const;
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function numeric(value:unknown,min:number,max:number,label:string):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be a number between ${min} and ${max}.`);
  return value;
}

/** Explicit allowlist: public design files never supply contractor rates or overrides. */
export function validateDesign(input:unknown):DeckData {
  if(!record(input))throw new Error('The design configuration is missing.');
  const clean:DeckData=structuredClone(DEFAULT_DECK);
  const target=clean as unknown as Record<string,unknown>;
  if(input.privacyScreens!==undefined){
    if(!Array.isArray(input.privacyScreens)||input.privacyScreens.length>12)throw new Error('A design supports up to 12 privacy screen rows.');
    const seen=new Set<string>();
    clean.privacyScreens=input.privacyScreens.map(p=>{
      if(!record(p)||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)||seen.has(p.id)||typeof p.enabled!=='boolean')throw new Error('Invalid or duplicate privacy screen row.');
      seen.add(p.id);const product=PRIVACY_SCREEN_PRODUCTS.find(x=>x.id===p.productId);
      if(!product||!product.finishes.includes(p.finish as 'Black'|'White'))throw new Error('Unknown screen product or finish.');
      const levelIndex=numeric(p.levelIndex,0,32,'Screen level'),edgeIndex=numeric(p.edgeIndex,0,64,'Screen edge'),count=numeric(p.count,1,12,'Screen count');
      if(![levelIndex,edgeIndex,count].every(Number.isInteger))throw new Error('Screen level, edge and count must be whole numbers.');
      return {id:p.id,productId:product.id,levelIndex,edgeIndex,count,offsetPct:numeric(p.offsetPct,0,100,'Screen position'),enabled:p.enabled,finish:p.finish as PrivacyScreenSelection['finish']};
    });
  }
  if(input.lightingPlacements!==undefined){
    if(!Array.isArray(input.lightingPlacements)||input.lightingPlacements.length>256)throw new Error('Invalid individual lighting placements.');
    const seen=new Set<string>();
    clean.lightingPlacements=input.lightingPlacements.map(p=>{
      if(!record(p)||typeof p.productId!=='string'||!LIGHTING_CATALOGUE.some(l=>l.id===p.productId&&l.supported)||typeof p.targetId!=='string'||p.targetId.length>160||!/^[a-z_]+_[0-9:.|\-]+$/.test(p.targetId)||!['inside','outside'].includes(p.face as string))throw new Error('Invalid lighting mounting target.');
      const index=numeric(p.index,0,29,'Fixture index'),id=`${p.productId}:${index}`;
      if(!Number.isInteger(index)||seen.has(id))throw new Error('Invalid or duplicate individual fixture.');seen.add(id);
      return {productId:p.productId,index,targetId:p.targetId,positionPct:numeric(p.positionPct,0,100,'Fixture position'),face:p.face as LightingPlacementOverride['face']};
    });
  }
  if(input.installation!==undefined)clean.installation=validateInstallation(input.installation);
  if(input.railingReview!==undefined)clean.railingReview=validateRailingReview(input.railingReview);
  if(input.skirting!==undefined)clean.skirting=validateSkirting(input.skirting);
  if(input.drySpace!==undefined)clean.drySpace=validateDrySpace(input.drySpace);
  if(input.boardFinishes!==undefined)clean.boardFinishes=validateBoardFinishes(input.boardFinishes);
  if(input.removedRailingSections!==undefined){
    const ids=input.removedRailingSections;
    if(!Array.isArray(ids)||ids.length>512||ids.some(id=>typeof id!=='string'||id.length>160||!/^rail_[0-9:.|\-]+$/.test(id))||new Set(ids).size!==ids.length)throw new Error('Invalid or duplicate railing section removals.');
    clean.removedRailingSections=[...ids];
  }
  for(const [key,values] of Object.entries(enums))if(Object.hasOwn(input,key)){
    if(!values.includes(input[key] as never))throw new Error(`Unsupported ${key} selection.`);
    target[key]=input[key];
  }
  for(const [key,[min,max]] of Object.entries(ranges))if(Object.hasOwn(input,key))target[key]=numeric(input[key],min,max,key);
  if(clean.landingAfterRisers!==undefined&&!Number.isInteger(clean.landingAfterRisers))throw new Error('Landing position must be a whole number of risers.');
  for(const key of booleans)if(Object.hasOwn(input,key)){
    if(typeof input[key]!=='boolean')throw new Error(`${key} must be true or false.`);
    target[key]=input[key];
  }
  for(const key of texts)if(Object.hasOwn(input,key)){
    if(typeof input[key]!=='string'||input[key].length>2000)throw new Error(`${key} must contain at most 2,000 characters.`);
    target[key]=input[key];
  }
  if(Object.hasOwn(input,'deckingMaterial')){
    if(typeof input.deckingMaterial!=='string'||!DECKING_CATALOGUE.some(m=>m.id===input.deckingMaterial))throw new Error('This decking collection is unavailable.');
    clean.deckingMaterial=input.deckingMaterial;
  }
  const material=DECKING_CATALOGUE.find(m=>m.id===clean.deckingMaterial)!;
  if(Object.hasOwn(input,'deckingColor')&&!material.colors.some(c=>c.name===input.deckingColor))throw new Error('The colour does not belong to the selected collection.');
  clean.deckingColor=typeof input.deckingColor==='string'?input.deckingColor:material.colors[0].name;
  if(input.catalogueRailingId!==undefined&&input.catalogueRailingId!==''){
    const railing=RAILING_CATALOGUE.find(r=>r.id===input.catalogueRailingId);
    if(!railing)throw new Error('This manufacturer railing system is unavailable.');
    clean.catalogueRailingId=railing.id;clean.railingType=railing.baseType;
  }
  if(input.catalogueAccessories!==undefined){
    if(!Array.isArray(input.catalogueAccessories)||input.catalogueAccessories.length>MANUFACTURER_ACCESSORIES.length)throw new Error('Invalid manufacturer accessories.');
    const seen=new Set<string>();
    clean.catalogueAccessories=input.catalogueAccessories.map(id=>{if(typeof id!=='string'||seen.has(id)||!MANUFACTURER_ACCESSORIES.some(a=>a.id===id&&a.previewSupported))throw new Error('Unknown, duplicate or unsupported manufacturer accessory.');seen.add(id);return id;});
  }
  if(Object.hasOwn(input,'lightingSystem')){
    const lighting=input.lightingSystem;
    if(!record(lighting)||!Array.isArray(lighting.selectedItems)||lighting.selectedItems.length>LIGHTING_CATALOGUE.length)throw new Error('The lighting selection is invalid.');
    const seen=new Set<string>();
    clean.lightingSystem={wireDistance:numeric(lighting.wireDistance,0,500,'Wire distance'),selectedItems:lighting.selectedItems.map(item=>{
      if(!record(item)||typeof item.productId!=='string'||!LIGHTING_CATALOGUE.some(p=>p.id===item.productId&&p.supported)||seen.has(item.productId))throw new Error('Unknown, unsupported or duplicate lighting product.');
      seen.add(item.productId);const qty=numeric(item.qty,0,30,'Lighting quantity');if(!Number.isInteger(qty))throw new Error('Lighting quantities must be whole numbers.');
      if(item.zone!==undefined&&!['deck','posts','rails','stairs','landscape','house'].includes(item.zone as string))throw new Error('Unsupported lighting installation zone.');
      return {productId:item.productId,qty,...(item.zone?{zone:item.zone as 'deck'|'posts'|'rails'|'stairs'|'landscape'|'house'}:{})};
    }).filter(item=>item.qty>0)};
  }
  if(input.lightingZoneEnabled!==undefined){
    if(!record(input.lightingZoneEnabled))throw new Error('Invalid lighting installation zones.');
    clean.lightingZoneEnabled={};
    for(const zone of ['deck','posts','rails','stairs','landscape','house'] as const)if(Object.hasOwn(input.lightingZoneEnabled,zone)){
      if(typeof input.lightingZoneEnabled[zone]!=='boolean')throw new Error('Installation zone must be enabled or disabled.');
      clean.lightingZoneEnabled[zone]=input.lightingZoneEnabled[zone];
    }
  }
  if(input.houseConfig!==undefined){
    const h=input.houseConfig;if(!record(h))throw new Error('Invalid house configuration.');
    for(const [key,choices] of Object.entries({storeys:[1,2,3],roofShape:['Gable','Hip','Flat'],roofFinish:['Shingles','Metal'],cladding:['Brick','Siding']}))if(!(choices as unknown[]).includes(h[key]))throw new Error(`Unsupported house ${key}.`);
    for(const key of ['roofColor','claddingColor','trimColor'])if(typeof h[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(h[key] as string))throw new Error('House colours must use six-digit hex colours.');
    const house:HouseConfig={widthFt:numeric(h.widthFt,12,100,'House width'),depthFt:numeric(h.depthFt,12,100,'House depth'),storeys:h.storeys as 1|2|3,storeyHeightIn:numeric(h.storeyHeightIn,96,300,'Storey height'),roofShape:h.roofShape as HouseConfig['roofShape'],roofFinish:h.roofFinish as HouseConfig['roofFinish'],roofColor:h.roofColor as string,cladding:h.cladding as HouseConfig['cladding'],claddingColor:h.claddingColor as string,trimColor:h.trimColor as string,openings:[]};
    if(!Array.isArray(h.openings)||h.openings.length>24)throw new Error('A house supports up to 24 openings.');
    const ids=new Set<string>();
    house.openings=h.openings.map(o=>{
      if(!record(o)||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(o.id)||ids.has(o.id)||!['Door','Window'].includes(o.type as string)||!['Front','Back','Left','Right'].includes(o.facade as string))throw new Error('Invalid or duplicate house opening.');
      ids.add(o.id);const opening:HouseOpening={id:o.id,type:o.type as HouseOpening['type'],facade:o.facade as HouseOpening['facade'],offsetPct:numeric(o.offsetPct,0,100,'Opening position'),bottomIn:numeric(o.bottomIn,0,900,'Opening bottom'),widthIn:numeric(o.widthIn,12,180,'Opening width'),heightIn:numeric(o.heightIn,12,144,'Opening height')};
      return clampHouseOpening(opening,house);
    });clean.houseConfig=house;
  }
  if(input.terrainConfig!==undefined){const t=input.terrainConfig;if(!record(t))throw new Error('Invalid terrain configuration.');clean.terrainConfig={widthFt:numeric(t.widthFt,20,250,'Terrain width'),depthFt:numeric(t.depthFt,20,250,'Terrain depth'),elevationIn:numeric(t.elevationIn,-120,120,'Terrain grade'),slopePct:numeric(t.slopePct,-30,30,'Terrain slope')};}
  if(input.yardFeatures!==undefined){
    if(!Array.isArray(input.yardFeatures)||input.yardFeatures.length>20)throw new Error('A design supports up to 20 yard features.');
    const ids=new Set<string>();clean.yardFeatures=input.yardFeatures.map(f=>{
      if(!record(f)||typeof f.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(f.id)||ids.has(f.id)||!['patio','retaining-wall','water-feature'].includes(f.kind as string)||typeof f.name!=='string'||f.name.length>80||typeof f.enabled!=='boolean'||typeof f.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(f.color))throw new Error('Invalid or duplicate yard feature.');
      ids.add(f.id);const kind=f.kind as YardFeature['kind'];const products=kind==='patio'?PATIO_PRODUCTS:kind==='retaining-wall'?WALL_PRODUCTS:WATER_PRODUCTS;
      if(typeof f.productId!=='string'||!products.some(p=>p.id===f.productId))throw new Error('This yard product is not supported for the selected feature.');
      return {id:f.id,kind,name:f.name,enabled:f.enabled,color:f.color,productId:f.productId,xFt:numeric(f.xFt,-150,150,'Yard position across'),zFt:numeric(f.zFt,-150,200,'Yard position out'),widthFt:numeric(f.widthFt,2,kind==='patio'?60:kind==='retaining-wall'?80:20,'Feature width'),depthFt:numeric(f.depthFt,kind==='retaining-wall'?0.5:2,kind==='patio'?60:kind==='retaining-wall'?8:20,'Feature depth'),heightIn:numeric(f.heightIn,kind==='patio'?-24:6,kind==='patio'?48:kind==='retaining-wall'?72:96,'Feature height or basin depth'),rotationDeg:numeric(f.rotationDeg,0,359,'Feature rotation')};
    });
  }
  // The public estimate derives railing quantity from geometry, never an imported allowance.
  clean.railingLf=0;
  if(clean.borderFinish==='Dark Slate')clean.pictureFrameRows=clean.pictureFrameRows===2?2:1;
  if((clean.deckType==='Attached'||clean.deckType==='Add-on')&&clean.stairPosition==='Back')clean.stairPosition='Front';
  return clean;
}

export function serializeDesign(data:DeckData):string {
  const clean=validateDesign(data);
  const configuration:Record<string,unknown>={};
  if(clean.installation)configuration.installation=clean.installation;
  if(clean.railingReview)configuration.railingReview=clean.railingReview;
  if(clean.skirting)configuration.skirting=clean.skirting;
  if(clean.drySpace)configuration.drySpace=clean.drySpace;
  if(clean.boardFinishes)configuration.boardFinishes=clean.boardFinishes;
  if(clean.removedRailingSections)configuration.removedRailingSections=clean.removedRailingSections;
  if(clean.lightingPlacements)configuration.lightingPlacements=clean.lightingPlacements;
  if(clean.privacyScreens)configuration.privacyScreens=clean.privacyScreens;
  for(const key of [...Object.keys(enums),...Object.keys(ranges),...booleans,...texts,'deckingMaterial','deckingColor','lightingSystem','catalogueRailingId','catalogueAccessories','lightingZoneEnabled','houseConfig','yardFeatures','terrainConfig']){
    if(clean[key as keyof DeckData]!==undefined)configuration[key]=clean[key as keyof DeckData];
  }
  return JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration},null,2);
}

export function parseDesign(text:string):DeckData {
  if(new TextEncoder().encode(text).length>MAX_DESIGN_BYTES)throw new Error('Choose a design file smaller than 100 KB.');
  let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Choose a valid Golden Maple JSON design file.');}
  if(!record(value)||value.format!=='golden-maple-deck-design'||value.version!==1)throw new Error('This design format or version is not supported.');
  return validateDesign(value.configuration);
}
