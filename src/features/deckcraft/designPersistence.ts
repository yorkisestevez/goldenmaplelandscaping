import { DEFAULT_DECK } from './defaults';
import { type DeckData, type DoorStyle, type GarageDoorStyle, type HouseBlock, type HouseConfig, type HouseOpening, type HousePlacement, type LightingZone, type PrivacyScreen, type YardFeature } from './types';
import {availableStairSides,getHouseContact} from './houseContact';
import {getFootprint} from './lib/deckGeometry';
import {normalizeWrap,WRAP_PORCH_DEPTH_FT,WRAP_PORCH_RUN_FT,WRAP_RUN_FT,WRAP_WING_WIDTH_FT} from './lib/wrapGeometry';
import {MAX_PRIVACY_SCREENS,MAX_PRIVACY_SQFT,MAX_SCREEN_PANELS,PRIVACY_HEIGHTS,PRIVACY_PRODUCTS,PRIVACY_SIDES,pricedPrivacyArea} from './privacyScreens';

const LIGHTING_ZONES=['deck','posts','stairs','landscape','house','privacy'] as const satisfies readonly LightingZone[];
import {PATIO_PRODUCTS,WALL_PRODUCTS,WATER_PRODUCTS} from './yardSettings';
import {clampHouseOpening,DOOR_STYLES,HOUSE_CLADDINGS,ROOF_PITCH_RANGE} from './houseSettings';
import {HOUSE_BLOCK_DEPTH_FT,HOUSE_BLOCK_ID,HOUSE_BLOCK_OFFSET_FT,HOUSE_BLOCK_WIDTH_FT,MAX_HOUSE_BLOCKS,normalizeHouseBlocks,openingWallId} from './houseFootprint';

export const GARAGE_DOOR_STYLES:readonly GarageDoorStyle[]=['Panel','Carriage','Flush','Glass'];
import { LIGHTING_CATALOGUE } from './lightingCatalogue';
import { DECKING_CATALOGUE, RAILING_CATALOGUE, MANUFACTURER_ACCESSORIES } from './manufacturerCatalog';

export const DESIGN_STORAGE_KEY = 'golden-maple.deck-studio.design.v1';
export const MAX_DESIGN_BYTES = 100_000;
const enums: Partial<Record<keyof DeckData, readonly (string | number)[]>> = {
  deckType:['Attached','Freestanding','Floating','Add-on'], municipality:['Toronto','Barrie','Simcoe County','Burlington-Oakville','Rural-Other'],
  siteType:['Standard','Waterfront-Lakefront','Hillside','Urban Tight','Island-Ferry'],soilCondition:['Unknown','Sandy','Clay','Shallow Bedrock','Fill'],
  buildSeason:['Spring-Summer','Fall','Winter'],intendedLoad:['Standard','Heavy'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],
  shape:['Rectangle','L-Shape','Multi-corner','Curved'],levels:[1,2,3],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],
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
const booleans = ['hasInlay','hasDrainage','hasDemo','houseVisible','lightingPreviewOn','level2FullStep'] as const;
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
  // A two-corner wrap derives its width (left wing + house + right wing), which may exceed the input range.
  const derivedWidth=record(input.wrap)&&record(input.wrap.left)&&record(input.wrap.right);
  for(const [key,[min,max]] of Object.entries(ranges))if(Object.hasOwn(input,key)){
    if(key==='width'&&derivedWidth&&!(typeof input.width==='number'&&input.width>=min&&input.width<=max))continue;
    target[key]=numeric(input[key],min,max,key);
  }
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
    for(const [key,choices] of Object.entries({storeys:[1,2,3],roofShape:['Gable','Hip','Flat'],roofFinish:['Shingles','Metal'],cladding:HOUSE_CLADDINGS}))if(!(choices as unknown[]).includes(h[key]))throw new Error(`Unsupported house ${key}.`);
    for(const key of ['roofColor','claddingColor','trimColor'])if(typeof h[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(h[key] as string))throw new Error('House colours must use six-digit hex colours.');
    const house:HouseConfig={widthFt:numeric(h.widthFt,12,100,'House width'),depthFt:numeric(h.depthFt,12,100,'House depth'),storeys:h.storeys as 1|2|3,storeyHeightIn:numeric(h.storeyHeightIn,96,300,'Storey height'),roofShape:h.roofShape as HouseConfig['roofShape'],roofFinish:h.roofFinish as HouseConfig['roofFinish'],roofColor:h.roofColor as string,cladding:h.cladding as HouseConfig['cladding'],claddingColor:h.claddingColor as string,trimColor:h.trimColor as string,openings:[]};
    if(h.footprint!==undefined){
      const f=h.footprint;if(!record(f)||!Array.isArray(f.rects)||f.rects.length>MAX_HOUSE_BLOCKS)throw new Error(`A house supports up to ${MAX_HOUSE_BLOCKS} added blocks.`);
      const blockIds=new Set<string>(['main']);
      const rects=f.rects.map(r=>{
        if(!record(r)||typeof r.id!=='string'||!HOUSE_BLOCK_ID.test(r.id)||blockIds.has(r.id)||!['house','garage'].includes(r.kind as string)||!['Front','Back','Left','Right'].includes(r.wall as string))throw new Error('Invalid or duplicate house block.');
        blockIds.add(r.id);
        const block:HouseBlock={id:r.id,kind:r.kind as HouseBlock['kind'],wall:r.wall as HouseBlock['wall'],offsetFt:numeric(r.offsetFt,HOUSE_BLOCK_OFFSET_FT[0],HOUSE_BLOCK_OFFSET_FT[1],'Block position'),widthFt:numeric(r.widthFt,HOUSE_BLOCK_WIDTH_FT[0],HOUSE_BLOCK_WIDTH_FT[1],'Block width'),depthFt:numeric(r.depthFt,HOUSE_BLOCK_DEPTH_FT[0],HOUSE_BLOCK_DEPTH_FT[1],'Block depth')};
        if(r.storeys!==undefined){if(![1,2,3].includes(r.storeys as number))throw new Error('Unsupported block storeys.');block.storeys=r.storeys as 1|2|3;}
        if(r.floorHeightIn!==undefined)block.floorHeightIn=numeric(r.floorHeightIn,0,240,'Block floor height');
        if(r.roofShape!==undefined){if(!['Gable','Hip','Flat'].includes(r.roofShape as string))throw new Error('Unsupported block roof.');block.roofShape=r.roofShape as HouseBlock['roofShape'];}
        return block;
      });
      if(rects.length)house.footprint={rects:normalizeHouseBlocks({...house,footprint:{rects}},Math.max(12,(Number(clean.length)||0)*12))};
    }
    if(!Array.isArray(h.openings)||h.openings.length>24)throw new Error('A house supports up to 24 openings.');
    const ids=new Set<string>();
    house.openings=h.openings.map(o=>{
      if(!record(o)||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(o.id)||ids.has(o.id)||!['Door','Window','Garage'].includes(o.type as string)||!['Front','Back','Left','Right'].includes(o.facade as string))throw new Error('Invalid or duplicate house opening.');
      ids.add(o.id);const opening:HouseOpening={id:o.id,type:o.type as HouseOpening['type'],facade:o.facade as HouseOpening['facade'],offsetPct:numeric(o.offsetPct,0,100,'Opening position'),bottomIn:numeric(o.bottomIn,0,900,'Opening bottom'),widthIn:numeric(o.widthIn,12,180,'Opening width'),heightIn:numeric(o.heightIn,12,144,'Opening height')};
      // A wall that no longer exists (its block was removed) falls back to the facade wall.
      if(o.wallId!==undefined){if(typeof o.wallId!=='string'||!/^[a-z][a-zA-Z0-9]{0,15}-(front|back|left|right)$/.test(o.wallId))throw new Error('Invalid house opening wall.');if(openingWallId({...opening,wallId:o.wallId},house)===o.wallId)opening.wallId=o.wallId;}
      // A style only applies to its own kind of opening (a garage door style on a garage door, a door style on a door).
      if(o.style!==undefined){const garage=GARAGE_DOOR_STYLES.includes(o.style as GarageDoorStyle),door=DOOR_STYLES.includes(o.style as DoorStyle);if(!garage&&!door)throw new Error('Unsupported door style.');if(opening.type==='Garage'&&garage)opening.style=o.style as GarageDoorStyle;if(opening.type==='Door'&&door)opening.style=o.style as DoorStyle;}
      return clampHouseOpening(opening,house);
    });
    if(h.floorHeightIn!==undefined)house.floorHeightIn=numeric(h.floorHeightIn,0,240,'House floor height');
    if(h.roofPitch!==undefined)house.roofPitch=numeric(h.roofPitch,ROOF_PITCH_RANGE[0],ROOF_PITCH_RANGE[1],'Roof pitch');
    if(h.ridge!==undefined){if(h.ridge!=='x'&&h.ridge!=='y')throw new Error('Unsupported roof ridge direction.');house.ridge=h.ridge;}
    clean.houseConfig=house;
  }
  if(input.housePlacement!==undefined){
    const p=input.housePlacement;
    if(!record(p)||!['left','center','right'].includes(p.anchor as string))throw new Error('Invalid house position.');
    clean.housePlacement={anchor:p.anchor as HousePlacement['anchor'],offsetIn:numeric(p.offsetIn,-2400,2400,'House position')};
  }
  if(input.wrap!==undefined){
    const w=input.wrap;if(!record(w))throw new Error('Invalid wrap-around.');
    const wing=(g:unknown,label:string)=>{
      if(g===undefined)return undefined;if(!record(g))throw new Error(`Invalid ${label.toLowerCase()} wrap wing.`);
      return {widthFt:numeric(g.widthFt,WRAP_WING_WIDTH_FT[0],WRAP_WING_WIDTH_FT[1],`${label} wing width`),runFt:numeric(g.runFt,WRAP_RUN_FT[0],WRAP_RUN_FT[1],`${label} wing run`)};
    };
    const left=wing(w.left,'Left'),right=wing(w.right,'Right');
    const porch=(g:unknown,label:string,wingOn:boolean)=>{
      if(g===undefined)return undefined;if(!record(g))throw new Error(`Invalid ${label.toLowerCase()} porch wrap.`);
      if(!wingOn)throw new Error(`A ${label.toLowerCase()} porch wrap continues the ${label.toLowerCase()} wing; add that wing first.`);
      return {depthFt:numeric(g.depthFt,WRAP_PORCH_DEPTH_FT[0],WRAP_PORCH_DEPTH_FT[1],`${label} porch depth`),runFt:numeric(g.runFt,WRAP_PORCH_RUN_FT[0],WRAP_PORCH_RUN_FT[1],`${label} porch run`)};
    };
    const porchLeft=porch(w.porchLeft,'Left',!!left),porchRight=porch(w.porchRight,'Right',!!right);
    if(left||right)clean.wrap={...(left?{left}:{}),...(right?{right}:{}),...(porchLeft?{porchLeft}:{}),...(porchRight?{porchRight}:{})};
  }
  for(const key of ['stairEdgeId','level2EdgeId'] as const)if(input[key]!==undefined){
    if(typeof input[key]!=='string'||!/^[a-zA-Z0-9-]{1,40}$/.test(input[key] as string))throw new Error('Invalid deck edge.');
    clean[key]=input[key] as string;
  }
  if(input.level3!==undefined){
    const l=input.level3;if(!record(l)||![1,2].includes(l.parent as number)||!['Front','Left','Right'].includes(l.position as string))throw new Error('Invalid third level.');
    if(l.edgeId!==undefined&&(typeof l.edgeId!=='string'||!/^[a-zA-Z0-9-]{1,40}$/.test(l.edgeId)))throw new Error('Invalid third level edge.');
    if(l.fullStep!==undefined&&typeof l.fullStep!=='boolean')throw new Error('Invalid third level step.');
    clean.level3={widthFt:numeric(l.widthFt,4,40,'Third level width'),lengthFt:numeric(l.lengthFt,4,40,'Third level depth'),heightIn:numeric(l.heightIn,8,144,'Third level height'),parent:l.parent as 1|2,position:l.position as 'Front'|'Left'|'Right',offsetPct:numeric(l.offsetPct,0,100,'Third level alignment'),...(typeof l.edgeId==="string"?{edgeId:l.edgeId}:{}),...(l.fullStep?{fullStep:true}:{})};
  }
  // Three levels always carry a third section; an older file without one gets the default.
  if(clean.levels===3&&!clean.level3)clean.level3=defaultLevel3(clean);
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
  // A wrap fixes the house size and, around both corners, the deck width.
  const wrapped=normalizeWrap(clean);if(wrapped!==clean){clean.width=wrapped.width;clean.houseConfig=wrapped.houseConfig;}
  // A named stair or level edge must be an exposed edge of this outline; otherwise the side decides.
  const namedEdgeOk=(id:string)=>{const fp=getFootprint(clean,1),contact=getHouseContact(clean,fp),i=fp.edgeIds?.indexOf(id)??-1;return i>=0&&!contact.isContactEdge(i);};
  if(clean.stairEdgeId&&!namedEdgeOk(clean.stairEdgeId))delete clean.stairEdgeId;
  if(clean.level2EdgeId&&!namedEdgeOk(clean.level2EdgeId))delete clean.level2EdgeId;
  if(clean.level3?.edgeId&&(clean.level3.parent!==1||!namedEdgeOk(clean.level3.edgeId)))delete clean.level3.edgeId;
  // A stair side with no exposed edge (e.g. against the house) moves to the first side that has one.
  const stairSides=availableStairSides(clean);
  if(!stairSides.includes(clean.stairPosition))clean.stairPosition=stairSides[0]??'Front';
  return clean;
}

/** A third section 2 ft lower than the second, off its front, when none has been set. */
export function defaultLevel3(data:DeckData):NonNullable<DeckData['level3']>{
  return {widthFt:Math.min(40,Math.max(4,data.width2)),lengthFt:8,heightIn:Math.max(8,data.height2-24),parent:2,position:'Front',offsetPct:50};
}

export function serializeDesign(data:DeckData):string {
  const clean=validateDesign(data);
  const configuration:Record<string,unknown>={};
  for(const key of [...Object.keys(enums),...Object.keys(ranges),...booleans,...texts,'deckingMaterial','deckingColor','lightingSystem','autoLighting','privacyScreens','catalogueRailingId','catalogueAccessories','lightingZoneEnabled','houseConfig','housePlacement','wrap','stairEdgeId','level2EdgeId','level3','yardFeatures','terrainConfig']){
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
