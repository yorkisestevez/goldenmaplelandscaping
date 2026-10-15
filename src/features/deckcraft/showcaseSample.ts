import type {DeckData,PatioInlay,YardFeature} from './types';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
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
import {newLandscapeObject,newLandscapePlant} from './landscapeCatalogue';
import {patioInlayPlans} from './patioInlays';
import {onPaving,pavingRings} from './pathLightPlacement';
import {poolOutline,poolPermanentExclusion} from './poolGeometry';
import {getLightingRuntimeProduct} from './lightingRuntimeCatalogue';
import {insidePolygon} from './lib/polygonCuts';
import {furnitureFacingIssues,nearestSeatPoint,rotationDegFacing,seatFront} from './furnitureFacing';

/**
 * The yard used for showcase stills: a two-storey contemporary house on a
 * 100×160 ft lot. One light-slab spine steps off the deck stairs — dining
 * terrace, pool court, and a fire lounge beside it — wrapped in deep beds.
 * It is a sample, not the editor's default deck. Pricing runs through the
 * same takeoff as any other design.
 * Planting uses the Ontario library: cedar hedge, sugar maple, white pine,
 * serviceberry, hydrangea, dogwood and Karl Foerster, layered back to front.
 * The pool feature has no underwater light. Chaise loungers sit on the pool
 * deck only, feet toward the water. The fire lounge seats two sofas facing the burner, 36–48 in
 * clear; the low table between them is the outdoor coffee table. Path bollards
 * stand in the planting beds beside the walks, never on paving. The pool deck,
 * terrace and fire lounge take flush EVO GROUND fixtures and WEDGE step lights
 * at the edges; those edge lights wash the water. The terrace lounge sits on the
 * west half, beside the deck, and leaves an 8 ft path from the stair foot toward
 * the pool. It is flush-lit only: one long sofa and two deep chairs from the
 * outdoor-sofa mesh, with a low table, in about a 12×12 ft group. There is no
 * club-chair product. The pergola is one black LOUSOL roof on the freestanding deck, louvers
 * open. Eight posts stand tight against the outside face of each beam:
 * the house line at 1, 8.5, 21.5 and 29 ft, clear of the slider, and the
 * front line on the four piers at 1, 10.33, 19.67 and 29 ft. Joists shift
 * so no post clips a joist. The dining table is the folding-table mesh scaled to an
 * eight-seat envelope on the deck; there is no larger table product.
 * The house front is 48 ft. The 30 ft deck is centred on that wall.
 * A saved camera on the terrace looks up the centre stair at the deck and pergola.
 */
const SLAB='techo-blu60-smooth-slab';
const ONYX='#565855',CREMA='#cabaaa',WALL_ONYX='#4b4d4d';
const BORDER:YardFeature['hardscape']={finishId:'hd-smooth6-13',colorId:'onyx-black',unitId:'standalone-6x13',patternId:'l77-linear-laying-pattern-09-100-6x13',angleDeg:0,jointMm:7};
const FIELD:YardFeature['hardscape']={finishId:'hd-smooth-grande',colorId:'caff-crema',unitId:'grande-495-825-60',patternId:'linear-laying-pattern-05-100-blu-grande',angleDeg:0,jointMm:7};
const SEAT:YardFeature['hardscape']={finishId:'smooth',colorId:'onyx-black',unitId:'double-sided-397-249-90',patternId:'running-bond',angleDeg:0,jointMm:0};
const SEAT_DEPTH=249/304.8;
/** One 6×13 course (330 mm) across the band, and the same reveal of field paver outside it. */
const BAND=330/25.4,MARGIN=BAND;
const BORDER_IN=BAND;
const LOT_W=100,LOT_D=160;
const JOIN=2/12;

/** Picture-frame strips, each within the 20 ft inlay limit, on a light field. */
function borderStrips(f:YardFeature):PatioInlay[]{
 const w=f.widthFt*12,d=f.depthFt*12,b=BORDER_IN,out:PatioInlay[]=[];
 const pieces=(span:number)=>{const n=Math.ceil(span/240-1e-6),size=span/n;return Array.from({length:n},(_,i)=>({at:-span/2+size*(i+.5),size}));};
 let k=0;
 const add=(xIn:number,yIn:number,widthIn:number,depthIn:number)=>{out.push({id:`${f.id}-border-${k++}`,name:'Onyx border',shape:'rectangle',xIn,yIn,widthIn,depthIn,rotationDeg:0,productId:SLAB,color:ONYX,hardscape:{...BORDER!}});};
 for(const side of [-1,1])for(const p of pieces(w))add(p.at,side*(d/2-b/2),p.size,b);
 for(const side of [-1,1])for(const p of pieces(d-2*b))add(side*(w/2-b/2),p.at,b,p.size);
 return out;
}

/** One onyx picture frame, inset by the same margin on every side of a world-inch rectangle. Corners belong to the
 * across-yard strips so the returns meet them on a straight joint and never overlap. */
function rectFrame(f:YardFeature,rect:{x0:number;x1:number;z0:number;z1:number}):PatioInlay[]{
 const B=BAND,M=MARGIN,cx=f.xFt*12,cz=f.zFt*12,out:PatioInlay[]=[];
 const x0=rect.x0+M,x1=rect.x1-M,z0=rect.z0+M,z1=rect.z1-M;
 if(x1-x0<=2*B+1||z1-z0<=2*B+1)throw Error(`${f.name} is too small for an even onyx frame.`);
 let k=0;
 const cuts=(a:number,c:number)=>{const n=Math.ceil((c-a)/240-1e-9),size=(c-a)/n;return Array.from({length:n},(_,i)=>[a+size*i,a+size*(i+1)] as const);};
 const add=(ax:number,az:number,bx:number,bz:number)=>out.push({id:`${f.id}-border-${k++}`,name:'Onyx border',shape:'rectangle',xIn:(ax+bx)/2-cx,yIn:(az+bz)/2-cz,widthIn:bx-ax,depthIn:bz-az,rotationDeg:0,productId:SLAB,color:ONYX,hardscape:{...BORDER!}});
 for(const [a,c] of cuts(x0,x1)){add(a,z0,c,z0+B);add(a,z1-B,c,z1);}
 for(const [a,c] of cuts(z0+B,z1-B)){add(x0,a,x0+B,c);add(x1-B,a,x1,c);}
 return out;
}

function push(data:DeckData,feature:YardFeature){data.yardFeatures=[...(data.yardFeatures??[]),feature];return feature;}
function slab(data:DeckData,id:string,name:string,x0:number,z0:number,x1:number,z1:number,border=false){
 const feature={...createYardFeature(data,{kind:'patio',id,name,xFt:(x0+x1)/2,zFt:(z0+z1)/2,widthFt:x1-x0,depthFt:z1-z0,heightIn:0,productId:SLAB,hardscape:FIELD}),color:CREMA};
 return push(data,border?{...feature,inlays:borderStrips(feature)}:feature);
}
function rectOf(f:YardFeature){const x=(f.xFt-f.widthFt/2)*12,z=(f.zFt-f.depthFt/2)*12,w=f.widthFt*12,d=f.depthFt*12;return [{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];}

/** Blu Grande, long side across the yard. The 300 mm lens fits inside one stone with room to spare. */
const GRANDE_L=825/25.4,GRANDE_W=495/25.4,GRANDE_J=7/25.4,PAVER_LENS_L=11.811,PAVER_LENS_W=1.1811;
type PaverPin={x:number;z:number;angle:number;y?:number};
function grandeGrid(f:YardFeature){
 const turn=((f.rotationDeg??0)+(f.hardscape?.angleDeg??0))*Math.PI/180,c=Math.cos(turn),s=Math.sin(turn),pitchX=GRANDE_L+GRANDE_J,pitchZ=GRANDE_W+GRANDE_J;
 const toLocal=(x:number,z:number)=>{const dx=x-f.xFt*12,dz=z-f.zFt*12;return {x:c*dx+s*dz,z:-s*dx+c*dz};};
 const toWorld=(lx:number,lz:number)=>({x:f.xFt*12+c*lx-s*lz,z:f.zFt*12+s*lx+c*lz});
 // The housing's long axis is local +X. A yaw of −turn sends that axis along the slab.
 return {pitchX,pitchZ,toLocal,toWorld,angle:-turn};
}
function paverLensCorners(x:number,z:number,angle:number){
 const c=Math.cos(angle),s=Math.sin(angle),out:{x:number;z:number}[]=[];
 for(const u of [-PAVER_LENS_L/2,PAVER_LENS_L/2])for(const v of [-PAVER_LENS_W/2,PAVER_LENS_W/2])out.push({x:x+c*u+s*v,z:z-s*u+c*v});
 return out;
}
/** Move each flush lens onto the centre of one whole Grande slab, long axis with the joints. */
function seatOnGrande(features:YardFeature[],pools:DeckData['pools'],places:PaverPin[],blocked:{x:number;y:number}[][]=[]){
 const grids=features.map(f=>({...grandeGrid(f),id:f.id,rings:yardFeatureOutline(f),bands:patioInlayPlans(f).filter(p=>p.status==='ok').map(p=>p.outline)}));
 const poolEx=(pools??[]).flatMap(poolPermanentExclusion),used=new Set<string>();
 const inside=(polys:{x:number;y:number}[][],x:number,z:number)=>polys.some(poly=>poly.length>=3&&insidePolygon({x,y:z},poly));
 const clear=(g:typeof grids[number],x:number,z:number)=>paverLensCorners(x,z,g.angle).every(p=>inside(g.rings,p.x,p.z)&&!inside(g.bands,p.x,p.z)&&!inside(poolEx,p.x,p.z)&&!inside(blocked,p.x,p.z));
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
  used.add(best.key);return {...p,x:best.x,z:best.z,angle:g.angle};
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

export function ontarioShowcaseDesign():DeckData{
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
  pictureFrameRows:1,pictureFrameOverhangIn:0,railingType:'Aluminum',
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
 terrace={...terrace,color:CREMA,inlays:rectFrame(terrace,{x0,x1,z0:zN,z1:zFar})};
 push(data,terrace);

 // The 36 ft pool run is across the yard. The court is 20 ft larger than the pool on both axes, so the
 // surround — and the onyx frame inset into it — is the same on every side.
 const far=terrace.zFt+terrace.depthFt/2;
 const courtDepth=36;
 const court=slab(data,'pool-court','Pool court',-4,far-JOIN,52,far-JOIN+courtDepth);
 const courtX0=(court.xFt-court.widthFt/2)*12,courtX1=(court.xFt+court.widthFt/2)*12,courtZ0=(court.zFt-court.depthFt/2)*12,courtZ1=(court.zFt+court.depthFt/2)*12;
 court.inlays=rectFrame(court,{x0:courtX0,x1:courtX1,z0:courtZ0,z1:courtZ1});
 const lounge=slab(data,'lounge','Fire lounge',-28,court.zFt-court.depthFt/2,-10,court.zFt-court.depthFt/2+18,true);
 slab(data,'spine-walk','Spine walk',-10-JOIN,lounge.zFt-lounge.depthFt/2-JOIN,-4+JOIN,lounge.zFt+lounge.depthFt/2+JOIN);
 const terraceX0=terrace.xFt-terrace.widthFt/2;
 slab(data,'west-walk','West walk',-14,deckFront/12,terraceX0+JOIN,far+JOIN);
 slab(data,'lounge-path','Lounge path',-28,36,terraceX0+JOIN,46);

 const lx0=(lounge.xFt-lounge.widthFt/2)*12,lx1=(lounge.xFt+lounge.widthFt/2)*12,lz0=(lounge.zFt-lounge.depthFt/2)*12,lz1=(lounge.zFt+lounge.depthFt/2)*12,inset=28;
 // The west leg steps out so two sofas can face the burner with 36–48 in of clearance and still sit on the paving.
 const westLeg=lx0+inset-12;
 const seatPath=[{x:lx1-inset-18,y:lz0+inset},{x:westLeg,y:lz0+inset},{x:westLeg,y:lz1-inset},{x:lx1-inset-18,y:lz1-inset}];
 push(data,{...createYardFeature(data,{kind:'retaining-wall',id:'seat-wall',name:'Seat wall',wallPath:seatPath,heightIn:18,depthFt:SEAT_DEPTH,productId:'techo-raffinato-wall',hardscape:SEAT,freestanding:true,supportFeatureId:lounge.id}),color:WALL_ONYX});
 const sofaDepthFt=36/12,burnerFt=1.75,edgePad=2/12;
 const innerX=westLeg/12+SEAT_DEPTH/2,patioEast=lounge.xFt+lounge.widthFt/2;
 const fireX=(innerX+edgePad+sofaDepthFt+patioEast-edgePad-sofaDepthFt)/2,fireZ=lounge.zFt;
 push(data,{...createYardFeature(data,{kind:'fire-feature',id:'fire-bowl',name:'Fire bowl',xFt:fireX,zFt:fireZ,widthFt:3.5,depthFt:3.5,productId:'fire-gas-bowl',supportFeatureId:lounge.id}),color:'#8a8478'});

 const poolLengthIn=16*12,poolShape=poolRoundedRectangle(36*12,poolLengthIn);
 const pool={...createPlanningPool({id:'lap-pool',name:'Lap pool',type:'fiberglass',xIn:court.xFt*12,zIn:court.zFt*12,copingTopElevationIn:0,shape:'rounded-rectangle'}),...poolShape,depthProfile:[{stationIn:0,depthIn:48},{stationIn:poolLengthIn,depthIn:48}]};
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
  'Build notes for Joist. The model shows what DeckCraft can draw; the rest is construction intent.',
  `Freestanding deck, not fastened to the house. Set the deck 1/2-1 in below the slider sill. The house-side beam stands on its own piers ${houseZ.toFixed(0)} in off the foundation wall. Those piers go to undisturbed soil below the backfill, or use helical piles. Other piers are ${data.foundationDepthIn} in deep, below the Barrie frost line.`,
  'The pergola is freestanding, not attached to the house. Eight posts sit tight against the outside beam faces (house beam on the house side, front beam on the yard side) on engineer-designed combined footings. House posts at 1, 8.5, 21.5 and 29 ft keep each span under the 23 ft LOUSOL limit. Front posts at 1, 10.33, 19.67 and 29 ft flank the stair. Interior posts need a 22-24 in bell or pad. Use rated post bases, hurricane ties and diagonal 2x6 bracing in both end bays.',
  'Posts drop through the deck. Frame headers and blocking around each with about a 1/2 in gap, and do not notch the posts. The preview does not cut those holes. Shifted joists keep every post clear of a joist. Drain each post in solid pipe to daylight, away from the piers and the foundation.',
  `LOUSOL custom, black, one roof of about ${roofM2.toFixed(1)} m². A permit is required, and the roof needs LOUSOL's sealed design. Closed-louver snow is about 2.4 kPa against their 55 psf limit; confirm uplift. Snow guards on the house roof, or a setback so snow can slide off.`,
  'Guards are 36 in, openings of 4 in or less, on the ends and yard side, open at the stair. The house edge has no guard. The 16 in gap gets a flashed trim board or rim. Posts are aluminum rail posts, separate from the pergola posts.',
  'The stair is an 8 ft centre flight: 5 risers at 7.2 in, 4 treads at an 11 in run, 11 stringers at 10 in o.c., a doubled front rim at the stair, and a handrail on both sides. The crema terrace landing is at least the stair width by 36 in deep, with a concrete strip under the pavers at the stair foot.',
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
 // Fence line, then a middle shrub layer, then grasses and perennials at the bed's inner edge.
 line('x',-36.5,6,zEnd,3.35,['thuja-occidentalis-smaragd'],112,34);
 line('x',-34.6,12,zEnd-4,14,['acer-saccharum','pinus-strobus'],240,120);
 line('x',-32.2,8,zEnd,3.6,['hydrangea-arborescens-annabelle','cornus-sericea','amelanchier-canadensis','hydrangea-paniculata','syringa-vulgaris']);
 line('x',-29.4,7,zEnd,2.5,['calamagrostis-karl-foerster','hosta','echinacea-purpurea','rudbeckia-hirta','matteuccia-struthiopteris','schizachyrium-scoparium']);
 line('x',60.5,6,zEnd,3.35,['thuja-occidentalis-smaragd'],112,34);
 line('x',58.6,12,zEnd-4,14,['pinus-strobus','acer-saccharum'],230,110);
 line('x',55.8,8,zEnd,3.6,['cornus-sericea','hydrangea-arborescens-annabelle','amelanchier-canadensis','physocarpus-opulifolius','hydrangea-paniculata']);
 line('x',53.4,7,zEnd,2.5,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','panicum-virgatum','hemerocallis','nepeta-faassenii']);
 line('z',rear1-1.5,-34,58,3.2,['thuja-occidentalis-smaragd'],112,34);
 line('z',(rear0+rear1)/2,-30,54,4.2,['acer-saccharum','amelanchier-canadensis','syringa-vulgaris','pinus-strobus'],200,100);
 line('z',rear0+1.5,-32,56,2.8,['calamagrostis-karl-foerster','hydrangea-arborescens-annabelle','hosta','rudbeckia-hirta']);
 line('x',48,8,flank1-1.2,3.4,['hydrangea-paniculata','cornus-sericea','amelanchier-canadensis']);
 line('x',terrace.xFt+terrace.widthFt/2+2.4,7,flank1-1.4,2.6,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','salvia-nemorosa']);
 line('z',rear0-1.4,-26,-8,3.4,['thuja-occidentalis-smaragd','pinus-strobus'],140,48);
 line('z',loungeFar+2,-25,-7,3.2,['hydrangea-arborescens-annabelle','cornus-sericea','calamagrostis-karl-foerster']);
 grow('hydrangea-arborescens-annabelle',-22,6);grow('cornus-sericea',-14,6);

 const diningX=data.pergola.xFt,diningZ=data.pergola.zFt;
 // The west inner court of the onyx frame, clear of the stair. The lounge group is centred in that rectangle.
 const westX0=x0+MARGIN+BAND,westX1=s0,westZ0=zN+MARGIN+BAND,westZ1=zFar-MARGIN-BAND;
 const loungeX=(westX0+westX1)/24,loungeCz=(westZ0+westZ1)/2,sofaD=40,chairD=40,tableD=36,gap=14;
 const sofaZ=(loungeCz-(sofaD+2*gap+tableD)/2)/12,tableZ=sofaZ+(sofaD+2*gap+tableD)/24,chairZ=tableZ+(tableD+2*gap+chairD)/24;
 const nearDeck=court.zFt-court.depthFt/2+3.8,farDeck=court.zFt+court.depthFt/2-3.6;
 // Long side across the 30 ft deck so 36 in behind the side chairs fits in the 16 ft depth. No patio id: the set sits on the deck.
 const table={...furn('outdoor-table','dining-table','Dining table',diningX,diningZ,0),widthIn:96,depthIn:42,heightIn:30};
 const water=poolOutline(pool);
 const aim=(xFt:number,zFt:number,tx:number,tz:number)=>rotationDegFacing(tx-xFt*12,tz-zFt*12);
 const aimPool=(xFt:number,zFt:number)=>{const edge=nearestSeatPoint({x:xFt*12,y:zFt*12},water);return aim(xFt,zFt,edge.x,edge.y);};
 const seat=(id:string,dx:number,dz:number)=>furn('outdoor-chair',id,'Dining chair',diningX+dx,diningZ+dz,aim(diningX+dx,diningZ+dz,diningX*12,diningZ*12));
 data.landscapeObjects=[
  bed('bed-west','West planting',-38,2,-28,rear0+4),
  bed('bed-east','East planting',52,2,62,rear0+4),
  bed('bed-rear','Rear planting',-38,rear0,62,rear1),
  polyBed('bed-flank','Terrace planting',[{x:deckX1/12+0.2,z:2},{x:51.7,z:2},{x:51.7,z:flank1},{x:terrace.xFt+terrace.widthFt/2+0.3,z:flank1},{x:terrace.xFt+terrace.widthFt/2+0.3,z:deckFront/12},{x:deckX1/12+0.2,z:deckFront/12}]),
  bed('bed-deckside','Deckside planting',-28,2,0,16),
  bed('bed-court-west','Pool planting',-28,loungeFar+0.2,-4.2,rear0-0.1),
  ...plants,
  table,
  seat('dining-1',-2.987,-3.173),seat('dining-2',0,-2.833),seat('dining-3',2.987,-3.173),
  seat('dining-4',-2.987,3.173),seat('dining-5',0,2.833),seat('dining-6',2.987,3.173),
  seat('dining-7',-5.083,0),seat('dining-8',5.083,0),
  {...furn('outdoor-sofa','terrace-sofa','Terrace sofa',loungeX,sofaZ,aim(loungeX,sofaZ,loungeX*12,tableZ*12),terrace.id),widthIn:144,depthIn:sofaD,heightIn:32},
  {...furn('outdoor-sofa','terrace-chair-1','Terrace lounge chair',loungeX-3.4,chairZ,aim(loungeX-3.4,chairZ,loungeX*12,tableZ*12),terrace.id),widthIn:46,depthIn:chairD,heightIn:32},
  {...furn('outdoor-sofa','terrace-chair-2','Terrace lounge chair',loungeX+3.4,chairZ,aim(loungeX+3.4,chairZ,loungeX*12,tableZ*12),terrace.id),widthIn:46,depthIn:chairD,heightIn:32},
  {...furn('outdoor-coffee-table','terrace-coffee','Terrace table',loungeX,tableZ,0,terrace.id),widthIn:72,depthIn:tableD,heightIn:16},
  furn('outdoor-sofa','lounge-west','Lounge sofa',innerX+edgePad+sofaDepthFt/2,fireZ,aim(innerX+edgePad+sofaDepthFt/2,fireZ,fireX*12,fireZ*12),lounge.id),
  furn('outdoor-sofa','lounge-east','Lounge sofa',patioEast-edgePad-sofaDepthFt/2,fireZ,aim(patioEast-edgePad-sofaDepthFt/2,fireZ,fireX*12,fireZ*12),lounge.id),
  furn('outdoor-coffee-table','lounge-table','Fire table',(innerX+edgePad+sofaDepthFt+(fireX-burnerFt))/2,fireZ,90,lounge.id),
  furn('lounge-chair','pool-near-1','Pool lounge',court.xFt-10,nearDeck,aimPool(court.xFt-10,nearDeck),court.id),
  furn('lounge-chair','pool-near-2','Pool lounge',court.xFt+10,nearDeck,aimPool(court.xFt+10,nearDeck),court.id),
  furn('lounge-chair','pool-far-1','Pool lounge',court.xFt-8,farDeck,aimPool(court.xFt-8,farDeck),court.id),
  furn('lounge-chair','pool-far-2','Pool lounge',court.xFt+8,farDeck,aimPool(court.xFt+8,farDeck),court.id),
 ];

 const lit=buildDeckTakeoff(data);
 // The pool feature has no underwater lamp. Bollards and stake spots stay in the beds.
 // EVO GROUND is flush in the paving; WEDGE step lights at the edges wash the deck and the water.
 // LIV WALL fixtures wash the fire lounge. Each place is model inches. Real preview lights are the
 // 8 spots and 8 bollards; the flush fixtures are listed after them so they glow without taking a slot.
 const pin=(xFt:number,zFt:number,angle=0,y?:number)=>({x:xFt*12,z:zFt*12,angle,...(y===undefined?{}:{y})});
 const cx=court.xFt,cz=court.zFt,tx0=terrace.xFt-terrace.widthFt/2,tx1=terrace.xFt+terrace.widthFt/2,tz1=terrace.zFt+terrace.depthFt/2,bedNorth=lounge.zFt+lounge.depthFt/2;
 const path=[pin(-16,13),pin(-10,13),pin(-30.5,40),pin(-30.5,52),pin(-20,bedNorth+4),pin(-12,bedNorth+4),pin(54.5,50),pin(54.5,68)];
 const spots=[pin(-32,24,Math.PI/2),pin(-32,55,Math.PI/2),pin(-34,36,Math.PI/2),pin(-18,bedNorth+4,Math.PI/2),pin(56,24,-Math.PI/2),pin(56,42,-Math.PI/2),pin(56,55,-Math.PI/2),pin(56,70,-Math.PI/2)];
 // Each lens is the centre of one Grande slab, long axis with the joints, clear of the onyx band,
 // the pool coping and the furniture. A bar that starts near a slab end runs across that joint.
 const paverHosts=[terrace,court,lounge];
 const paverBlocked=(data.landscapeObjects??[]).filter(o=>o.kind==='furniture').map(o=>yardRectangle(o.xIn,o.zIn,o.widthIn,o.depthIn,(o.rotationDeg??0)*Math.PI/180));
 const pavers=seatOnGrande(paverHosts,data.pools,[
  pin(cx-12,cz-10),pin(cx,cz-10),pin(cx+12,cz-10),pin(cx-20,cz),pin(cx+20,cz),pin(cx,cz+9),
  pin(tx0+4,33),pin(tx1-4,19),pin(tx0+4,tz1-3),pin(terrace.xFt,tz1-3),pin(tx1-4,tz1-3),
  pin(loungeX-7.2,sofaZ),pin(loungeX+7.2,sofaZ),pin(loungeX-7.2,chairZ),pin(loungeX+7.2,chairZ),
  pin(-21,fireZ-5.4),pin(-15,fireZ-5.4),pin(-21,fireZ+5.2),pin(-15,fireZ+5.2),
 ],paverBlocked);
 // Coping is 12 in wide with 1 in of overhang, so the outer face is 11 in outside the water. The plate sits in that face.
 const cope=11,halfW=18*12,halfL=8*12,faceY=-1,paverFace=-60/25.4/2,terraceMid=(zN+zFar)/2;
 const onFace=(xIn:number,zIn:number,angle:number,y=faceY)=>pin(xIn/12,zIn/12,angle,y);
 const steps=[
  onFace(cx*12-16*12,cz*12-halfL-cope,0),onFace(cx*12,cz*12-halfL-cope,0),onFace(cx*12+16*12,cz*12-halfL-cope,0),
  onFace(cx*12-16*12,cz*12+halfL+cope,Math.PI),onFace(cx*12,cz*12+halfL+cope,Math.PI),onFace(cx*12+16*12,cz*12+halfL+cope,Math.PI),
  onFace(cx*12-halfW-cope,cz*12,Math.PI/2),onFace(cx*12+halfW+cope,cz*12,-Math.PI/2),
  onFace(x0+0.25,terraceMid,-Math.PI/2,paverFace),onFace(x1-0.25,terraceMid,Math.PI/2,paverFace),
 ];
 const loungeWall=[pin(innerX+0.45,fireZ-4.4,Math.PI/2,16),pin(innerX+0.45,fireZ+4.4,Math.PI/2,16),pin(fireX,(lz0+inset)/12+SEAT_DEPTH/2+0.4,0,16),pin(fireX,(lz1-inset)/12-SEAT_DEPTH/2-0.4,Math.PI,16)];
 data.lightingSystem={wireDistance:80,selectedItems:syncAutoLighting({...data,lightingSystem:{wireDistance:80,selectedItems:[
  {productId:'scope',qty:spots.length,zone:'landscape',places:spots},
  {productId:'liv',qty:path.length,zone:'landscape',places:path},
  {productId:'evo_ground_300',qty:pavers.length,zone:'landscape',places:pavers},
  {productId:'wedge',qty:steps.length,zone:'deck',places:steps},
  {productId:'liv_wall',qty:loungeWall.length,zone:'deck',places:loungeWall},
 ]}}, {posts:lit.quantities.railingPosts,stairs:lit.treads.length,privacy:0})};

 // Over the rear bed, inside the fence, looking back at the house. The spine
 // fills the frame and the context trees sit behind the lens.
 const hero={position:[-6,30,82] as [number,number,number],target:[15,2,30] as [number,number,number]};
 const eye={position:[28,5.4,22] as [number,number,number],target:[6,1.2,58] as [number,number,number]};
 const poolCam={position:[24,12,36] as [number,number,number],target:[24,0,64] as [number,number,number]};
 const fireCam={position:[-6,8.2,31] as [number,number,number],target:[fireX,1.05,fireZ] as [number,number,number]};
 const diningCam={position:[3.2,data.height/12+5,15.15] as [number,number,number],target:[14.2,9.4,7.1] as [number,number,number]};
 const terraceLoungeCam={position:[18,5.2,24] as [number,number,number],target:[loungeX,1.1,tableZ] as [number,number,number]};
 const stairMid=(s0+s1)/24;
 const stairUp={position:[stairMid,5.2,foot/12+6] as [number,number,number],target:[stairMid,6.5,data.length*0.45] as [number,number,number]};
 const shot=(id:string,name:string,frame:{position:[number,number,number];target:[number,number,number]},fov:number)=>({id,name,fov,positionIn:frame.position.map(n=>n*12) as [number,number,number],targetIn:frame.target.map(n=>n*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',cameraPreset:'terrace',activeCameraId:'hero',cameras:[shot('hero','Whole property',hero,56),shot('terrace-eye','Terrace toward the pool',eye,55),shot('pool','Pool court',poolCam,42),shot('fire','Fire lounge',fireCam,42),shot('dining','Dining set',diningCam,66),shot('terrace-lounge','Terrace lounge',terraceLoungeCam,50),shot('stair-up','Up the stair',stairUp,48)]};
 return data;
}

function gapOf(a:YardFeature,b:YardFeature){const ax0=a.xFt-a.widthFt/2,ax1=a.xFt+a.widthFt/2,az0=a.zFt-a.depthFt/2,az1=a.zFt+a.depthFt/2,bx0=b.xFt-b.widthFt/2,bx1=b.xFt+b.widthFt/2,bz0=b.zFt-b.depthFt/2,bz1=b.zFt+b.depthFt/2,sx=ax1<bx0?bx0-ax1:bx1<ax0?ax0-bx1:0,sz=az1<bz0?bz0-az1:bz1<az0?az0-bz1:0;return sx===0||sz===0?sx+sz:Math.hypot(sx,sz);}
function overlapSqft(a:YardFeature,b:YardFeature){return yardArea(yardClip([rectOf(a)],[rectOf(b)],'intersection'));}

/** Layout promises the stills rely on. Empty when the sample is buildable. */
export function showcaseSampleIssues(data=ontarioShowcaseDesign()):string[]{
 const issues:string[]=[];
 if(data.permitSite?.lotWidthFt!==LOT_W||data.permitSite.lotDepthFt!==LOT_D)issues.push('Lot is not 100×160 ft.');
 const terrace=data.yardFeatures?.find(f=>f.id==='terrace'),lounge=data.yardFeatures?.find(f=>f.id==='lounge'),court=data.yardFeatures?.find(f=>f.id==='pool-court'),walk=data.yardFeatures?.find(f=>f.id==='spine-walk'),west=data.yardFeatures?.find(f=>f.id==='west-walk'),loungePath=data.yardFeatures?.find(f=>f.id==='lounge-path'),fire=data.yardFeatures?.find(f=>f.id==='fire-bowl'),wall=data.yardFeatures?.find(f=>f.id==='seat-wall');
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
 if([terrace,court,walk,west,loungePath].some(f=>f.hardscape?.colorId!=='caff-crema'))issues.push('The spine is not one crema grande slab.');
 if(overlapSqft(terrace,court)<1||overlapSqft(walk,court)<0.4||overlapSqft(walk,lounge)<0.4||overlapSqft(walk,terrace)<0.2)issues.push('Terrace, pool court and fire lounge are not joined.');
 const loungeGap=gapOf(lounge,court);if(loungeGap<5||loungeGap>6.5)issues.push(`Lounge and pool court are ${loungeGap.toFixed(1)} ft apart.`);
 for(const room of [terrace,lounge,court]){const plans=patioInlayPlans(room);if(!plans.length||plans.some(p=>p.status!=='ok')||plans.some(p=>p.inlay.hardscape?.colorId!=='onyx-black'))issues.push(`${room.name} is missing its onyx border.`);}
 {
  const bandOf=(room:YardFeature)=>{const plans=patioInlayPlans(room).filter(p=>p.status==='ok');const xs=plans.flatMap(p=>p.outline.flatMap(v=>[v.x])),zs=plans.flatMap(p=>p.outline.flatMap(v=>[v.y]));return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),plans};};
  const even=(room:YardFeature,rect:{x0:number;x1:number;z0:number;z1:number},label:string)=>{
   const band=bandOf(room);
   const gaps=[band.x0-rect.x0,rect.x1-band.x1,band.z0-rect.z0,rect.z1-band.z1];
   if(gaps.some(g=>Math.abs(g-MARGIN)>0.2))issues.push(`${label} onyx frame is not inset evenly (${gaps.map(g=>g.toFixed(1)).join(', ')} in).`);
   if(band.plans.some(p=>Math.abs(Math.min(p.inlay.widthIn,p.inlay.depthIn)-BAND)>0.2))issues.push(`${label} onyx band is not one 6×13 course.`);
   const cx=(band.x0+band.x1)/2,cz=(band.z0+band.z1)/2;
   return {cx,cz};
  };
  let foot=-Infinity,s0=Infinity,s1=-Infinity;
  for(const ring of stairFootprints(tk))for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
  const coverIn=Math.min(1.1,0.32*144/Math.max(1,s1-s0)),zN=foot-coverIn,zFar=zN+24*12,x0=Math.min(...deckXs)-8*12,x1=Math.max(...deckXs)+8*12;
  const terraceFrame=even(terrace,{x0,x1,z0:zN,z1:zFar},'Terrace');
  if(Math.abs(terraceFrame.cx-(s0+s1)/2)>1)issues.push('The terrace onyx frame is not centred on the stair.');
  const pool=data.pools?.[0];
  if(pool){const poolFrame=even(court,{x0:(court.xFt-court.widthFt/2)*12,x1:(court.xFt+court.widthFt/2)*12,z0:(court.zFt-court.depthFt/2)*12,z1:(court.zFt+court.depthFt/2)*12},'Pool');if(Math.abs(poolFrame.cx-pool.xIn)>1||Math.abs(poolFrame.cz-pool.zIn)>1)issues.push('The pool onyx frame is not centred on the pool.');}
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
 if(plants.length<140||(data.landscapeObjects?.length??0)>300)issues.push(`Planting density is ${plants.length} plants in ${data.landscapeObjects?.length??0} objects.`);
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
 const table=data.landscapeObjects?.find(o=>o.id==='dining-table'),chairs=(data.landscapeObjects??[]).filter(o=>o.id.startsWith('dining-')&&o.assetId==='outdoor-chair');
 if(!table||table.widthIn!==96||table.depthIn!==42||table.supportFeatureId||chairs.length!==8||chairs.some(o=>o.supportFeatureId))issues.push('The dining set is not an 8-seat table on the deck.');
 if(table&&data.pergola&&Math.hypot(table.xIn/12-data.pergola.xFt,table.zIn/12-data.pergola.zFt)>1)issues.push('The dining table is not centred under the pergola.');
 const deckRingPts=deck.footprint.outline.map(p=>({x:p.x+deck.offset.x,y:p.y+deck.offset.z}));
 for(const chair of chairs){const front=seatFront(chair.rotationDeg),backX=chair.xIn-front.x*chair.depthIn/2,backZ=chair.zIn-front.z*chair.depthIn/2;if(!insidePolygon({x:backX-front.x*36,y:backZ-front.z*36},deckRingPts))issues.push(`${chair.id} has under 36 in behind it.`);}
 const terraceSeats=(data.landscapeObjects??[]).filter(o=>o.id==='terrace-sofa'||o.id.startsWith('terrace-chair'));
 const terraceCoffee=data.landscapeObjects?.find(o=>o.id==='terrace-coffee');
 const terraceSofa=terraceSeats.find(o=>o.id==='terrace-sofa'),terraceChairs=terraceSeats.filter(o=>o.id.startsWith('terrace-chair'));
 if(terraceSeats.length!==3||!terraceCoffee||!terraceSofa||terraceChairs.length!==2||terraceSeats.some(o=>o.assetId!=='outdoor-sofa'||o.supportFeatureId!=='terrace')||terraceCoffee.supportFeatureId!=='terrace'||terraceCoffee.assetId!=='outdoor-coffee-table')issues.push('The terrace lounge is not a sofa, two deep chairs and a coffee table on the terrace.');
 if(terraceSofa&&(terraceSofa.widthIn<120||terraceChairs.some(o=>o.widthIn>=terraceSofa.widthIn||o.assetId==='outdoor-chair')))issues.push('The terrace lounge still uses dining chairs, or the sofa is not the long piece.');
 if((data.landscapeObjects??[]).some(o=>o.assetId==='outdoor-chair'&&o.supportFeatureId==='terrace'))issues.push('Folding dining chairs are on the terrace.');
 if(terraceSofa&&terraceCoffee){
  const box=terraceSeats.concat(terraceCoffee);
  {
   let foot=-Infinity,s0=Infinity,s1=-Infinity;
   for(const ring of stairFootprints(tk))for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
   const coverIn=Math.min(1.1,0.32*144/Math.max(1,s1-s0)),zN=foot-coverIn,zFar=zN+24*12,x0=Math.min(...deckXs)-8*12;
   const westX0=x0+MARGIN+BAND,westX1=s0,westZ0=zN+MARGIN+BAND,westZ1=zFar-MARGIN-BAND;
   const xs0=box.flatMap(o=>[o.xIn-o.widthIn/2,o.xIn+o.widthIn/2]),zs0=box.flatMap(o=>[o.zIn-o.depthIn/2,o.zIn+o.depthIn/2]);
   const mx=(Math.min(...xs0)+Math.max(...xs0))/2,mz=(Math.min(...zs0)+Math.max(...zs0))/2;
   if(Math.abs(mx-(westX0+westX1)/2)>6||Math.abs(mz-(westZ0+westZ1)/2)>6)issues.push('The terrace lounge is not centred in the west framed court.');
  }
  const xs=box.flatMap(o=>[o.xIn-o.widthIn/2,o.xIn+o.widthIn/2]),zs=box.flatMap(o=>[o.zIn-o.depthIn/2,o.zIn+o.depthIn/2]);
  const spanX=(Math.max(...xs)-Math.min(...xs))/12,spanZ=(Math.max(...zs)-Math.min(...zs))/12;
  if(spanX<10||spanX>14||spanZ<10||spanZ>14)issues.push(`The terrace lounge group is ${spanX.toFixed(1)}×${spanZ.toFixed(1)} ft, not about 12×12.`);
  const stair=getStairPlacement(data,getFootprint(data));
  if(stair){
   let stairFoot=-Infinity;for(const ring of stairFootprints(tk))for(const p of ring)stairFoot=Math.max(stairFoot,p.y);
   const far=Math.max(...yardFeatureOutline(terrace).flat().map(p=>p.y)),x0=stair.origin.x,x1=x0+stair.width;
   const corridor=[{x:x0,y:stairFoot},{x:x1,y:stairFoot},{x:x1,y:far},{x:x0,y:far}];
   const landing=[{x:x0,y:stairFoot},{x:x1,y:stairFoot},{x:x1,y:stairFoot+120},{x:x0,y:stairFoot+120}];
   if(stair.width<96)issues.push('The stair path is under 8 ft wide.');
   if(far<stairFoot+120)issues.push('The terrace does not carry the stair path 10 ft toward the pool.');
   for(const seat of box){
    const ring=yardRectangle(seat.xIn,seat.zIn,seat.widthIn,seat.depthIn,seat.rotationDeg*Math.PI/180);
    if(yardArea(yardClip([ring],[corridor],'intersection'))>0.01||yardArea(yardClip([ring],[landing],'intersection'))>0.01)issues.push(`${seat.name} blocks the path from the stair toward the pool.`);
    if(seat.xIn>x0)issues.push(`${seat.name} is not on the west side of the terrace.`);
   }
  }
 }
 const lights=data.lightingSystem.selectedItems,placed=(id:string)=>lights.find(i=>i.productId===id)?.places?.length??0;
 if(placed('liv')<8||placed('scope')<8||placed('liv_wall')<4||placed('evo_ground_300')<6||placed('wedge')<8)issues.push('Path lights, tree uplights, paver lights, step lights and fire-lounge wall lights are not placed.');
 const hardscape=pavingRings(data,tk),water=(data.pools??[]).map(poolOutline),bedRings=(data.landscapeObjects??[]).filter(o=>o.kind==='bed'&&(o.polygon?.length??0)>=3).map(o=>o.polygon!.map(p=>({x:p.x,y:p.z})));
 for(const item of lights){
  const product=getLightingRuntimeProduct(item.productId);if(!product||!item.places)continue;
  for(const place of item.places){
   const paved=onPaving(hardscape,place.x,place.z),bed=bedRings.some(ring=>insidePolygon({x:place.x,y:place.z},ring)),swimming=water.some(ring=>insidePolygon({x:place.x,y:place.z},ring));
   if((product.geometry==='bollard'||product.geometry==='spot')&&(paved||!bed))issues.push(`${product.name} is not in a planting bed clear of the paving.`);
   if((item.productId==='evo_ground_300'||item.productId==='wedge')&&(!paved||swimming))issues.push(`${product.name} is not on the paving clear of the water.`);
   if(item.productId==='evo_ground_300'&&Math.abs((place.y??0))>0.2)issues.push('A paver light is not seated on the paving surface.');
   if(item.productId==='evo_ground_300'){
    const slab=(data.yardFeatures??[]).find(f=>(f.id==='terrace'||f.id==='pool-court'||f.id==='lounge')&&yardFeatureOutline(f).some(ring=>ring.length>=3&&insidePolygon({x:place.x,y:place.z},ring)));
    if(!slab)issues.push('A paver light is not on the terrace, the pool deck or the fire lounge.');
    else{
     const grid=grandeGrid(slab),loc=grid.toLocal(place.x,place.z);
     const along=((loc.x%grid.pitchX)+grid.pitchX)%grid.pitchX,across=((loc.z%grid.pitchZ)+grid.pitchZ)%grid.pitchZ;
     const turn=Math.atan2(Math.sin(place.angle-grid.angle),Math.cos(place.angle-grid.angle));
     const parallel=Math.min(Math.abs(turn),Math.abs(Math.abs(turn)-Math.PI))<0.02;
     if(!parallel||Math.abs(along-GRANDE_L/2)>0.15||Math.abs(across-GRANDE_W/2)>0.15)issues.push('A paver light is skewed across the Grande joints instead of centred in one slab.');
     const bands=patioInlayPlans(slab).filter(p=>p.status==='ok').map(p=>p.outline),poolEx=(data.pools??[]).flatMap(poolPermanentExclusion);
     const hit=(polys:{x:number;y:number}[][],x:number,z:number)=>polys.some(poly=>poly.length>=3&&insidePolygon({x,y:z},poly));
     if(paverLensCorners(place.x,place.z,place.angle).some(p=>hit(bands,p.x,p.z)||hit(poolEx,p.x,p.z)||!yardFeatureOutline(slab).some(ring=>insidePolygon({x:p.x,y:p.z},ring))))issues.push('A paver light leaves its slab and meets the onyx band, the coping or the patio edge.');
    }
   }
   if(item.productId==='wedge'&&(place.y===undefined||place.y>-0.2||place.y<-2))issues.push('A step light is not seated in the riser.');
  }
 }
 if((data.landscapeObjects??[]).filter(o=>o.assetId==='lounge-chair'&&o.supportFeatureId==='pool-court').length<2)issues.push('The pool deck has no lounge chairs.');
 if((data.landscapeObjects??[]).some(o=>o.assetId==='lounge-chair'&&o.supportFeatureId==='lounge'))issues.push('Chaise loungers are inside the fire lounge.');
 const sofas=(data.landscapeObjects??[]).filter(o=>o.assetId==='outdoor-sofa'&&o.supportFeatureId==='lounge').sort((a,b)=>a.xIn-b.xIn);
 if(sofas.length!==2)issues.push('The fire lounge does not have two sofas.');
 if(fire&&sofas.length===2){
  const burner=fireOutline(fire),ring=(o:LandscapeObject)=>yardRectangle(o.xIn,o.zIn,o.widthIn,o.depthIn,o.rotationDeg*Math.PI/180);
  const turn=(d:number)=>{const n=((d%360)+360)%360;return n>180?n-360:n;};
  if(Math.abs(turn(sofas[0].rotationDeg)+90)>1||Math.abs(turn(sofas[1].rotationDeg)-90)>1)issues.push('The lounge sofas do not face the burner.');
  for(const sofa of sofas){const gap=planGapIn(ring(sofa),burner);if(gap<36||gap>48)issues.push(`A lounge sofa is ${gap.toFixed(1)} in from the burner.`);}
  const low=data.landscapeObjects?.find(o=>o.id==='lounge-table');
  if(low&&(planGapIn(ring(low),burner)<1||sofas.some(sofa=>planGapIn(ring(low),ring(sofa))<1)))issues.push('The fire table overlaps a sofa or the burner.');
 }
 if(!data.autoLighting?.posts||!data.autoLighting.stairs)issues.push('Deck lighting is off.');
 if(!data.pergola?.lighting)issues.push('The pergola has no lights.');
 if(!fire?.supportFeatureId)issues.push('The fire bowl is not on the lounge.');
 if(!wall?.wallConstruction?.freestanding)issues.push('The seat wall is not freestanding.');
 if(fire){
  const body=fireOutline(fire),rings=[...houseOutline(data),...tk.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...stairFootprints(tk)];
  const gap=Math.min(...rings.filter(r=>r.length>=3).map(r=>planGapIn(body,r)));
  if(gap<48)issues.push(`Fire clearance is ${(gap/12).toFixed(2)} ft.`);
 }
 const cameras=data.scenePresentation?.cameras??[];
 if(data.scenePresentation?.activeCameraId!=='hero'||!['hero','terrace-eye','pool','fire','dining','terrace-lounge','stair-up'].every(id=>cameras.some(c=>c.id===id)))issues.push('Hero, terrace, pool, fire, dining, terrace-lounge and stair cameras are missing.');
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
