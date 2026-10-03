import {stepAssemblySchema,stepRowEditSchema,stepControllerSchema} from '../stepAssemblySchema';
import {validatePergola} from '../pergolaValidation';
import type {ObjectEdit} from '../professionalEdits';
import type {SiteModel,SiteGradingTransition,SiteGradingRegion as GradingRegion} from '../siteModel';
import type {DeckData,DeckInlay,PatioInlay,BoardLayoutRegion,BoardLayoutBreaker,ColourRef} from '../types';
import {selectableBoards} from './boardLayoutActions';
import {BOARD_LAYOUT_LIMITS} from '../boardLayout';
import type {EstimateResult} from '../calculations';
import {calculateDeckReleaseEstimate,deckReleaseData,parseDeckReleaseDesign} from '../deckRelease';
import {DECKING_CATALOGUE,RAILING_CATALOGUE,MANUFACTURER_ACCESSORIES} from '../manufacturerCatalog';
import {LIGHTING_CATALOGUE} from '../lightingCatalogue';
import {PRICE_BOOK} from '../priceBook';
import {encodeDesignLink} from '../designLink';
import type {BoundaryLevel} from '../lib/freeOutline';
import {editableBoundaries} from './boundaryEditMath';
import {listPlanComponents,type ComponentEdit,type ComponentBatchEdit} from './componentEditActions';
import {extrasLayout} from '../extrasLayout';
import {listEdgeSections,type EdgeSectionEdit} from './edgeSectionActions';
import {syncAutoLighting} from '../lightingSystem';
import {houseRailingReviewFlags} from '../houseRailingClearance';
import type {PreviewMode} from './constants';
import type {SectionId} from './sections';
import type {SketchDocument} from '../sketch/sketchTypes';
import {HARDSCAPE_PRODUCTS,HARDSCAPE_PATTERNS,hardscapeSelection} from '../hardscapeCatalogue';
import {shapedBond} from '../hardscapeShapes';
import {yardShapeWorldPoints} from '../yardShapeGeometry';
import {INLAY_PRESETS} from '../lib/inlayPresets';
import {patioInlayPlans} from '../patioInlays';
import type {YardStarterPreset} from '../yardDesignTools';

export const AGENT_VIEWS=['plan','drawing','3d','overview','front','top','structure','hardware','foundation'] as const;
export const AGENT_SECTIONS=['house','deck','boards','stairs','lighting','extras','site','backyard','proposal'] as const;
export const AGENT_ACTIONS=['save.json','export.obj','export.dxf','export.dxf2d','permit.pdf','proposal.open','proposal.pdf','review.open'] as const;
export type AgentAction=typeof AGENT_ACTIONS[number];
const PRIVATE_FIELDS=['poolQuoteInputs','quoteResolutions','pergolaQuoteCosts','customerName','projectAddress','scopeOfWork','customLaborCost','materialMarkup','customOverrides','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf','generatedImageUrl','isGeneratingImage'] as const;
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
  |{type:'pool.create';id:string;poolType?:import('../poolTypes').PoolFeature['type'];shape?:'rectangle'|'rounded-rectangle';xIn?:number;zIn?:number;copingTopElevationIn?:number;patioId?:string}
  |{type:'pool.edit';id:string;patch:Partial<Omit<import('../poolTypes').PoolFeature,'id'|'outline'|'curves'|'depthProfile'|'product'>>}
  |{type:'pool.move';id:string;dxIn:number;dzIn:number}
  |{type:'pool.rotate';id:string;rotationDeg:number}
  |{type:'pool.delete';id:string}
  |{type:'pool.shape';id:string;outline:{x:number;y:number}[];curves?:{edge:number;bulgeIn:number}[]}
  |{type:'pool.depth';id:string;profile:{stationIn:number;depthIn:number}[]}
  |{type:'pool.radius';id:string;index:number;radiusIn:number;side?:number}
  |{type:'site.replace';site?:SiteModel}
  |{type:'site.transition';transition:SiteGradingTransition}
  |{type:'site.transition.remove';id:string}
  |{type:'site.point';id:string;xIn:number;zIn:number;elevationIn:number}
  |{type:'site.grade';region:GradingRegion}
  |{type:'site.remove';target:'point'|'grading';id:string}
  |{type:'landscape.edit';id:string;edit:import('../landscapeEdits').LandscapeEdit}
  |{type:'objects.edit';ids:string[];edit:ObjectEdit}
  |{type:'yard.radius';id:string;index:number;radiusIn:number;side?:number}
  |{type:'yard.offset';id:string;distanceIn:number}
  |{type:'inlay.preset';presetId:string;id:string;level:1|2|3;point:{x:number;y:number}}
  |{type:'inlay.place';inlay:DeckInlay;level:1|2|3;point:{x:number;y:number}}
  |{type:'inlay.move';id:string;dxIn:number;dyIn:number}
  |{type:'inlay.rotate';id:string;rotationDeg:number}
  |{type:'inlay.remove';id:string}
  |{type:'yard.move';id:string;target:'point'|'edge'|'area';index?:number;dxIn:number;dyIn:number}
  |{type:'yard.add'|'yard.remove';id:string;index:number}
  |{type:'yard.set';id:string;points:{x:number;y:number}[]}
  |{type:'yard.dimension';id:string;index:number;lengthIn:number;angleDeg?:number}
  |{type:'yard.stepAssembly';id:string;assembly:import('../stepAssembly').StepAssembly}
  |{type:'yard.stepConvert';id:string}
  |{type:'yard.stepRow';id:string;flightId:string;row:number;edit:Omit<import('../stepAssembly').StepRowOverride,'row'>}
  |{type:'yard.stoneSupport';id:string;support:NonNullable<NonNullable<import('../stoneSteps').StoneSteps['support']>>|null}
  |{type:'yard.finished';id:string;edit:import('../yardFinishedEdits').YardFinishedEdit}
  |{type:'stair.refit';flightId?:string;surface?:'terrain'|'patio';patioId?:string}
  |{type:'yard.elevation';id:string;field:'heightIn'|'baseElevationIn';valueIn:number}
  |{type:'yard.delete';id:string}
  |{type:'yard.preset';id:string;presetId:YardStarterPreset}
  |{type:'yard.curve';id:string;index:number;bulgeIn:number}
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
  yardQuantities:EstimateResult['yardModel']['quantities'];
  siteEarthwork?:{cutYd3:number;fillYd3:number;complete:boolean;uncoveredAreaSqft:number};
  gradingTransitions?:{id:string;name:string;status:string;warnings:string[];areaSqft:number;maxSlopePct:number|null;missingAreaSqft:number;minElevationIn?:number|null;maxElevationIn?:number|null}[];
  stepConstruction?:{featureId:string;quantities:Record<string,number>;warnings:string[];stockSchedule:NonNullable<EstimateResult['yardModel']['features'][number]['stockSchedule']>}[];
  poolConstruction?:{featureId:string;status:string;quantities:Record<string,number>;warnings:string[];pending:string[]}[];
  yardEarthwork:EstimateResult['yardTakeoff']['earthwork'];
  wallConstruction:{featureId:string;planning:boolean;quantities:EstimateResult['yardModel']['features'][number]['quantities'];warnings:string[];capOptions:NonNullable<ReturnType<typeof hardscapeSelection>>['caps']}[];
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
const stoneSupportSchema:Schema={...fields('kind stockWidthIn stockDepthIn stockThicknessIn jointIn productName sourceURL'),courses:[true]};
const point=fields('x y'),look={...fields('cladding color'),wainscot:fields('cladding color heightIn'),gable:fields('cladding color')};
const sketchSchema:Schema={version:true,shapes:[{...fields('id kind label widthFt depthFt heightIn'),points:[point]}]};
const regionSchema={...fields('id level angleDeg colour replaceBorder'),polygon:[point]} as Schema;
const breakerSchema={...fields('id level widthIn colour'),start:point,end:point};
const pieceSchema={...fields('id level cx cy lengthIn widthIn angleDeg colour sourceAngleDeg'),polygon:[point]} as Schema;
const inlaySchema:Schema={...fields('id level kind name fill frame dxFt dyFt rotationDeg widthFt depthFt frameRows pattern direction atFt boards diameterFt style'),points:[point]};
const patioInlaySchema:Schema={...fields('id name shape xIn yIn widthIn depthIn rotationDeg productId color'),points:[point],hardscape:fields('finishId colorId unitId patternId angleDeg jointMm')};
const poolScopes=fields('structure excavation disposal aggregate backfill coping plumbing equipment installation delivery electrical drainage site-requirements');
const poolSettings:Record<string,Schema>={...fields('name enabled type xIn zIn rotationDeg copingTopElevationIn waterOffsetIn scopeMode'),scopeOwners:poolScopes,assembly:fields('status wallThicknessIn floorThicknessIn baseDepthIn workingClearanceIn backfillMaterial collarWidthIn collarDepthIn sourceUrl sourceNote'),coping:fields('status widthIn thicknessIn overhangIn jointIn transitionJointIn stockLengthIn manufacturer productId sourceUrl verifiedForPool color settingBedThicknessIn settingBedMaterial supportSourceUrl supportNote'),serviceTrenches:[{...fields('id service widthIn depthIn'),points:[point]}]};
const poolSchema:Schema={...poolSettings,id:true,outline:[point],curves:[fields('edge bulgeIn')],depthProfile:[fields('stationIn depthIn')],product:fields('manufacturer model sourceUrl shapeSignature sourceNote')};
const transitionBoundarySchema:Schema={points:[point],curves:[fields('edge bulgeIn')],elevationSource:true,levels:[fields('stationIn elevationIn')]};
const transitionSchema:Schema={...fields('id name enabled'),a:transitionBoundarySchema,b:transitionBoundarySchema};
const nested:Record<string,Schema>={
  pools:[poolSchema],
  stairPath:{points:[point]},
  pergola:{...fields('productId variantId frameFinish roofFinish supplyMode xFt zFt rotationDeg louverDeg lighting'),accessories:[true],target:fields('kind level featureId'),customSize:fields('widthFt depthFt heightFt')},
  boundaryLocks:[fields('level edge dxIn dyIn')],
  boardLayout:{regions:[regionSchema],breakers:[breakerSchema],pieces:[pieceSchema]},
  deckOutlines:{main:[point],second:[point],third:[point]},deckOutlineOffsets:{second:point,third:point},
  scenePresentation:{...fields('viewMode cameraPreset activeCameraId'),cameras:[{...fields('id name fov'),positionIn:[true],targetIn:[true]}]},
  landscapeObjects:[{...fields('id name enabled kind assetId supportFeatureId xIn zIn rotationDeg heightIn widthIn depthIn mulchDepthIn surfaceDepthIn baseDepthIn edging'),outline:{outer:{points:[fields('x z')],segments:[{kind:true,bulgeIn:true,c1:fields('x z'),c2:fields('x z')}]},holes:[{points:[fields('x z')],segments:[{kind:true,bulgeIn:true,c1:fields('x z'),c2:fields('x z')}]}]},groundCoverOnly:true,holeEdging:true,fillSeed:fields('x z'),puttingCups:[fields('x z')],polygon:[fields('x z')],speciesRecord:{...fields('id commonName botanicalName spacingIn sourceURL spacingSourceURL sourceNote'),matureHeightIn:[true],matureSpreadIn:[true]}}],siteModel:{version:true,points:[fields('id xIn zIn elevationIn')],boundary:[point],grading:[{...fields('id name originXIn originZIn elevationIn slopeXPct slopeZPct'),boundary:[point]}],transitions:[transitionSchema],overlay:fields('attachmentId name widthPx heightPx scaleInPerPx rotationDeg originXIn originZIn')},editorOrganization:{layers:[fields('id name visible locked')],groups:[{id:true,name:true,objectIds:[true]}],objects:[fields('id layerId locked')]},
  underDeck:fields('drainage ceiling scope gravel gravelDepthIn floorMesh'),terrainConfig:fields('widthFt depthFt elevationIn slopePct'),yardEarthwork:fields('soilReusePct spoilSwellPct looseSpoilTonnesPerYd3 binPayloadTonnes binVolumeYd3'),yardAllowances:fields('finish firePit kitchen turfSqft lighting'),permitSite:fields('lotWidthFt lotDepthFt leftYardFt rearYardFt yardFaces corner'),
  stairTargets:[fields('flightId elevationIn riserCount treadDepthIn surface patioId')],
  yardFeatures:[{...fields('id kind name enabled xFt zFt widthFt depthFt heightIn baseElevationIn finishedElevationIn rotationDeg productId color'),stepAssembly:stepControllerSchema(stepAssemblySchema),patioSlope:fields('xPct zPct'),stoneSteps:{...fields('lowerElevationIn riserCount treadRunIn stockWidthIn stockDepthIn stockThicknessIn baseDepthIn settingBedIn jointIn productName sourceURL supportNote'),support:stoneSupportSchema},pavingInterface:fields('jointIn supportNote'),wallTopSteps:[fields('stationIn elevationIn')],curves:[fields('edge bulgeIn')],outline:[point],wallPath:[point],hardscape:fields('finishId colorId unitId patternId angleDeg jointMm capUnitId'),wallConstruction:fields('geogridLengthIn geogridEveryCourses foundationMode setbackPerCourseIn drainOutletCount drainOutletLengthFt drainOutletElevationIn drainOutletFallPct'),inlays:[patioInlaySchema]}],
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
  try{next=parseDeckReleaseDesign(JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:{...candidate,quoteResolutions:undefined,poolQuoteInputs:undefined}}));}
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
  return freeze(clone({version:1 as const,revision,ready:state.ready,design:publicDesign(data),pricing:{currency:'CAD' as const,priceBook:PRICE_BOOK,subtotal:e.subtotal,hst:e.hst,total:e.total,areaSqft:e.area,sections:e.sections,complete:e.quoteRequired.length===0},quotes:e.quoteRequired,issues:[...new Set([...houseRailingReviewFlags(data,e.model,e.flags),...extras.warnings,...(planned?[]:state.reviewFlags??[])])],quantities:e.model.quantities,yardQuantities:e.yardModel.quantities,...(e.yardModel.siteCutFill?{siteEarthwork:e.yardModel.siteCutFill}:{}),...(e.yardModel.siteSurface?.transitionModels?{gradingTransitions:e.yardModel.siteSurface.transitionModels.map(({id,name,status,warnings,areaSqft,maxSlopePct,missingAreaSqft,minElevationIn,maxElevationIn})=>({id,name,status,warnings,areaSqft,maxSlopePct,missingAreaSqft,...(minElevationIn!==undefined?{minElevationIn}:{}),...(maxElevationIn!==undefined?{maxElevationIn}:{})}))}:{}),...(data.pools?.length?{poolConstruction:(e.yardModel as EstimateResult['yardModel']&{pools?:import('../poolModel').PoolFeatureModel[]}).pools?.map(p=>({featureId:p.config.id,status:p.status,quantities:p.quantities,warnings:p.warnings,pending:p.pending}))??[]}:{}) ,yardEarthwork:e.yardTakeoff.earthwork,stepConstruction:e.yardModel.features.filter(f=>!f.excluded&&(f.config.stoneSteps||f.config.stepAssembly)).map(f=>({featureId:f.config.id,quantities:f.quantities,warnings:f.warnings,stockSchedule:f.stockSchedule??[]})),wallConstruction:e.yardModel.features.filter(f=>!f.excluded&&f.config.kind==='retaining-wall').map(f=>({featureId:f.config.id,planning:true,quantities:f.quantities,warnings:f.warnings,capOptions:hardscapeSelection(f.config)?.caps??[]})),yardBoundaries:(data.yardFeatures??[]).filter(f=>f.kind!=='water-feature').map(f=>({id:f.id,kind:f.kind,enabled:f.enabled,points:yardShapeWorldPoints(f),coordinateSpace:'world-inches' as const})),patioInlays:(data.yardFeatures??[]).filter(f=>f.kind==='patio').flatMap(f=>patioInlayPlans(f,e.yardModel.features.find(m=>m.config.id===f.id)?.footprints??[]).map(p=>({featureId:f.id,id:p.inlay.id,status:p.status,message:p.message,outline:p.outline,coordinateSpace:'world-inches' as const}))),inlayShapes:e.model.levels.flatMap(l=>(l.inlays??[]).map(p=>({id:p.id,level:(l.index??0)+1,kind:p.kind,status:p.status,...(p.message?{message:p.message}:{}),outline:p.outline,offset:{x:l.offset.x,y:l.offset.z},coordinateSpace:'level-local-inches' as const}))),boundaries:editableBoundaries(data,e.model),boards:boardInventory(data,e.model),parts:listPlanComponents(data,e.model),edgeSections:listEdgeSections(data,e.model),view:state.view,openSections:state.openSections,history:{canUndo:state.canUndo,canRedo:state.canRedo}}));
}
const AGENT_OPTIONS={levels:[1,2,3],shape:['Rectangle','L-Shape','Multi-corner','Curved','Custom'],pattern:['Straight','Diagonal','Picture Frame','Herringbone'],deckType:['Attached','Freestanding','Floating','Add-on'],foundation:['Concrete Piers','Helical Piles','Deck Blocks'],framingSize:['2x8','2x10','2x12'],boardWidth:[3.5,5.5],joistSpacing:[12,16],fasteningSystem:['Face','Hidden'],pictureFrameRows:[0,1,2],stairFlights:[0,1,2,3],stairType:['Straight','Winder','Landing'],stairPosition:['Front','Left','Right','Back'],sceneLighting:['Daylight','Evening'],skirtingStyles:['Horizontal boards','Vertical boards','Lattice'],cornerTreatment:['Folded solid boards'],boundaryTargets:['point','edge','area']} as const;
function descriptor(){return freeze(clone({namespace:'window.deckcraft',version:1,units:{inlays:'inlay.preset/place point uses level-local INCHES from that level boundary origin; custom points are inch offsets from inlay origin, dxFt/dyFt are feet from level centre; rotationDeg clockwise in plan',yard:'yard.preset replaces a patio outline (rectangle,chamfered,l-shape,rounded) or wall path (straight,wall-l,arc) while retaining placement and material; yard.curve bends one edge with signed midpoint bulgeIn (inches, positive to directed chord left); yard.move uses world inches across/out; yard.set points are world inches; patio closed outlines, wall open paths; unit sizes millimetres from catalogue; yard.elevation sets heightIn (patio surface or wall exposed height) or baseElevationIn (whole wall datum); legacy height/base values inches relative to local terrain. yard.finished edit pin preserves current world top, level sets absolute elevationIn (moves all wall top runs together), slope sets patio-local xPct/zPct, steps sets increasing exact-path stationIn and absolute elevationIn; fixed tops do not follow ground. stair.refit previews equal-riser fit to the full terrain or chosen patio bottom landing; apply through execute after preview; design.patch yardFeatures selects product variants; yard.inlay.place/move use patio-local inches from patio centre before its rotation, inlay points are local offsets; yard.inlay.rotate accepts 0 through 360 degrees',design:'feet except fields explicitly named In; height/stairWidth are inches',boundaries:'inches, local x/y; offsets are world inches; dimension lengthIn and optional angleDeg; locks hold exact edge length and direction, allow translation',components:'current parts inventory IDs; component.edit action update/add-opening/duplicate/remove; opening/house/stair/screen field names explicitly identify units; generated structure is inspection only',edgeSections:'physical deck perimeter edges from edgeSections inventory; level 1..3, edgeId, startPct/endPct along polygon A to B, 0..100; rail/screen edits share visual controls',boardLayout:'level-local inches; angleDeg degrees (-360..360); modelLevel/index from the current revision-guarded boards inventory'},views:AGENT_VIEWS,sections:AGENT_SECTIONS,actions:[...AGENT_ACTIONS,'share.create'],commands:['landscape.edit','pool.create','pool.edit','pool.move','pool.rotate','pool.delete','pool.shape','pool.depth','pool.radius','site.replace','site.transition','site.transition.remove','site.point','site.grade','site.remove','objects.edit','yard.radius','yard.offset','inlay.preset','inlay.place','inlay.move','inlay.rotate','inlay.remove','yard.move','yard.add','yard.remove','yard.set','yard.dimension','yard.elevation','yard.stoneSupport','yard.stepAssembly','yard.stepConvert','yard.stepRow','yard.finished','stair.refit','yard.delete','yard.preset','yard.curve','yard.inlay.place','yard.inlay.move','yard.inlay.rotate','yard.inlay.remove','edge.edit','sketch.generate','design.patch','design.replace','boundary.move','boundary.add','boundary.remove','boundary.set','boundary.dimension','boundary.lock','component.edit','component.batch','layout.region','layout.breaker','layout.board','layout.boards','layout.remove','layout.deleteBoard','view.set','section.open','history.undo','history.redo','action'],editableFields:Object.keys(designSchema),fieldSchema:designSchema,sketch:{schema:sketchSchema,units:'points: shared sketch pixels; widthFt/depthFt: feet; heightIn: inches',kinds:['house','deck','landing','stairs'],generation:'Measured local plan recognition; preview before execute. House sits above deck. Typed dimensions and labels; no handwriting OCR. Interpretation reports cleared options and unresolved geometry.'},options:AGENT_OPTIONS,catalogue:{inlayPresets:INLAY_PRESETS,hardscape:HARDSCAPE_PRODUCTS.map(p=>({...p,finishes:p.finishes.map(f=>({...f,units:f.units.map(u=>({...u,shapeBond:shapedBond(p.id,u)}))}))})),hardscapePatterns:HARDSCAPE_PATTERNS,hardscapeLibrary:'/deckcraft/hardscape-catalogue.json',decking:DECKING_CATALOGUE.map(({id,name,colors,sourceUrl,availabilityNote})=>({id,name,colors,sourceUrl,availabilityNote})),railing:RAILING_CATALOGUE,accessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported),lighting:LIGHTING_CATALOGUE.filter(p=>p.supported).map(({id,name})=>({id,name}))},limits:{commands:64,idCache:1024,ackTimeoutMs:15000,boardLayout:BOARD_LAYOUT_LIMITS},safety:{personalFields:'private and preserved',pricingOverrides:'not editable',submission:'review.open only opens the review form; sending is manual',preview:'no writes, history, autosave or actions',batch:'design edits only; one commit and one undo'}}));}
const commandSchemas:Record<string,Schema>={
  'pool.create':fields('type id poolType shape xIn zIn copingTopElevationIn patioId'),'pool.edit':{type:true,id:true,patch:poolSettings},'pool.move':fields('type id dxIn dzIn'),'pool.rotate':fields('type id rotationDeg'),'pool.delete':fields('type id'),'pool.shape':{type:true,id:true,outline:[point],curves:[fields('edge bulgeIn')]},'pool.depth':{type:true,id:true,profile:[fields('stationIn depthIn')]},'pool.radius':fields('type id index radiusIn side'),
  'site.replace':{type:true,site:designSchema.siteModel},'site.transition':{type:true,transition:transitionSchema},'site.transition.remove':fields('type id'),'site.point':fields('type id xIn zIn elevationIn'),'site.grade':{type:true,region:{...fields('id name originXIn originZIn elevationIn slopeXPct slopeZPct'),boundary:[point]}},'site.remove':fields('type target id'),  'landscape.edit':{type:true,id:true,edit:{action:true,object:designSchema.landscapeObjects instanceof Array?designSchema.landscapeObjects[0]:true,patch:designSchema.landscapeObjects instanceof Array?designSchema.landscapeObjects[0]:true,handle:fields('ring index part'),point:fields('x z'),preset:true,widthIn:true,depthIn:true,ring:true,index:true,kind:true,radiusIn:true,side:true,smoothingIn:true,points:[fields('x z')],container:[fields('x z')],convertArcs:true}},
  'objects.edit':{type:true,ids:[true],edit:fields('action dxIn dzIn angleDeg pivotXIn pivotZIn axis gridIn locked layerId name')},'yard.radius':fields('type id index radiusIn side'),'yard.offset':fields('type id distanceIn'),
  'inlay.preset':{...fields('type presetId id level'),point},'inlay.place':{type:true,inlay:inlaySchema,level:true,point},'inlay.move':fields('type id dxIn dyIn'),'inlay.rotate':fields('type id rotationDeg'),'inlay.remove':fields('type id'),
  'yard.move':fields('type id target index dxIn dyIn'),'yard.add':fields('type id index'),'yard.remove':fields('type id index'),'yard.set':{type:true,id:true,points:[point]},'yard.dimension':fields('type id index lengthIn angleDeg'),'yard.elevation':fields('type id field valueIn'),'yard.stepAssembly':{type:true,id:true,assembly:stepControllerSchema(stepAssemblySchema)},'yard.stepConvert':fields('type id'),'yard.stepRow':{...fields('type id flightId row'),edit:stepControllerSchema(stepRowEditSchema)},'yard.stoneSupport':{type:true,id:true,support:stoneSupportSchema},'yard.finished':{...fields('type id'),edit:{...fields('action elevationIn xPct zPct'),steps:[fields('stationIn elevationIn')]}},'stair.refit':fields('type flightId surface patioId'),'yard.delete':fields('type id'),'yard.preset':fields('type id presetId'),'yard.curve':fields('type id index bulgeIn'),
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
  for(const c of r.commands){if(!c||typeof c!=='object'||typeof c.type!=='string'||!Object.hasOwn(commandSchemas,c.type))fail('Unknown command type.');checkSchema(c.type==='yard.stoneSupport'&&c.support===null?{...c,support:{}}:c,commandSchemas[c.type],'command');}
  return clone(r);
}
const isEdit=(c:AgentCommand)=>c.type==='landscape.edit'||c.type==='stair.refit'||c.type.startsWith('pool.')||c.type.startsWith('site.')||c.type==='objects.edit'||c.type.startsWith('inlay.')||c.type.startsWith('yard.')||c.type.startsWith('edge.')||c.type.startsWith('component.')||c.type==='sketch.generate'||c.type.startsWith('design.')||c.type.startsWith('boundary.')||c.type.startsWith('layout.');
async function planDesign(initial:DeckData,commands:AgentCommand[]){
  const edits=await import('./deckAgentEdits');
  return edits.planDesign(initial,commands,{fail,clone,canonical,parseStrict,stabilize,designSchema,privateFields:PRIVATE_FIELDS});
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
