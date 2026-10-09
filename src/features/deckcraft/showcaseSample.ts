import type {DeckData,PatioInlay,YardFeature} from './types';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
import {DEFAULT_DECK} from './defaults';
import {EXTERIOR_LOOKS,applyLook} from './houseLooks';
import {getHouseConfig} from './houseSettings';
import {houseOutline} from './houseFootprint';
import {buildDeckTakeoff} from './deckTakeoff';
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
import {poolOutline} from './poolGeometry';
import {getLightingRuntimeProduct} from './lightingRuntimeCatalogue';
import {insidePolygon} from './lib/polygonCuts';
import {furnitureFacingIssues,nearestSeatPoint,rotationDegFacing} from './furnitureFacing';

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
 * at the edges; those edge lights wash the water. The pergola
 * is black aluminium louvers, opened so the slats
 * and the light between them read. The dining table is the folding-table mesh
 * scaled to an eight-seat envelope; there is no larger table product.
 */
const SLAB='techo-blu60-smooth-slab';
const ONYX='#565855',CREMA='#cabaaa',WALL_ONYX='#4b4d4d';
const BORDER:YardFeature['hardscape']={finishId:'hd-smooth6-13',colorId:'onyx-black',unitId:'standalone-6x13',patternId:'l77-linear-laying-pattern-09-100-6x13',angleDeg:0,jointMm:7};
const FIELD:YardFeature['hardscape']={finishId:'hd-smooth-grande',colorId:'caff-crema',unitId:'grande-495-825-60',patternId:'linear-laying-pattern-05-100-blu-grande',angleDeg:0,jointMm:7};
const SEAT:YardFeature['hardscape']={finishId:'smooth',colorId:'onyx-black',unitId:'double-sided-397-249-90',patternId:'running-bond',angleDeg:0,jointMm:0};
const SEAT_DEPTH=249/304.8;
const BORDER_IN=18;
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

/** Onyx frame on the notched terrace: the near edge returns to the deck on both sides of the stairs. */
function notchBorder(f:YardFeature,b:{x0:number;x1:number;zD:number;zN:number;zFar:number;s0:number;s1:number}):PatioInlay[]{
 const B=BORDER_IN,cx=f.xFt*12,cz=f.zFt*12,out:PatioInlay[]=[];
 let k=0;
 const cuts=(a:number,c:number)=>{const n=Math.ceil((c-a)/240-1e-9),size=(c-a)/n;return Array.from({length:n},(_,i)=>[a+size*i,a+size*(i+1)] as const);};
 const add=(x0:number,z0:number,x1:number,z1:number)=>out.push({id:`${f.id}-border-${k++}`,name:'Onyx border',shape:'rectangle',xIn:(x0+x1)/2-cx,yIn:(z0+z1)/2-cz,widthIn:x1-x0,depthIn:z1-z0,rotationDeg:0,productId:SLAB,color:ONYX,hardscape:{...BORDER!}});
 for(const [z0,z1] of cuts(b.zD,b.zFar)){add(b.x0,z0,b.x0+B,z1);add(b.x1-B,z0,b.x1,z1);}
 for(const [a,c] of cuts(b.x0+B,b.x1-B))add(a,b.zFar-B,c,b.zFar);
 add(b.x0+B,b.zD,b.s0-B,b.zD+B);
 add(b.s1+B,b.zD,b.x1-B,b.zD+B);
 add(b.s0-B,b.zD,b.s0,b.zN);
 add(b.s1,b.zD,b.s1+B,b.zN);
 add(b.s0,b.zN,b.s1,b.zN+B);
 return out;
}

function push(data:DeckData,feature:YardFeature){data.yardFeatures=[...(data.yardFeatures??[]),feature];return feature;}
function slab(data:DeckData,id:string,name:string,x0:number,z0:number,x1:number,z1:number,border=false){
 const feature={...createYardFeature(data,{kind:'patio',id,name,xFt:(x0+x1)/2,zFt:(z0+z1)/2,widthFt:x1-x0,depthFt:z1-z0,heightIn:0,productId:SLAB,hardscape:FIELD}),color:CREMA};
 return push(data,border?{...feature,inlays:borderStrips(feature)}:feature);
}
function rectOf(f:YardFeature){const x=(f.xFt-f.widthFt/2)*12,z=(f.zFt-f.depthFt/2)*12,w=f.widthFt*12,d=f.depthFt*12;return [{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];}

function bed(id:string,name:string,x0:number,z0:number,x1:number,z1:number):LandscapeObject{
 return polyBed(id,name,[{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}]);
}
function polyBed(id:string,name:string,points:{x:number;z:number}[]):LandscapeObject{
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 const o=newLandscapeObject('mulch-bed',id,(x0+x1)/2*12,(z0+z1)/2*12);
 return {...o,name,widthIn:(x1-x0)*12,depthIn:(z1-z0)*12,polygon:points.map(p=>({x:p.x*12,z:p.z*12}))};
}
function furn(asset:LandscapeAssetId,id:string,name:string,xFt:number,zFt:number,rotationDeg:number,support:string):LandscapeObject{
 const o=newLandscapeObject(asset,id,xFt*12,zFt*12);
 return {...o,name,rotationDeg,supportFeatureId:support};
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
  width:24,length:16,height:36,
  deckingMaterial:'tt_vintage',deckingColor:'Weathered Teak',boardWidth:5.5,
  pictureFrameRows:1,pictureFrameOverhangIn:0,railingType:'Aluminum',
  stairFlights:1,stairWidth:60,stairType:'Straight',stairPosition:'Front',stairOffset:50,
  houseVisible:true,houseConfig:house,housePlacement:{anchor:'center',offsetIn:0},
  terrainConfig:{widthFt:LOT_W,depthFt:LOT_D,elevationIn:0,slopePct:0},
  lightingPreviewOn:true,autoLighting:{posts:true,stairs:true},
  lightingSystem:{selectedItems:[],wireDistance:80},
  yardFeatures:[],landscapeObjects:[],
 };

 const houseLeft=Math.min(...houseOutline(data).flat().map(p=>p.x));
 const lotLeft=data.width*6-LOT_W*6;
 data.permitSite={lotWidthFt:LOT_W,lotDepthFt:LOT_D,leftYardFt:(houseLeft-lotLeft)/12,rearYardFt:data.length/2+LOT_D/2,yardFaces:'S'};

 const takeoff=buildDeckTakeoff(data),rings=stairFootprints(takeoff);
 const deckRing=takeoff.levels[0].footprint.outline.map(p=>({x:p.x+takeoff.levels[0].offset.x,y:p.y+takeoff.levels[0].offset.z}));
 let foot=-Infinity,s0=Infinity,s1=-Infinity;
 for(const ring of rings)for(const p of ring){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
 const deckFront=Math.max(...deckRing.map(p=>p.y)),deckX0=Math.min(...deckRing.map(p=>p.x)),deckX1=Math.max(...deckRing.map(p=>p.x));
 const stair=getStairPlacement(data,getFootprint(data));
 if(!stair||stair.outward.y<0.5)throw Error('The showcase stair has to come off the front of the deck.');
 // Wider than the deck. The near edge returns to the fascia on both sides of the flight and meets the tread by under half a square foot.
 const x0=deckX0-8*12,x1=deckX1+8*12,zN=foot-1.15,zFar=zN+24*12;
 const nose=createYardFeature(data,{kind:'patio',id:'terrace',name:'Dining terrace',xFt:(x0+x1)/24,zFt:(zN+zFar)/24,widthFt:(x1-x0)/12,depthFt:(zFar-zN)/12,heightIn:0,productId:SLAB,hardscape:FIELD});
 let terrace=yardShapeEdit(nose,[
  {x:x0,y:deckFront},{x:s0,y:deckFront},{x:s0,y:zN},{x:s1,y:zN},{x:s1,y:deckFront},{x:x1,y:deckFront},{x:x1,y:zFar},{x:x0,y:zFar},
 ]);
 const landingOverlap=yardArea(yardClip(yardFeatureOutline(terrace),rings,'intersection'));
 const deckOverlap=yardArea(yardClip(yardFeatureOutline(terrace),[deckRing],'intersection'));
 if(deckOverlap>0.01)throw Error(`The terrace overlaps the deck by ${deckOverlap.toFixed(3)} sq ft.`);
 if(landingOverlap<=0.05||landingOverlap>0.5)throw Error(`Stair landing overlap is ${landingOverlap.toFixed(3)} sq ft; the treads have to land on the paving without the terrace standing on the flight.`);
 terrace={...terrace,color:CREMA,inlays:notchBorder(terrace,{x0,x1,zD:deckFront,zN,zFar,s0,s1})};
 push(data,terrace);

 // The 36 ft pool run is across the yard. A 36 ft run away from the house does
 // not leave the surround and a rear bed inside this lot.
 const far=terrace.zFt+terrace.depthFt/2;
 const court=slab(data,'pool-court','Pool court',-4,far-JOIN,52,far-JOIN+34);
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
 data.pergola={...pergola,frameFinish:'black',roofFinish:'black',accessories:[],lighting:'perimeter-led',customSize:{widthFt:10,depthFt:12,heightFt:9},target:{kind:'patio',featureId:terrace.id},xFt:terrace.xFt,zFt:foot/12+8,rotationDeg:0,louverDeg:80};

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
 line('x',-36.5,6,zEnd,3.1,['thuja-occidentalis-smaragd'],112,34);
 line('x',-34.6,12,zEnd-4,14,['acer-saccharum','pinus-strobus'],240,120);
 line('x',-32.2,8,zEnd,3.6,['hydrangea-arborescens-annabelle','cornus-sericea','amelanchier-canadensis','hydrangea-paniculata','syringa-vulgaris']);
 line('x',-29.4,7,zEnd,2.5,['calamagrostis-karl-foerster','hosta','echinacea-purpurea','rudbeckia-hirta','matteuccia-struthiopteris','schizachyrium-scoparium']);
 line('x',60.5,6,zEnd,3.1,['thuja-occidentalis-smaragd'],112,34);
 line('x',58.6,12,zEnd-4,14,['pinus-strobus','acer-saccharum'],230,110);
 line('x',55.8,8,zEnd,3.6,['cornus-sericea','hydrangea-arborescens-annabelle','amelanchier-canadensis','physocarpus-opulifolius','hydrangea-paniculata']);
 line('x',53.4,7,zEnd,2.5,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','panicum-virgatum','hemerocallis','nepeta-faassenii']);
 line('z',rear1-1.5,-34,58,3.2,['thuja-occidentalis-smaragd'],112,34);
 line('z',(rear0+rear1)/2,-30,54,4.2,['acer-saccharum','amelanchier-canadensis','syringa-vulgaris','pinus-strobus'],200,100);
 line('z',rear0+1.5,-32,56,2.8,['calamagrostis-karl-foerster','hydrangea-arborescens-annabelle','hosta','rudbeckia-hirta']);
 line('x',48,8,flank1-1.2,3.4,['hydrangea-paniculata','cornus-sericea','amelanchier-canadensis']);
 line('x',36,7,flank1-1.4,2.6,['calamagrostis-karl-foerster','echinacea-purpurea','hosta','salvia-nemorosa']);
 line('z',rear0-1.4,-26,-8,3.4,['thuja-occidentalis-smaragd','pinus-strobus'],140,48);
 line('z',loungeFar+2,-25,-7,3.2,['hydrangea-arborescens-annabelle','cornus-sericea','calamagrostis-karl-foerster']);
 grow('hydrangea-arborescens-annabelle',-22,6);grow('cornus-sericea',-14,6);grow('hydrangea-paniculata',-6,6);
 grow('calamagrostis-karl-foerster',-24,12);grow('hosta',-16,12);grow('echinacea-purpurea',-8,12);

 const diningX=data.pergola.xFt,diningZ=data.pergola.zFt;
 const nearDeck=court.zFt-court.depthFt/2+3.8,farDeck=court.zFt+court.depthFt/2-3.6;
 const table={...furn('outdoor-table','dining-table','Dining table',diningX,diningZ,0,terrace.id),widthIn:42,depthIn:96,heightIn:30};
 const water=poolOutline(pool);
 const aim=(xFt:number,zFt:number,tx:number,tz:number)=>rotationDegFacing(tx-xFt*12,tz-zFt*12);
 const aimPool=(xFt:number,zFt:number)=>{const edge=nearestSeatPoint({x:xFt*12,y:zFt*12},water);return aim(xFt,zFt,edge.x,edge.y);};
 const seat=(id:string,dx:number,dz:number)=>furn('outdoor-chair',id,'Dining chair',diningX+dx,diningZ+dz,aim(diningX+dx,diningZ+dz,diningX*12,diningZ*12),terrace.id);
 data.landscapeObjects=[
  bed('bed-west','West planting',-38,2,-28,rear0+4),
  bed('bed-east','East planting',52,2,62,rear0+4),
  bed('bed-rear','Rear planting',-38,rear0,62,rear1),
  polyBed('bed-flank','Terrace planting',[{x:24,z:2},{x:51.7,z:2},{x:51.7,z:flank1},{x:32.05,z:flank1},{x:32.05,z:16},{x:24,z:16}]),
  bed('bed-deckside','Deckside planting',-28,2,0,16),
  bed('bed-court-west','Pool planting',-28,loungeFar+0.2,-4.2,rear0-0.1),
  ...plants,
  table,
  seat('dining-1',3.19,-2.99),seat('dining-2',2.85,0),seat('dining-3',3.19,2.99),
  seat('dining-4',-3.19,-2.99),seat('dining-5',-2.85,0),seat('dining-6',-3.19,2.99),
  seat('dining-7',0,5.1),seat('dining-8',0,-5.1),
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
 const pavers=[
  pin(cx-12,cz-10),pin(cx,cz-10),pin(cx+12,cz-10),pin(cx-20,cz),pin(cx+20,cz),pin(cx,cz+9),
  pin(tx0+4,19),pin(tx1-4,19),pin(tx0+4,tz1-3),pin(terrace.xFt,tz1-3),pin(tx1-4,tz1-3),
  pin(-21,fireZ-5.4),pin(-15,fireZ-5.4),pin(-21,fireZ+5.2),pin(-15,fireZ+5.2),
 ];
 const steps=[
  pin(cx-16,cz-12,0,2),pin(cx,cz-12,0,2),pin(cx+16,cz-12,0,2),
  pin(cx-16,cz+12,Math.PI,2),pin(cx,cz+12,Math.PI,2),pin(cx+16,cz+12,Math.PI,2),
  pin(cx-21,cz,Math.PI/2,2),pin(cx+21,cz,-Math.PI/2,2),
  pin(terrace.xFt-8,tz1-1.5,0,2),pin(terrace.xFt+8,tz1-1.5,0,2),
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
 const hero={position:[-8,28,78] as [number,number,number],target:[12,1,28] as [number,number,number]};
 const eye={position:[24,5.2,23] as [number,number,number],target:[2,1,62] as [number,number,number]};
 const poolCam={position:[24,12,36] as [number,number,number],target:[24,0,64] as [number,number,number]};
 const fireCam={position:[-6,8.2,31] as [number,number,number],target:[fireX,1.05,fireZ] as [number,number,number]};
 const diningCam={position:[diningX+8,5,diningZ-3] as [number,number,number],target:[diningX,1.2,diningZ] as [number,number,number]};
 const shot=(id:string,name:string,frame:{position:[number,number,number];target:[number,number,number]},fov:number)=>({id,name,fov,positionIn:frame.position.map(n=>n*12) as [number,number,number],targetIn:frame.target.map(n=>n*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',cameraPreset:'terrace',activeCameraId:'hero',cameras:[shot('hero','Whole property',hero,56),shot('terrace-eye','Terrace toward the pool',eye,55),shot('pool','Pool court',poolCam,42),shot('fire','Fire lounge',fireCam,42),shot('dining','Dining set',diningCam,42)]};
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
 if(Math.abs(court.widthFt-56)>0.2||Math.abs(court.depthFt-34)>0.2)issues.push('The pool court is not 56×34 ft.');
 if(Math.abs(lounge.widthFt-18)>0.2||Math.abs(lounge.depthFt-18)>0.2)issues.push('The fire lounge is not 18×18 ft.');
 if(walk.widthFt<5.5||walk.widthFt>7)issues.push('The spine walk is not about 6 ft wide.');
 if(west.widthFt<5.5||west.widthFt>8||overlapSqft(west,terrace)<1||overlapSqft(loungePath,west)<1||overlapSqft(loungePath,lounge)<1)issues.push('The west path does not join the terrace to the fire lounge.');
 if([terrace,court,walk,west,loungePath].some(f=>f.hardscape?.colorId!=='caff-crema'))issues.push('The spine is not one crema grande slab.');
 if(overlapSqft(terrace,court)<1||overlapSqft(walk,court)<0.4||overlapSqft(walk,lounge)<0.4||overlapSqft(walk,terrace)<0.2)issues.push('Terrace, pool court and fire lounge are not joined.');
 const loungeGap=gapOf(lounge,court);if(loungeGap<5||loungeGap>6.5)issues.push(`Lounge and pool court are ${loungeGap.toFixed(1)} ft apart.`);
 for(const room of [terrace,lounge]){const plans=patioInlayPlans(room);if(!plans.length||plans.some(p=>p.status!=='ok')||plans.some(p=>p.inlay.hardscape?.colorId!=='onyx-black'))issues.push(`${room.name} is missing its onyx border.`);}
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
 if(data.pergola?.roofFinish!=='black'||data.pergola.frameFinish!=='black'||data.pergola.lighting!=='perimeter-led'||(data.pergola.louverDeg??0)<70)issues.push('The pergola is not open black aluminium louvers with the LEDs on.');
 const table=data.landscapeObjects?.find(o=>o.id==='dining-table'),chairs=(data.landscapeObjects??[]).filter(o=>o.assetId==='outdoor-chair'&&o.supportFeatureId==='terrace');
 if(!table||Math.max(table.widthIn,table.depthIn)<84||Math.min(table.widthIn,table.depthIn)<40||chairs.length<6||chairs.length>8)issues.push('The dining set is not a 6–8 seat table under the pergola.');
 if(table&&data.pergola&&Math.hypot(table.xIn/12-data.pergola.xFt,table.zIn/12-data.pergola.zFt)>1)issues.push('The dining table is not centred under the pergola.');
 const lights=data.lightingSystem.selectedItems,placed=(id:string)=>lights.find(i=>i.productId===id)?.places?.length??0;
 if(placed('liv')<8||placed('scope')<8||placed('liv_wall')<4||placed('evo_ground_300')<6||placed('wedge')<8)issues.push('Path lights, tree uplights, paver lights, step lights and fire-lounge wall lights are not placed.');
 const hardscape=pavingRings(data,tk),water=(data.pools??[]).map(poolOutline),bedRings=(data.landscapeObjects??[]).filter(o=>o.kind==='bed'&&(o.polygon?.length??0)>=3).map(o=>o.polygon!.map(p=>({x:p.x,y:p.z})));
 for(const item of lights){
  const product=getLightingRuntimeProduct(item.productId);if(!product||!item.places)continue;
  for(const place of item.places){
   const paved=onPaving(hardscape,place.x,place.z),bed=bedRings.some(ring=>insidePolygon({x:place.x,y:place.z},ring)),swimming=water.some(ring=>insidePolygon({x:place.x,y:place.z},ring));
   if((product.geometry==='bollard'||product.geometry==='spot')&&(paved||!bed))issues.push(`${product.name} is not in a planting bed clear of the paving.`);
   if((item.productId==='evo_ground_300'||item.productId==='wedge')&&(!paved||swimming))issues.push(`${product.name} is not on the paving clear of the water.`);
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
 if(data.scenePresentation?.activeCameraId!=='hero'||!['hero','terrace-eye','pool','fire','dining'].every(id=>cameras.some(c=>c.id===id)))issues.push('Hero, terrace, pool, fire and dining cameras are missing.');
 issues.push(...furnitureFacingIssues(data));
 return issues;
}
