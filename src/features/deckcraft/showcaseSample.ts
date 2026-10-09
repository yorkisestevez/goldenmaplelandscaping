import type {DeckData,PatioInlay,YardFeature,YardHardscape} from './types';
import type {LandscapeObject} from './landscapeTypes';
import {DEFAULT_DECK} from './defaults';
import {EXTERIOR_LOOKS,applyLook} from './houseLooks';
import {getHouseConfig} from './houseSettings';
import {houseOutline} from './houseFootprint';
import {buildDeckTakeoff} from './deckTakeoff';
import {getFootprint,getStairPlacement} from './lib/deckGeometry';
import {stairFootprints,planGapIn,fireOutline} from './fireFeatureModel';
import {createYardFeature} from './yardCreateEdits';
import {applyWalkway,type ShapePath} from './shapeTools';
import {yardArea,yardClip} from './yardModel';
import {createPlanningPool} from './poolAssembly';
import {newPergola} from './pergolaValidation';
import {syncAutoLighting} from './lightingSystem';
import {LANDSCAPE_SPECIES,newLandscapeObject} from './landscapeCatalogue';
import {overviewCamera} from './components/viewer3d/cameraFraming';
import type {LandscapeAssetId} from './landscapeTypes';

/**
 * The yard used for showcase stills: a two-storey contemporary house on a
 * 120×240 ft estate lot. The dining terrace, fire lounge and pool court are
 * separate rooms with lawn and planting between them.
 * It is a sample, not the editor's default deck. Pricing runs through the
 * same takeoff as any other design.
 */
const SLAB='techo-blu60-smooth-slab';
const ONYX='#565855',CREMA='#cabaaa',CHAMPLAIN='#8d8377',WALL_ONYX='#4b4d4d';
const BORDER:YardHardscape={finishId:'hd-smooth6-13',colorId:'onyx-black',unitId:'standalone-6x13',patternId:'l77-linear-laying-pattern-09-100-6x13',angleDeg:0,jointMm:7};
const FIELD:YardHardscape={finishId:'hd-smooth-grande',colorId:'caff-crema',unitId:'grande-495-825-60',patternId:'linear-laying-pattern-05-100-blu-grande',angleDeg:0,jointMm:7};
const POOL_PAVE:YardHardscape={finishId:'hd-smooth-grande',colorId:'champlain-grey',unitId:'grande-495-825-60',patternId:'linear-laying-pattern-05-100-blu-grande',angleDeg:0,jointMm:7};
const SEAT:YardHardscape={finishId:'smooth',colorId:'onyx-black',unitId:'double-sided-397-249-90',patternId:'running-bond',angleDeg:0,jointMm:0};
const SEAT_DEPTH=249/304.8;
const INSET=330/25.4;
const LOT_W=120,LOT_D=240;

const line=(points:{x:number;y:number}[]):ShapePath=>({points,edges:points.slice(1).map(()=>({kind:'line'})),closed:false});
const species=(id:string)=>structuredClone(LANDSCAPE_SPECIES.find(s=>s.id===id)!);

function fieldInlay(f:YardFeature,name:string):PatioInlay{
 const widthIn=f.widthFt*12-2*INSET,depthIn=f.depthFt*12-2*INSET;
 if(widthIn<12||depthIn<12||widthIn>240||depthIn>240)throw Error(`${f.name} field is ${widthIn.toFixed(1)}×${depthIn.toFixed(1)} in; a catalogue inlay stays within 20 ft.`);
 return {id:`${f.id}-field`,name,shape:'rectangle',xIn:0,yIn:0,widthIn,depthIn,rotationDeg:0,productId:SLAB,color:CREMA,hardscape:FIELD};
}

function push(data:DeckData,feature:YardFeature){data.yardFeatures=[...(data.yardFeatures??[]),feature];return feature;}

function rectOf(f:YardFeature){const x=(f.xFt-f.widthFt/2)*12,z=(f.zFt-f.depthFt/2)*12,w=f.widthFt*12,d=f.depthFt*12;return [{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z}];}

/** An onyx walkway along a centreline, in world inches, joining two paved rooms across the lawn. */
function pathWalk(data:DeckData,id:string,name:string,spine:{x:number;y:number}[]){
 const mid=spine[Math.floor((spine.length-1)/2)];
 const base=createYardFeature(data,{kind:'patio',id,name,xFt:mid.x/12,zFt:mid.y/12,widthFt:4,depthFt:8,heightIn:0,productId:SLAB,hardscape:BORDER});
 return push(data,{...applyWalkway(base,line(spine),48,'square'),color:ONYX});
}

function bed(id:string,name:string,x0:number,z0:number,x1:number,z1:number):LandscapeObject{
 const o=newLandscapeObject('cedar-mulch-bed',id,(x0+x1)/2*12,(z0+z1)/2*12);
 return {...o,name,widthIn:(x1-x0)*12,depthIn:(z1-z0)*12,polygon:[{x:x0*12,z:z0*12},{x:x1*12,z:z0*12},{x:x1*12,z:z1*12},{x:x0*12,z:z1*12}]};
}
function plant(asset:LandscapeAssetId,id:string,name:string,xFt:number,zFt:number,heightIn:number,speciesId:string,rotationDeg=0):LandscapeObject{
 const o=newLandscapeObject(asset,id,xFt*12,zFt*12);
 const spread=asset==='grass-clump'?28:asset==='rounded-shrub'?46:asset==='conifer-tree'?Math.round(heightIn*.45):Math.round(heightIn*.62);
 return {...o,name,heightIn,widthIn:spread,depthIn:spread,rotationDeg,speciesRecord:species(speciesId)};
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
   {id:'slider',type:'Door',facade:'Front',wallId:'main-front',style:'Sliding',offsetPct:50,bottomIn:36,widthIn:96,heightIn:84},
   {id:'front-left',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:14,bottomIn:28,widthIn:72,heightIn:60},
   {id:'front-right',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:86,bottomIn:28,widthIn:72,heightIn:60},
   {id:'upper-left',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:22,bottomIn:138,widthIn:64,heightIn:48},
   {id:'upper-center',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:50,bottomIn:138,widthIn:84,heightIn:48},
   {id:'upper-right',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:78,bottomIn:138,widthIn:64,heightIn:48},
   {id:'side-left',type:'Window',facade:'Left',wallId:'main-left',style:'Picture',offsetPct:62,bottomIn:138,widthIn:48,heightIn:48},
   {id:'side-right',type:'Window',facade:'Right',wallId:'main-right',style:'Picture',offsetPct:62,bottomIn:138,widthIn:48,heightIn:48},
   {id:'garage-door',type:'Garage',facade:'Back',wallId:'garage-back',style:'Glass',offsetPct:50,bottomIn:0,widthIn:168,heightIn:84},
  ],
 },contemporary);

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
 let foot=-Infinity;for(const ring of rings)for(const p of ring)foot=Math.max(foot,p.y);
 const stair=getStairPlacement(data,getFootprint(data));
 if(!stair||stair.outward.y<0.5)throw Error('The showcase stair has to come off the front of the deck.');
 const stairX=stair.origin.x+stair.along.x*stair.width/2;
 let terrace:YardFeature|undefined,landingError:Error|undefined;
 for(const overlapIn of [1.2,1,0.8,0.6]){
  try{
   const z0=foot-overlapIn,depthIn=20*12;
   terrace=createYardFeature(data,{kind:'patio',id:'terrace',name:'Dining terrace',xFt:stairX/12,zFt:(z0+depthIn/2)/12,widthFt:22,depthFt:20,heightIn:0,productId:SLAB,hardscape:BORDER});
   break;
  }catch(error){landingError=error as Error;}
 }
 if(!terrace)throw landingError??Error('The dining terrace could not meet the stair.');
 const landingOverlap=yardArea(yardClip([rectOf(terrace)],rings,'intersection'));
 if(landingOverlap<=0.05||landingOverlap>0.5)throw Error(`Stair landing overlap is ${landingOverlap.toFixed(3)} sq ft; it has to meet the tread without standing on the flight.`);
 terrace={...terrace,color:ONYX,inlays:[fieldInlay(terrace,'Crema field')]};
 push(data,terrace);

 const loungeBuilt={...createYardFeature(data,{kind:'patio',id:'lounge',name:'Fire lounge',xFt:-28,zFt:62,widthFt:18,depthFt:18,heightIn:0,productId:SLAB,hardscape:BORDER}),color:ONYX};
 loungeBuilt.inlays=[fieldInlay(loungeBuilt,'Crema field')];
 const loungePatio=push(data,loungeBuilt);

 const poolPatio=push(data,{...createYardFeature(data,{kind:'patio',id:'pool-court',name:'Pool court',xFt:46,zFt:102,widthFt:30,depthFt:42,heightIn:0,productId:SLAB,hardscape:POOL_PAVE}),color:CHAMPLAIN});
 const tz=terrace.zFt*12,lz=loungePatio.zFt*12,pz=(poolPatio.zFt-poolPatio.depthFt/2)*12;
 pathWalk(data,'walk-lounge','Lounge walk',[
  {x:(terrace.xFt-terrace.widthFt/2)*12+24,y:tz},
  {x:(loungePatio.xFt+loungePatio.widthFt/2)*12+72,y:tz},
  {x:(loungePatio.xFt+loungePatio.widthFt/2)*12+72,y:lz},
  {x:(loungePatio.xFt+loungePatio.widthFt/2)*12-24,y:lz},
 ]);
 pathWalk(data,'walk-pool','Pool walk',[
  {x:(terrace.xFt+terrace.widthFt/2)*12-24,y:tz},
  {x:(poolPatio.xFt-6)*12,y:tz},
  {x:(poolPatio.xFt-6)*12,y:pz+24},
  {x:poolPatio.xFt*12,y:pz+24},
 ]);

 const lx0=(loungePatio.xFt-loungePatio.widthFt/2)*12,lx1=(loungePatio.xFt+loungePatio.widthFt/2)*12,lz0=(loungePatio.zFt-loungePatio.depthFt/2)*12,lz1=(loungePatio.zFt+loungePatio.depthFt/2)*12,inset=28;
 const seatPath=[{x:lx0+inset,y:lz0+inset+18},{x:lx0+inset,y:lz1-inset},{x:lx1-inset,y:lz1-inset},{x:lx1-inset,y:lz0+inset+18}];
 push(data,{...createYardFeature(data,{kind:'retaining-wall',id:'seat-wall',name:'Seat wall',wallPath:seatPath,heightIn:18,depthFt:SEAT_DEPTH,productId:'techo-raffinato-wall',hardscape:SEAT,freestanding:true,supportFeatureId:loungePatio.id}),color:WALL_ONYX});
 const fireX=loungePatio.xFt,fireZ=loungePatio.zFt+0.4;
 push(data,{...createYardFeature(data,{kind:'fire-feature',id:'fire-bowl',name:'Fire bowl',xFt:fireX,zFt:fireZ,widthFt:3.5,depthFt:3.5,productId:'fire-gas-bowl',supportFeatureId:loungePatio.id}),color:'#8a8478'});

 const pool=createPlanningPool({id:'lap-pool',name:'Lap pool',type:'fiberglass',xIn:poolPatio.xFt*12,zIn:poolPatio.zFt*12,copingTopElevationIn:0,shape:'rounded-rectangle'});
 data.pools=[pool];

 const pergola=newPergola('lousol-junior','10x12');
 data.pergola={...pergola,accessories:['led'],lighting:'perimeter-led',target:{kind:'patio',featureId:terrace.id},xFt:terrace.xFt,zFt:terrace.zFt+terrace.depthFt/2-6.5,rotationDeg:0,louverDeg:18};

 const diningX=data.pergola.xFt,diningZ=data.pergola.zFt;
 // Beds frame each room and the lot edges. The panel between them stays lawn.
 data.landscapeObjects=[
  bed('bed-house-left','House border',-16,0.6,-1,15),
  bed('bed-house-right','East border',25,0.6,42,15),
  bed('bed-west','West planting',-46.5,4,-41.2,108),
  bed('bed-east','East planting',63.2,18,70.4,118),
  bed('bed-lounge','Lounge border',-40,74,-16,79.2),
  bed('bed-terrace-west','Terrace border',-38,42,-22,49),
  bed('bed-rear','Rear planting',18,124.4,66,127.2),
  plant('conifer-tree','white-pine','White pine',-43.8,14,200,'pinus-strobus',8),
  plant('deciduous-tree','serviceberry-1','Serviceberry',-43.6,78,168,'amelanchier-canadensis',20),
  plant('deciduous-tree','serviceberry-2','Serviceberry',66.6,48,176,'amelanchier-canadensis',-15),
  plant('rounded-shrub','dogwood-left','Red-osier dogwood',-8,6,48,'cornus-sericea'),
  plant('rounded-shrub','dogwood-right','Red-osier dogwood',33,6,50,'cornus-sericea',6),
  plant('rounded-shrub','dogwood-west','Red-osier dogwood',-43.8,36,56,'cornus-sericea',-8),
  plant('rounded-shrub','dogwood-east','Red-osier dogwood',66.6,88,54,'cornus-sericea',12),
  plant('rounded-shrub','dogwood-lounge','Red-osier dogwood',-28,76.4,52,'cornus-sericea'),
  plant('rounded-shrub','dogwood-rear','Red-osier dogwood',42,125.6,48,'cornus-sericea',-12),
  plant('grass-clump','reed-1','Karl Foerster',-43.9,52,46,'calamagrostis-karl-foerster'),
  plant('grass-clump','reed-2','Karl Foerster',-43.7,96,44,'calamagrostis-karl-foerster'),
  plant('grass-clump','reed-3','Karl Foerster',66.4,28,46,'calamagrostis-karl-foerster'),
  plant('grass-clump','reed-4','Karl Foerster',-34,76.6,42,'calamagrostis-karl-foerster',10),
  plant('grass-clump','reed-5','Karl Foerster',24,125.5,44,'calamagrostis-karl-foerster'),
  furn('outdoor-table','dining-table','Dining table',diningX,diningZ,0,terrace.id),
  furn('outdoor-chair','dining-1','Dining chair',diningX,diningZ-2.3,0,terrace.id),
  furn('outdoor-chair','dining-2','Dining chair',diningX,diningZ+2.3,180,terrace.id),
  furn('outdoor-chair','dining-3','Dining chair',diningX-2.3,diningZ,90,terrace.id),
  furn('outdoor-chair','dining-4','Dining chair',diningX+2.3,diningZ,-90,terrace.id),
  furn('outdoor-sofa','lounge-sofa','Lounge sofa',fireX,fireZ+2.6,0,loungePatio.id),
  furn('outdoor-coffee-table','lounge-table','Coffee table',fireX,fireZ+1.15,0,loungePatio.id),
  furn('lounge-chair','lounge-left','Chaise',fireX-3.2,fireZ-1.3,90,loungePatio.id),
  furn('lounge-chair','lounge-right','Chaise',fireX+3.2,fireZ-1.3,-90,loungePatio.id),
 ];

 const lit=buildDeckTakeoff(data);
 data.lightingSystem={wireDistance:80,selectedItems:syncAutoLighting({...data,lightingSystem:{wireDistance:80,selectedItems:[{productId:'liv',qty:6,zone:'landscape'},{productId:'scope',qty:4,zone:'landscape'}]}}, {posts:lit.quantities.railingPosts,stairs:lit.treads.length,privacy:0})};

 // Rear three-quarter from just past the back fence: the roof, the three rooms and the lawn between them.
 const hero={position:[36,32,196] as [number,number,number],target:[16,4,44] as [number,number,number]};
 const poolCam=overviewCamera({w:30,d:42,cx:poolPatio.xFt,cz:poolPatio.zFt,height:1.2,aspect:16/9,points:[
  {x:poolPatio.xFt-16,y:0,z:poolPatio.zFt-22},{x:poolPatio.xFt+16,y:0,z:poolPatio.zFt-22},{x:poolPatio.xFt-16,y:0,z:poolPatio.zFt+22},{x:poolPatio.xFt+16,y:0.4,z:poolPatio.zFt+22},
  {x:poolPatio.xFt,y:-3.2,z:poolPatio.zFt},
 ],direction:[-.35,.28,-1]},36);
 const fireCam=overviewCamera({w:18,d:18,cx:loungePatio.xFt,cz:loungePatio.zFt,height:1.6,aspect:16/9,points:[
  {x:loungePatio.xFt-9,y:0,z:loungePatio.zFt-9},{x:loungePatio.xFt+9,y:0,z:loungePatio.zFt-9},{x:loungePatio.xFt-9,y:1.8,z:loungePatio.zFt+9},{x:loungePatio.xFt+9,y:1.8,z:loungePatio.zFt+9},{x:fireX,y:1.5,z:fireZ},
 ],direction:[.55,.22,-1]},38);
 const shot=(id:string,name:string,frame:{position:[number,number,number];target:[number,number,number]},fov:number)=>({id,name,fov,positionIn:frame.position.map(n=>n*12) as [number,number,number],targetIn:frame.target.map(n=>n*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',cameraPreset:'terrace',activeCameraId:'hero',cameras:[shot('hero','Whole property',hero,42),shot('pool','Pool court',poolCam,36),shot('fire','Fire lounge',fireCam,38)]};
 return data;
}

/** Layout promises the stills rely on. Empty when the sample is buildable. */
export function showcaseSampleIssues(data=ontarioShowcaseDesign()):string[]{
 const issues:string[]=[];
 if(data.permitSite?.lotWidthFt!==LOT_W||data.permitSite.lotDepthFt!==LOT_D||LOT_W<100||LOT_D<200)issues.push('Lot is not a 120×240 ft estate.');
 const rooms=(data.yardFeatures??[]).filter(f=>f.id==='terrace'||f.id==='lounge'||f.id==='pool-court');
 const gapOf=(a:YardFeature,b:YardFeature)=>{const ax0=a.xFt-a.widthFt/2,ax1=a.xFt+a.widthFt/2,az0=a.zFt-a.depthFt/2,az1=a.zFt+a.depthFt/2,bx0=b.xFt-b.widthFt/2,bx1=b.xFt+b.widthFt/2,bz0=b.zFt-b.depthFt/2,bz1=b.zFt+b.depthFt/2,sx=ax1<bx0?bx0-ax1:bx1<ax0?ax0-bx1:0,sz=az1<bz0?bz0-az1:bz1<az0?az0-bz1:0;return sx===0||sz===0?sx+sz:Math.hypot(sx,sz);};
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const gap=gapOf(rooms[i],rooms[j]);if(gap<12)issues.push(`${rooms[i].name} and ${rooms[j].name} are ${gap.toFixed(1)} ft apart.`);}
 const lawn={x0:-6,x1:26,z0:44,z1:76},hitsLawn=(x:number,z:number)=>x>lawn.x0&&x<lawn.x1&&z>lawn.z0&&z<lawn.z1;
 for(const object of data.landscapeObjects??[]){
  if(object.kind==='bed'&&object.polygon?.some(p=>hitsLawn(p.x/12,p.z/12)))issues.push(`${object.name} cuts the lawn panel.`);
  if(object.kind!=='bed'&&object.kind!=='furniture'&&hitsLawn(object.xIn/12,object.zIn/12))issues.push(`${object.name} stands in the lawn panel.`);
 }
 if(!data.autoLighting?.posts||!data.autoLighting.stairs)issues.push('Deck lighting is off.');
 if(!data.pergola?.lighting)issues.push('The pergola has no lights.');
 const terrace=data.yardFeatures?.find(f=>f.id==='terrace'),lounge=data.yardFeatures?.find(f=>f.id==='lounge'),poolCourt=data.yardFeatures?.find(f=>f.id==='pool-court'),fire=data.yardFeatures?.find(f=>f.id==='fire-bowl'),wall=data.yardFeatures?.find(f=>f.id==='seat-wall');
 if(!terrace?.inlays?.length||!lounge?.inlays?.length)issues.push('A paved room is missing its field.');
 if(poolCourt?.hardscape?.colorId!=='champlain-grey')issues.push('The pool court is not champlain grande.');
 if(!fire?.supportFeatureId)issues.push('The fire bowl is not on the lounge.');
 if(!wall?.wallConstruction?.freestanding)issues.push('The seat wall is not freestanding.');
 const tk=buildDeckTakeoff(data);
 if(fire){
  const body=fireOutline(fire),rings=[...houseOutline(data),...tk.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...stairFootprints(tk)];
  const gap=Math.min(...rings.filter(r=>r.length>=3).map(r=>planGapIn(body,r)));
  if(gap<48)issues.push(`Fire clearance is ${(gap/12).toFixed(2)} ft.`);
 }
 if(data.scenePresentation?.activeCameraId!=='hero'||(data.scenePresentation.cameras?.length??0)<3)issues.push('Hero, pool and fire cameras are missing.');
 return issues;
}
