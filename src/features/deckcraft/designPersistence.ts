import {validateScenePresentation} from './scenePresentation';
import {validatePoolFeatures} from './poolTypes';
import {validateStairTargets} from './stairTargets';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {assertUniqueObjectIds} from './editorOrganization';
import {pruneEdgeNames} from './edgeNames';
import {validateStairPath} from './lib/stairPath';
import {yardShapeProblem,yardShapeRunIn} from './yardShapeGeometry';
import {hardscapeProduct,hardscapeProblem,hardscapeSelection} from './hardscapeCatalogue';
import {earthworkProblem} from './yardEarthwork';
import {wallConstructionProblem} from './wallConstruction';
import {patioInlayProblem,PATIO_INLAY_LIMITS} from './patioInlays';
export {pruneEdgeNames} from './edgeNames';
import {validatePergola} from './pergolaValidation';
import {validatePermitSite} from './permitSite';
import { DEFAULT_DECK } from './defaults';
import {validateSiteModel} from './siteModel';
import {validateLandscapeObjects} from './landscapeTypes';
import {validateEditorOrganization} from './editorOrganization';
import {validateCircularArcs,arcGeometry,inspectArcShape} from './circularArcs';
import {normalizeUnderDeck} from './underDeckOptions';
import {boundaryBounds,boundaryProblem} from './lib/freeOutline';
import {validateBoardLayout} from './boardLayout';
import {validateBoundaryLocks} from './designer/boundaryDimensions';
import {EDGE_SECTION_ID,validateRailSections} from './lib/edgeSections';
import { type BoardColour, type DeckData, type DeckFinishes, type DeckInlay, type SkirtingStyle, type DoorStyle, type WindowStyle, type GarageDoorStyle, type HouseBlock, type HouseConfig, type HouseOpening, type HousePlacement, type LightingZone, type PrivacyScreen, type YardAllowances, type YardFeature, type HouseCladding, type HouseFinish } from './types';
import {availableStairSides,getHouseContact} from './houseContact';
import {getFootprint} from './lib/deckGeometry';
import {normalizeWrap,WRAP_PORCH_DEPTH_FT,WRAP_PORCH_RUN_FT,WRAP_RUN_FT,WRAP_WING_WIDTH_FT} from './lib/wrapGeometry';
import {MAX_PRIVACY_SCREENS,MAX_PRIVACY_SQFT,MAX_SCREEN_PANELS,PRIVACY_HEIGHTS,PRIVACY_PRODUCTS,PRIVACY_SIDES,pricedPrivacyArea} from './privacyScreens';

const LIGHTING_ZONES=['deck','posts','stairs','landscape','house','privacy','border'] as const satisfies readonly LightingZone[];
import {ALLOWANCE_FINISHES,PATIO_PRODUCTS,TURF_SQFT,WALL_PRODUCTS,WATER_PRODUCTS} from './yardSettings';
import {GARAGE_DOOR_STYLES,WINDOW_STYLES} from './houseOpenings';
import {clampHouseOpening,DOOR_STYLES,HOUSE_CLADDINGS,ROOF_FINISHES,ROOF_PITCH_RANGE} from './houseSettings';
import {HEX_COLOUR,HOUSE_COLOUR_FIELDS} from './houseFinishes';
import {angledStairAllowed,angledStairFits,CORNER_CHAMFER_FT,isChamferEdgeId} from './lib/cornerChamfers';
import {activeCustomFront,frontBounds,normalizeFront,outlineProblems} from './lib/customOutline';
import {darkSlateBorder,MAX_BOARD_COLOURS,parseColourRef,partAllowed} from './boardFinishes';
import {INLAY_LIMITS,validateDeckInlay} from './lib/inlayGeometry';
import {SKIRTING_EDGE,SKIRTING_LIMITS,SKIRTING_STYLES} from './skirting';
import {DECK_PARTS,pruneDeckFinishes} from './deckPartFinishes';
import {HOUSE_BLOCK_DEPTH_FT,HOUSE_BLOCK_ID,HOUSE_BLOCK_OFFSET_FT,HOUSE_BLOCK_WIDTH_FT,MAX_HOUSE_BLOCKS,normalizeHouseBlocks,openingWallId} from './houseFootprint';

export {GARAGE_DOOR_STYLES} from './houseOpenings';
import { LIGHTING_RUNTIME_CATALOGUE } from './lightingRuntimeCatalogue';
import { DECKING_CATALOGUE, RAILING_CATALOGUE, MANUFACTURER_ACCESSORIES } from './manufacturerRuntimeCatalogue';

/** A wainscot band's top above grade, inches. */
export const WAINSCOT_HEIGHT_IN=[12,72] as const;
/** Keeps the wall finishes of the walls a house has ('main-…' and each added block's): a removed block's go. */
const liveWalls=(h:HouseConfig,f:Record<string,HouseFinish>)=>Object.entries(f).filter(([id])=>id.startsWith('main-')||h.footprint?.rects.some(b=>id.startsWith(b.id+'-')));

export const DESIGN_STORAGE_KEY = 'golden-maple.deck-studio.design.v1';
export const MAX_DESIGN_BYTES = 1_000_000;
export const MAX_PUBLIC_DESIGN_BYTES = 100_000;
const enums: Partial<Record<keyof DeckData, readonly (string | number)[]>> = {
  deckType:['Attached','Freestanding','Floating','Add-on'], municipality:['Toronto','Barrie','Simcoe County','Burlington-Oakville','Rural-Other'],
  siteType:['Standard','Waterfront-Lakefront','Hillside','Urban Tight','Island-Ferry'],soilCondition:['Unknown','Sandy','Clay','Shallow Bedrock','Fill'],
  buildSeason:['Spring-Summer','Fall','Winter'],intendedLoad:['Standard','Heavy'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],
  shape:['Rectangle','L-Shape','Multi-corner','Curved','Custom'],levels:[1,2,3],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],
  framingSize:['2x8','2x10','2x12'],boardWidth:[5.5,3.5],joistSpacing:[12,16],fasteningSystem:['Face','Hidden'],pictureFrameRows:[0,1,2],
  railingType:['None','Wood Picket','Aluminum','Cable','Glass Panels','Frameless Glass','Trex Select','Trex Transcend','Fortress AL13','TT Classic','TT Impression'],
  stairFlights:[0,1,2,3],stairType:['Straight','Winder','Landing'],stairPosition:['Front','Left','Right','Back'],
  sceneLighting:['Daylight','Evening'],level2Position:['Front','Left','Right'],stairTurn:['Left','Right'],
  borderFinish:['Matching','Dark Slate'],
  glassMount:['Top-mount base shoe','Fascia-mount base shoe','Spigots'],glassFinish:['Black','Silver'],
};
const ranges: Partial<Record<keyof DeckData, readonly [number,number]>> = {
  width:[4,60],length:[4,60],height:[8,144],width2:[4,40],length2:[4,40],height2:[8,144],
  cutoutWidth:[0,48],cutoutLength:[0,48],cutoutWidth2:[0,48],cutoutLength2:[0,48],
  foundationDepthIn:[24,144],stairWidth:[36,120],stairOffset:[0,100],inlayLf:[0,200],
  stairRiserCount:[1,32],stairTreadDepthIn:[10,24],
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
  const poolsDescriptor=Object.getOwnPropertyDescriptor(input,'pools');if(poolsDescriptor){if(!('value'in poolsDescriptor)||!poolsDescriptor.enumerable)throw Error('Pool settings must be plain saved values.');if(poolsDescriptor.value!==undefined){if(!validatePoolFeatures(poolsDescriptor.value))throw Error('Invalid pool settings.');clean.pools=structuredClone(poolsDescriptor.value);}}
  if(input.siteModel!==undefined)clean.siteModel=validateSiteModel(input.siteModel);
  if(input.landscapeObjects!==undefined){if(!validateLandscapeObjects(input.landscapeObjects))throw Error('Invalid landscape objects.');clean.landscapeObjects=structuredClone(input.landscapeObjects) as NonNullable<DeckData['landscapeObjects']>;}
  if(input.editorOrganization!==undefined)clean.editorOrganization=validateEditorOrganization(input.editorOrganization);
  if(input.scenePresentation!==undefined)clean.scenePresentation=validateScenePresentation(input.scenePresentation);
  for(const [key,values] of Object.entries(enums))if(Object.hasOwn(input,key)){
    if(!values.includes(input[key] as never))throw new Error(`Unsupported ${key} selection.`);
    target[key]=input[key];
  }
  // A two-corner wrap derives its width (left wing + house + right wing), which may exceed the input range.
  const derivedWidth=record(input.wrap)&&record(input.wrap.left)&&record(input.wrap.right);
  for(const [key,[min,max]] of Object.entries(ranges))if(Object.hasOwn(input,key)){
    if((key==='stairRiserCount'||key==='stairTreadDepthIn')&&input[key]===undefined)continue;
    if(record(input.deckOutlines)&&((key==='width'||key==='length')&&input.deckOutlines.main||(key==='width2'||key==='length2')&&input.deckOutlines.second))continue;
    if(key==='width'&&derivedWidth&&!(typeof input.width==='number'&&input.width>=min&&input.width<=max))continue;
    target[key]=numeric(input[key],min,max,key);
  }
  for(const key of booleans)if(Object.hasOwn(input,key)){
    if(typeof input[key]!=='boolean')throw new Error(`${key} must be true or false.`);
    target[key]=input[key];
  }
  if(clean.stairRiserCount!==undefined&&!Number.isInteger(clean.stairRiserCount))throw new Error('Stair riser count must be a whole number.');
  if(input.stairPath!==undefined)clean.stairPath=validateStairPath(input.stairPath);
  if(Object.hasOwn(input,'underDeck')){clean.underDeck=normalizeUnderDeck(input.underDeck);clean.hasDrainage=clean.underDeck.drainage!=='none';}
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
  if(input.boardLayout!==undefined){
    const layout=validateBoardLayout(input.boardLayout,clean.boardWidth);
    for(const entry of [...layout.regions,...layout.breakers,...layout.pieces])if(entry.colour&&!partAllowed(clean,entry.colour))throw new Error(`Board-layout colour ${entry.colour} is incompatible with the selected decking material.`);
    if(layout.regions.length||layout.breakers.length||layout.pieces.length)clean.boardLayout=layout;
  }
  if(input.railSections!==undefined){const sections=validateRailSections(input.railSections);if(sections.length)clean.railSections=sections;}
  if(input.railDefault!==undefined){if(typeof input.railDefault!=='boolean')throw new Error('Default railing must be on or off.');clean.railDefault=input.railDefault;}
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
    if(!record(lighting)||!Array.isArray(lighting.selectedItems)||lighting.selectedItems.length>LIGHTING_RUNTIME_CATALOGUE.length)throw new Error('The lighting selection is invalid.');
    const seen=new Set<string>();
    clean.lightingSystem={wireDistance:numeric(lighting.wireDistance,0,500,'Wire distance'),selectedItems:lighting.selectedItems.map(item=>{
      if(!record(item)||typeof item.productId!=='string'||!LIGHTING_RUNTIME_CATALOGUE.some(p=>p.id===item.productId&&p.supported)||seen.has(item.productId))throw new Error('Unknown, unsupported or duplicate lighting product.');
      seen.add(item.productId);const qty=numeric(item.qty,0,30,'Lighting quantity');if(!Number.isInteger(qty))throw new Error('Lighting quantities must be whole numbers.');
      if(item.zone==='border'||item.zone!==undefined&&!(LIGHTING_ZONES as readonly unknown[]).includes(item.zone))throw new Error('Unsupported lighting installation zone; picture-frame lights use their dedicated option.');
      if(item.auto!==undefined&&item.auto!==true)throw new Error('Invalid managed lighting flag.');
      return {productId:item.productId,qty,...(item.zone?{zone:item.zone as LightingZone}:{}),...(item.auto?{auto:true as const}:{})};
    }).filter(item=>item.qty>0)};
  }
  if(input.autoLighting!==undefined){
    const auto=input.autoLighting;if(!record(auto))throw new Error('Invalid simple lighting selection.');
    clean.autoLighting={};
    for(const key of ['posts','stairs','border'] as const)if(Object.hasOwn(auto,key)){
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
      if(s.level!==undefined){if(![1,2,3].includes(s.level as number))throw new Error('A privacy screen level must be 1, 2 or 3.');screen.level=s.level as 1|2|3;}
      if(s.edgeId!==undefined){if(typeof s.edgeId!=='string'||!EDGE_SECTION_ID.test(s.edgeId))throw new Error('Choose an actual privacy-screen edge.');screen.edgeId=s.edgeId;}
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
    for(const [key,choices] of Object.entries({storeys:[1,2,3],roofShape:['Gable','Hip','Flat'],roofFinish:ROOF_FINISHES,cladding:HOUSE_CLADDINGS}))if(!(choices as unknown[]).includes(h[key]))throw new Error(`Unsupported house ${key}.`);
    for(const key of ['roofColor','claddingColor','trimColor'])if(typeof h[key]!=='string'||!HEX_COLOUR.test(h[key] as string))throw new Error('House colours must use six-digit hex colours.');
    // Exterior colours (appearance only) are optional; one that is there must be a six-digit hex colour.
    for(const key of HOUSE_COLOUR_FIELDS)if(h[key]!==undefined&&(typeof h[key]!=='string'||!HEX_COLOUR.test(h[key] as string)))throw new Error('House colours must use six-digit hex colours.');
    // A wall, block or whole-house finish (appearance only): a cladding and colour, a wainscot band (band=1) with its
    // height, and on a finish (band=0) its own wainscot and gable accent. A malformed one is refused.
    const look=(v:unknown,band?:number):HouseFinish&{heightIn?:number}=>{
      if(!record(v)||!HOUSE_CLADDINGS.includes(v.cladding as HouseCladding)||!HEX_COLOUR.test(v.color as string))throw new Error('Invalid house wall finish.');
      const f:HouseFinish&{heightIn?:number}={cladding:v.cladding as HouseCladding,color:v.color as string};
      if(band)f.heightIn=numeric(v.heightIn,WAINSCOT_HEIGHT_IN[0],WAINSCOT_HEIGHT_IN[1],'Wainscot height');
      else if(band===0){if(v.wainscot!==undefined)f.wainscot=look(v.wainscot,1) as HouseFinish['wainscot'];if(v.gable!==undefined)f.gable=look(v.gable);}
      return f;
    };
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
        if(r.finish!==undefined)block.finish=look(r.finish,0);
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
      if(o.style!==undefined){const garage=GARAGE_DOOR_STYLES.includes(o.style as GarageDoorStyle),door=DOOR_STYLES.includes(o.style as DoorStyle),window=WINDOW_STYLES.includes(o.style as WindowStyle);if(!garage&&!door&&!window)throw new Error('Unsupported door or window style.');if(opening.type==='Garage'&&garage)opening.style=o.style as GarageDoorStyle;if(opening.type==='Door'&&door)opening.style=o.style as DoorStyle;if(opening.type==='Window'&&window)opening.style=o.style as WindowStyle;}
      if(o.color!==undefined){if(typeof o.color!=='string'||!HEX_COLOUR.test(o.color))throw new Error('House colours must use six-digit hex colours.');opening.color=o.color;}
      return clampHouseOpening(opening,house);
    });
    if(h.floorHeightIn!==undefined)house.floorHeightIn=numeric(h.floorHeightIn,0,240,'House floor height');
    if(h.roofPitch!==undefined)house.roofPitch=numeric(h.roofPitch,ROOF_PITCH_RANGE[0],ROOF_PITCH_RANGE[1],'Roof pitch');
    if(h.ridge!==undefined){if(h.ridge!=='x'&&h.ridge!=='y')throw new Error('Unsupported roof ridge direction.');house.ridge=h.ridge;}
    for(const key of HOUSE_COLOUR_FIELDS)if(h[key]!==undefined)house[key]=h[key] as string;
    // Walls with their own finish: a wall of a block that is gone is dropped, so at most 28 (7 blocks × 4 walls) stay.
    const w=h.wallFinishes;
    if(w!==undefined){
      if(!record(w))throw new Error('Invalid house wall finish.');
      const walls=liveWalls(house,Object.fromEntries(Object.entries(w).map(([id,f])=>{if(!/^[a-z][a-zA-Z0-9]{0,15}-(front|back|left|right)$/.test(id))throw new Error('Invalid house wall finish.');return [id,look(f,0)];})));
      if(walls.length)house.wallFinishes=Object.fromEntries(walls);
    }
    if(h.wainscot!==undefined)house.wainscot=look(h.wainscot,1) as HouseConfig['wainscot'];
    if(h.gableAccent!==undefined)house.gableAccent=look(h.gableAccent);
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
  // Angled front corners: a missing or zero leg is a square corner, so {} and zeros store nothing.
  if(input.cornerChamfers!==undefined){
    const c=input.cornerChamfers;if(!record(c))throw new Error('Invalid angled corners.');
    const leg=(v:unknown,label:string)=>v===undefined||v===0?undefined:numeric(v,CORNER_CHAMFER_FT[0],CORNER_CHAMFER_FT[1],label);
    const frontLeftFt=leg(c.frontLeftFt,'Front-left angled corner'),frontRightFt=leg(c.frontRightFt,'Front-right angled corner');
    if(frontLeftFt!==undefined||frontRightFt!==undefined)clean.cornerChamfers={...(frontLeftFt!==undefined?{frontLeftFt}:{}),...(frontRightFt!==undefined?{frontRightFt}:{})};
  }
  // A custom outline's front (lib/customOutline.ts): kept on any shape but built only on 'Custom'. A custom
  // deck takes its width and depth from it and is one level.
  if(input.customFront!==undefined){
    const problems=outlineProblems(input.customFront);if(problems.length)throw new Error(`Invalid custom outline: ${problems[0]}`);
    clean.customFront=normalizeFront(input.customFront as {x:number;y:number}[]).map(p=>({x:p.x,y:p.y}));
  }
  if(input.deckOutlines!==undefined){
    if(!input.deckOutlines||typeof input.deckOutlines!=='object'||Array.isArray(input.deckOutlines))throw new Error('Invalid deck areas.');
    clean.deckOutlines={};
    for(const key of ['main','second','third'] as const){
      const points=(input.deckOutlines as NonNullable<DeckData['deckOutlines']>)[key];if(points===undefined)continue;
      if(!Array.isArray(points)||!points.every(p=>p&&typeof p.x==='number'&&typeof p.y==='number'))throw new Error('Invalid deck area points.');
      const inches=points.map(p=>({x:p.x*12,y:p.y*12})),problem=boundaryProblem(inches);if(problem)throw new Error(`Invalid deck area: ${problem}`);
      clean.deckOutlines[key]=points.map(p=>({x:p.x,y:p.y}));
      const {w,h}=boundaryBounds(inches);
      if(key==='main'){clean.width=w/12;clean.length=h/12;}else if(key==='second'){clean.width2=w/12;clean.length2=h/12;}else if(clean.level3)clean.level3={...clean.level3,widthFt:w/12,lengthFt:h/12};
    }
  }
  if(input.deckOutlineOffsets!==undefined){
    if(!input.deckOutlineOffsets||typeof input.deckOutlineOffsets!=='object'||Array.isArray(input.deckOutlineOffsets))throw new Error('Invalid deck area positions.');
    clean.deckOutlineOffsets={};
    for(const key of ['second','third'] as const){const p=(input.deckOutlineOffsets as NonNullable<DeckData['deckOutlineOffsets']>)[key];if(p===undefined)continue;
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>200||Math.abs(p.y)>200)throw new Error('Invalid deck area position.');
      clean.deckOutlineOffsets[key]={x:p.x,y:p.y};
    }
  }
  if(clean.shape==='Custom'&&!clean.deckOutlines?.main){Object.assign(clean,frontBounds(activeCustomFront(clean)!));clean.levels=1;}
  // Accent-colour boards (boardFinishes.ts): real product colours on named board places, one choice per place
  // (the last one wins). A choice whose place is gone is kept and simply not applied.
  if(input.boardColours!==undefined){
    if(!Array.isArray(input.boardColours))throw new Error('Invalid accent boards.');
    const byPlace=new Map<string,BoardColour>();
    for(const raw of input.boardColours){
      if(!record(raw)||![1,2,3].includes(raw.lv as number)||!['field','border','breaker'].includes(raw.role as string)||!['piece','course'].includes(raw.scope as string))throw new Error('Invalid accent board.');
      if(typeof raw.course!=='string'||!(/^[a-z][a-z0-9.:-]{0,40}$/.test(raw.course)||/^l[rbp]:[a-z0-9.:-]{1,396}$/.test(raw.course)))throw new Error('Invalid accent board place.');
      if(!parseColourRef(raw.colour))throw new Error('Unknown accent board colour.');
      const at=raw.scope==='piece'?Math.round(numeric(raw.at,-100000,100000,'Accent board position')*2)/2:undefined;
      const item:BoardColour={lv:raw.lv as BoardColour['lv'],role:raw.role as BoardColour['role'],scope:raw.scope as BoardColour['scope'],course:raw.course,...(at!==undefined?{at}:{}),colour:raw.colour as string};
      const key=[item.lv,item.role,item.scope,item.course,at??''].join('|');byPlace.delete(key);byPlace.set(key,item);
    }
    if(byPlace.size>MAX_BOARD_COLOURS)throw new Error(`A design holds up to ${MAX_BOARD_COLOURS} accent boards.`);
    if(byPlace.size)clean.boardColours=[...byPlace.values()];
  }
  // Strict canonical inlays; placement that does not fit remains saved for review, never silently moved.
  const inlaysDescriptor=Object.getOwnPropertyDescriptor(input,'inlays');
  if(inlaysDescriptor){
    if(!inlaysDescriptor.enumerable||!('value'in inlaysDescriptor))throw new Error('Invalid inlay list.');
    const inlays=inlaysDescriptor.value;
    if(inlays!==undefined){
      if(!Array.isArray(inlays)||Object.getPrototypeOf(inlays)!==Array.prototype||inlays.length>INLAY_LIMITS.max)throw new Error(`A design holds up to ${INLAY_LIMITS.max} inlays.`);
      const keys=Reflect.ownKeys(inlays);
      if(keys.length!==inlays.length+1||keys.some(k=>k!=='length'&&(typeof k!=='string'||!/^\d+$/.test(k))))throw new Error('Invalid inlay list.');
      const ids=new Set<string>(),list:DeckInlay[]=[];
      for(let i=0;i<inlays.length;i++){
        const entry=Object.getOwnPropertyDescriptor(inlays,String(i));
        if(!entry?.enumerable||!('value'in entry))throw new Error('Invalid inlay list.');
        const item=validateDeckInlay(entry.value);
        if(ids.has(item.id))throw new Error('Invalid repeated inlay id.');
        ids.add(item.id);list.push(item);
      }
      if(list.length)clean.inlays=list;
    }
  }
  // Skirting under the deck (skirting.ts). An open side the design no longer has (a level or landing gone) is kept
  // and simply matches nothing.
  if(input.skirting!==undefined){
    const s=input.skirting;
    if(!record(s)||!SKIRTING_STYLES.includes(s.style as SkirtingStyle))throw new Error('Invalid skirting style.');
    if(s.colour!==undefined&&!parseColourRef(s.colour))throw new Error('Unknown skirting colour.');
    if(s.cornerTreatment!==undefined&&s.cornerTreatment!=='Folded solid boards')throw new Error('Invalid skirting corner treatment.');
    const clearanceIn=numeric(s.clearanceIn,SKIRTING_LIMITS.clearanceIn[0],SKIRTING_LIMITS.clearanceIn[1],'Skirting clearance');
    const accessPanels=s.accessPanels===undefined?0:numeric(s.accessPanels,SKIRTING_LIMITS.accessPanels[0],SKIRTING_LIMITS.accessPanels[1],'Skirting access panels');
    if(!Number.isInteger(accessPanels))throw new Error('Skirting access panels must be a whole number.');
    if(s.openEdges!==undefined&&(!Array.isArray(s.openEdges)||s.openEdges.length>SKIRTING_LIMITS.openEdges||!s.openEdges.every(e=>typeof e==='string'&&SKIRTING_EDGE.test(e))))throw new Error('Invalid skirting sides.');
    const openEdges=[...new Set((s.openEdges??[]) as string[])];
    clean.skirting={style:s.style as SkirtingStyle,...(s.colour!==undefined?{colour:s.colour as string}:{}),clearanceIn,...(openEdges.length?{openEdges}:{}),...(accessPanels?{accessPanels}:{}),...(s.cornerTreatment?{cornerTreatment:'Folded solid boards' as const}:{})};
  }
  // Deck-part finishes (deckPartFinishes.ts): real product colours for the border, fascia, stair treads and risers, and
  // a railing colour name. A malformed one is refused; one the deck or its railing can no longer take is dropped
  // quietly (pruneEdgeNames, below), and nothing set saves nothing.
  if(input.deckFinishes!==undefined){
    const f=input.deckFinishes;if(!record(f))throw new Error('Invalid deck-part finishes.');
    const finishes:DeckFinishes={};
    for(const part of DECK_PARTS)if(f[part]!==undefined){if(!parseColourRef(f[part]))throw new Error('Invalid deck-part finishes.');finishes[part]=f[part] as string;}
    if(f.railingColor!==undefined){if(typeof f.railingColor!=='string'||f.railingColor.length>60)throw new Error('Invalid deck-part finishes.');finishes.railingColor=f.railingColor;}
    clean.deckFinishes=finishes;
  }
  for(const key of ['stairEdgeId','level2EdgeId'] as const)if(input[key]!==undefined){
    if(typeof input[key]!=='string'||!/^[a-zA-Z0-9-]{1,40}$/.test(input[key] as string))throw new Error('Invalid deck edge.');
    clean[key]=input[key] as string;
  }
  if(input.level3!==undefined){
    const l=input.level3;if(!record(l)||![1,2].includes(l.parent as number)||!['Front','Left','Right'].includes(l.position as string))throw new Error('Invalid third level.');
    if(l.edgeId!==undefined&&(typeof l.edgeId!=='string'||!/^[a-zA-Z0-9-]{1,40}$/.test(l.edgeId)))throw new Error('Invalid third level edge.');
    if(l.fullStep!==undefined&&typeof l.fullStep!=='boolean')throw new Error('Invalid third level step.');
    const freeThird=clean.deckOutlines?.third&&boundaryBounds(clean.deckOutlines.third);
    clean.level3={widthFt:freeThird?freeThird.w:numeric(l.widthFt,4,40,'Third level width'),lengthFt:freeThird?freeThird.h:numeric(l.lengthFt,4,40,'Third level depth'),heightIn:numeric(l.heightIn,8,144,'Third level height'),parent:l.parent as 1|2,position:l.position as 'Front'|'Left'|'Right',offsetPct:numeric(l.offsetPct,0,100,'Third level alignment'),...(typeof l.edgeId==="string"?{edgeId:l.edgeId}:{}),...(l.fullStep?{fullStep:true}:{})};
  }
  // Three levels always carry a third section; an older file without one gets the default.
  if(clean.levels===3&&!clean.level3)clean.level3=defaultLevel3(clean);
  if(input.stairTargets!==undefined)clean.stairTargets=validateStairTargets(input.stairTargets);
  if(input.terrainConfig!==undefined){const t=input.terrainConfig;if(!record(t))throw new Error('Invalid terrain configuration.');clean.terrainConfig={widthFt:numeric(t.widthFt,20,250,'Terrain width'),depthFt:numeric(t.depthFt,20,250,'Terrain depth'),elevationIn:numeric(t.elevationIn,-120,120,'Terrain grade'),slopePct:numeric(t.slopePct,-30,30,'Terrain slope')};}
  if(input.yardEarthwork!==undefined){const problem=earthworkProblem(input.yardEarthwork);if(problem)throw Error(problem);clean.yardEarthwork={...input.yardEarthwork as object};}
  if(input.yardFeatures!==undefined){
    if(!Array.isArray(input.yardFeatures)||input.yardFeatures.length>20)throw new Error('A design supports up to 20 yard features.');
    const ids=new Set<string>();clean.yardFeatures=input.yardFeatures.map(f=>{
      if(!record(f)||typeof f.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(f.id)||ids.has(f.id)||!['patio','retaining-wall','water-feature'].includes(f.kind as string)||typeof f.name!=='string'||f.name.length>80||typeof f.enabled!=='boolean'||typeof f.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(f.color))throw new Error('Invalid or duplicate yard feature.');
      ids.add(f.id);const kind=f.kind as YardFeature['kind'];const products=kind==='patio'?PATIO_PRODUCTS:kind==='retaining-wall'?WALL_PRODUCTS:WATER_PRODUCTS;
      if(typeof f.productId!=='string'||!products.some(p=>p.id===f.productId)&&!hardscapeProduct(f.productId))throw new Error('This yard product is not supported for the selected feature.');
      const cleanFeature:YardFeature={id:f.id,kind,name:f.name,enabled:f.enabled,color:f.color,productId:f.productId,xFt:numeric(f.xFt,-150,150,'Yard position across'),zFt:numeric(f.zFt,-150,200,'Yard position out'),widthFt:numeric(f.widthFt,2,kind==='patio'?60:kind==='retaining-wall'?(Object.getOwnPropertyDescriptor(f,'wallPath')?.value!==undefined?240:80):20,'Feature width'),depthFt:numeric(f.depthFt,kind==='retaining-wall'?.01:kind==='patio'&&(Object.getOwnPropertyDescriptor(f,'stoneSteps')?.value!==undefined||Object.getOwnPropertyDescriptor(f,'stepAssembly')?.value!==undefined)?1/12:2,kind==='patio'?60:kind==='retaining-wall'?8:20,'Feature depth'),heightIn:numeric(f.heightIn,kind==='patio'?-24:6,kind==='patio'?48:kind==='retaining-wall'?72:96,'Feature height or basin depth'),rotationDeg:numeric(f.rotationDeg,0,359,'Feature rotation')};
      const baseDescriptor=Object.getOwnPropertyDescriptor(f,'baseElevationIn');if(baseDescriptor){if(!('value'in baseDescriptor)||!baseDescriptor.enumerable||kind!=='retaining-wall')throw Error('Only walls support a plain base elevation.');cleanFeature.baseElevationIn=numeric(baseDescriptor.value,-120,120,'Wall base elevation');}
      const constructionDescriptor=Object.getOwnPropertyDescriptor(f,'wallConstruction');if(constructionDescriptor){if(!('value'in constructionDescriptor)||!constructionDescriptor.enumerable)throw Error('Reinforcement inputs must use plain values.');const problem=wallConstructionProblem({...cleanFeature,wallConstruction:constructionDescriptor.value});if(problem)throw Error(problem);if(constructionDescriptor.value!==undefined)cleanFeature.wallConstruction={...constructionDescriptor.value};}
      const variantDescriptor=Object.getOwnPropertyDescriptor(f,'hardscape');if(variantDescriptor&&!('value'in variantDescriptor))throw Error('Supplier selections must use plain values.');if(variantDescriptor?.value!==undefined){const v=variantDescriptor.value;if(!record(v)||Object.getOwnPropertySymbols(v).length||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!('value'in d)||!d.enumerable)||Object.keys(v).some(k=>!['finishId','colorId','unitId','patternId','angleDeg','jointMm','capUnitId'].includes(k))||!['finishId','colorId','unitId','patternId'].every(k=>typeof v[k]==='string')||v.capUnitId!==undefined&&typeof v.capUnitId!=='string')throw Error('Invalid supplier variant.');cleanFeature.hardscape={finishId:v.finishId as string,colorId:v.colorId as string,unitId:v.unitId as string,patternId:v.patternId as string,angleDeg:numeric(v.angleDeg,0,360,'Paving direction'),jointMm:numeric(v.jointMm,0,25,'Paving joint'),...(typeof v.capUnitId==='string'?{capUnitId:v.capUnitId}:{})};}
      const variantProblem=hardscapeProblem(cleanFeature);if(variantProblem)throw Error(variantProblem);
      // Thin manufacturer veneers keep their documented depth. Generic wall inputs
      // still require at least one inch; supplier stock thickness was checked above.
      if(kind==='retaining-wall'&&cleanFeature.depthFt<1/12&&!hardscapeSelection(cleanFeature))throw Error('Generic wall depth must be at least one inch.');
      if(f.outline!==undefined||f.wallPath!==undefined){
        if(f.outline!==undefined&&kind!=='patio'||f.wallPath!==undefined&&kind!=='retaining-wall')throw Error('This yard shape is not compatible with its feature.');
        const points=f.outline??f.wallPath;let problem=yardShapeProblem(kind as 'patio'|'retaining-wall',points);if(problem==='Keep the complete wall path between 2 and 240 ft long.'&&f.curves!==undefined)problem=yardShapeProblem('retaining-wall',points,validateCircularArcs(f.curves,points as {x:number;y:number}[],false));if(problem)throw Error(problem);
        const shape=(points as {x:number;y:number}[]).map(p=>({...p}));
        if(kind==='patio'){const w=(Math.max(...shape.map(p=>p.x))-Math.min(...shape.map(p=>p.x)))/12,d=(Math.max(...shape.map(p=>p.y))-Math.min(...shape.map(p=>p.y)))/12;if(Math.abs(w-cleanFeature.widthFt)>1e-6||Math.abs(d-cleanFeature.depthFt)>1e-6)throw Error('Patio dimensions must match the saved outline.');cleanFeature.outline=shape;}
        else{if(f.curves===undefined&&Math.abs(yardShapeRunIn(shape)/12-cleanFeature.widthFt)>1e-6)throw Error('Wall run length must match the saved path.');cleanFeature.wallPath=shape;}
      }
      const inlayDescriptor=Object.getOwnPropertyDescriptor(f,'inlays');if(inlayDescriptor){if(!('value'in inlayDescriptor)||!inlayDescriptor.enumerable||kind!=='patio'||!Array.isArray(inlayDescriptor.value)||Object.getPrototypeOf(inlayDescriptor.value)!==Array.prototype||inlayDescriptor.value.length>PATIO_INLAY_LIMITS.count)throw Error('Only patios support up to 12 plain inlays.');
        const list=inlayDescriptor.value,ds=Object.getOwnPropertyDescriptors(list),seen=new Set<string>();if(Reflect.ownKeys(list).some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=list.length)))throw Error('Invalid inlay list.');
        cleanFeature.inlays=Array.from({length:list.length},(_,n)=>{const entry=ds[n];if(!entry?.enumerable||!('value'in entry))throw Error('Invalid inlay list.');const i=entry.value,problem=patioInlayProblem(i);if(problem)throw Error(problem);if(seen.has(i.id))throw Error('Duplicate patio inlay id.');seen.add(i.id);return {...i,...(i.points?{points:i.points.map((p:{x:number;y:number})=>({...p}))}:{}),hardscape:{...i.hardscape}};});
      }
      const spineDescriptor=Object.getOwnPropertyDescriptor(f,'pathSpine');if(spineDescriptor){
        // A walkway's editable centreline. Its outline above stays the construction geometry.
        const s=spineDescriptor.value,run='Keep the complete wall path between 2 and 240 ft long.';
        if(!('value'in spineDescriptor)||!spineDescriptor.enumerable||kind!=='patio'||!cleanFeature.outline||!record(s)||Object.values(Object.getOwnPropertyDescriptors(s)).some(d=>!('value'in d)||!d.enumerable)||Object.keys(s).some(k=>!['points','curves','widthIn','ends'].includes(k))||typeof s.widthIn!=='number'||!(s.widthIn>=12&&s.widthIn<=240)||s.ends!=='square'&&s.ends!=='round')throw Error('Invalid walkway centreline.');
        let problem=yardShapeProblem('retaining-wall',s.points);if(problem&&problem!==run)throw Error(problem);
        const points=(s.points as {x:number;y:number}[]).map(p=>({x:p.x,y:p.y})),curves=s.curves===undefined?undefined:validateCircularArcs(s.curves,points,false);
        if(problem&&(problem=yardShapeProblem('retaining-wall',points,curves)))throw Error(problem);
        cleanFeature.pathSpine={points,...(curves?{curves}:{}),widthIn:s.widthIn,ends:s.ends};
      }
      if(f.curves!==undefined){if(!cleanFeature.outline&&!cleanFeature.wallPath)throw Error('Circular arcs require saved canonical control points.');if(kind==='water-feature')throw Error('Water features cannot contain arcs.');const points=cleanFeature.outline??cleanFeature.wallPath??(kind==='patio'?[{x:-cleanFeature.widthFt*6,y:-cleanFeature.depthFt*6},{x:cleanFeature.widthFt*6,y:-cleanFeature.depthFt*6},{x:cleanFeature.widthFt*6,y:cleanFeature.depthFt*6},{x:-cleanFeature.widthFt*6,y:cleanFeature.depthFt*6}]:[{x:-cleanFeature.widthFt*6,y:0},{x:cleanFeature.widthFt*6,y:0}]);cleanFeature.curves=validateCircularArcs(f.curves,points,kind==='patio');inspectArcShape(points,cleanFeature.curves,kind==='patio',cleanFeature.productId==='techo-raffinato-wall'?102:undefined);if(kind==='retaining-wall'){const run=points.slice(1).reduce((sum,b,i)=>{const a=points[i],arc=cleanFeature.curves?.find(c=>c.edge===i);return sum+(arc?arcGeometry(a,b,arc.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y));},0);if(Math.abs(run/12-cleanFeature.widthFt)>1e-6)throw Error('Wall run must match its exact arcs.');}}
      for(const key of ['finishedElevationIn','patioSlope','wallTopSteps','stoneSteps','stepAssembly','pavingInterface'] as const){const d=Object.getOwnPropertyDescriptor(f,key);if(d){if(!d.enumerable||!('value'in d))throw Error('Elevation settings must use plain values.');Object.defineProperty(cleanFeature,key,{value:d.value,enumerable:true,writable:true,configurable:true});}}
      return validateYardFinishedSettings(cleanFeature);
    });
  }
  if(input.permitSite!==undefined)clean.permitSite=validatePermitSite(input.permitSite);
  if(input.yardAllowances!==undefined){
    const a=input.yardAllowances;
    if(!record(a)||!ALLOWANCE_FINISHES.some(f=>f.id===a.finish)||!['none','wood','gas'].includes(a.firePit as string)||!['none','basic','full'].includes(a.kitchen as string)||typeof a.lighting!=='boolean')throw new Error('Invalid backyard allowances.');
    clean.yardAllowances={finish:a.finish as YardAllowances['finish'],firePit:a.firePit as YardAllowances['firePit'],kitchen:a.kitchen as YardAllowances['kitchen'],turfSqft:a.turfSqft===0?0:numeric(a.turfSqft,TURF_SQFT.min,TURF_SQFT.max,'Turf area'),lighting:a.lighting};
  }
  if(input.pergola!==undefined)clean.pergola=validatePergola(input.pergola);
  // The public estimate derives railing quantity from geometry, never an imported allowance.
  clean.railingLf=0;
  // A Dark Slate border needs a border row (unless a border colour replaces it; see pruneEdgeNames).
  if(darkSlateBorder(clean))clean.pictureFrameRows=clean.pictureFrameRows===2?2:1;
  // A wrap fixes the house size and, around both corners, the deck width.
  const wrapped=normalizeWrap(clean);if(wrapped!==clean){clean.width=wrapped.width;clean.houseConfig=wrapped.houseConfig;}
  const named=pruneEdgeNames(clean);
  // A stair side with no exposed edge (e.g. against the house) moves to the first side that has one.
  const stairSides=availableStairSides(named);
  if(!stairSides.includes(named.stairPosition))named.stairPosition=stairSides[0]??'Front';
  if(input.boundaryLocks!==undefined)named.boundaryLocks=validateBoundaryLocks(input.boundaryLocks,named);
  assertUniqueObjectIds(named);
  return named;
}

/**
 * Drops a named stair or level edge the design can no longer use: an edge this outline doesn't have, or
 * one against the house; an angled corner for a stair that isn't one straight flight of up to 14 risers
 * from the main deck, or that is wider than the angled face; and any angled corner for a level. Loading
 * and every edit run it, so a choice the pickers no longer show can never stay in force.
 */
/** A third section 2 ft lower than the second, off its front, when none has been set. */
export function defaultLevel3(data:DeckData):NonNullable<DeckData['level3']>{
  return {widthFt:Math.min(40,Math.max(4,data.width2)),lengthFt:8,heightIn:Math.max(8,data.height2-24),parent:2,position:'Front',offsetPct:50};
}

export function serializeDesign(data:DeckData):string {
  const clean=validateDesign(data);
  const configuration:Record<string,unknown>={};
  for(const key of [...Object.keys(enums),...Object.keys(ranges),...booleans,...texts,'deckingMaterial','deckingColor','lightingSystem','autoLighting','privacyScreens','catalogueRailingId','catalogueAccessories','lightingZoneEnabled','houseConfig','housePlacement','wrap','cornerChamfers','stairEdgeId','stairPath','stairTargets','level2EdgeId','level3','scenePresentation','pools','siteModel','landscapeObjects','editorOrganization','yardFeatures','yardEarthwork','terrainConfig','yardAllowances','permitSite','customFront','boardColours','inlays','skirting','deckFinishes','underDeck','deckOutlines','deckOutlineOffsets','boardLayout','boundaryLocks','railSections','railDefault','pergola']){
    if(clean[key as keyof DeckData]!==undefined)configuration[key]=clean[key as keyof DeckData];
  }
  return JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration},null,2);
}

export function parseDesign(text:string):DeckData {
  if(new TextEncoder().encode(text).length>MAX_DESIGN_BYTES)throw new Error('Choose a design file smaller than 1 MB.');
  let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Choose a valid Golden Maple JSON design file.');}
  if(!record(value)||value.format!=='golden-maple-deck-design'||value.version!==1)throw new Error('This design format or version is not supported.');
  if(record(value.configuration)&&['quoteResolutions','poolQuoteInputs'].some(key=>Object.hasOwn(value.configuration as object,key)))throw new Error('Public design files cannot include private contractor quote records. Import them through Review quote costs.');
  return validateDesign(value.configuration);
}
