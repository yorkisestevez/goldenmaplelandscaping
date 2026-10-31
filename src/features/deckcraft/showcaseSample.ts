import type {DeckData,PatioInlay,YardFeature} from './types';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
import {LANDSCAPE_LIMITS} from './landscapeTypes';
import {DEFAULT_DECK} from './defaults';
import {EXTERIOR_LOOKS,applyLook} from './houseLooks';
import {getHouseConfig} from './houseSettings';
import {houseOutline} from './houseFootprint';
import {buildDeckTakeoff,guardRuns} from './deckTakeoff';
import {getFootprint,getStairPlacement} from './lib/deckGeometry';
import {stairFootprints,planGapIn,fireOutline} from './fireFeatureModel';
import {createYardFeature} from './yardCreateEdits';
import {yardShapeEdit} from './yardShapeEditing';
import {yardFeatureOutline} from './yardPathGeometry';
import {yardArea,yardClip,yardRectangle} from './yardModel';
import {createPlanningPool,poolRoundedRectangle} from './poolAssembly';
import {poolLocalBounds} from './poolGeometry';
import {newPergola} from './pergolaValidation';
import {syncAutoLighting} from './lightingSystem';
import {poolLightPlaces,lightingPlacementIssues,poolWaterRing,ringDistance} from './lightingPlacementRules';
import {POOL_LIGHT_ID} from './poolLightSpec';
import {postFacing,treadNose} from './extrasLayout';
import {newLandscapeObject,newLandscapePlant} from './landscapeCatalogue';
import {patioInlayPlans} from './patioInlays';
import {onPaving,pavingRings} from './pathLightPlacement';
import {poolOutline,poolPermanentExclusion} from './poolGeometry';
import {getLightingRuntimeProduct} from './lightingRuntimeCatalogue';
import {insidePolygon} from './lib/polygonCuts';
import {DINING_TABLES,furnitureFacingIssues,rotationDegFacing,seatFront} from './furnitureFacing';
import {CURVED_SECTIONAL,CURVED_SECTIONAL_ARC_OFFSET_IN,premiumAsset} from './premiumFurniture';
import {isWalkWidth,outdoorRoomIssues} from './outdoorRoomRules';

/**
 * The yard used for showcase stills: a two-storey contemporary house on a 100×160 ft lot. One light-slab spine steps
 * off the deck stairs (dining deck, a terrace of three framed rooms, the pool court and a fire lounge beside it),
 * wrapped in deep beds. It is a sample, not the editor's default deck. Pricing runs through the same takeoff as any
 * other design; the premium furniture is drawn but unpriced (premiumFurniture.ts).
 * Planting uses the Ontario library: cedar hedge, sugar maple, white pine, serviceberry, hydrangea, dogwood and Karl
 * Foerster, layered back to front.
 * Palette (2026 "controlled contrast"): a Caffè Crema Blu Grande field with a Greyed Nickel 6×13 band, one band width
 * everywhere; the west walks are Borealis Hazelnut Brandy plank, the third material, on walks only. `classic` keeps
 * the earlier Onyx band.
 * Rooms, each centred in its own frame:
 * - the deck: a teak eight-seat table with woven armchairs under the black LOUSOL pergola, 36 in clear behind every
 *   chair, two beam-hung infrared heaters;
 * - the terrace, split by two bands on the stair stringer lines into a west lounge (low modular sofa, two swivel
 *   chairs, a coffee table 16 in off, a 9×12 rug, lanterns), an 8 ft walk straight on from the stair, and an east
 *   outdoor kitchen (an 11 ft grill island with four stools at its raised bar);
 * - the pool court: the pool sits 3.5 ft toward the rear, so the house (sun) side is 13.5 ft deep. Two chaise pairs,
 *   30 in apart, feet to the water and 36 in or more off the coping, each with a side table and a cantilever umbrella;
 * - the fire lounge: a round sculptural gas fire bowl with a curved sectional and two swivel chairs facing it, seats
 *   39 in from the rim, side tables and lanterns, no coffee table.
 * The pool has three underwater 12 V niche lights in its house-side wall, shining away from the house; the coping is
 * not lit. Path bollards stand in the planting beds, never on paving. In-ground lights are round and flush: 22 mm
 * markers on the walked edges of the band, a 40 mm one at the stair foot, DOT 22 markers on the pool deck centred in
 * a Grande slab, and two 2 in louvered rounds grazing the front pergola posts. No light sits in a seating floor.
 * The pergola is one black LOUSOL roof on the freestanding deck, louvers open. Eight posts stand tight against the
 * outside face of each beam: the house line at 1, 8.5, 21.5 and 29 ft, clear of the slider, and the front line on the
 * four piers at 1, 10.33, 19.67 and 29 ft. Joists shift so no post clips a joist. The house front is 48 ft; the 30 ft
 * deck is centred on that wall. The house edge of the deck has no railing.
 */
const SLAB='techo-blu60-smooth-slab';
/** Caffè Crema as it reads in the photo swatch, a touch warm so the plan colour and the swatch tint agree. */
const CREMA='#d0bca4';
export type ShowcasePalette='trend-2026'|'classic';
/** The band colour. `trend-2026` is the controlled-contrast preset: Greyed Nickel on Caffè Crema. */
export const SHOWCASE_PALETTES:Record<ShowcasePalette,{colorId:string;color:string;name:string}>={
 'trend-2026':{colorId:'greyed-nickel',color:'#b8b5b1',name:'Greyed Nickel'},
 classic:{colorId:'onyx-black',color:'#565855',name:'Onyx'},
};
let band=SHOWCASE_PALETTES['trend-2026'];
const border=():YardFeature['hardscape']=>({finishId:'hd-smooth6-13',colorId:band.colorId,unitId:'standalone-6x13',patternId:'l77-linear-laying-pattern-09-100-6x13',angleDeg:0,jointMm:7});
/** Borealis plank, Hazelnut Brandy, the long side along the walk (angle 0 runs along x). */
const PLANK_PRODUCT='techo-borealis-slab',PLANK_COLOR='#8f8375';
const plank=(angleDeg:number):YardFeature['hardscape']=>({finishId:'klean-bloc-wood-texture',colorId:'hazelnut-brandy',unitId:'127-762-57-mm-127-762-57',patternId:'atlas-borealis-01',angleDeg,jointMm:0});
const FIELD:YardFeature['hardscape']={finishId:'hd-smooth-grande',colorId:'caff-crema',unitId:'grande-495-825-60',patternId:'linear-laying-pattern-05-100-blu-grande',angleDeg:0,jointMm:7};
/** One 6×13 course (330 mm) across the band, and the same reveal of field paver outside it. */
const BAND=330/25.4,MARGIN=BAND;
const BORDER_IN=BAND;
const LOT_W=100,LOT_D=160;
/** The pool's shift toward the rear of its court: 13.5 ft of deck on the house side, 6.5 ft behind. */
const POOL_SHIFT_IN=42;
const JOIN=2/12;

/** Picture-frame strips, each within the 20 ft inlay limit, on a light field. */
function borderStrips(f:YardFeature):PatioInlay[]{
 const w=f.widthFt*12,d=f.depthFt*12,b=BORDER_IN,out:PatioInlay[]=[];
 const pieces=(span:number)=>{const n=Math.ceil(span/240-1e-6),size=span/n;return Array.from({length:n},(_,i)=>({at:-span/2+size*(i+.5),size}));};
 let k=0;
 const add=(xIn:number,yIn:number,widthIn:number,depthIn:number)=>{out.push({id:`${f.id}-border-${k++}`,name:`${band.name} border`,shape:'rectangle',xIn,yIn,widthIn,depthIn,rotationDeg:0,productId:SLAB,color:band.color,hardscape:border()});};
 for(const side of [-1,1])for(const p of pieces(w))add(p.at,side*(d/2-b/2),p.size,b);
 for(const side of [-1,1])for(const p of pieces(d-2*b))add(side*(w/2-b/2),p.at,b,p.size);
 return out;
}

/** One picture frame, inset by the same margin on every side of a world-inch rectangle. Corners belong to the
 * across-yard strips so the returns meet them on a straight joint and never overlap. `dividers` are world x lines
 * where a band of the same width runs from the near strip to the far one, splitting the frame into rooms. */
function rectFrame(f:YardFeature,rect:{x0:number;x1:number;z0:number;z1:number},dividers:number[]=[]):PatioInlay[]{
 const B=BAND,M=MARGIN,cx=f.xFt*12,cz=f.zFt*12,out:PatioInlay[]=[];
 const x0=rect.x0+M,x1=rect.x1-M,z0=rect.z0+M,z1=rect.z1-M;
 if(x1-x0<=2*B+1||z1-z0<=2*B+1)throw Error(`${f.name} is too small for an even frame.`);
 let k=0;
 const cuts=(a:number,c:number)=>{const n=Math.ceil((c-a)/240-1e-9),size=(c-a)/n;return Array.from({length:n},(_,i)=>[a+size*i,a+size*(i+1)] as const);};
 const add=(ax:number,az:number,bx:number,bz:number)=>out.push({id:`${f.id}-border-${k++}`,name:`${band.name} border`,shape:'rectangle',xIn:(ax+bx)/2-cx,yIn:(az+bz)/2-cz,widthIn:bx-ax,depthIn:bz-az,rotationDeg:0,productId:SLAB,color:band.color,hardscape:border()});
 for(const [a,c] of cuts(x0,x1)){add(a,z0,c,z0+B);add(a,z1-B,c,z1);}
 for(const [a,c] of cuts(z0+B,z1-B)){add(x0,a,x0+B,c);add(x1-B,a,x1,c);for(const d of dividers)add(d,a,d+B,c);}
 return out;
}

function push(data:DeckData,feature:YardFeature){data.yardFeatures=[...(data.yardFeatures??[]),feature];return feature;}
function slab(data:DeckData,id:string,name:string,x0:number,z0:number,x1:number,z1:number,border=false,walk?:number){
 const feature=walk===undefined?{...createYardFeature(data,{kind:'patio',id,name,xFt:(x0+x1)/2,zFt:(z0+z1)/2,widthFt:x1-x0,depthFt:z1-z0,heightIn:0,productId:SLAB,hardscape:FIELD}),color:CREMA}
  :{...createYardFeature(data,{kind:'patio',id,name,xFt:(x0+x1)/2,zFt:(z0+z1)/2,widthFt:x1-x0,depthFt:z1-z0,heightIn:0,productId:PLANK_PRODUCT,hardscape:plank(walk)}),color:PLANK_COLOR};
 return push(data,border?{...feature,inlays:borderStrips(feature)}:feature);
}
function rectOf(f:YardFeature){const x=(f.xFt-f.widthFt/2)*12,z=(f.zFt-f.depthFt/2)*12,w=f.widthFt*12,d=f.depthFt*12;return [{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];}

/** Blu Grande, long side across the yard. A round paver light sits in the middle of one stone. */
const GRANDE_L=825/25.4,GRANDE_W=495/25.4,GRANDE_J=7/25.4,PAVER_DOT_R=40/25.4/2;
type PaverPin={x:number;z:number;angle:number;y?:number};
function grandeGrid(f:YardFeature){
 const turn=((f.rotationDeg??0)+(f.hardscape?.angleDeg??0))*Math.PI/180,c=Math.cos(turn),s=Math.sin(turn),pitchX=GRANDE_L+GRANDE_J,pitchZ=GRANDE_W+GRANDE_J;
 const toLocal=(x:number,z:number)=>{const dx=x-f.xFt*12,dz=z-f.zFt*12;return {x:c*dx+s*dz,z:-s*dx+c*dz};};
 const toWorld=(lx:number,lz:number)=>({x:f.xFt*12+c*lx-s*lz,z:f.zFt*12+s*lx+c*lz});
 // The housing's long axis is local +X. A yaw of −turn sends that axis along the slab.
 return {pitchX,pitchZ,toLocal,toWorld,angle:-turn};
}
function paverDotSamples(x:number,z:number){
 const out:{x:number;z:number}[]=[];
 for(let k=0;k<8;k++){const a=k/8*Math.PI*2;out.push({x:x+Math.cos(a)*PAVER_DOT_R,z:z+Math.sin(a)*PAVER_DOT_R});}
 return out;
}
const tenth=(n:number)=>Math.round(n*10)/10;
/** Move each flush lens onto the centre of one whole Grande slab, long axis with the joints, at a place `accept` allows. */
function seatOnGrande(features:YardFeature[],pools:DeckData['pools'],places:PaverPin[],blocked:{x:number;y:number}[][]=[],accept:(x:number,z:number)=>boolean=()=>true){
 const grids=features.map(f=>({...grandeGrid(f),id:f.id,rings:yardFeatureOutline(f),bands:patioInlayPlans(f).filter(p=>p.status==='ok').map(p=>p.outline)}));
 const poolEx=(pools??[]).flatMap(poolPermanentExclusion),used=new Set<string>();
 const inside=(polys:{x:number;y:number}[][],x:number,z:number)=>polys.some(poly=>poly.length>=3&&insidePolygon({x,y:z},poly));
 const clear=(g:typeof grids[number],x:number,z:number)=>accept(x,z)&&paverDotSamples(x,z).every(p=>inside(g.rings,p.x,p.z)&&!inside(g.bands,p.x,p.z)&&!inside(poolEx,p.x,p.z)&&!inside(blocked,p.x,p.z));
 return places.map(p=>{
  const g=grids.find(g=>inside(g.rings,p.x,p.z));if(!g)return p;
  const loc=g.toLocal(p.x,p.z),col0=Math.round((loc.x-GRANDE_L/2)/g.pitchX),row0=Math.round((loc.z-GRANDE_W/2)/g.pitchZ);
  let best:{d:number;x:number;z:number;key:string}|undefined;
  for(let dc=-4;dc<=4;dc++)for(let dr=-4;dr<=4;dr++){
   const col=col0+dc,row=row0+dr,key=`${g.id}:${col}:${row}`;if(used.has(key))continue;
   const w=g.toWorld(col*g.pitchX+GRANDE_L/2,row*g.pitchZ+GRANDE_W/2),d=Math.hypot(w.x-p.x,w.z-p.z);
   if(!clear(g,w.x,w.z)||best&&d>=best.d)continue;
   best={d,x:w.x,z:w.z,key};
  }
  if(!best)throw Error(`No whole Grande slab will hold a paver light near (${(p.x/12).toFixed(1)} ft, ${(p.z/12).toFixed(1)} ft).`);
  used.add(best.key);return {...p,x:tenth(best.x),z:tenth(best.z),angle:0};
 });
}

function bed(id:string,name:string,x0:number,z0:number,x1:number,z1:number):LandscapeObject{
 return polyBed(id,name,[{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}]);
}
function polyBed(id:string,name:string,points:{x:number;z:number}[]):LandscapeObject{
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 const o=newLandscapeObject('mulch-bed',id,(x0+x1)/2*12,(z0+z1)/2*12);
 return {...o,name,widthIn:(x1-x0)*12,depthIn:(z1-z0)*12,polygon:points.map(p=>({x:p.x*12,z:p.z*12}))};
}
function furn(asset:LandscapeAssetId,id:string,name:string,xFt:number,zFt:number,rotationDeg:number,support?:string):LandscapeObject{
 const o=newLandscapeObject(asset,id,xFt*12,zFt*12);
 return {...o,name,rotationDeg,...(support?{supportFeatureId:support}:{})};
}

export function ontarioShowcaseDesign({palette='trend-2026'}:{palette?:ShowcasePalette}={}):DeckData{
 band=SHOWCASE_PALETTES[palette];
 const contemporary=EXTERIOR_LOOKS.find(look=>look.id==='contemporary');
 if(!contemporary)throw Error('The contemporary exterior look is missing.');
 const house=applyLook({
  ...getHouseConfig(DEFAULT_DECK),
  widthFt:48,depthFt:34,storeys:2,storeyHeightIn:120,roofShape:'Hip',roofPitch:6,ridge:'x',floorHeightIn:36,
  footprint:{rects:[{id:'garage',kind:'garage',wall:'Back',offsetFt:24,widthFt:22,depthFt:22,storeys:1,roofShape:'Hip'}]},
  openings:[
   {id:'slider',type:'Door',facade:'Front',wallId:'main-front',style:'Sliding',offsetPct:50,bottomIn:36,widthIn:144,heightIn:96},
   {id:'front-left',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:18,bottomIn:40,widthIn:156,heightIn:108},
   {id:'front-right',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:82,bottomIn:40,widthIn:156,heightIn:108},
   {id:'upper-left',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:20,bottomIn:160,widthIn:150,heightIn:68},
   {id:'upper-center',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:50,bottomIn:160,widthIn:168,heightIn:68},
   {id:'upper-right',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:80,bottomIn:160,widthIn:150,heightIn:68},
   {id:'side-low-left',type:'Window',facade:'Left',wallId:'main-left',style:'Picture',offsetPct:34,bottomIn:40,widthIn:108,heightIn:96},
   {id:'side-low-right',type:'Window',facade:'Right',wallId:'main-right',style:'Picture',offsetPct:34,bottomIn:40,widthIn:108,heightIn:96},
   {id:'side-left',type:'Window',facade:'Left',wallId:'main-left',style:'Picture',offsetPct:68,bottomIn:162,widthIn:84,heightIn:60},
   {id:'side-right',type:'Window',facade:'Right',wallId:'main-right',style:'Picture',offsetPct:68,bottomIn:162,widthIn:84,heightIn:60},
   {id:'garage-door',type:'Garage',facade:'Back',wallId:'garage-back',style:'Glass',offsetPct:50,bottomIn:0,widthIn:168,heightIn:84},
  ],
 },contemporary);
 house.cladding='Board & batten';
 house.claddingColor='#c4895a';
 house.wainscot={cladding:'Fieldstone',color:'#9c9388',heightIn:42};
 house.trimColor='#f6f1e8';
 house.windowColor='#3d342c';
 house.doorColor='#6e4b32';

 const data:DeckData={
  ...DEFAULT_DECK,
  customerName:'Showcase sample',projectAddress:'Barrie, Ontario',
  width:30,length:16,height:36,deckType:'Freestanding',foundationDepthIn:48,houseCantileverIn:16,
  deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',boardWidth:5.5,
  pictureFrameRows:1,railingType:'Aluminum',
  catalogueRailingId:'dk_contemporary',
  deckFinishes:{border:'tt_prime_plus:Dark Cocoa',railingColor:'Textured Black'},
  stairFlights:1,stairWidth:96,stairType:'Straight',stairPosition:'Front',stairOffset:50,
  stairRiserCount:5,stairTreadDepthIn:11,
  houseVisible:true,houseConfig:house,housePlacement:{anchor:'center',offsetIn:0},
  terrainConfig:{widthFt:LOT_W,depthFt:LOT_D,elevationIn:0,slopePct:0},
  lightingPreviewOn:true,autoLighting:{posts:true,stairs:true},
  lightingSystem:{selectedItems:[],wireDistance:80},
  yardFeatures:[],landscapeObjects:[],
 };

 const houseLeft=Math.min(...houseOutline(data).flat().map(p=>p.x));
 // Pin the lot on the previous west line. Centering it on the wider deck would slide the fence through the west garden.
 const lotLeft=-38*12;
 data.permitSite={lotWidthFt:LOT_W,lotDepthFt:LOT_D,leftYardFt:(houseLeft-lotLeft)/12,rearYardFt:data.length/2+LOT_D/2,yardFaces:'S'};

 const takeoff=buildDeckTakeoff(data),rings=stairFootprints(takeoff);
 const deckRing=takeoff.levels[0].footprint.outline.map(p=>({x:p.x+takeoff.levels[0].offset.x,y:p.y+takeoff.levels[0].offset.z}));
 let foot=-Infinity,s0=Infinity,s1=-Infinity;
 for(const ring of rings)for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
 const deckFront=Math.max(...deckRing.map(p=>p.y)),deckX0=Math.min(...deckRing.map(p=>p.x)),deckX1=Math.max(...deckRing.map(p=>p.x));
 const stair=getStairPlacement(data,getFootprint(data));
 if(!stair||stair.outward.y<0.5)throw Error('The showcase stair has to come off the front of the deck.');
 // Wider than the deck. The near edge returns to the fascia on both sides of the flight and meets the tread by under half a square foot.
 const x0=deckX0-8*12,x1=deckX1+8*12,coverIn=Math.min(1.1,0.32*144/Math.max(1,s1-s0)),zN=foot-coverIn,zFar=zN+24*12;
 const nose=createYardFeature(data,{kind:'patio',id:'terrace',name:'Dining terrace',xFt:(x0+x1)/24,zFt:(zN+zFar)/24,widthFt:(x1-x0)/12,depthFt:(zFar-zN)/12,heightIn:0,productId:SLAB,hardscape:FIELD});
 let terrace=yardShapeEdit(nose,[
  {x:x0,y:deckFront},{x:s0,y:deckFront},{x:s0,y:zN},{x:s1,y:zN},{x:s1,y:deckFront},{x:x1,y:deckFront},{x:x1,y:zFar},{x:x0,y:zFar},
 ]);
 const landingOverlap=yardArea(yardClip(yardFeatureOutline(terrace),rings,'intersection'));
 const deckOverlap=yardArea(yardClip(yardFeatureOutline(terrace),[deckRing],'intersection'));
 if(deckOverlap>0.01)throw Error(`The terrace overlaps the deck by ${deckOverlap.toFixed(3)} sq ft.`);
 if(landingOverlap<=0.05||landingOverlap>0.5)throw Error(`Stair landing overlap is ${landingOverlap.toFixed(3)} sq ft; the treads have to land on the paving without the terrace standing on the flight.`);
 // The framed field is the full-width slab in front of the stair nose, centred on the stair and the house.
 // The shallow wings beside the flight stay outside that rectangle, so the band does not run into the stair.
 // Two bands of the same width on the stair stringer lines split it into three rooms: the west lounge, an
 // 8 ft walk exactly the stair's width straight on from the treads, and the east outdoor kitchen.
 terrace={...terrace,color:CREMA,inlays:rectFrame(terrace,{x0,x1,z0:zN,z1:zFar},[s0-BAND,s1])};
 push(data,terrace);

 // The 36 ft pool run is across the yard. The court is 20 ft larger than the pool on both axes; its frame stays
 // concentric with the court. The pool sits 3.5 ft toward the rear, so the house side (south-facing, the sun side)
 // is a 13.5 ft lounge deck for the chaises and the rear keeps 6.5 ft, over the 4 ft minimum.
 const far=terrace.zFt+terrace.depthFt/2;
 const courtDepth=36;
 const court=slab(data,'pool-court','Pool court',-4,far-JOIN,52,far-JOIN+courtDepth);
 const courtX0=(court.xFt-court.widthFt/2)*12,courtX1=(court.xFt+court.widthFt/2)*12,courtZ0=(court.zFt-court.depthFt/2)*12,courtZ1=(court.zFt+court.depthFt/2)*12;
 court.inlays=rectFrame(court,{x0:courtX0,x1:courtX1,z0:courtZ0,z1:courtZ1});
 const lounge=slab(data,'lounge','Fire lounge',-28,court.zFt-court.depthFt/2,-10,court.zFt-court.depthFt/2+18,true);
 slab(data,'spine-walk','Spine walk',-10-JOIN,lounge.zFt-lounge.depthFt/2-JOIN,-4+JOIN,lounge.zFt+lounge.depthFt/2+JOIN);
 const terraceX0=terrace.xFt-terrace.widthFt/2;
 // Borealis plank on the two west walks, laid along each walk.
 slab(data,'west-walk','West walk',-14,deckFront/12,terraceX0+JOIN,far+JOIN,false,90);
 slab(data,'lounge-path','Lounge path',-28,36,terraceX0+JOIN,46,false,0);

 // The fire lounge group is centred in the lounge: a curved sectional on the west, its open side and two swivel
 // chairs to the east, all facing a round sculptural gas bowl at the sectional's arc centre.
 const FIRE_IN=42,fireR=FIRE_IN/2,sectional=premiumAsset('curved-sectional')!,swivel=premiumAsset('swivel-lounge-chair')!;
 const seatGap=CURVED_SECTIONAL.frontRadiusIn-fireR;
 const swivelR=fireR+seatGap+swivel.depthIn/2,swivelDeg=40*Math.PI/180;
 const swivelAt=(side:number)=>({x:swivelR*Math.cos(swivelDeg),z:side*swivelR*Math.sin(swivelDeg)});
 const faceFire=(p:{x:number;z:number})=>rotationDegFacing(-p.x,-p.z);
 const groupWest=CURVED_SECTIONAL_ARC_OFFSET_IN+sectional.depthIn/2;
 const groupEast=Math.max(...[-1,1].flatMap(side=>{const p=swivelAt(side);return yardRectangle(p.x,p.z,swivel.widthIn,swivel.depthIn,faceFire(p)*Math.PI/180).map(q=>q.x);}));
 const fireX=lounge.xFt+(groupWest-groupEast)/24,fireZ=lounge.zFt;
 push(data,{...createYardFeature(data,{kind:'fire-feature',id:'fire-bowl',name:'Fire bowl',xFt:fireX,zFt:fireZ,widthFt:FIRE_IN/12,depthFt:FIRE_IN/12,productId:'fire-gas-sculptural',supportFeatureId:lounge.id}),color:'#a69c8f'});

 const poolLengthIn=16*12,poolShape=poolRoundedRectangle(36*12,poolLengthIn);
 const pool={...createPlanningPool({id:'lap-pool',name:'Lap pool',type:'fiberglass',xIn:court.xFt*12,zIn:court.zFt*12+POOL_SHIFT_IN,copingTopElevationIn:0,shape:'rounded-rectangle'}),...poolShape,depthProfile:[{stationIn:0,depthIn:48},{stationIn:poolLengthIn,depthIn:48}]};
 data.pools=[pool];

 const pergola=newPergola('lousol-custom','custom');
 // Posts stand against the outside face of each beam, not on the centre line, so a post does not cut the beam.
 // The house line adds two posts beside the slider. The published house-beam limit is 23 ft, so the outer piers alone cannot carry it.
 const POST=5,level=takeoff.levels[0],supports=level.supports,houseZ=Math.min(...supports.map(s=>s.z)),beamZ=Math.max(...supports.map(s=>s.z));
 const halfBeam=level.reference.beam.plies*1.5/2;
 const near=(z:number)=>level.beams.filter(b=>Math.abs(b.a.z-z)<halfBeam+1).map(b=>b.a.z);
 const houseFace=Math.min(...near(houseZ))-0.75,frontFace=Math.max(...near(beamZ))+0.75;
 if(!Number.isFinite(houseFace)||!Number.isFinite(frontFace)||Math.abs(houseFace-(houseZ-halfBeam))>0.2||Math.abs(frontFace-(beamZ+halfBeam))>0.2)throw Error('The beam faces do not match the ply stack.');
 const onBeam=(z:number)=>supports.filter(s=>Math.abs(s.z-z)<2).map(s=>s.x).sort((a,b)=>a-b);
 const houseXs=onBeam(houseZ),frontXs=onBeam(beamZ);
 const slider=house.openings.find(o=>o.id==='slider');
 if(!slider)throw Error('The showcase house is missing its slider.');
 const sliderMid=houseLeft+slider.offsetPct/100*house.widthFt*12,sliderA=sliderMid-slider.widthIn/2,sliderB=sliderMid+slider.widthIn/2;
 const housePosts=[houseXs[0],8.5*12,21.5*12,houseXs[houseXs.length-1]];
 const frontPosts=frontXs.filter(x=>x<s0-2||x>s1+2);
 if(housePosts.length!==4||frontPosts.length!==4)throw Error(`Pergola posts need four on each beam, got ${housePosts.length} and ${frontPosts.length}.`);
 if(housePosts.some((x,i)=>Math.abs(x-[12,102,258,348][i])>1))throw Error('The house posts are not at 1, 8.5, 21.5 and 29 ft.');
 if(housePosts.some(x=>x+POST/2>sliderA&&x-POST/2<sliderB))throw Error('A house post stands in the slider.');
 const houseGaps=housePosts.slice(1).map((x,i)=>x-housePosts[i]);
 if(Math.max(...houseGaps)>23*12)throw Error('A house-side pergola span is over 23 ft.');
 const postXs=[...housePosts,...frontPosts],postX0=Math.min(...postXs),postX1=Math.max(...postXs);
 const housePostZ=houseFace-POST/2,frontPostZ=frontFace+POST/2;
 const pergolaW=(postX1-postX0+POST)/12,pergolaD=(frontPostZ-housePostZ+POST)/12,roofX=(postX0+postX1)/2,roofZ=(housePostZ+frontPostZ)/2;
 if(pergolaW>30||pergolaD>30||pergolaD<4)throw Error(`The pergola is ${pergolaW.toFixed(2)} by ${pergolaD.toFixed(2)} ft, outside the LOUSOL size limit.`);
 const roofM2=pergolaW*pergolaD*0.09290304;
 const posts=[...housePosts.map(x=>({xIn:x-roofX,zIn:housePostZ-roofZ})),...frontPosts.map(x=>({xIn:x-roofX,zIn:frontPostZ-roofZ}))];
 data.pergola={...pergola,frameFinish:'black',roofFinish:'black',accessories:[],lighting:'perimeter-led',customSize:{widthFt:pergolaW,depthFt:pergolaD,heightFt:10.5},target:{kind:'deck',level:0},xFt:roofX/12,zFt:roofZ/12,rotationDeg:0,louverDeg:80,posts};
 data.scopeOfWork=[
  'Build notes for Joist (construction intent).',
  `Freestanding deck, not fastened to the house. Set the deck 1/2-1 in below the slider sill. The house-side beam stands on its own piers ${houseZ.toFixed(0)} in off the foundation wall. Those piers go to undisturbed soil below the backfill, or use helical piles. Other piers are ${data.foundationDepthIn} in deep, below the Barrie frost line.`,
  'The pergola is freestanding, not attached to the house. Eight posts sit tight against the outside beam faces on engineer-designed footings. House posts at 1, 8.5, 21.5 and 29 ft keep each span under the 23 ft LOUSOL limit. Front posts at 1, 10.33, 19.67 and 29 ft flank the stair. Interior posts need a 22-24 in bell or pad. Use rated post bases, hurricane ties and diagonal 2x6 bracing in both end bays.',
  'Posts drop through the deck. Frame headers and blocking around each with about a 1/2 in gap, and do not notch the posts. Shifted joists keep every post clear of a joist. Drain each post in solid pipe to daylight, away from the piers and the foundation.',
  `LOUSOL custom, black, one roof of about ${roofM2.toFixed(1)} m². A permit is required, and the roof needs LOUSOL's sealed design. Closed-louver snow is about 2.4 kPa against their 55 psf limit; confirm uplift. Snow guards on the house roof, or a setback so snow can slide off.`,
  'Guards are 36 in, openings of 4 in or less, on the ends and yard side, open at the stair. The house edge has no guard. The 16 in gap gets a flashed trim board or rim.',
  'The stair is an 8 ft centre flight: 5 risers at 7.2 in, 4 treads at an 11 in run, 11 stringers at 10 in o.c., a doubled front rim at the stair, and a handrail on both sides. The crema terrace landing is at least the stair width by 36 in deep, with a concrete strip under the pavers at the stair foot.',
  'Pool enclosure (Barrie by-law): 1.2 m min., non-climbable, self-closing and self-latching gates, permit. Confirm the lot fence.',
  'Kitchen, heaters and furniture: design intent, unpriced. Gas by a TSSA fitter, circuits by an electrician.',
 ].join(' ');
 if(data.scopeOfWork.length>2000)throw Error(`The build notes exceed the scope field (${data.scopeOfWork.length}).`);

 const rear0=court.zFt+court.depthFt/2+0.15,rear1=data.permitSite.rearYardFt-0.4;
 const flank1=court.zFt-court.depthFt/2-0.15;
 const loungeFar=lounge.zFt+lounge.depthFt/2;
 const plants:LandscapeObject[]=[];
 let n=0;
 const grow=(speciesId:string,xFt:number,zFt:number,heightIn?:number,widthIn?:number)=>{
  const o=newLandscapePlant(speciesId,`plant-${n++}`,xFt*12,zFt*12);
  plants.push({...o,rotationDeg:(n*47)%50-25,speciesRecord:structuredClone(o.speciesRecord!),...(heightIn?{heightIn}:{}),...(widthIn?{widthIn,depthIn:widthIn}:{})});
 };
 const line=(fixed:'x'|'z',at:number,from:number,to:number,step:number,species:string[],heightIn?:number,widthIn?:number)=>{
  for(let t=from,i=0;t<=to+1e-6;t+=step,i++)grow(species[i%species.length],fixed==='x'?at:t,fixed==='z'?at:t,heightIn,widthIn);
 };
 const zEnd=rear0-1.6;
 // Fence line, then a middle shrub layer, then grasses and perennials at the bed's inner edge. The front layers are
 // spaced so the plants and the outdoor-room furniture stay inside the 300-object design limit.
 line('x',-36.5,6,zEnd,3.35,['thuja-occidentalis-smaragd'],112,34);
 line('x',-34.6,12,zEnd-4,14,['acer-saccharum','pinus-strobus'],240,120);
 line('x',-32.2,8,zEnd,3.6,['hydrangea-arborescens-annabelle','cornus-sericea','amelanchier-canadensis','hydrangea-paniculata','syringa-vulgaris']);
 line('x',-29.4,7,zEnd,3.1,['calamagrostis-karl-foerster','hosta','echinacea-purpurea','rudbeckia-hirta','matteuccia-struthiopteris','schizachyrium-scoparium']);
 line('x',60.5,6,zEnd,3.35,['thuja-occidentalis-smaragd'],112,34);
 line('x',58.6,12,zEnd-4,14,['pinus-strobus','acer-saccharum'],230,110);
 line('x',55.8,8,zEnd,3.6,['cornus-sericea','hydrangea-arborescens-annabelle','amelanchier-canadensis','physocarpus-opulifolius','hydrangea-paniculata']);
 line('x',53.4,7,zEnd,3.1,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','panicum-virgatum','hemerocallis','nepeta-faassenii']);
 line('z',rear1-1.5,-34,58,3.2,['thuja-occidentalis-smaragd'],112,34);
 line('z',(rear0+rear1)/2,-30,54,4.2,['acer-saccharum','amelanchier-canadensis','syringa-vulgaris','pinus-strobus'],200,100);
 line('z',rear0+1.5,-32,56,3.3,['calamagrostis-karl-foerster','hydrangea-arborescens-annabelle','hosta','rudbeckia-hirta']);
 line('x',48,8,flank1-1.2,3.4,['hydrangea-paniculata','cornus-sericea','amelanchier-canadensis']);
 line('x',terrace.xFt+terrace.widthFt/2+2.4,7,flank1-1.4,2.6,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','salvia-nemorosa']);
 line('z',rear0-1.4,-26,-8,3.4,['thuja-occidentalis-smaragd','pinus-strobus'],140,48);
 line('z',loungeFar+2,-25,-7,3.2,['hydrangea-arborescens-annabelle','cornus-sericea','calamagrostis-karl-foerster']);
 grow('hydrangea-arborescens-annabelle',-22,6);grow('cornus-sericea',-14,6);

 const diningX=data.pergola.xFt,diningZ=data.pergola.zFt;
 const aim=(xFt:number,zFt:number,tx:number,tz:number)=>rotationDegFacing(tx-xFt*12,tz-zFt*12);
 const at=(asset:LandscapeAssetId,id:string,name:string,xIn:number,zIn:number,rotationDeg:number,support?:string)=>furn(asset,id,name,xIn/12,zIn/12,rotationDeg,support);
 // Dining on the deck: a teak 96×42 table under the pergola, long side across the deck, three woven armchairs a side
 // at 33 in centres and one at each end, 36 in of deck behind every chair. No patio id: the set sits on the deck.
 const chair=premiumAsset('woven-dining-chair')!,tableW=96,tableD=42,tuck=3;
 const table=furn('teak-dining-table','dining-table','Dining table',diningX,diningZ,0);
 const sideDz=(tableD/2+chair.depthIn/2-tuck)/12,endDx=(tableW/2+chair.depthIn/2-tuck+1)/12;
 // Each chair squares up to the table edge in front of it.
 const seat=(id:string,dx:number,dz:number)=>furn('woven-dining-chair',id,'Dining chair',diningX+dx,diningZ+dz,aim(diningX+dx,diningZ+dz,(diningX+(dz===0?0:dx))*12,diningZ*12));
 // Two infrared heaters hang from the front pergola beam, either side of the table's long axis and clear of the posts.
 const heaterZ=frontPostZ;
 const heaters=[-1,1].map((side,k)=>furn('infrared-heater',`heater-${k+1}`,'Infrared heater',diningX+side*30/12,heaterZ/12,0));

 // The terrace rooms. Both side rooms are the same size, between the frame and the stringer-line bands.
 const roomZ0=zN+MARGIN+BAND,roomZ1=zFar-MARGIN-BAND,roomCz=(roomZ0+roomZ1)/2;
 const westRoom={x0:x0+MARGIN+BAND,x1:s0-BAND},eastRoom={x0:s1+BAND,x1:x1-MARGIN-BAND};
 // West lounge: the low sofa backs onto the deck side, two swivel chairs across a coffee table 16 in from each, on a
 // 9×12 rug that takes every front leg, a lantern at each sofa end. The whole group is centred in the room.
 const sofa=premiumAsset('modular-sofa')!,rug=premiumAsset('outdoor-rug')!,lantern=premiumAsset('outdoor-lantern')!;
 const coffeeW=66,coffeeD=30,coffeeGap=16,westCx=(westRoom.x0+westRoom.x1)/2;
 // The chairs turn in toward the table; each is pushed back until its nearest corner is 16 in off the table edge.
 const chairDx=32,ringAt=(x:number,z:number,w:number,d:number,rot:number)=>yardRectangle(x,z,w,d,rot*Math.PI/180);
 let chairDz=coffeeD/2+coffeeGap+swivel.depthIn/2;
 const chairRot=(side:number,dz:number)=>rotationDegFacing(-side*chairDx,-dz);
 for(let k=0;k<40;k++)chairDz+=0.8*(coffeeGap-planGapIn(ringAt(chairDx,chairDz,swivel.widthIn,swivel.depthIn,chairRot(1,chairDz)),ringAt(0,0,coffeeW,coffeeD,0)));
 const sofaDz=-(coffeeD/2+coffeeGap+sofa.depthIn/2);
 const chairMaxZ=Math.max(...ringAt(chairDx,chairDz,swivel.widthIn,swivel.depthIn,chairRot(1,chairDz)).map(p=>p.y));
 const coffeeZ=roomCz-((sofaDz-sofa.depthIn/2)+chairMaxZ)/2,sofaZ=coffeeZ+sofaDz,chairZ=coffeeZ+chairDz;
 // East kitchen: the island's cook side faces the pool, its raised bar faces the deck with four stools tucked 4 in
 // under the ledge. Island and stools are centred in the room together.
 const island=premiumAsset('kitchen-island')!,stool=premiumAsset('bar-stool')!,ex=(eastRoom.x0+eastRoom.x1)/2;
 const stoolDz=-(island.depthIn/2+stool.depthIn/2-4),kitchenZ=roomCz-((stoolDz-stool.depthIn/2)+island.depthIn/2)/2;
 // The pool court: two chaise pairs on the sun side, symmetric about the pool's cross-axis, clear of the 8 ft runner
 // from the stair. Chaises 30 in apart with a side table between the heads, feet to the water, each pair under a
 // cantilever umbrella whose mast stands on the outer side.
 const chaise={w:30,d:80},pairGap=30,pairDx=16.75*12,headZ=courtZ0+MARGIN+BAND+2,chaiseZ=headZ+chaise.d/2;
 const umbrella=premiumAsset('cantilever-umbrella')!,canopyOff=(umbrella.widthIn/2-66),mastIn=60,mastClear=20;
 const pools=[-1,1].flatMap((side,k)=>{
  // The canopy is centred 4 in off the envelope centre, away from the mast; the mast plate is 28 in square.
  const px=court.xFt*12+side*pairDx,outer=px+side*(pairGap/2+chaise.w);
  const mast=outer+side*(mastClear+14),canopyX=mast-side*mastIn,objX=canopyX+side*canopyOff;
  return [
   at('lounge-chair',`pool-chaise-${2*k+1}`,'Pool lounge',px-(pairGap+chaise.w)/2,chaiseZ,0,court.id),
   at('lounge-chair',`pool-chaise-${2*k+2}`,'Pool lounge',px+(pairGap+chaise.w)/2,chaiseZ,0,court.id),
   at('side-table',`pool-side-${k+1}`,'Pool side table',px,headZ+18,0,court.id),
   at('cantilever-umbrella',`pool-umbrella-${k+1}`,'Pool umbrella',objX,courtZ0+18+umbrella.depthIn/2,side<0?0:180,court.id),
  ];
 });
 // Fire lounge pieces, relative to the burner.
 const fx=fireX*12,fz=fireZ*12,sideBearing=(105-(10+3)/77*180/Math.PI)*Math.PI/180,lanternBearing=67*Math.PI/180;
 const polar=(r:number,b:number,side:number)=>({x:fx+r*Math.cos(b),z:fz+side*r*Math.sin(b)});
 data.landscapeObjects=[
  bed('bed-west','West planting',-38,2,-28,rear0+4),
  bed('bed-east','East planting',52,2,62,rear0+4),
  bed('bed-rear','Rear planting',-38,rear0,62,rear1),
  polyBed('bed-flank','Terrace planting',[{x:deckX1/12+0.2,z:2},{x:51.7,z:2},{x:51.7,z:flank1},{x:terrace.xFt+terrace.widthFt/2+0.3,z:flank1},{x:terrace.xFt+terrace.widthFt/2+0.3,z:deckFront/12},{x:deckX1/12+0.2,z:deckFront/12}]),
  bed('bed-deckside','Deckside planting',-28,2,0,16),
  bed('bed-court-west','Pool planting',-28,loungeFar+0.2,-4.2,rear0-0.1),
  ...plants,
  table,
  seat('dining-1',-33/12,-sideDz),seat('dining-2',0,-sideDz),seat('dining-3',33/12,-sideDz),
  seat('dining-4',-33/12,sideDz),seat('dining-5',0,sideDz),seat('dining-6',33/12,sideDz),
  seat('dining-7',-endDx,0),seat('dining-8',endDx,0),
  ...heaters,
  at('outdoor-rug','terrace-rug','Terrace rug',westCx,roomCz,0,terrace.id),
  at('modular-sofa','terrace-sofa','Terrace sofa',westCx,sofaZ,0,terrace.id),
  {...at('outdoor-coffee-table','terrace-coffee','Terrace coffee table',westCx,coffeeZ,0,terrace.id),widthIn:coffeeW,depthIn:coffeeD,heightIn:16},
  ...[-1,1].map((side,k)=>at('swivel-lounge-chair',`terrace-chair-${k+1}`,'Terrace swivel chair',westCx+side*chairDx,chairZ,chairRot(side,chairDz),terrace.id)),
  ...[-1,1].map((side,k)=>at('outdoor-lantern',`terrace-lantern-${k+1}`,'Terrace lantern',westCx+side*(sofa.widthIn/2+4+lantern.widthIn/2),sofaZ,0,terrace.id)),
  at('kitchen-island','kitchen-island','Outdoor kitchen',ex,kitchenZ,0,terrace.id),
  ...[-39,-13,13,39].map((dx,k)=>at('bar-stool',`bar-stool-${k+1}`,'Bar stool',ex+dx,kitchenZ+stoolDz,0,terrace.id)),
  ...pools,
  at('curved-sectional','lounge-sectional','Fire lounge sectional',fx-CURVED_SECTIONAL_ARC_OFFSET_IN,fz,-90,lounge.id),
  ...[-1,1].map((side,k)=>{const p=swivelAt(side);return at('swivel-lounge-chair',`lounge-chair-${k+1}`,'Fire lounge swivel chair',fx+p.x,fz+p.z,faceFire(p),lounge.id);}),
  ...[-1,1].map((side,k)=>{const p=polar(77,sideBearing,side);return at('side-table',`lounge-side-${k+1}`,'Fire lounge side table',p.x,p.z,0,lounge.id);}),
  ...[-1,1].map((side,k)=>{const p=polar(88,lanternBearing,side);return at('outdoor-lantern',`lounge-lantern-${k+1}`,'Fire lounge lantern',p.x,p.z,0,lounge.id);}),
 ];
 void sectional;

 const lit=buildDeckTakeoff(data);
 // Lighting follows the best-practice rules (lightingPlacementRules.ts), each fixture on its own zone:
 // - pool: 3 underwater 12 V niche lights in the house-side wall, lens top 18 in down, shining away from the house;
 //   nothing in the coping, and 4 round markers on the pool deck, 36–48 in out from it;
 // - paths: 22 mm round markers on the walked edges of the band, about 6 ft apart, a 40 mm one at the stair
 //   foot, and path lights only in the beds, 8–10 ft apart and staggered;
 // - stairs and posts: 2 under-step lights a tread on the 8 ft flight; shielded down-lights on the stair posts, the
 //   front corners and every other post, none on the house edge;
 // - pergola and dining: the perimeter LED, a downlight centred over the table, and 2 louvered rounds grazing the
 //   front pergola posts; fire lounge: the flame and two lanterns, no floor lights;
 // - accent trees: narrow cowled uplights on the yard side of each tree, aimed into the yard; facade: a down-light
 //   beside each side of the slider. No light sits inside a seating floor.
 // Each place is model inches. The real preview lights are the 8 tree uplights, 7 path lights and the dining downlight.
 const pin=(xFt:number,zFt:number,angle=0,y?:number)=>({x:xFt*12,z:zFt*12,angle,...(y===undefined?{}:{y})});
 const tenthIn=(p:{x:number;z:number;angle:number;y?:number})=>({...p,x:tenth(p.x),z:tenth(p.z),...(p.y===undefined?{}:{y:tenth(p.y)})});
 const houseRings=houseOutline(data);
 const poolLights=poolLightPlaces(pool,houseRings).map(tenthIn);
 // Pool deck: one round marker at each corner of the walk round the pool, 42 in out from the coping on the diagonal.
 // No marker inside a seat's 24 in pad: the walked edge passes the chaise feet, and a light there sits in their floor.
 const seatPads=(data.landscapeObjects??[]).filter(o=>o.kind==='furniture').map(o=>yardRectangle(o.xIn,o.zIn,o.widthIn+48,o.depthIn+48,(o.rotationDeg??0)*Math.PI/180));
 const waterRing=poolWaterRing(pool),wx=waterRing.map(p=>p.x),wz=waterRing.map(p=>p.y);
 const wx0=Math.min(...wx),wx1=Math.max(...wx),wz0=Math.min(...wz),wz1=Math.max(...wz),cornerR=24,copeOut=(pool.coping?.widthIn??12)-(pool.coping?.overhangIn??1);
 const fromCoping=(x:number,z:number)=>ringDistance(x,z,waterRing)-copeOut;
 const diag=(cornerR+copeOut+42)/Math.SQRT2;
 const deckCorners=[[wx0,-1],[wx1,1]].flatMap(([ex,sx])=>[[wz0,-1],[wz1,1]].map(([ez,sz])=>({x:ex-sx*cornerR+sx*diag,z:ez-sz*cornerR+sz*diag,angle:0})));
 // A corner whose slabs are all inside a seat pad (the chaise pairs on the sun side) gets no marker.
 const poolDeck=deckCorners.flatMap(c=>{try{return seatOnGrande([court],data.pools,[c],seatPads,(x,z)=>{const d=fromCoping(x,z);return d>=36&&d<=48;});}catch{return [];}});
 // Band centrelines. Markers go on the walked edges only: the terrace's south edge toward the pool court, its west
 // edge where the west walk and the lounge path meet it, and the court's west edge along the spine walk.
 const bandIn=MARGIN+BAND/2,step=72;
 const tb={x0:x0+bandIn,x1:x1-bandIn,z0:zN+bandIn,z1:zFar-bandIn},courtBandX=courtX0+bandIn;
 const southRun=Math.round((tb.x1-tb.x0)/step);
 const bandMarkers=[
  ...Array.from({length:southRun+1},(_,i)=>({x:tenth(tb.x0+(tb.x1-tb.x0)*i/southRun),z:tenth(tb.z1),angle:0})),
  ...[1,2,3].map(k=>({x:tenth(tb.x0),z:tenth(tb.z1-k*step),angle:0})),
  ...[48.5,54.5,60.5].map(zFt=>({x:tenth(courtBandX),z:zFt*12,angle:0})),
 ].filter(p=>!seatPads.some(r=>insidePolygon({x:p.x,y:p.z},r)));
 // The 40 mm marker at the stair foot, on the band the treads land on.
 const stairFoot=[{x:tenth((s0+s1)/2),z:tenth(tb.z0),angle:0}];
 // Two louvered 2 in rounds grazing the front pergola posts beside the stair, 12 in out from the deck fascia.
 const frontPostXs=data.pergola.posts!.filter(p=>p.zIn>0).map(p=>roofX+p.xIn).filter(x=>Math.abs(x-(s0+s1)/2)<8*12).sort((a,b)=>a-b);
 const postGrazers=frontPostXs.map(x=>({x:tenth(x),z:tenth(deckFront+12),angle:Math.PI}));
 // Shielded post lights: the stair posts, the two front corners, then every other post along each run. The house edge has no guard.
 const facing=postFacing(lit),railTop=lit.railing.height;
 const deckPosts=lit.railing.posts.map((p,i)=>({p,i,f:facing[i]??{x:0,y:1}}));
 const stairPost=(p:{x:number;z:number})=>p.x>s0-24&&p.x<s1+24&&p.z>deckFront-24;
 const cornerPost=(p:{x:number;z:number})=>p.z>deckFront-24&&(Math.abs(p.x-deckX0)<12||Math.abs(p.x-deckX1)<12);
 const chosen=new Set(deckPosts.filter(({p})=>stairPost(p)||cornerPost(p)).map(q=>q.i));
 // The end runs, from the front corner back toward the house: every other post after the corner.
 for(const side of [deckX0,deckX1]){
  const run=deckPosts.filter(({p})=>Math.abs(p.x-side)<12&&!cornerPost(p)).sort((a,b)=>b.p.z-a.p.z);
  run.forEach((q,k)=>{if(k%2===1)chosen.add(q.i);});
 }
 const postOut=1.9+3.937/2;
 const postLights=deckPosts.filter(q=>chosen.has(q.i)).map(({p,f})=>({x:tenth(p.x+f.x*postOut),z:tenth(p.z+f.y*postOut),y:tenth(p.y+railTop-7),angle:Math.atan2(f.x,f.y)}));
 // A down-light on the house wall each side of the slider, 69 in over the deck.
 const doorLights=[sliderA-14,sliderB+14].map(x=>({x:tenth(x),z:.8,y:data.height+69,angle:0}));
 // The dining downlight, centred over the table, under the louvers.
 const diningLight=[{x:tenth(diningX*12),z:tenth(diningZ*12),y:tenth(data.height+data.pergola.customSize!.heightFt*12-8),angle:0}];
 // Tree uplights 24 in in front of each trunk, on the yard side, aimed up into the canopy and into the yard.
 const trees=[26,40,54,68].flatMap(zFt=>[pin(-34.6+2,zFt,Math.PI/2),pin(58.6-2,zFt,-Math.PI/2)]);
 // Path lights in the beds, 14 in back from the walk, 8–10 ft apart and staggered side to side.
 const path=[pin(-11,14.8),pin(-29.2,40),pin(-29.2,50),pin(-7,63.4),pin(-5.4,72),pin(53.3,52),pin(53.3,62)];
 data.autoLighting={posts:false,stairs:true,stairsPerTread:2};
 data.lightingSystem={wireDistance:80,selectedItems:syncAutoLighting({...data,lightingSystem:{wireDistance:80,selectedItems:[
  {productId:POOL_LIGHT_ID,qty:poolLights.length,zone:'pool',places:poolLights},
  {productId:'dot_22',qty:poolDeck.length,zone:'pool-deck',places:poolDeck},
  {productId:'fusion_22',qty:bandMarkers.length,zone:'paths',places:bandMarkers},
  {productId:'paver_40',qty:stairFoot.length,zone:'paths',places:stairFoot},
  {productId:'liv',qty:path.length,zone:'paths',places:path},
  {productId:'big_scope_narrow',qty:trees.length,zone:'accent-trees',places:trees},
  {productId:'inground_2ss',qty:postGrazers.length,zone:'pergola-dining',places:postGrazers},
  {productId:'scope_ceiling',qty:diningLight.length,zone:'pergola-dining',places:diningLight},
  {productId:'halo_down',qty:postLights.length,zone:'posts',places:postLights},
  {productId:'evo_down',qty:doorLights.length,zone:'facade',places:doorLights},
  // Two 100 VA hubs on the house wall by the deck, about 50 ft from the pool: the load is about 120 VA before the
  // unrated fixtures, and each hub stays under 80%. The pool lights run on the pool builder's own 12 V supply.
  {productId:'hub100',qty:2},
 ]}}, {posts:lit.quantities.railingPosts,stairs:lit.treads.length,privacy:0})};

 // Over the rear bed, inside the fence, looking back at the house. The spine
 // fills the frame and the context trees sit behind the lens.
 const hero={position:[-6,30,82] as [number,number,number],target:[15,2,30] as [number,number,number]};
 const eye={position:[28,5.4,22] as [number,number,number],target:[6,1.2,58] as [number,number,number]};
 const poolCam={position:[24,12,36] as [number,number,number],target:[24,0,64] as [number,number,number]};
 const fireCam={position:[-6,8.2,31] as [number,number,number],target:[fireX,1.05,fireZ] as [number,number,number]};
 const kitchenCam={position:[ex/12-14,6.2,kitchenZ/12+16] as [number,number,number],target:[ex/12+1,2.2,kitchenZ/12-3] as [number,number,number]};
 const overhead={position:[12,96,40] as [number,number,number],target:[12,0,39.9] as [number,number,number]};
 const diningCam={position:[3.2,data.height/12+5,15.15] as [number,number,number],target:[14.2,9.4,7.1] as [number,number,number]};
 const terraceLoungeCam={position:[westCx/12+15,5.2,roomCz/12+6] as [number,number,number],target:[westCx/12,1.1,coffeeZ/12] as [number,number,number]};
 const stairMid=(s0+s1)/24;
 const stairUp={position:[stairMid,5.2,foot/12+6] as [number,number,number],target:[stairMid,6.5,data.length*0.45] as [number,number,number]};
 const shot=(id:string,name:string,frame:{position:[number,number,number];target:[number,number,number]},fov:number)=>({id,name,fov,positionIn:frame.position.map(n=>n*12) as [number,number,number],targetIn:frame.target.map(n=>n*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',cameraPreset:'terrace',activeCameraId:'hero',cameras:[shot('hero','Whole property',hero,56),shot('terrace-eye','Terrace toward the pool',eye,55),shot('pool','Pool court',poolCam,42),shot('fire','Fire lounge',fireCam,42),shot('dining','Dining set',diningCam,66),shot('terrace-lounge','Terrace lounge',terraceLoungeCam,50),shot('kitchen','Terrace kitchen',kitchenCam,50),shot('overhead','Overhead plan',overhead,50),shot('stair-up','Up the stair',stairUp,48)]};
 // Positions to a tenth of an inch, not float noise, so the estate share link stays inside MAX_PUBLIC_DESIGN_BYTES.
 data.landscapeObjects=data.landscapeObjects?.map(o=>({...o,xIn:tenth(o.xIn),zIn:tenth(o.zIn)}));
 return data;
}

function gapOf(a:YardFeature,b:YardFeature){const ax0=a.xFt-a.widthFt/2,ax1=a.xFt+a.widthFt/2,az0=a.zFt-a.depthFt/2,az1=a.zFt+a.depthFt/2,bx0=b.xFt-b.widthFt/2,bx1=b.xFt+b.widthFt/2,bz0=b.zFt-b.depthFt/2,bz1=b.zFt+b.depthFt/2,sx=ax1<bx0?bx0-ax1:bx1<ax0?ax0-bx1:0,sz=az1<bz0?bz0-az1:bz1<az0?az0-bz1:0;return sx===0||sz===0?sx+sz:Math.hypot(sx,sz);}
function overlapSqft(a:YardFeature,b:YardFeature){return yardArea(yardClip([rectOf(a)],[rectOf(b)],'intersection'));}

/** Layout promises the stills rely on. Empty when the sample is buildable. */
export function showcaseSampleIssues(data=ontarioShowcaseDesign()):string[]{
 const issues:string[]=[];
 if(data.permitSite?.lotWidthFt!==LOT_W||data.permitSite.lotDepthFt!==LOT_D)issues.push('Lot is not 100×160 ft.');
 const terrace=data.yardFeatures?.find(f=>f.id==='terrace'),lounge=data.yardFeatures?.find(f=>f.id==='lounge'),court=data.yardFeatures?.find(f=>f.id==='pool-court'),walk=data.yardFeatures?.find(f=>f.id==='spine-walk'),west=data.yardFeatures?.find(f=>f.id==='west-walk'),loungePath=data.yardFeatures?.find(f=>f.id==='lounge-path'),fire=data.yardFeatures?.find(f=>f.id==='fire-bowl');
 if(!terrace||!lounge||!court||!walk||!west||!loungePath){issues.push('The spine is missing a room.');return issues;}
 const tk=buildDeckTakeoff(data),deck=tk.levels[0],deckXs=deck.footprint.outline.map(p=>p.x+deck.offset.x),deckYs=deck.footprint.outline.map(p=>p.y+deck.offset.z);
 const deckX0=Math.min(...deckXs)/12,deckX1=Math.max(...deckXs)/12,deckFront=Math.max(...deckYs)/12;
 if(terrace.xFt-terrace.widthFt/2>deckX0-7||terrace.xFt+terrace.widthFt/2<deckX1+7)issues.push('The terrace does not span the deck.');
 if(Math.abs(terrace.zFt-terrace.depthFt/2-deckFront)>0.05)issues.push('The terrace does not meet the deck beside the stairs.');
 const landing=yardArea(yardClip(yardFeatureOutline(terrace),stairFootprints(tk),'intersection'));
 if(landing<=0.05||landing>0.5)issues.push(`The stairs do not land on the terrace (${landing.toFixed(3)} sq ft).`);
 if(Math.abs(court.widthFt-56)>0.2||Math.abs(court.depthFt-36)>0.2)issues.push('The pool court is not 56×36 ft.');
 if(Math.abs(lounge.widthFt-18)>0.2||Math.abs(lounge.depthFt-18)>0.2)issues.push('The fire lounge is not 18×18 ft.');
 if(walk.widthFt<5.5||walk.widthFt>7)issues.push('The spine walk is not about 6 ft wide.');
 if(west.widthFt<5.5||west.widthFt>8||overlapSqft(west,terrace)<1||overlapSqft(loungePath,west)<1||overlapSqft(loungePath,lounge)<1)issues.push('The west path does not join the terrace to the fire lounge.');
 if([terrace,court,walk,lounge].some(f=>f.hardscape?.colorId!=='caff-crema'||f.hardscape.finishId!=='hd-smooth-grande'))issues.push('The spine is not one crema grande slab.');
 if([west,loungePath].some(f=>f.productId!==PLANK_PRODUCT||f.hardscape?.colorId!=='hazelnut-brandy'||!isWalkWidth(f)))issues.push('The west walks are not Borealis Hazelnut Brandy plank.');
 if(overlapSqft(terrace,court)<1||overlapSqft(walk,court)<0.4||overlapSqft(walk,lounge)<0.4||overlapSqft(walk,terrace)<0.2)issues.push('Terrace, pool court and fire lounge are not joined.');
 const loungeGap=gapOf(lounge,court);if(loungeGap<5||loungeGap>6.5)issues.push(`Lounge and pool court are ${loungeGap.toFixed(1)} ft apart.`);
 const bandColours=new Set([terrace,lounge,court].flatMap(room=>patioInlayPlans(room).map(p=>p.inlay.hardscape?.colorId)));
 if(bandColours.size!==1||!Object.values(SHOWCASE_PALETTES).some(p=>bandColours.has(p.colorId)))issues.push('The rooms do not share one band colour from a showcase palette.');
 for(const room of [terrace,lounge,court]){const plans=patioInlayPlans(room);if(!plans.length||plans.some(p=>p.status!=='ok'))issues.push(`${room.name} is missing its border.`);}
 {
  const bandOf=(room:YardFeature)=>{const plans=patioInlayPlans(room).filter(p=>p.status==='ok');const xs=plans.flatMap(p=>p.outline.flatMap(v=>[v.x])),zs=plans.flatMap(p=>p.outline.flatMap(v=>[v.y]));return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),plans};};
  const even=(room:YardFeature,rect:{x0:number;x1:number;z0:number;z1:number},label:string)=>{
   const band=bandOf(room);
   const gaps=[band.x0-rect.x0,rect.x1-band.x1,band.z0-rect.z0,rect.z1-band.z1];
   if(gaps.some(g=>Math.abs(g-MARGIN)>0.2))issues.push(`${label} frame is not inset evenly (${gaps.map(g=>g.toFixed(1)).join(', ')} in).`);
   if(band.plans.some(p=>Math.abs(Math.min(p.inlay.widthIn,p.inlay.depthIn)-BAND)>0.2))issues.push(`${label} band is not one 6×13 course.`);
   const cx=(band.x0+band.x1)/2,cz=(band.z0+band.z1)/2;
   return {cx,cz};
  };
  let foot=-Infinity,s0=Infinity,s1=-Infinity;
  for(const ring of stairFootprints(tk))for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
  const coverIn=Math.min(1.1,0.32*144/Math.max(1,s1-s0)),zN=foot-coverIn,zFar=zN+24*12,x0=Math.min(...deckXs)-8*12,x1=Math.max(...deckXs)+8*12;
  const terraceFrame=even(terrace,{x0,x1,z0:zN,z1:zFar},'Terrace');
  if(Math.abs(terraceFrame.cx-(s0+s1)/2)>1)issues.push('The terrace frame is not centred on the stair.');
  // The two room dividers sit on the stringer lines, so the walk between them is exactly the stair's width.
  const dividers=patioInlayPlans(terrace).filter(p=>p.status==='ok'&&p.inlay.depthIn>p.inlay.widthIn&&Math.abs(p.inlay.xIn+terrace.xFt*12-(s0+s1)/2)<(s1-s0)/2+BAND+1).map(p=>p.inlay.xIn+terrace.xFt*12).sort((a,b)=>a-b);
  if(dividers.length!==2||Math.abs(dividers[0]-(s0-BAND/2))>0.5||Math.abs(dividers[1]-(s1+BAND/2))>0.5)issues.push('The terrace is not split into lounge, walk and kitchen on the stair stringer lines.');
  const pool=data.pools?.[0];
  if(pool){const cz0=(court.zFt-court.depthFt/2)*12,cz1=(court.zFt+court.depthFt/2)*12,poolFrame=even(court,{x0:(court.xFt-court.widthFt/2)*12,x1:(court.xFt+court.widthFt/2)*12,z0:cz0,z1:cz1},'Pool');
   // B-POOL-PARALLEL: the frame is concentric with the court and symmetric about the pool's cross-axis; the deeper side faces the house (sun).
   if(Math.abs(poolFrame.cx-pool.xIn)>1||Math.abs(poolFrame.cz-court.zFt*12)>1)issues.push('The pool frame is not centred on the court and the pool axis.');
   const b=poolLocalBounds(pool),houseSide=pool.zIn-b.lengthIn/2-cz0,rearSide=cz1-pool.zIn-b.lengthIn/2;
   if(Math.abs(houseSide-162)>1||rearSide<48+12)issues.push(`The pool deck is ${(houseSide/12).toFixed(1)} ft on the sun side and ${(rearSide/12).toFixed(1)} ft at the rear, not 13.5 and 6.5 ft.`);}
 }
 const pool=data.pools?.[0],bounds=pool?poolLocalBounds(pool):undefined;
 if(!bounds||Math.abs(bounds.widthIn-36*12)>1||Math.abs(bounds.lengthIn-16*12)>1)issues.push('The pool is not 36 ft across and 16 ft out from the house.');
 const beds=(data.landscapeObjects??[]).filter(o=>o.kind==='bed');
 if(!beds.length||beds.some(o=>o.assetId!=='mulch-bed'))issues.push('Planting beds are not brown mulch.');
 const lawn={x0:-28,x1:-14,z0:16,z1:36},hits=(x:number,z:number)=>x>lawn.x0&&x<lawn.x1&&z>lawn.z0&&z<lawn.z1;
 let bedSqft=0;
 for(const object of data.landscapeObjects??[]){
  if(object.kind==='bed'&&object.polygon){if(object.polygon.some(p=>hits(p.x/12,p.z/12)))issues.push(`${object.name} cuts the lawn panel.`);bedSqft+=Math.abs(object.widthIn*object.depthIn)/144;}
  if(object.kind!=='bed'&&object.kind!=='furniture'&&hits(object.xIn/12,object.zIn/12))issues.push(`${object.name} stands in the lawn panel.`);
 }
 const paved=[terrace,court,lounge,walk,west,loungePath].reduce((n,f)=>n+f.widthFt*f.depthFt,0);
 const rear=data.permitSite?.rearYardFt??0,visible=LOT_W*rear;
 if(visible<=0||(paved+bedSqft)/visible<0.58)issues.push('Hardscape and planting do not fill the yard.');
 const plants=(data.landscapeObjects??[]).filter(o=>o.kind==='plant');
 const speciesIds=new Set(plants.map(o=>o.speciesRecord?.id));
 for(const id of ['pinus-strobus','amelanchier-canadensis','cornus-sericea','calamagrostis-karl-foerster','thuja-occidentalis-smaragd','acer-saccharum','hydrangea-arborescens-annabelle'])if(!speciesIds.has(id))issues.push('The beds are missing '+id+'.');
 if(plants.length<140||(data.landscapeObjects?.length??0)>LANDSCAPE_LIMITS.objects)issues.push(`Planting density is ${plants.length} plants in ${data.landscapeObjects?.length??0} objects.`);
 const frontWall=data.houseConfig?.openings.filter(o=>o.wallId==='main-front'&&o.widthIn>=140&&o.heightIn>=96)??[];
 if(frontWall.length<2||data.houseConfig?.cladding!=='Board & batten'||data.houseConfig.wainscot?.cladding!=='Fieldstone'||data.houseConfig.claddingColor==='#3d4043')issues.push('The house is not wood over stone with a window wall toward the yard.');
 if(data.width!==30||data.length!==16||data.height!==36||data.deckType!=='Freestanding'||data.deckingColor!=='Coconut Husk'||data.deckFinishes?.border!=='tt_prime_plus:Dark Cocoa'||data.stairWidth!==96)issues.push('The deck is not a freestanding 30×16 ft Coconut Husk deck with a Dark Cocoa picture frame and an 8 ft stair.');
 if(data.foundationDepthIn!==48||data.houseCantileverIn!==16||data.stairRiserCount!==5||data.stairTreadDepthIn!==11)issues.push('The piers, house-side beam, or stair rise and run are not the reviewed sizes.');
 const grade=tk.flights.find(f=>f.kind==='grade'&&!f.id.endsWith('-upper')&&!f.id.endsWith('-lower'));
 if(!grade||grade.risers!==5||Math.abs(grade.rise-7.2)>0.05||Math.abs(grade.run-11)>0.05)issues.push('The stair is not 5 risers at 7.2 in and an 11 in run.');
 const guards=guardRuns(tk).filter(r=>Math.abs(r.a.y-r.b.y)<.5&&r.a.y>data.height-1);
 const deckLen=data.length*12;
 if(guards.some(r=>Math.abs(r.a.z)<1&&Math.abs(r.b.z)<1))issues.push('A guard still runs along the house side of the deck.');
 if(!guards.some(r=>Math.abs(r.a.x)<2&&Math.abs(r.b.x)<2)||!guards.some(r=>Math.abs(r.a.x-data.width*12)<2&&Math.abs(r.b.x-data.width*12)<2))issues.push('An end guard is missing.');
 if(!guards.some(r=>Math.abs(r.a.z-deckLen)<2&&Math.abs(r.b.z-deckLen)<2))issues.push('The yard-side guard is missing.');
 if(guards.some(r=>Math.abs(r.a.z-deckLen)<2&&Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z)>data.width*12-24))issues.push('The yard-side guard is not open at the stair.');
 const finished=deck.deckingFootprint?.outline??[];
 if(finished.some(p=>p.y<-0.05))issues.push('The house-side decking enters the wall.');
 if(!(deck.rim??[]).some(r=>Math.abs(r.a.z)<.5&&Math.abs(r.b.z)<.5))issues.push('The house-side rim is missing.');
 if(data.catalogueRailingId!=='dk_contemporary'||data.deckFinishes?.railingColor!=='Textured Black')issues.push('The rail is not black aluminum.');
 if(data.pergola?.target.kind!=='deck'||data.pergola.roofFinish!=='black'||data.pergola.frameFinish!=='black'||data.pergola.lighting!=='perimeter-led'||(data.pergola.louverDeg??0)<70)issues.push('The pergola is not open black aluminium louvers on the deck with the LEDs on.');
 if(data.pergola?.customSize&&(data.pergola.customSize.heightFt*12-7<96||data.height+data.pergola.customSize.heightFt*12-7<148))issues.push('The pergola beam does not clear 8 ft at the house, or it crosses the picture-window heads.');
 if(data.pergola?.customSize&&data.pergola.posts){
  const px=data.pergola.xFt*12,pz=data.pergola.zFt*12,stations=data.pergola.posts.map(p=>({x:px+p.xIn,z:pz+p.zIn}));
  const framed=tk.levels[0],houseZ=Math.min(...framed.supports.map(s=>s.z)),beamZ=Math.max(...framed.supports.map(s=>s.z));
  const half=framed.reference.beam.plies*1.5/2,houseFace=houseZ-half,frontFace=beamZ+half;
  if(Math.abs(houseZ-16)>2)issues.push('The house-side beam is not about 16 in off the foundation.');
  const housePosts=stations.filter(p=>p.z<houseZ&&Math.abs(p.z+2.5-houseFace)<1),frontPosts=stations.filter(p=>p.z>beamZ&&Math.abs(p.z-2.5-frontFace)<1);
  if(stations.length!==8||housePosts.length!==4||frontPosts.length!==4)issues.push('The pergola does not have four posts tight against each beam face.');
  const want=[12,102,258,348];
  if(housePosts.length===4&&want.some(x=>!housePosts.some(p=>Math.abs(p.x-x)<1)))issues.push('The house posts are not at 1, 8.5, 21.5 and 29 ft.');
  const hx=housePosts.map(p=>p.x).sort((a,b)=>a-b);
  if(hx.slice(1).some((x,i)=>x-hx[i]>23*12+0.5))issues.push('A house-side pergola span is over 23 ft.');
  const frontPiers=framed.supports.filter(s=>Math.abs(s.z-beamZ)<2);
  if(frontPosts.some(p=>!frontPiers.some(s=>Math.abs(s.x-p.x)<1)))issues.push('A front pergola post is not on a front-pier line.');
  if(Math.abs(data.pergola.customSize.widthFt-data.width)>2)issues.push('The pergola does not cover the deck.');
  const roofM2=data.pergola.customSize.widthFt*data.pergola.customSize.depthFt*0.09290304;
  if(roofM2<36||roofM2>37.2)issues.push(`The pergola roof is ${roofM2.toFixed(1)} m².`);
  const stairs=stairFootprints(tk);
  for(const p of stations){const poly=[{x:p.x-3,y:p.z-3},{x:p.x+3,y:p.z-3},{x:p.x+3,y:p.z+3},{x:p.x-3,y:p.z+3}];if(yardArea(yardClip([poly],stairs,'intersection'))>0.01)issues.push('A pergola post stands in the stair opening.');}
  const slider=data.houseConfig?.openings.find(o=>o.id==='slider'),hLeft=Math.min(...houseOutline(data).flat().map(p=>p.x));
  if(slider){const mid=hLeft+slider.offsetPct/100*(data.houseConfig?.widthFt??0)*12,a=mid-slider.widthIn/2-6,b=mid+slider.widthIn/2+6;if(stations.some(p=>p.x>a&&p.x<b&&Math.abs(p.z-houseZ)<8))issues.push('A pergola post blocks the slider.');}
  const stair=getStairPlacement(data,getFootprint(data));
  if(stair&&frontPosts.filter(p=>p.x<stair.origin.x-1||p.x>stair.origin.x+stair.width+1).length<2)issues.push('The front posts do not flank the stair.');
  const joistXs=framed.joists.map(j=>j.a.x);
  if(stations.some(p=>joistXs.some(x=>Math.abs(x-p.x)<3.24)))issues.push('A pergola post clips a joist.');
 }
 const notes=data.scopeOfWork??'';
 if(!notes.includes('1/2-1 in below the slider')||!notes.includes('8.5')||!notes.includes('21.5')||!notes.includes('23 ft')||!notes.includes('2.4 kPa')||!notes.includes('55 psf')||!notes.includes('Snow guards')||!notes.includes('solid pipe')||!notes.includes('helical')||!notes.includes('22-24')||!notes.includes('hurricane')||!notes.includes('2x6')||!notes.includes('concrete strip')||!notes.includes('11 stringers')||!notes.includes('doubled front rim')||!notes.includes('no guard')||!notes.includes('flashed trim'))issues.push('The build notes are missing a Joist re-check item.');
 if(/41 m|30\s*[x×]\s*30|30 ft maximum|Six posts|2\.5 kPa/i.test(notes))issues.push('The build notes still claim a 30 ft single span or the old roof area.');
 const table=data.landscapeObjects?.find(o=>o.id==='dining-table'),chairs=(data.landscapeObjects??[]).filter(o=>o.id.startsWith('dining-')&&o.id!=='dining-table');
 if(!table||table.assetId!=='teak-dining-table'||table.widthIn!==96||table.depthIn!==42||table.supportFeatureId||chairs.length!==8||chairs.some(o=>o.assetId!=='woven-dining-chair'||o.supportFeatureId))issues.push('The dining set is not a teak 8-seat table with woven chairs on the deck.');
 if((data.landscapeObjects??[]).some(o=>o.assetId==='outdoor-chair'||o.assetId==='outdoor-table'||o.assetId==='outdoor-sofa'))issues.push('A folding or legacy furniture mesh is still in the showcase (F-NO-FOLDING).');
 const heaters=(data.landscapeObjects??[]).filter(o=>o.assetId==='infrared-heater');
 if(heaters.length!==2||heaters.some(o=>o.supportFeatureId))issues.push('The pergola does not have two beam-hung infrared heaters.');
 if(table&&data.pergola&&Math.hypot(table.xIn/12-data.pergola.xFt,table.zIn/12-data.pergola.zFt)>1)issues.push('The dining table is not centred under the pergola.');
 const deckRingPts=deck.footprint.outline.map(p=>({x:p.x+deck.offset.x,y:p.y+deck.offset.z}));
 for(const chair of chairs){const front=seatFront(chair.rotationDeg),backX=chair.xIn-front.x*chair.depthIn/2,backZ=chair.zIn-front.z*chair.depthIn/2;if(!insidePolygon({x:backX-front.x*36,y:backZ-front.z*36},deckRingPts))issues.push(`${chair.id} has under 36 in behind it.`);}
 const obj=(id:string)=>data.landscapeObjects?.find(o=>o.id===id);
 const group=(pred:(o:LandscapeObject)=>boolean)=>(data.landscapeObjects??[]).filter(o=>o.kind==='furniture'&&pred(o));
 const bboxOf=(objs:LandscapeObject[])=>{const pts=objs.flatMap(o=>yardRectangle(o.xIn,o.zIn,o.widthIn,o.depthIn,o.rotationDeg*Math.PI/180));const xs=pts.map(p=>p.x),zs=pts.map(p=>p.y);return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};};
 {
  let foot=-Infinity,s0=Infinity,s1=-Infinity;
  for(const ring of stairFootprints(tk))for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
  const coverIn=Math.min(1.1,0.32*144/Math.max(1,s1-s0)),zN=foot-coverIn,zFar=zN+24*12,x0=Math.min(...deckXs)-8*12,x1=Math.max(...deckXs)+8*12;
  const rz0=zN+MARGIN+BAND,rz1=zFar-MARGIN-BAND,west={x0:x0+MARGIN+BAND,x1:s0-BAND},east={x0:s1+BAND,x1:x1-MARGIN-BAND};
  if(Math.abs((west.x1-west.x0)-(east.x1-east.x0))>0.5)issues.push('The terrace lounge and kitchen rooms are not the same size.');
  // F-CENTRED: each group centred in its framed room, ±3 in.
  const centred=(objs:LandscapeObject[],room:{x0:number;x1:number},label:string,aisle=0)=>{if(!objs.length){issues.push(`${label} is empty.`);return;}const b=bboxOf(objs);if(Math.abs((b.x0+b.x1)/2-(room.x0+room.x1)/2)>3||Math.abs((b.z0+b.z1+aisle)/2-(rz0+rz1)/2)>3)issues.push(`${label} is not centred in its framed room.`);if(b.x0<room.x0-0.5||b.x1>room.x1+0.5||b.z0<rz0-0.5||b.z1>rz1+0.5)issues.push(`${label} runs onto its frame.`);};
  const lounge=group(o=>o.id.startsWith('terrace-')&&o.assetId!=='outdoor-rug'&&o.assetId!=='outdoor-lantern'),kitchen=group(o=>o.id==='kitchen-island'||o.id.startsWith('bar-stool'));
  centred(lounge,west,'The terrace lounge');centred(kitchen,east,'The terrace kitchen');
  const sofa=obj('terrace-sofa'),coffee=obj('terrace-coffee'),rug=obj('terrace-rug'),tChairs=group(o=>o.id.startsWith('terrace-chair'));
  if(sofa?.assetId!=='modular-sofa'||coffee?.assetId!=='outdoor-coffee-table'||rug?.assetId!=='outdoor-rug'||tChairs.length!==2||tChairs.some(o=>o.assetId!=='swivel-lounge-chair')||[sofa,coffee,rug,...tChairs].some(o=>o?.supportFeatureId!=='terrace'))issues.push('The terrace lounge is not a modular sofa, two swivel chairs, a coffee table and a 9×12 rug on the terrace.');
  if(rug&&(rug.widthIn!==144||rug.depthIn!==108||Math.abs(rug.xIn-(west.x0+west.x1)/2)>3))issues.push('The terrace rug is not a centred 9×12.');
  if(coffee&&sofa&&(coffee.widthIn<0.5*sofa.widthIn||coffee.widthIn>0.75*sofa.widthIn))issues.push('The coffee table is not 50–75% of the sofa length.');
  if(group(o=>o.id.startsWith('terrace-lantern')).length!==2||group(o=>o.id.startsWith('lounge-lantern')).length!==2)issues.push('The lounges do not have two lanterns each.');
  const isl=obj('kitchen-island'),stools=group(o=>o.assetId==='bar-stool');
  if(!isl||isl.assetId!=='kitchen-island'||isl.supportFeatureId!=='terrace'||stools.length!==4)issues.push('The east room is not an outdoor kitchen island with four bar stools.');
  // The walk: nothing stands between the stringer lines from the stair foot to the far edge of the terrace.
  const corridor=[{x:s0,y:foot},{x:s1,y:foot},{x:s1,y:zFar},{x:s0,y:zFar}];
  if(s1-s0<96)issues.push('The stair path is under 8 ft wide.');
  for(const o of group(o=>o.supportFeatureId==='terrace'))if(yardArea(yardClip([yardRectangle(o.xIn,o.zIn,o.widthIn,o.depthIn,o.rotationDeg*Math.PI/180)],[corridor],'intersection'))>0.01)issues.push(`${o.name} blocks the walk from the stair toward the pool.`);
 }
 const lights=data.lightingSystem.selectedItems,placed=(id:string)=>lights.find(i=>i.productId===id)?.places?.length??0;
 if(placed(POOL_LIGHT_ID)!==3||placed('dot_22')<1||placed('dot_22')>4||placed('fusion_22')<12||placed('fusion_22')>16||placed('paver_40')!==1||placed('inground_2ss')!==2||placed('liv')<6||placed('big_scope_narrow')<8||placed('wedge_slim')!==0||placed('scope_ceiling')!==1||placed('evo_down')!==2||placed('halo_down')<6)issues.push('The lighting plan is not the best-practice set: 3 pool lights, up to 4 pool-deck markers, 12–16 band markers, a stair-foot marker, 2 post grazers, path lights, tree uplights, a dining downlight, 2 door lights and the post caps, and no seat-wall lights now the seat wall is gone.');
 if(lights.some(i=>i.productId==='scope'||i.productId==='liv_wall'))issues.push('Wide tree spots or the tall seat-wall lights are back.');
 const zoneOf=new Map(lights.map(i=>[i.productId,i.zone]));
 if(zoneOf.get(POOL_LIGHT_ID)!=='pool'||zoneOf.get('dot_22')!=='pool-deck'||zoneOf.get('big_scope_narrow')!=='accent-trees'||zoneOf.get('scope_ceiling')!=='pergola-dining'||zoneOf.get('evo_down')!=='facade')issues.push('The lights are not on their own zones.');
 const pinnedFixtures=lights.flatMap(i=>i.places?.length?i.places.map(p=>({productId:i.productId,x:p.x,z:p.z,y:p.y??0,angle:p.angle,zone:i.zone})):Array.from({length:i.qty},()=>({productId:i.productId,x:-9999,z:-9999,y:0,angle:0,zone:i.zone})));
 for(const msg of lightingPlacementIssues(data,tk,pinnedFixtures,{treadWidths:tk.treads.map(t=>treadNose(t).width),houseRings:houseOutline(data)}))if(!msg.includes('within 3 m of the pool. Use a GFCI'))issues.push(`Lighting rule: ${msg}`);
 for(const pool of data.pools??[]){const ring=poolWaterRing(pool);for(const p of lights.find(i=>i.productId==='dot_22')?.places??[]){const d=ringDistance(p.x,p.z,ring)-((pool.coping?.widthIn??12)-(pool.coping?.overhangIn??1));if(d<36||d>48)issues.push(`A pool-deck marker is ${d.toFixed(0)} in from the coping.`);}}
 const hardscape=pavingRings(data,tk),water=(data.pools??[]).map(poolOutline),bedRings=(data.landscapeObjects??[]).filter(o=>o.kind==='bed'&&(o.polygon?.length??0)>=3).map(o=>o.polygon!.map(p=>({x:p.x,y:p.z})));
 const bandOutlines=(data.yardFeatures??[]).filter(f=>f.id==='terrace'||f.id==='pool-court'||f.id==='lounge').flatMap(f=>patioInlayPlans(f).filter(p=>p.status==='ok').map(p=>p.outline));
 for(const item of lights){
  const product=getLightingRuntimeProduct(item.productId);if(!product||!item.places)continue;
  const field=item.productId==='dot_22',band=item.productId==='fusion_22'||item.productId==='paver_40',well=item.productId==='inground_2ss';
  for(const place of item.places){
   const paved=onPaving(hardscape,place.x,place.z),bed=bedRings.some(ring=>insidePolygon({x:place.x,y:place.z},ring)),swimming=water.some(ring=>insidePolygon({x:place.x,y:place.z},ring));
   if((product.geometry==='bollard'||product.geometry==='spot')&&(paved||!bed))issues.push(`${product.name} is not in a planting bed clear of the paving.`);
   if((field||band||well)&&(!paved||swimming))issues.push(`${product.name} is not on the paving clear of the water.`);
   if((field||band||well)&&Math.abs(place.y??0)>0.2)issues.push('A paver light is not seated on the paving surface.');
   if(field){
    const slab=(data.yardFeatures??[]).find(f=>(f.id==='terrace'||f.id==='pool-court'||f.id==='lounge')&&yardFeatureOutline(f).some(ring=>ring.length>=3&&insidePolygon({x:place.x,y:place.z},ring)));
    if(!slab)issues.push('A paver light is not on the terrace, the pool deck or the fire lounge.');
    else{
     const grid=grandeGrid(slab),loc=grid.toLocal(place.x,place.z);
     const along=((loc.x%grid.pitchX)+grid.pitchX)%grid.pitchX,across=((loc.z%grid.pitchZ)+grid.pitchZ)%grid.pitchZ;
     if(Math.abs(along-GRANDE_L/2)>0.2||Math.abs(across-GRANDE_W/2)>0.2)issues.push('A paver light is not centred in one Grande slab.');
     const bands=patioInlayPlans(slab).filter(p=>p.status==='ok').map(p=>p.outline),poolEx=(data.pools??[]).flatMap(poolPermanentExclusion);
     const hit=(polys:{x:number;y:number}[][],x:number,z:number)=>polys.some(poly=>poly.length>=3&&insidePolygon({x,y:z},poly));
     if(paverDotSamples(place.x,place.z).some(p=>hit(bands,p.x,p.z)||hit(poolEx,p.x,p.z)||!yardFeatureOutline(slab).some(ring=>insidePolygon({x:p.x,y:p.z},ring))))issues.push('A paver light leaves its slab and meets the band, the coping or the patio edge.');
    }
   }
   if(band&&!bandOutlines.some(poly=>poly.length>=3&&insidePolygon({x:place.x,y:place.z},poly)))issues.push(`${product.name} is not on the band.`);
   if(well&&!paved)issues.push('A post grazer is not on the paving.');
  }
 }
 // Pool deck: two chaise pairs, 24–36 in apart, each with a side table and a cantilever umbrella, symmetric about the
 // pool's cross-axis, feet to the water.
 const chaises=group(o=>o.assetId==='lounge-chair'&&o.supportFeatureId==='pool-court').sort((a,b)=>a.xIn-b.xIn);
 if(group(o=>o.assetId==='lounge-chair'&&o.supportFeatureId!=='pool-court').length)issues.push('Chaise loungers are off the pool deck.');
 const poolX=data.pools?.[0]?.xIn??0;
 if(chaises.length!==4)issues.push('The pool deck does not have two chaise pairs.');
 else{
  const pairs=[chaises.slice(0,2),chaises.slice(2)];
  for(const pair of pairs){
   const gap=pair[1].xIn-pair[0].xIn-(pair[0].widthIn+pair[1].widthIn)/2;
   if(gap<24||gap>36)issues.push(`A chaise pair is ${gap.toFixed(0)} in apart, not 24–36 in.`);
   const mid=(pair[0].xIn+pair[1].xIn)/2;
   if(!group(o=>o.assetId==='side-table'&&o.supportFeatureId==='pool-court').some(t=>Math.abs(t.xIn-mid)<1))issues.push('A chaise pair has no side table between it.');
   if(!group(o=>o.assetId==='cantilever-umbrella').some(u=>yardArea(yardClip([yardRectangle(u.xIn,u.zIn,u.widthIn,u.depthIn,u.rotationDeg*Math.PI/180)],[yardRectangle(mid,pair[0].zIn,90,pair[0].depthIn)],'intersection'))>0.9*90*pair[0].depthIn/144))issues.push('A chaise pair is not under its umbrella.');
  }
  if(Math.abs((chaises[0].xIn+chaises[3].xIn)/2-poolX)>1||chaises.some(c=>Math.abs(c.rotationDeg)>0.5))issues.push('The chaise pairs are not symmetric about the pool with their feet to the water.');
 }
 // Fire lounge: a curved sectional and two swivel chairs face a sculptural gas bowl 36–48 in off, side tables, no coffee table.
 const sect=obj('lounge-sectional'),swivels=group(o=>o.id.startsWith('lounge-chair-'));
 if(!fire||fire.productId!=='fire-gas-sculptural'||Math.abs(fire.widthFt*12-42)>0.5)issues.push('The fire lounge is not a 42 in sculptural gas bowl.');
 if(sect?.assetId!=='curved-sectional'||swivels.length!==2||swivels.some(o=>o.assetId!=='swivel-lounge-chair')||[sect,...swivels].some(o=>o?.supportFeatureId!=='lounge'))issues.push('The fire lounge is not a curved sectional and two swivel chairs.');
 if(group(o=>o.supportFeatureId==='lounge'&&o.assetId==='outdoor-coffee-table').length)issues.push('A coffee table is in the fire lounge.');
 if(group(o=>o.id.startsWith('lounge-side')&&o.assetId==='side-table').length!==2)issues.push('The fire lounge has no side tables.');
 if(fire&&sect){
  const f=seatFront(sect.rotationDeg),cx=sect.xIn+f.x*CURVED_SECTIONAL_ARC_OFFSET_IN,cz=sect.zIn+f.z*CURVED_SECTIONAL_ARC_OFFSET_IN;
  if(Math.hypot(cx-fire.xFt*12,cz-fire.zFt*12)>0.5)issues.push('The sectional is not centred on the fire.');
  const burner=fireOutline(fire);
  for(const chair of swivels){const gap=planGapIn(yardRectangle(chair.xIn,chair.zIn,chair.widthIn,chair.depthIn,chair.rotationDeg*Math.PI/180),burner);if(gap<36||gap>48)issues.push(`A fire lounge chair is ${gap.toFixed(1)} in from the burner.`);}
  const loungeGroup=bboxOf([sect,...swivels]);
  if(Math.abs((loungeGroup.x0+loungeGroup.x1)/2-lounge.xFt*12)>3||Math.abs((loungeGroup.z0+loungeGroup.z1)/2-lounge.zFt*12)>3)issues.push('The fire lounge group is not centred in the lounge.');
 }
 if(data.yardFeatures?.some(f=>f.kind==='retaining-wall'&&f.supportFeatureId==='lounge'))issues.push('A seat wall is still in the fire lounge.');
 // The design checker's outdoor-room rules (clearances, band width, paving count). The pool-enclosure reminder is a
 // scope note here, so it is checked as one.
 for(const msg of outdoorRoomIssues(data,tk))if(!msg.startsWith('A pool needs a by-law enclosure'))issues.push(`Room rule: ${msg}`);
 if(!(data.scopeOfWork??'').includes('Pool enclosure')||!(data.scopeOfWork??'').includes('self-latching'))issues.push('The build notes do not cover the pool enclosure.');
 if(!data.autoLighting?.stairs||data.autoLighting.stairsPerTread!==2)issues.push('The 8 ft stair does not have two lights a tread.');
 if(placed('halo_down')>=tk.railing.posts.length)issues.push('Every deck post has a cap light; light the stair posts, corners and every other post.');
 if(!data.pergola?.lighting)issues.push('The pergola has no lights.');
 if(!fire?.supportFeatureId)issues.push('The fire bowl is not on the lounge.');
 if(fire){
  const body=fireOutline(fire),rings=[...houseOutline(data),...tk.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...stairFootprints(tk)];
  const gap=Math.min(...rings.filter(r=>r.length>=3).map(r=>planGapIn(body,r)));
  if(gap<48)issues.push(`Fire clearance is ${(gap/12).toFixed(2)} ft.`);
 }
 const cameras=data.scenePresentation?.cameras??[];
 if(data.scenePresentation?.activeCameraId!=='hero'||!['hero','terrace-eye','pool','fire','dining','terrace-lounge','kitchen','overhead','stair-up'].every(id=>cameras.some(c=>c.id===id)))issues.push('Hero, terrace, pool, fire, dining, terrace-lounge, kitchen, overhead and stair cameras are missing.');
 const stairCam=cameras.find(c=>c.id==='stair-up');
 if(stairCam&&stairCam.positionIn[2]<=stairCam.targetIn[2])issues.push('The terrace stair camera does not look up the stair toward the deck.');
 const diningView=cameras.find(c=>c.id==='dining');
 if(diningView&&table){
  if(Math.abs(diningView.positionIn[1]-(data.height+60))>8)issues.push('The dining camera is not about 5 ft above the deck.');
  if(diningView.targetIn[1]<data.height+48)issues.push('The dining camera looks down at the floor.');
  if(Math.hypot(diningView.positionIn[0]-table.xIn,diningView.positionIn[2]-table.zIn)<96)issues.push('The dining camera is too close to show the whole table.');
 }
 issues.push(...furnitureFacingIssues(data));
 return issues;
}
