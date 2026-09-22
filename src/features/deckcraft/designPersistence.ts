import { DEFAULT_DECK } from './defaults';
import { type DeckData, type HouseConfig, type HouseOpening, type HousePlacement, type LightingZone, type PrivacyScreen, type YardFeature } from './types';
import {availableStairSides} from './houseContact';
import {MAX_PRIVACY_SCREENS,MAX_PRIVACY_SQFT,MAX_SCREEN_PANELS,PRIVACY_HEIGHTS,PRIVACY_PRODUCTS,PRIVACY_SIDES,pricedPrivacyArea} from './privacyScreens';

const LIGHTING_ZONES=['deck','posts','stairs','landscape','house','privacy'] as const satisfies readonly LightingZone[];
import {PATIO_PRODUCTS,WALL_PRODUCTS,WATER_PRODUCTS} from './yardSettings';
import {clampHouseOpening} from './houseSettings';
import { LIGHTING_CATALOGUE } from './lightingCatalogue';
import { DECKING_CATALOGUE, RAILING_CATALOGUE, MANUFACTURER_ACCESSORIES } from './manufacturerCatalog';

export const DESIGN_STORAGE_KEY = 'golden-maple.deck-studio.design.v1';
export const MAX_DESIGN_BYTES = 100_000;
const enums: Partial<Record<keyof DeckData, readonly (string | number)[]>> = {
  deckType:['Attached','Freestanding','Floating','Add-on'], municipality:['Toronto','Barrie','Simcoe County','Burlington-Oakville','Rural-Other'],
  siteType:['Standard','Waterfront-Lakefront','Hillside','Urban Tight','Island-Ferry'],soilCondition:['Unknown','Sandy','Clay','Shallow Bedrock','Fill'],
  buildSeason:['Spring-Summer','Fall','Winter'],intendedLoad:['Standard','Heavy'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],
  shape:['Rectangle','L-Shape','Multi-corner','Curved'],levels:[1,2],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],
  framingSize:['2x8','2x10','2x12'],boardWidth:[5.5,3.5],joistSpacing:[12,16],fasteningSystem:['Face','Hidden'],pictureFrameRows:[0,1,2],
  railingType:['None','Wood Picket','Aluminum','Cable','Glass Panels','Trex Select','Trex Transcend','Fortress AL13','TT Classic','TT Impression'],
  stairFlights:[0,1,2,3],stairType:['Straight','Winder','Landing'],stairPosition:['Front','Left','Right','Back'],
  sceneLighting:['Daylight','Evening'],level2Position:['Front','Left','Right'],stairTurn:['Left','Right'],
  borderFinish:['Matching','Dark Slate'],
};
const ranges: Partial<Record<keyof DeckData, readonly [number,number]>> = {
  width:[4,60],length:[4,60],height:[8,144],width2:[4,40],length2:[4,40],height2:[8,144],
  cutoutWidth:[0,48],cutoutLength:[0,48],cutoutWidth2:[0,48],cutoutLength2:[0,48],
  foundationDepthIn:[24,144],stairWidth:[36,120],stairOffset:[0,100],inlayLf:[0,200],
  benchLf:[0,100],privacySqft:[0,500],pergolaSqft:[0,600],
  pictureFrameOverhangIn:[0,1.5],
  houseWallHeightIn:[96,240],houseDoorOffset:[0,100],houseDoorWidthIn:[30,144],level2Offset:[0,100],landingDepthIn:[36,120],
};
const booleans = ['hasInlay','hasDrainage','hasDemo','houseVisible','lightingPreviewOn'] as const;
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
  for(const [key,values] of Object.entries(enums))if(Object.hasOwn(input,key)){
    if(!values.includes(input[key] as never))throw new Error(`Unsupported ${key} selection.`);
    target[key]=input[key];
  }
  for(const [key,[min,max]] of Object.entries(ranges))if(Object.hasOwn(input,key))target[key]=numeric(input[key],min,max,key);
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
      if(item.zone!==undefined&&!(LIGHTING_ZONES as readonly unknown[]).includes(item.zone))throw new Error('Unsupported lighting installation zone.');
      if(item.auto!==undefined&&item.auto!==true)throw new Error('Invalid managed lighting flag.');
      return {productId:item.productId,qty,...(item.zone?{zone:item.zone as LightingZone}:{}),...(item.auto?{auto:true as const}:{})};
    }).filter(item=>item.qty>0)};
  }
  if(input.autoLighting!==undefined){
    const auto=input.autoLighting;if(!record(auto))throw new Error('Invalid simple lighting selection.');
    clean.autoLighting={};
    for(const key of ['posts','stairs'] as const)if(Object.hasOwn(auto,key)){
      if(typeof auto[key]!=='boolean')throw new Error('Simple lighting options must be on or off.');
      clean.autoLighting[key]=auto[key];
    }
    if(Object.hasOwn(auto,'stairStyle')){
      if(auto.stairStyle!=='evo_hyde'&&auto.stairStyle!=='evo_flex')throw new Error('Unsupported under-step light style.');
      clean.autoLighting.stairStyle=auto.stairStyle;
    }
  }
  if(input.privacyScreens!==undefined){
    if(!Array.isArray(input.privacyScreens)||input.privacyScreens.length>MAX_PRIVACY_SCREENS)throw new Error(`A design supports up to ${MAX_PRIVACY_SCREENS} privacy screens.`);
    const ids=new Set<string>();
    clean.privacyScreens=input.privacyScreens.map(s=>{
      if(!record(s)||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(s.id)||ids.has(s.id)||!(PRIVACY_SIDES as readonly unknown[]).includes(s.side)||!(PRIVACY_HEIGHTS as readonly unknown[]).includes(s.heightFt)||typeof s.lights!=='boolean')throw new Error('Invalid or duplicate privacy screen.');
      ids.add(s.id);
      const screen:PrivacyScreen={id:s.id,side:s.side as PrivacyScreen['side'],lengthFt:numeric(s.lengthFt,0,60,'Privacy screen length'),heightFt:s.heightFt as PrivacyScreen['heightFt'],offsetPct:numeric(s.offsetPct,0,100,'Privacy screen position'),lights:s.lights};
      if(s.enabled!==undefined){if(typeof s.enabled!=='boolean')throw new Error('A privacy screen must be on or off.');screen.enabled=s.enabled;}
      if(s.product!==undefined&&s.product!=='slatted'){
        const product=PRIVACY_PRODUCTS.find(p=>p.id===s.product);
        if(!product)throw new Error('This privacy screen product is unavailable.');
        if(typeof s.design!=='string'||!product.designs.includes(s.design))throw new Error(`Choose a ${product.name} design.`);
        if(product.finishes.length?!product.finishes.includes(s.finish as never):s.finish!==undefined)throw new Error(`Unsupported ${product.name} finish.`);
        const panels=numeric(s.panels,1,MAX_SCREEN_PANELS,'Privacy screen panels');if(!Number.isInteger(panels))throw new Error('Privacy screen panels must be whole panels.');
        Object.assign(screen,{product:product.id,design:s.design,panels,...(s.finish!==undefined?{finish:s.finish}:{})});
      }
      return screen;
    });
    // Screens are the source of truth for the priced area; a file cannot price one area and draw another.
    clean.privacySqft=pricedPrivacyArea(clean.privacyScreens);
    if(clean.privacySqft>MAX_PRIVACY_SQFT)throw new Error(`Privacy screens can total at most ${MAX_PRIVACY_SQFT} square feet.`);
  }
  if(input.lightingZoneEnabled!==undefined){
    if(!record(input.lightingZoneEnabled))throw new Error('Invalid lighting installation zones.');
    clean.lightingZoneEnabled={};
    for(const zone of LIGHTING_ZONES)if(Object.hasOwn(input.lightingZoneEnabled,zone)){
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
    });
    if(h.floorHeightIn!==undefined)house.floorHeightIn=numeric(h.floorHeightIn,0,240,'House floor height');
    clean.houseConfig=house;
  }
  if(input.housePlacement!==undefined){
    const p=input.housePlacement;
    if(!record(p)||!['left','center','right'].includes(p.anchor as string))throw new Error('Invalid house position.');
    clean.housePlacement={anchor:p.anchor as HousePlacement['anchor'],offsetIn:numeric(p.offsetIn,-2400,2400,'House position')};
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
  // A stair side with no exposed edge (e.g. against the house) moves to the first side that has one.
  const stairSides=availableStairSides(clean);
  if(!stairSides.includes(clean.stairPosition))clean.stairPosition=stairSides[0]??'Front';
  return clean;
}

export function serializeDesign(data:DeckData):string {
  const clean=validateDesign(data);
  const configuration:Record<string,unknown>={};
  for(const key of [...Object.keys(enums),...Object.keys(ranges),...booleans,...texts,'deckingMaterial','deckingColor','lightingSystem','autoLighting','privacyScreens','catalogueRailingId','catalogueAccessories','lightingZoneEnabled','houseConfig','housePlacement','yardFeatures','terrainConfig']){
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
