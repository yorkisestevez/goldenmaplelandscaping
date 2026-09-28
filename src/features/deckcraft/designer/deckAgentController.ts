import {validatePergola} from '../pergolaValidation';
import type {DeckData,DeckInlay,PatioInlay,BoardLayoutRegion,BoardLayoutBreaker,ColourRef} from '../types';
import {selectableBoards,emptyBoardLayout,editSelectedBoard} from './boardLayoutActions';
import {BOARD_LAYOUT_LIMITS} from '../boardLayout';
import type {EstimateResult} from '../calculations';
import {calculateDeckReleaseEstimate,deckReleaseData,parseDeckReleaseDesign} from '../deckRelease';
import {DECKING_CATALOGUE,RAILING_CATALOGUE,MANUFACTURER_ACCESSORIES} from '../manufacturerCatalog';
import {LIGHTING_CATALOGUE} from '../lightingCatalogue';
import {PRICE_BOOK} from '../priceBook';
import {DEFAULT_DECK} from '../defaults';
import {encodeDesignLink} from '../designLink';
import {boundaryKey,resizeBoundaryPatch,type BoundaryLevel} from '../lib/freeOutline';
import {boundaryPatch,editableBoundaries,moveBoundary,insertBoundaryPoint,removeBoundaryPoint,boundaryProblem} from './boundaryEditMath';
import {setBoundaryDimension} from './boundaryDimensions';
import {applyComponentEdit,applyComponentBatch,listPlanComponents,type ComponentEdit,type ComponentBatchEdit} from './componentEditActions';
import {editBoardBatch} from './boardBatchActions';
import {extrasLayout} from '../extrasLayout';
import {listEdgeSections,applyEdgeSectionEdit,type EdgeSectionEdit} from './edgeSectionActions';
import {syncAutoLighting} from '../lightingSystem';
import {houseRailingReviewFlags} from '../houseRailingClearance';
import type {PreviewMode} from './constants';
import type {SectionId} from './sections';
import type {SketchDocument} from '../sketch/sketchTypes';
import {HARDSCAPE_PRODUCTS,HARDSCAPE_PATTERNS} from '../hardscapeCatalogue';
import {shapedBond} from '../hardscapeShapes';
import {yardShapeWorldPoints,yardShapePull,yardShapeInsert,yardShapeRemove,yardShapeEdit,yardShapeDimension} from '../yardShapeEditing';
import {INLAY_PRESETS,createInlayPreset} from '../lib/inlayPresets';
import {contrastColour} from '../boardFinishes';
import {yardElevationEdit} from '../yardElevations';
import {patioInlayPlans,normalizePavingAngle} from '../patioInlays';

export const AGENT_VIEWS=['plan','drawing','3d','overview','front','top','structure','hardware','foundation'] as const;
export const AGENT_SECTIONS=['house','deck','boards','stairs','lighting','extras','site','backyard','proposal'] as const;
export const AGENT_ACTIONS=['save.json','export.obj','export.dxf','proposal.open','proposal.pdf','review.open'] as const;
export type AgentAction=typeof AGENT_ACTIONS[number];
const PRIVATE_FIELDS=['quoteResolutions','pergolaQuoteCosts','customerName','projectAddress','scopeOfWork','customLaborCost','materialMarkup','customOverrides','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf','generatedImageUrl','isGeneratingImage'] as const;
export type AgentDesign=Omit<DeckData,typeof PRIVATE_FIELDS[number]>;
export interface DeckAgentHostState {data:DeckData;estimate?:EstimateResult;reviewFlags?:string[];view:PreviewMode;openSections:SectionId[];canUndo:boolean;canRedo:boolean;ready:boolean}
export interface DeckAgentHost {
  getState:()=>DeckAgentHostState;
  /** One replacement through useDeckDesign, with the page's ledger updated once. */
  commitDesign:(next:DeckData)=>void|Promise<void>;
  undo:()=>void|Promise<void>;redo:()=>void|Promise<void>;
  setView:(view:PreviewMode)=>void|Promise<void>;
  openSection:(section:SectionId)=>void|Promise<void>;
  /** Resolves only after a host render satisfies the predicate, or rejects on timeout/unmount. */
  waitForRender:(predicate:(state:DeckAgentHostState)=>boolean)=>Promise<void>;
  actions?:Partial<Record<AgentAction,()=>void|Promise<void>>>;
  shareOrigin?:string;
}
export type AgentCommand=
  |{type:'inlay.preset';presetId:string;id:string;level:1|2|3;point:{x:number;y:number}}
  |{type:'inlay.place';inlay:DeckInlay;level:1|2|3;point:{x:number;y:number}}
  |{type:'inlay.move';id:string;dxIn:number;dyIn:number}
  |{type:'inlay.rotate';id:string;rotationDeg:number}
  |{type:'inlay.remove';id:string}
  |{type:'yard.move';id:string;target:'point'|'edge'|'area';index?:number;dxIn:number;dyIn:number}
  |{type:'yard.add'|'yard.remove';id:string;index:number}
  |{type:'yard.set';id:string;points:{x:number;y:number}[]}
  |{type:'yard.dimension';id:string;index:number;lengthIn:number;angleDeg?:number}
  |{type:'yard.elevation';id:string;field:'heightIn'|'baseElevationIn';valueIn:number}
  |{type:'yard.delete';id:string}
  |{type:'yard.inlay.place';id:string;inlay:PatioInlay}
  |{type:'yard.inlay.move';id:string;inlayId:string;dxIn:number;dyIn:number}
  |{type:'yard.inlay.rotate';id:string;inlayId:string;rotationDeg:number}
  |{type:'yard.inlay.remove';id:string;inlayId:string}
  |{type:'sketch.generate';document:SketchDocument}
  |{type:'design.patch';patch:Partial<AgentDesign>;unset?:string[]}
  |{type:'design.replace';design:AgentDesign}
  |{type:'boundary.move';level:BoundaryLevel;target:'point'|'edge'|'area';index?:number;dxIn:number;dyIn:number}
  |{type:'boundary.add';level:BoundaryLevel;index:number}
  |{type:'boundary.remove';level:BoundaryLevel;index:number}
  |{type:'boundary.set';level:BoundaryLevel;points:{x:number;y:number}[]}
  |{type:'boundary.dimension';level:BoundaryLevel;index:number;lengthIn:number;angleDeg?:number}
  |{type:'boundary.lock';level:BoundaryLevel;index:number;locked:boolean}
  |{type:'edge.edit';edit:EdgeSectionEdit}
  |{type:'component.edit';id:string;edit:ComponentEdit}
  |{type:'component.batch';ids:string[];edit:ComponentBatchEdit}
  |{type:'layout.region';region:BoardLayoutRegion}
  |{type:'layout.breaker';breaker:BoardLayoutBreaker}
  |{type:'layout.board';modelLevel:number;index:number;pieceId:string;angleDeg?:number;colour?:ColourRef}
  |{type:'layout.boards';targets:{modelLevel:number;index:number}[];idPrefix:string;angleDeg?:number;colour?:ColourRef}
  |{type:'layout.remove';id:string}
  |{type:'layout.deleteBoard';modelLevel:number;index:number;replacementId:string}
  |{type:'view.set';view:PreviewMode}
  |{type:'section.open';section:SectionId}
  |{type:'history.undo'|'history.redo'}
  |{type:'action';action:AgentAction|'share.create'};
export interface AgentRequest {id:string;expectedRevision?:number;commands:AgentCommand[]}
export interface AgentSnapshot {
  version:1;revision:number;ready:boolean;design:AgentDesign;
  pricing:{currency:'CAD';priceBook:typeof PRICE_BOOK;subtotal:number;hst:number;total:number;areaSqft:number;sections:EstimateResult['sections'];complete:boolean};
  quotes:string[];issues:string[];quantities:EstimateResult['model']['quantities'];
  boundaries:ReturnType<typeof editableBoundaries>;view:PreviewMode;openSections:SectionId[];history:{canUndo:boolean;canRedo:boolean};
  yardBoundaries:{id:string;kind:string;enabled:boolean;points:{x:number;y:number}[];coordinateSpace:'world-inches'}[];
  inlayShapes:{id:string;level:number;kind:string;status:string;message?:string;outline:{x:number;y:number}[];offset:{x:number;y:number};coordinateSpace:'level-local-inches'}[];
  patioInlays:{featureId:string;id:string;status:string;message:string;outline:{x:number;y:number}[];coordinateSpace:'world-inches'}[];
  boards:ReturnType<typeof boardInventory>;
  parts:ReturnType<typeof listPlanComponents>;
  edgeSections:ReturnType<typeof listEdgeSections>;
}
export type AgentResponse={ok:true;revision:number;snapshot:AgentSnapshot;changed:boolean;replayed?:boolean;result?:{url:string};interpretation?:{warnings:string[];summary:string[]}}|{ok:false;error:{code:string;message:string};revision:number};
export interface DeckAgentController {describe:()=>ReturnType<typeof descriptor>;read:()=>AgentSnapshot;preview:(request:unknown)=>Promise<AgentResponse>;execute:(request:unknown)=>Promise<AgentResponse>;subscribe:(listener:()=>void)=>()=>void;notify:()=>void;dispose:()=>void}
export type DeckAgentApi=Pick<DeckAgentController,'describe'|'read'|'preview'|'execute'>;
class ControlError extends Error {constructor(public code:string,message:string){super(message);}}
const fail=(message:string,code='invalid_command'):never=>{throw new ControlError(code,message);};
const clone=<T,>(value:T):T=>structuredClone(value);
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(v=>freeze(v));}return value;}
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value)??'undefined';}
function publicDesign(data:DeckData):AgentDesign {const out=clone(data) as unknown as Record<string,unknown>;for(const key of PRIVATE_FIELDS)delete out[key];if(out.pergola)out.pergola=validatePergola(out.pergola);return out as unknown as AgentDesign;}

// The release parser validates values. This companion schema refuses unknown fields the importer intentionally ignores.
type Schema=true|{[key:string]:Schema}|readonly [Schema];
const fields=(names:string):Record<string,Schema>=>Object.fromEntries(names.split(' ').filter(Boolean).map(k=>[k,true]));
const point=fields('x y'),look={...fields('cladding color'),wainscot:fields('cladding color heightIn'),gable:fields('cladding color')};
const sketchSchema:Schema={version:true,shapes:[{...fields('id kind label widthFt depthFt heightIn'),points:[point]}]};
const regionSchema={...fields('id level angleDeg colour replaceBorder'),polygon:[point]} as Schema;
const breakerSchema={...fields('id level widthIn colour'),start:point,end:point};
const pieceSchema={...fields('id level cx cy lengthIn widthIn angleDeg colour sourceAngleDeg'),polygon:[point]} as Schema;
const inlaySchema:Schema={...fields('id level kind name fill frame dxFt dyFt rotationDeg widthFt depthFt frameRows pattern direction atFt boards diameterFt style'),points:[point]};
const patioInlaySchema:Schema={...fields('id name shape xIn yIn widthIn depthIn rotationDeg productId color'),points:[point],hardscape:fields('finishId colorId unitId patternId angleDeg jointMm')};
const nested:Record<string,Schema>={
  stairPath:{points:[point]},
  pergola:{...fields('productId variantId frameFinish roofFinish supplyMode xFt zFt rotationDeg louverDeg lighting'),accessories:[true],target:fields('kind level featureId'),customSize:fields('widthFt depthFt heightFt')},
  boundaryLocks:[fields('level edge dxIn dyIn')],
  boardLayout:{regions:[regionSchema],breakers:[breakerSchema],pieces:[pieceSchema]},
  deckOutlines:{main:[point],second:[point],third:[point]},deckOutlineOffsets:{second:point,third:point},
  underDeck:fields('drainage ceiling scope gravel gravelDepthIn floorMesh'),terrainConfig:fields('widthFt depthFt elevationIn slopePct'),yardAllowances:fields('finish firePit kitchen turfSqft lighting'),permitSite:fields('lotWidthFt lotDepthFt leftYardFt rearYardFt yardFaces corner'),
  yardFeatures:[{...fields('id kind name enabled xFt zFt widthFt depthFt heightIn baseElevationIn rotationDeg productId color'),outline:[point],wallPath:[point],hardscape:fields('finishId colorId unitId patternId angleDeg jointMm capUnitId'),inlays:[patioInlaySchema]}],
  houseConfig:{...fields('widthFt depthFt storeys storeyHeightIn roofShape roofFinish roofColor cladding claddingColor trimColor floorHeightIn roofPitch ridge fasciaColor soffitColor gutterColor doorColor windowColor garageDoorColor'),openings:[fields('id type facade offsetPct bottomIn widthIn heightIn wallId style color')],footprint:{rects:[{...fields('id kind wall offsetFt widthFt depthFt storeys floorHeightIn roofShape'),finish:look}]},wallFinishes:{'*':look},wainscot:fields('cladding color heightIn'),gableAccent:fields('cladding color')},
  housePlacement:fields('anchor offsetIn'),wrap:{left:fields('widthFt runFt'),right:fields('widthFt runFt'),porchLeft:fields('depthFt runFt'),porchRight:fields('depthFt runFt')},cornerChamfers:fields('frontLeftFt frontRightFt'),customFront:[point],
  boardColours:[fields('lv role scope course at colour')],inlays:[inlaySchema],
  skirting:{...fields('style colour clearanceIn accessPanels cornerTreatment'),openEdges:[true]},deckFinishes:fields('fascia treads risers border railingColor'),level3:fields('widthFt lengthFt heightIn parent position offsetPct edgeId fullStep'),
  lightingZoneEnabled:fields('deck posts stairs landscape house privacy border'),catalogueAccessories:[true],
  lightingSystem:{selectedItems:[fields('productId qty zone auto')],wireDistance:true},autoLighting:fields('posts stairs border stairStyle'),
  privacyScreens:[fields('id side lengthFt heightFt offsetPct lights enabled product design finish panels level edgeId')],
  railSections:[fields('id level edgeId startPct endPct enabled')],railDefault:true,
};
const designSchema:Record<string,Schema>={...fields('deckType municipality siteType soilCondition buildSeason intendedLoad foundation width length height cutoutWidth cutoutLength width2 length2 height2 cutoutWidth2 cutoutLength2 shape levels pattern deckingMaterial deckingColor framingSize boardWidth joistSpacing fasteningSystem pictureFrameRows hasInlay inlayLf railingType railingLf stairFlights stairWidth stairRiserCount stairTreadDepthIn stairType stairPosition stairOffset benchLf privacySqft hasDrainage hasDemo pergolaSqft stairEdgeId level2EdgeId level2FullStep lightingPreviewOn catalogueRailingId glassMount glassFinish borderFinish pictureFrameOverhangIn houseVisible houseWallHeightIn houseDoorOffset houseDoorWidthIn sceneLighting level2Position level2Offset stairTurn landingDepthIn foundationDepthIn projectKind'),...nested};
function safeTree(value:unknown,path='request',depth=0):void {
  if(depth>24)fail(`${path}: nesting exceeds 24 levels.`);
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))fail(`${path}: numbers must be finite.`);return;}
  if(!value||typeof value!=='object')fail(`${path}: use JSON values only.`);
  if(Object.getPrototypeOf(value)!==(Array.isArray(value)?Array.prototype:Object.prototype)&&Object.getPrototypeOf(value)!==null)fail(`${path}: custom prototypes are not accepted.`);
  if(Object.getOwnPropertySymbols(value).length)fail(`${path}: symbol fields are not accepted.`);
  if(Array.isArray(value)&&Object.keys(value).some(k=>!/^\d+$/.test(k)||Number(k)>=value.length))fail(`${path}: arrays cannot carry extra fields.`);
  if(Array.isArray(value)&&Object.keys(value).length!==value.length)fail(`${path}: sparse arrays are not accepted.`);
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value))){
    if(key==='length'&&Array.isArray(value))continue;
    if(['__proto__','prototype','constructor'].includes(key)||!('value' in d)||!d.enumerable)fail(`${path}.${key}: unsafe field.`);
    safeTree(d.value,`${path}.${key}`,depth+1);
  }
}
function checkSchema(value:unknown,schema:Schema,path:string):void {
  if(schema===true){if(value!==null&&typeof value==='object')fail(`${path}: expected a scalar value.`);return;}
  if(Array.isArray(schema)){if(!Array.isArray(value))fail(`${path}: expected an array.`);const values=value as unknown[];for(let i=0;i<values.length;i++)checkSchema(values[i],schema[0],`${path}[${i}]`);return;}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(`${path}: expected an object.`);
  const obj=schema as Record<string,Schema>;
  for(const [key,v] of Object.entries(value)){const sub=Object.hasOwn(obj,key)?obj[key]:Object.hasOwn(obj,'*')?obj['*']:undefined;if(!sub)fail(`${path}.${key}: unknown or private field.`);checkSchema(v,sub,`${path}.${key}`);}
}
function parseStrict(candidate:DeckData,explicit:Record<string,unknown>):DeckData {
  checkSchema(explicit,designSchema,'design');
  if(explicit.projectKind!==undefined&&explicit.projectKind!=='deck')fail('Only deck designs are supported.');
  let next:DeckData;
  // Existing job evidence is carried through privately below; public imports reject supplied quote records.
  try{next=parseDeckReleaseDesign(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:{...candidate,quoteResolutions:undefined}}));}
  catch(e){fail(e instanceof Error?e.message:'Invalid design.');}
  // An explicit input must survive the importer exactly. Reject clamping, incompatible looks, dropped options,
  // duplicate entries and derived-value contradictions; agents can omit canonical defaults instead.
  for(const [key,value] of Object.entries(explicit)){
    const clearLayout=key==='boardLayout'&&(value as DeckData['boardLayout'])?.regions.length===0&&(value as DeckData['boardLayout'])?.breakers.length===0&&(value as DeckData['boardLayout'])?.pieces.length===0&&!next!.boardLayout;
    if(!clearLayout&&canonical(value)!==canonical((next! as unknown as Record<string,unknown>)[key]))fail(`design.${key}: validation would change or discard this value; use the canonical value or omit the default.`);
  }
  // Private local fields are never supplied by commands and never changed by import defaults.
  for(const key of PRIVATE_FIELDS)if(Object.hasOwn(candidate,key))(next! as unknown as Record<string,unknown>)[key]=clone(candidate[key]);
  return next!;
}
function stabilize(data:DeckData):{data:DeckData;estimate:EstimateResult} {
  let next=deckReleaseData(data),estimate=calculateDeckReleaseEstimate(next);
  const extras=extrasLayout(next,estimate.model),items=syncAutoLighting(next,{posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length,border:extras.borderMounts.length});
  if(canonical(items)!==canonical(next.lightingSystem.selectedItems)){next={...next,lightingSystem:{...next.lightingSystem,selectedItems:items}};estimate=calculateDeckReleaseEstimate(next);}
  return {data:next,estimate};
}
function boardInventory(data:DeckData,model:EstimateResult['model']){
  return selectableBoards(data,model).map(({level,modelLevel,index,run,polygon,colour,offset,address})=>({level,modelLevel,index,angleDeg:run.angleDeg,cx:run.cx,cy:run.cy,lengthIn:run.length,widthIn:run.width??data.boardWidth,role:run.role??'field',colour,polygon,offset,address,...(run.layoutId?{layoutId:run.layoutId,layoutKind:run.layoutKind}:{}),...(run.layoutSource?{source:run.layoutSource}:{})}));
}
function snapshot(state:DeckAgentHostState,revision:number,planned?:{data:DeckData;estimate:EstimateResult}):AgentSnapshot {
  const data=planned?.data??state.data,e=planned?.estimate??state.estimate??calculateDeckReleaseEstimate(data),extras=extrasLayout(data,e.model);
  return freeze(clone({version:1 as const,revision,ready:state.ready,design:publicDesign(data),pricing:{currency:'CAD' as const,priceBook:PRICE_BOOK,subtotal:e.subtotal,hst:e.hst,total:e.total,areaSqft:e.area,sections:e.sections,complete:e.quoteRequired.length===0},quotes:e.quoteRequired,issues:[...new Set([...houseRailingReviewFlags(data,e.model,e.flags),...extras.warnings,...(planned?[]:state.reviewFlags??[])])],quantities:e.model.quantities,yardBoundaries:(data.yardFeatures??[]).filter(f=>f.kind!=='water-feature').map(f=>({id:f.id,kind:f.kind,enabled:f.enabled,points:yardShapeWorldPoints(f),coordinateSpace:'world-inches' as const})),patioInlays:(data.yardFeatures??[]).filter(f=>f.kind==='patio').flatMap(f=>patioInlayPlans(f,e.yardModel.features.find(m=>m.config.id===f.id)?.footprints??[]).map(p=>({featureId:f.id,id:p.inlay.id,status:p.status,message:p.message,outline:p.outline,coordinateSpace:'world-inches' as const}))),inlayShapes:e.model.levels.flatMap(l=>(l.inlays??[]).map(p=>({id:p.id,level:(l.index??0)+1,kind:p.kind,status:p.status,...(p.message?{message:p.message}:{}),outline:p.outline,offset:{x:l.offset.x,y:l.offset.z},coordinateSpace:'level-local-inches' as const}))),boundaries:editableBoundaries(data,e.model),boards:boardInventory(data,e.model),parts:listPlanComponents(data,e.model),edgeSections:listEdgeSections(data,e.model),view:state.view,openSections:state.openSections,history:{canUndo:state.canUndo,canRedo:state.canRedo}}));
}
const AGENT_OPTIONS={levels:[1,2,3],shape:['Rectangle','L-Shape','Multi-corner','Curved','Custom'],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],deckType:['Attached','Freestanding','Floating','Add-on'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],framingSize:['2x8','2x10','2x12'],boardWidth:[3.5,5.5],joistSpacing:[12,16],fasteningSystem:['Face','Hidden'],pictureFrameRows:[0,1,2],stairFlights:[0,1,2,3],stairType:['Straight','Winder','Landing'],stairPosition:['Front','Left','Right','Back'],sceneLighting:['Daylight','Evening'],skirtingStyles:['Horizontal boards','Vertical boards','Lattice'],cornerTreatment:['Folded solid boards'],boundaryTargets:['point','edge','area']} as const;
function descriptor(){return freeze(clone({namespace:'window.deckcraft',version:1,units:{inlays:'inlay.preset/place point uses level-local INCHES from that level boundary origin; custom points are inch offsets from inlay origin, dxFt/dyFt are feet from level centre; rotationDeg clockwise in plan',yard:'yard.move uses world inches across/out; yard.set points are world inches; patio closed outlines, wall open paths; unit sizes millimetres from catalogue; yard.elevation sets heightIn (patio surface or wall exposed height) or baseElevationIn (whole wall datum); all values inches relative to local terrain; design.patch yardFeatures selects product variants; yard.inlay.place/move use patio-local inches from patio centre before its rotation, inlay points are local offsets; yard.inlay.rotate accepts 0 through 360 degrees',design:'feet except fields explicitly named In; height/stairWidth are inches',boundaries:'inches, local x/y; offsets are world inches; dimension lengthIn and optional angleDeg; locks hold exact edge length and direction, allow translation',components:'current parts inventory IDs; component.edit action update/add-opening/duplicate/remove; opening/house/stair/screen field names explicitly identify units; generated structure is inspection only',edgeSections:'physical deck perimeter edges from edgeSections inventory; level 1..3, edgeId, startPct/endPct along polygon A to B, 0..100; rail/screen edits share visual controls',boardLayout:'level-local inches; angleDeg degrees (-360..360); modelLevel/index from the current revision-guarded boards inventory'},views:AGENT_VIEWS,sections:AGENT_SECTIONS,actions:[...AGENT_ACTIONS,'share.create'],commands:['inlay.preset','inlay.place','inlay.move','inlay.rotate','inlay.remove','yard.move','yard.add','yard.remove','yard.set','yard.dimension','yard.elevation','yard.delete','yard.inlay.place','yard.inlay.move','yard.inlay.rotate','yard.inlay.remove','edge.edit','sketch.generate','design.patch','design.replace','boundary.move','boundary.add','boundary.remove','boundary.set','boundary.dimension','boundary.lock','component.edit','component.batch','layout.region','layout.breaker','layout.board','layout.boards','layout.remove','layout.deleteBoard','view.set','section.open','history.undo','history.redo','action'],editableFields:Object.keys(designSchema),fieldSchema:designSchema,sketch:{schema:sketchSchema,units:'points: shared sketch pixels; widthFt/depthFt: feet; heightIn: inches',kinds:['house','deck','landing','stairs'],generation:'Measured local plan recognition; preview before execute. House sits above deck. Typed dimensions and labels; no handwriting OCR. Interpretation reports cleared options and unresolved geometry.'},options:AGENT_OPTIONS,catalogue:{inlayPresets:INLAY_PRESETS,hardscape:HARDSCAPE_PRODUCTS.map(p=>({...p,finishes:p.finishes.map(f=>({...f,units:f.units.map(u=>({...u,shapeBond:shapedBond(p.id,u)}))}))})),hardscapePatterns:HARDSCAPE_PATTERNS,hardscapeLibrary:'/deckcraft/hardscape-catalogue.json',decking:DECKING_CATALOGUE.map(({id,name,colors,sourceUrl,availabilityNote})=>({id,name,colors,sourceUrl,availabilityNote})),railing:RAILING_CATALOGUE,accessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported),lighting:LIGHTING_CATALOGUE.filter(p=>p.supported).map(({id,name})=>({id,name}))},limits:{commands:64,idCache:1024,ackTimeoutMs:15000,boardLayout:BOARD_LAYOUT_LIMITS},safety:{personalFields:'private and preserved',pricingOverrides:'not editable',submission:'review.open only opens the review form; sending is manual',preview:'no writes, history, autosave or actions',batch:'design edits only; one commit and one undo'}}));}
const commandSchemas:Record<string,Schema>={
  'inlay.preset':{...fields('type presetId id level'),point},'inlay.place':{type:true,inlay:inlaySchema,level:true,point},'inlay.move':fields('type id dxIn dyIn'),'inlay.rotate':fields('type id rotationDeg'),'inlay.remove':fields('type id'),
  'yard.move':fields('type id target index dxIn dyIn'),'yard.add':fields('type id index'),'yard.remove':fields('type id index'),'yard.set':{type:true,id:true,points:[point]},'yard.dimension':fields('type id index lengthIn angleDeg'),'yard.elevation':fields('type id field valueIn'),'yard.delete':fields('type id'),
  'yard.inlay.place':{type:true,id:true,inlay:patioInlaySchema},'yard.inlay.move':fields('type id inlayId dxIn dyIn'),'yard.inlay.rotate':fields('type id inlayId rotationDeg'),'yard.inlay.remove':fields('type id inlayId'),
  'edge.edit':{type:true,edit:fields('action level edgeId startPct endPct enabled heightFt id')},
  'component.edit':{type:true,id:true,edit:{action:true,fields:fields('type widthIn heightIn bottomIn offsetPct wallId widthFt depthFt offsetIn visible stairWidth stairType stairPosition stairOffset stairEdgeId side lengthFt heightFt panels enabled'),presetKey:true,wallId:true}},
  'component.batch':{type:true,ids:[true],edit:{action:true,offsetDeltaPct:true,enabled:true,fields:fields('type widthIn heightIn bottomIn offsetPct wallId lengthFt heightFt panels enabled side')}},
  'sketch.generate':{type:true,document:sketchSchema},
  'design.patch':{type:true,patch:designSchema,unset:[true]},'design.replace':{type:true,design:designSchema},
  'boundary.move':fields('type level target index dxIn dyIn'),'boundary.add':fields('type level index'),'boundary.remove':fields('type level index'),'boundary.set':{type:true,level:true,points:[point]},
  'boundary.dimension':fields('type level index lengthIn angleDeg'),'boundary.lock':fields('type level index locked'),
  'layout.region':{type:true,region:regionSchema},'layout.breaker':{type:true,breaker:breakerSchema},'layout.board':fields('type modelLevel index pieceId angleDeg colour'),'layout.remove':fields('type id'),
  'layout.boards':{type:true,targets:[fields('modelLevel index')],idPrefix:true,angleDeg:true,colour:true},
  'layout.deleteBoard':fields('type modelLevel index replacementId'),
  'view.set':fields('type view'),'section.open':fields('type section'),'history.undo':fields('type'),'history.redo':fields('type'),'action':fields('type action'),
};
function requestOf(input:unknown):AgentRequest {
  safeTree(input);if(canonical(input).length>150000)fail('Command request exceeds 150 KB.');
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Request must be an object.');
  for(const key of Object.keys(input))if(!['id','expectedRevision','commands'].includes(key))fail(`request.${key}: unknown field.`);
  const r=input as AgentRequest;
  if(typeof r.id!=='string'||!/^[A-Za-z0-9_.:-]{1,96}$/.test(r.id))fail('Provide a command id of 1–96 letters, digits, _, ., :, or -.');
  if(r.expectedRevision!==undefined&&(!Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0))fail('expectedRevision must be a nonnegative integer.');
  if(!Array.isArray(r.commands)||!r.commands.length||r.commands.length>64)fail('Provide between 1 and 64 commands.');
  for(const c of r.commands){if(!c||typeof c!=='object'||typeof c.type!=='string'||!Object.hasOwn(commandSchemas,c.type))fail('Unknown command type.');checkSchema(c,commandSchemas[c.type],'command');}
  return clone(r);
}
const isEdit=(c:AgentCommand)=>c.type.startsWith('inlay.')||c.type.startsWith('yard.')||c.type.startsWith('edge.')||c.type.startsWith('component.')||c.type==='sketch.generate'||c.type.startsWith('design.')||c.type.startsWith('boundary.')||c.type.startsWith('layout.');
async function planDesign(initial:DeckData,commands:AgentCommand[]):Promise<ReturnType<typeof stabilize>&{interpretation?:{warnings:string[];summary:string[]}}> {
  if(commands.length!==1&&commands.some(c=>c.type==='layout.deleteBoard'))fail('Delete one board per request, then read the new revision before another edit. Inventory indices cannot be reused after a deletion.');
  let data=clone(initial);
  let interpretation:{warnings:string[];summary:string[]}|undefined;
  const requireLayoutLevel=(level:number)=>{if(!calculateDeckReleaseEstimate(data).model.levels.some(l=>l.kind==='deck'&&(l.index??0)+1===level))fail('That deck level is not present. Restore or add it before editing its board layout.');};
  for(const c of commands){
    if(c.type.startsWith('inlay.')){
      const edit=c as Extract<AgentCommand,{type:'inlay.preset'|'inlay.place'|'inlay.move'|'inlay.rotate'|'inlay.remove'}>;
      const actions=await import('./inlayActions');
      const model=calculateDeckReleaseEstimate(data).model;
      let patch:Partial<DeckData>;
      if(edit.type==='inlay.preset'||edit.type==='inlay.place'){
        if(![1,2,3].includes(edit.level))fail('Choose a current deck level for this inlay.');
        const inlay=edit.type==='inlay.preset'?createInlayPreset(edit.presetId,edit.id,contrastColour(data)):edit.inlay;
        patch=actions.placeInlayPatch(data,model,inlay,edit.level,edit.point);
      }else if(edit.type==='inlay.move')patch=actions.moveInlayPatch(data,model,edit.id,edit.dxIn,edit.dyIn);
      else if(edit.type==='inlay.rotate')patch=actions.rotateInlayPatch(data,model,edit.id,edit.rotationDeg);
      else patch=actions.removeInlayPatch(data,edit.id);
      data=parseStrict({...data,...patch},JSON.parse(JSON.stringify(patch)));
    }else if(c.type.startsWith('yard.inlay.')){
      const edit=c as Extract<AgentCommand,{type:'yard.inlay.place'|'yard.inlay.move'|'yard.inlay.rotate'|'yard.inlay.remove'}>,features=data.yardFeatures??[],feature=features.find(f=>f.id===edit.id);if(!feature||feature.kind!=='patio')fail('Choose a current patio.');
      let inlays=feature!.inlays??[];
      if(edit.type==='yard.inlay.place'){if(inlays.some(i=>i.id===edit.inlay.id))fail('That patio inlay id already exists.');inlays=[...inlays,{...edit.inlay}];}
      else {if(!inlays.some(i=>i.id===edit.inlayId))fail('That patio inlay is not present.');
        if(edit.type==='yard.inlay.remove')inlays=inlays.filter(i=>i.id!==edit.inlayId);
        else if(edit.type==='yard.inlay.move'){if(![edit.dxIn,edit.dyIn].every(Number.isFinite))fail('Enter finite local inch offsets.');inlays=inlays.map(i=>i.id===edit.inlayId?{...i,xIn:i.xIn+edit.dxIn,yIn:i.yIn+edit.dyIn}:i);}
        else {if(!Number.isFinite(edit.rotationDeg)||edit.rotationDeg<0||edit.rotationDeg>360)fail('Enter a rotation between 0 and 360 degrees.');inlays=inlays.map(i=>i.id===edit.inlayId?{...i,rotationDeg:normalizePavingAngle(edit.rotationDeg)}:i);}
      }
      data=parseStrict({...data,yardFeatures:features.map(f=>f.id===edit.id?{...f,inlays}:f)},{});
    }else if(c.type.startsWith('yard.')){
      const edit=c as Extract<AgentCommand,{type:'yard.move'|'yard.add'|'yard.remove'|'yard.set'|'yard.dimension'|'yard.elevation'|'yard.delete'}>,features=data.yardFeatures??[],feature=features.find(f=>f.id===edit.id);if(!feature)fail('That yard feature is not present. Read the current design.');
      if(edit.type==='yard.delete'){data=parseStrict({...data,yardFeatures:features.filter(f=>f.id!==edit.id)},{});continue;}
      if(feature!.kind==='water-feature')fail('Direct shape editing supports patios and retaining walls.');
      let next=feature!;
      if(edit.type==='yard.move'){if(!['point','edge','area'].includes(edit.target)||edit.target!=='area'&&!Number.isInteger(edit.index))fail('Choose a current yard point, edge or whole area.');next=yardShapePull(feature!,edit.target,edit.index??0,edit.dxIn,edit.dyIn);}
      else if(edit.type==='yard.add')next=yardShapeInsert(feature!,edit.index);
      else if(edit.type==='yard.remove')next=yardShapeRemove(feature!,edit.index);
      else if(edit.type==='yard.set')next=yardShapeEdit(feature!,edit.points);
      else if(edit.type==='yard.dimension')next=yardShapeDimension(feature!,edit.index,edit.lengthIn,edit.angleDeg);
      else if(edit.type==='yard.elevation')next=yardElevationEdit(feature!,edit.field,edit.valueIn);
      data=parseStrict({...data,yardFeatures:features.map(f=>f.id===edit.id?next:f)},{});
    }else if(c.type==='edge.edit'){
      const result=applyEdgeSectionEdit(data,calculateDeckReleaseEstimate(data).model,c.edit);
      if('patch'in result)data=parseStrict({...data,...result.patch},JSON.parse(JSON.stringify(result.patch)));
      else fail(result.error);
    }else if(c.type==='sketch.generate'){
      const {parseSketchDocument,generateSketchDesign}=await import('../sketch/sketchToDesign');
      const generated=generateSketchDesign(parseSketchDocument(c.document),data);
      if(!generated.ok||!generated.patch)fail(generated.errors.join(' ')||'The sketch could not be converted.','invalid_sketch');
      // The shared converter explicitly clears obsolete geometry-bound choices. Undefined clear values belong
      // to the generated candidate, but aren't user-supplied JSON fields to the strict release parser.
      data=parseStrict({...data,...generated.patch},JSON.parse(JSON.stringify(generated.patch)));
      interpretation={warnings:[...(interpretation?.warnings??[]),...generated.warnings],summary:[...(interpretation?.summary??[]),...generated.summary]};
    }else if(c.type==='component.batch'){
      if(!Array.isArray(c.ids)||!c.ids.length||c.ids.length>64||c.ids.some(id=>typeof id!=='string'))fail('Select 1–64 current component IDs.');
      if(!c.edit||typeof c.edit!=='object'||!['update','duplicate','remove','move','distribute','screen-lights'].includes(c.edit.action))fail('Choose a supported batch part edit.');
      const allowed=c.edit.action==='update'?['action','fields']:c.edit.action==='move'?['action','offsetDeltaPct']:c.edit.action==='screen-lights'?['action','enabled']:['action'];
      if(Object.keys(c.edit).some(key=>!allowed.includes(key)))fail('Unexpected fields for this batch operation.');
      const result=applyComponentBatch(data,calculateDeckReleaseEstimate(data).model,c.ids,c.edit);
      if('error' in result)fail(result.error);
      if('patch' in result)data=parseStrict({...data,...result.patch},Object.fromEntries(Object.entries(result.patch).filter(([,v])=>v!==undefined)));
    }else if(c.type==='component.edit'){
      if(typeof c.id!=='string'||!c.edit||typeof c.edit!=='object'||!['update','add-opening','duplicate','remove'].includes(c.edit.action))fail('Supply a current part id and supported component operation.');
      const allowed=c.edit.action==='update'?['action','fields']:c.edit.action==='add-opening'?['action','presetKey','wallId']:['action'];
      if(Object.keys(c.edit).some(key=>!allowed.includes(key)))fail('Unexpected fields for this component operation.');
      const result=applyComponentEdit(data,calculateDeckReleaseEstimate(data).model,c.id,c.edit);
      if('error' in result)fail(result.error);
      if('patch' in result)data=parseStrict({...data,...result.patch},Object.fromEntries(Object.entries(result.patch).filter(([,v])=>v!==undefined)));
    }else if(c.type==='design.patch'){
      if(!c.patch||Array.isArray(c.patch))fail('patch must be an object.');
      const resized=resizeBoundaryPatch(data,c.patch),candidate={...data,...resized};
      const lockBase={...data,...(c.unset?.includes('boundaryLocks')||Object.hasOwn(c.patch,'boundaryLocks')?{boundaryLocks:undefined}: {})};
      // Generic dimension/outline patches keep the same neighboring origins and measured house as a point drag.
      // An explicit house or origin choice still wins; explicit dimensions are checked against the final boundary.
      if(resized.deckOutlines){
        const model=calculateDeckReleaseEstimate(data).model;
        for(const level of [1,2,3] as const){const key=boundaryKey(level),points=resized.deckOutlines[key];if(!points||canonical(points)===canonical(data.deckOutlines?.[key]))continue;
          const existing=editableBoundaries(data,model).find(b=>b.level===level);if(!existing)fail('That deck level is not present. Add the level before editing its boundary.');
          const preserved=boundaryPatch(lockBase,level,points.map(p=>({x:p.x*12,y:p.y*12})),existing.offset,model);if(!preserved)fail('Invalid deck boundary or measured edge lock. Unlock the edge before changing its length or direction.');
          for(const field of ['houseConfig','housePlacement','deckOutlineOffsets','boardLayout','boundaryLocks'] as const)if(!Object.hasOwn(c.patch,field)&&(preserved[field]!==undefined||field==='boundaryLocks'))(candidate as unknown as Record<string,unknown>)[field]=preserved[field];
          Object.assign(lockBase,{deckOutlines:preserved.deckOutlines,boundaryLocks:preserved.boundaryLocks});
          if(level===1){if(!Object.hasOwn(c.patch,'wrap'))delete candidate.wrap;if(!Object.hasOwn(c.patch,'cornerChamfers'))delete candidate.cornerChamfers;}
        }
      }
      for(const key of c.unset??[]){if(typeof key!=='string'||!Object.hasOwn(designSchema,key)||Object.hasOwn(DEFAULT_DECK,key)||Object.hasOwn(c.patch,key))fail('unset must name an optional editable field absent from patch.');delete (candidate as unknown as Record<string,unknown>)[key];}
      data=parseStrict(candidate,c.patch as Record<string,unknown>);
    }else if(c.type==='design.replace'){
      const candidate={...c.design} as DeckData;for(const key of PRIVATE_FIELDS)if(Object.hasOwn(data,key))(candidate as unknown as Record<string,unknown>)[key]=data[key];
      data=parseStrict(candidate,c.design as unknown as Record<string,unknown>);
    }else if(c.type.startsWith('layout.')){
      const layout=data.boardLayout??emptyBoardLayout();let patch:Partial<DeckData>;
      if(c.type==='layout.region'){const next=c.region;if(!next||typeof next!=='object')fail('Supply a layout region.');requireLayoutLevel(next.level);patch={boardLayout:{...layout,regions:layout.regions.some(r=>r.id===next.id)?layout.regions.map(r=>r.id===next.id?next:r):[...layout.regions,next]}};}
      else if(c.type==='layout.breaker'){const next=c.breaker;if(!next||typeof next!=='object')fail('Supply a layout breaker.');requireLayoutLevel(next.level);patch={boardLayout:{...layout,breakers:layout.breakers.some(b=>b.id===next.id)?layout.breakers.map(b=>b.id===next.id?next:b):[...layout.breakers,next]}};}
      else if(c.type==='layout.remove'){if(typeof c.id!=='string'||![...layout.regions,...layout.breakers,...layout.pieces].some(p=>p.id===c.id))fail('That layout id is not present.');patch={boardLayout:{regions:layout.regions.filter(r=>r.id!==c.id),breakers:layout.breakers.filter(b=>b.id!==c.id),pieces:layout.pieces.filter(p=>p.id!==c.id)}};}
      else if(c.type==='layout.deleteBoard'){
        if(!Number.isSafeInteger(c.modelLevel)||c.modelLevel<0||!Number.isSafeInteger(c.index)||c.index<0||typeof c.replacementId!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(c.replacementId))fail('Use a current board modelLevel/index and a stable replacementId.');
        const {deleteSelectedBoards}=await import('./boardRemovalActions');let sequence=0;
        patch=deleteSelectedBoards(data,calculateDeckReleaseEstimate(data).model,[{level:c.modelLevel,index:c.index}],()=>`${c.replacementId}-${++sequence}`).patch;
      }
      else if(c.type==='layout.board'){
        if(!Number.isInteger(c.modelLevel)||!Number.isInteger(c.index)||typeof c.pieceId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(c.pieceId))fail('Use current board modelLevel/index and a stable pieceId (letters, digits, _ or -).');
        const model=calculateDeckReleaseEstimate(data).model,board=selectableBoards(data,model).find(b=>b.modelLevel===c.modelLevel&&b.index===c.index);if(!board)fail('That board is not present. Read the current inventory again.');
        if(c.angleDeg===undefined&&c.colour===undefined)fail('Supply a board direction or colour.');
        if(c.angleDeg!==undefined&&(typeof c.angleDeg!=='number'||!Number.isFinite(c.angleDeg)||Math.abs(c.angleDeg)>360))fail('Board direction must be -360..360 degrees.');
        patch=editSelectedBoard(data,model,board!,c.angleDeg??board!.run.layoutSource?.angleDeg??board!.run.angleDeg,c.colour??board!.colour,c.pieceId);
      }else if(c.type==='layout.boards'){
        if(!Array.isArray(c.targets)||!c.targets.length||c.targets.length>64||c.targets.some(t=>!Number.isSafeInteger(t.modelLevel)||t.modelLevel<0||!Number.isSafeInteger(t.index)||t.index<0))fail('Select 1–64 current board inventory targets.');
        if(typeof c.idPrefix!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(c.idPrefix))fail('Use an idPrefix of 1–48 letters, digits, _ or -.');
        if(c.colour!==undefined&&typeof c.colour!=='string')fail('Use a catalogue colour reference.');
        let sequence=0;
        patch=editBoardBatch(data,calculateDeckReleaseEstimate(data).model,c.targets.map(t=>({level:t.modelLevel,index:t.index})),{angleDeg:c.angleDeg,colour:c.colour},()=>`${c.idPrefix}-${++sequence}`);
      }else fail('Unsupported layout command.');
      data=parseStrict({...data,...patch!},Object.fromEntries(Object.entries(patch!).filter(([,value])=>value!==undefined)));
    }else if(c.type.startsWith('boundary.')){
      const b=c as Extract<AgentCommand,{type:'boundary.move'|'boundary.add'|'boundary.remove'|'boundary.set'|'boundary.dimension'|'boundary.lock'}>;if(![1,2,3].includes(b.level))fail('Boundary level must be 1, 2 or 3.');
      const model=calculateDeckReleaseEstimate(data).model,current=editableBoundaries(data,model).find(v=>v.level===b.level);if(!current)fail('That deck level is not present. Add the level before editing its boundary.');
      let points=current.points;
      if(b.type==='boundary.set')points=b.points;
      else {
        if(b.type!=='boundary.move'||b.target!=='area')if(!Number.isInteger(b.index)||b.index!<0||b.index!>=points.length)fail('Boundary index is outside this polygon.');
        if(b.type==='boundary.lock'){
          if(typeof b.locked!=='boolean')fail('locked must be a boolean.');
          const patch=boundaryPatch(data,b.level,points,current.offset,model);if(!patch)fail('Invalid boundary or measured edge lock.');
          const a=points[b.index],end=points[(b.index+1)%points.length],locks=(data.boundaryLocks??[]).filter(l=>l.level!==b.level||l.edge!==b.index);
          if(b.locked)locks.push({level:b.level,edge:b.index,dxIn:end.x-a.x,dyIn:end.y-a.y});
          data=parseStrict({...data,...patch,boundaryLocks:locks},{});continue;
        }
        if(b.type==='boundary.dimension')points=setBoundaryDimension(points,b.index,b.lengthIn,b.angleDeg);
        else if(b.type==='boundary.move'){if(!['point','edge','area'].includes(b.target))fail('Unsupported boundary move target.');if(typeof b.dxIn!=='number'||typeof b.dyIn!=='number')fail('Boundary moves require dxIn and dyIn.');points=moveBoundary(points,b.target,b.index??0,b.dxIn,b.dyIn);}
        else if(b.type==='boundary.add')points=insertBoundaryPoint(points,b.index);
        else points=removeBoundaryPoint(points,b.index);
      }
      const problem=boundaryProblem(points);if(problem)fail(problem);
      const patch=boundaryPatch(data,b.level,points,current.offset,model);if(!patch)fail('Invalid boundary or measured edge lock. Unlock the edge before changing its length or direction.');
      data=parseStrict({...data,...patch},{});
    }else fail('Preview supports design edits only.');
  }
  const stable=stabilize(data),lastLighting=[...commands].reverse().find(c=>c.type==='design.replace'||c.type==='design.patch'&&Object.hasOwn(c.patch,'lightingSystem'));
  if(lastLighting){const supplied=lastLighting.type==='design.replace'?lastLighting.design.lightingSystem:lastLighting.type==='design.patch'?lastLighting.patch.lightingSystem:undefined;
    if(supplied&&canonical(supplied)!==canonical(stable.data.lightingSystem))fail('Managed lighting quantities must match the modeled mounts. Change autoLighting intent or omit managed items instead of supplying contradictory counts.');}
  return {...stable,...(interpretation?{interpretation}: {})};
}
export function createDeckAgentController(host:DeckAgentHost):DeckAgentController {
  let revision=0,fingerprint='',disposed=false,queue:Promise<unknown>=Promise.resolve();
  const listeners=new Set<()=>void>(),replays=new Map<string,{key:string;promise:Promise<AgentResponse>}>();
  const state=()=>{if(disposed)fail('Agent controller is disconnected.','disconnected');const s=host.getState(),key=canonical([s.data,s.view,s.openSections,s.canUndo,s.canRedo,s.ready]);if(fingerprint&&fingerprint!==key)revision++;fingerprint=key;return s;};
  const read=()=>snapshot(state(),revision);
  const error=(e:unknown):AgentResponse=>({ok:false,error:{code:e instanceof ControlError?e.code:'host_error',message:e instanceof Error?e.message:'Operation failed.'},revision});
  const guard=(r:AgentRequest)=>{const s=state();if(!s.ready)fail('The design is still restoring. Wait for read().ready.','not_ready');if(r.expectedRevision!==undefined&&r.expectedRevision!==revision)fail(`Expected revision ${r.expectedRevision}; current revision is ${revision}. Read and preview again.`,'stale_revision');return s;};
  const preview=async(input:unknown):Promise<AgentResponse>=>{try{const r=requestOf(input),s=guard(r),startRevision=revision,planned=await planDesign(s.data,r.commands);state();if(revision!==startRevision)fail('The design changed while the preview was generated. Read and preview again.','stale_revision');return {ok:true,revision,snapshot:snapshot(s,revision,planned),changed:canonical(s.data)!==canonical(planned.data),...(planned.interpretation?{interpretation:planned.interpretation}:{})};}catch(e){return error(e);}};
  const run=async(r:AgentRequest):Promise<AgentResponse>=>{
    try{
      const s=guard(r);let result:{url:string}|undefined,interpretation:{warnings:string[];summary:string[]}|undefined;
      if(r.commands.every(isEdit)){
        const startRevision=revision,planned=await planDesign(s.data,r.commands);state();if(revision!==startRevision)fail('The design changed while the command was prepared. Read and preview again.','stale_revision');interpretation=planned.interpretation;
        if(canonical(s.data)!==canonical(planned.data)){await host.commitDesign(clone(planned.data));await host.waitForRender(n=>canonical(n.data)===canonical(planned.data)&&n.canUndo&&!n.canRedo);}
      }else{
        if(r.commands.length!==1)fail('Batch only design, boundary and layout edits. Run navigation, history and actions separately.');
        const c=r.commands[0];
        if(c.type==='view.set'){if(!(AGENT_VIEWS as readonly unknown[]).includes(c.view))fail('Unsupported view.');await host.setView(c.view);await host.waitForRender(n=>n.view===c.view);}
        else if(c.type==='section.open'){if(!(AGENT_SECTIONS as readonly unknown[]).includes(c.section))fail('Unsupported section.');await host.openSection(c.section);await host.waitForRender(n=>n.openSections.includes(c.section));}
        else if(c.type==='history.undo'||c.type==='history.redo'){
          if(c.type==='history.undo'?!s.canUndo:!s.canRedo)fail('No history step is available.','history_empty');
          await(c.type==='history.undo'?host.undo():host.redo());await host.waitForRender(n=>canonical(n.data)!==canonical(s.data)&&(c.type==='history.undo'?n.canRedo:n.canUndo));
        }else if(c.type==='action'){
          if(c.action==='share.create')result={url:await encodeDesignLink(s.data,host.shareOrigin)};
          else {if(!(AGENT_ACTIONS as readonly unknown[]).includes(c.action))fail('Unsupported action; sending is never automated.');const action=host.actions?.[c.action];if(!action)fail('That action is unavailable in this host.','unavailable_action');await action();}
        }else fail('Unsupported command.');
      }
      const after=read();listeners.forEach(fn=>fn());return {ok:true,revision,snapshot:after,changed:canonical(s.data)!==canonical(host.getState().data),...(result?{result}:{}),...(interpretation?{interpretation}:{})};
    }catch(e){if(!disposed)state();return error(e);}
  };
  const execute=(input:unknown):Promise<AgentResponse>=>{
    let r:AgentRequest;try{r=requestOf(input);}catch(e){return Promise.resolve(error(e));}
    const key=canonical(r),prior=replays.get(r.id);
    if(prior){if(prior.key!==key)return Promise.resolve(error(new ControlError('id_conflict','This command id already belongs to a different request.')));return prior.promise.then(answer=>freeze(clone({...answer,...(answer.ok?{replayed:true}:{})})));}
    if(replays.size>=1024)return Promise.resolve(error(new ControlError('session_limit','This controller has reached 1024 command ids. Reopen the page to start a new session.')));
    const promise=queue.then(()=>run(r)).then(answer=>freeze(clone(answer)));queue=promise.catch(()=>{});
    replays.set(r.id,{key,promise});
    return promise;
  };
  state();return {describe:descriptor,read,preview,execute,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},notify:()=>{state();listeners.forEach(fn=>fn());},dispose:()=>{disposed=true;listeners.clear();}};
}
