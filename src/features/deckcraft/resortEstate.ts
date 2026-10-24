import type {DeckData,YardFeature} from './types';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
import {DEFAULT_DECK} from './defaults';
import {EXTERIOR_LOOKS,applyLook} from './houseLooks';
import {getHouseConfig} from './houseSettings';
import {buildDeckTakeoff} from './deckTakeoff';
import {stairFootprints} from './fireFeatureModel';
import {createYardFeature} from './yardCreateEdits';
import {yardShapeEdit} from './yardShapeEditing';
import {createPlanningPool,poolRoundedRectangle} from './poolAssembly';
import {newPergola} from './pergolaValidation';
import {syncAutoLighting} from './lightingSystem';
import {poolLightPlaces} from './lightingPlacementRules';
import {POOL_LIGHT_ID} from './poolLightSpec';
import {houseOutline} from './houseFootprint';
import {newLandscapeObject,newLandscapePlant} from './landscapeCatalogue';
import {rotationDegFacing} from './furnitureFacing';
import {arcGeometry} from './circularArcs';

/**
 * "Paradise Resort" — a from-scratch flagship on a 140×200 ft lot, built to look nothing like the Ontario showcase:
 * - modern-farmhouse house; a two-level deck (upper 36×14, lower level stepping down on the east) with no house-side rail;
 * - a Caffè Crema arrival terrace at the stair foot (the treads land on it);
 * - a Borealis plank path that winds (three bends) from the terrace through a native meadow;
 * - a resort pool: a 16×40 ft lagoon (big-radius ends) turned 22° across the east of the yard, with a spa off its end;
 * - a LOUSOL pool cabana (pergola on its own patio) over the outdoor kitchen island and bar stools, with dining beside it;
 * - a round sunken-style fire circle in the west: gas bowl ringed by two curved seat walls facing the flame;
 * - a cedar raised-bed cutting garden; a dense meadow of Ontario natives (coneflower, bee balm, black-eyed Susan,
 *   little bluestem, switchgrass) with redbud, red maple and serviceberry feature trees.
 */
const CREMA='#d0bca4';
const FIELD:YardFeature['hardscape']={finishId:'hd-smooth',colorId:'beige-cream',unitId:'900-600-60-mm-600-900-60',patternId:'linear-pattern-35-100-900x600',angleDeg:0,jointMm:0};
// Walks: Techo-Bloc Linea in Shale Grey (one cool-grey family with the coping), the long 100×425 unit in running bond, laid along each walk.
const plank=(angleDeg:number):YardFeature['hardscape']=>({finishId:'dry-cast',colorId:'shale-grey',unitId:'100-425-100-mm-100-425-100',patternId:'running-bond',angleDeg,jointMm:3});
const SLAB='techo-industria-slab',PLANK='techo-linea-paver';

export function resortEstateDesign():DeckData{
 const look=EXTERIOR_LOOKS.find(l=>l.id==='modern-farmhouse')!;
 const house=applyLook({...getHouseConfig(DEFAULT_DECK),widthFt:56,depthFt:36,storeys:2,storeyHeightIn:114,roofShape:'Gable',roofPitch:8,ridge:'x',floorHeightIn:40,
  openings:[
   {id:'slider',type:'Door',facade:'Front',wallId:'main-front',style:'Sliding',offsetPct:38,bottomIn:40,widthIn:120,heightIn:96},
   {id:'w1',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:12,bottomIn:44,widthIn:96,heightIn:96},
   {id:'w2',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:70,bottomIn:44,widthIn:144,heightIn:96},
   {id:'u1',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:25,bottomIn:160,widthIn:72,heightIn:60},
   {id:'u2',type:'Window',facade:'Front',wallId:'main-front',style:'Picture',offsetPct:75,bottomIn:160,widthIn:72,heightIn:60},
  ]},look);
 const data:DeckData={...DEFAULT_DECK,customerName:'Paradise Resort',projectAddress:'Barrie, Ontario',
  width:36,length:14,height:40,deckType:'Freestanding',foundationDepthIn:48,houseCantileverIn:16,
  levels:2,level2Position:'Right',level2Offset:50,height2:28,
  deckingMaterial:'tt_prime_plus',deckingColor:'Dark Cocoa',boardWidth:5.5,pictureFrameRows:1,railingType:'Glass Panels',
  stairFlights:1,stairWidth:72,stairType:'Straight',stairPosition:'Front',stairOffset:35,stairRiserCount:5,stairTreadDepthIn:11,
  houseVisible:true,houseConfig:house,housePlacement:{anchor:'center',offsetIn:-60},
  terrainConfig:{widthFt:200,depthFt:250,elevationIn:0,slopePct:0},
  lightingPreviewOn:true,autoLighting:{posts:false,stairs:true,stairsPerTread:2},lightingSystem:{selectedItems:[],wireDistance:80},
  yardFeatures:[],landscapeObjects:[]} as DeckData;
 data.permitSite={lotWidthFt:128,lotDepthFt:200,leftYardFt:30,rearYardFt:128,yardFaces:'S'};
 const tk=buildDeckTakeoff(data),rings=stairFootprints(tk);
 let foot=-Infinity,s0=Infinity,s1=-Infinity;for(const r of rings)for(const p of r){foot=Math.max(foot,p.y);s0=Math.min(s0,p.x);s1=Math.max(s1,p.x);}
 const allDeck=tk.levels.flatMap(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})));
 const deckFront=Math.max(...tk.levels[0].footprint.outline.map(p=>p.y+tk.levels[0].offset.z));
 const push=(f:YardFeature)=>{data.yardFeatures=[...data.yardFeatures!,f];return f;};
 const pave=(id:string,name:string,xFt:number,zFt:number,w:number,d:number,rot=0,walk?:number)=>push({...createYardFeature(data,{kind:'patio',id,name,xFt,zFt,widthFt:w,depthFt:d,heightIn:0,productId:walk===undefined?SLAB:PLANK,hardscape:walk===undefined?{...FIELD!,angleDeg:(360-((rot%360)+360)%360)%360}:plank(walk)}),rotationDeg:((rot%360)+360)%360,color:walk===undefined?CREMA:'#928d8c'});
 // Arrival terrace: 16 ft deep, notched round the flight so the treads land on it.
 const cx=(s0+s1)/2,x0=s0-10*12,x1=s1+10*12,cover=Math.min(1.1,0.32*144/(s1-s0)),zN=foot-cover,zF=zN+16*12;
 let terrace=createYardFeature(data,{kind:'patio',id:'terrace',name:'Arrival terrace',xFt:(x0+x1)/24,zFt:(zN+zF)/24,widthFt:(x1-x0)/12,depthFt:(zF-zN)/12,heightIn:0,productId:SLAB,hardscape:FIELD});
 terrace=yardShapeEdit(terrace,[{x:x0,y:deckFront},{x:s0,y:deckFront},{x:s0,y:zN},{x:s1,y:zN},{x:s1,y:deckFront},{x:x1,y:deckFront},{x:x1,y:zF},{x:x0,y:zF}]);
 push({...terrace,color:CREMA});
 const tz=zF/12,tx=cx/12;
 // Winding plank path: straight off the terrace, bends east, then back.
 pave('path-1','Garden path',tx,tz+6-0.3,6,12,0,90);
 pave('path-2','Garden path',tx+5.2,tz+15.2,6,13,325,55);
 pave('path-3','Garden path',tx+9.6,tz+25,6,10,0,90);
 // Resort pool court, turned 22°.
 const courtX=tx+12,courtZ=tz+43,ROT=22;
 const court=pave('court','Pool court',courtX,courtZ,50,36,ROT);
 // Lounge frame: one 24 in band of Industria Greyed Nickel framing a 20×9 ft lounge bay, centred on the pool axis.
 {const BAND={...FIELD!,colorId:'greyed-nickel'};
  const cu=-7*12,cv=-12.5*12,band=(id:string,x:number,y:number,w:number,d:number)=>({id,name:'Lounge frame band',shape:'band' as const,xIn:x,yIn:y,widthIn:w,depthIn:d,rotationDeg:0,productId:SLAB,color:'#b0aea6',hardscape:BAND});
  court.inlays=[band('fr-n',cu,cv+48,240,24),band('fr-s',cu,cv-48,240,24),band('fr-w',cu-108,cv,24,72),band('fr-e',cu+108,cv,24,72),band('link',(9.17+14.33)/2*12,4*12,(14.33-9.17)*12,24)];}
 const t=ROT*Math.PI/180;
 const L=(u:number,v:number)=>({x:courtX+u*Math.cos(t)-v*Math.sin(t),z:courtZ+u*Math.sin(t)+v*Math.cos(t)});
 // Pool and spa on one axis (v=4), same coping; a 24 in Greyed Nickel band runs coping-to-coping between them (see court inlays).
 const PC=L(-7,4),SC=L(19.5,4);
 const pool={...createPlanningPool({id:'lagoon',name:'Resort pool',type:'concrete',xIn:PC.x*12,zIn:PC.z*12,copingTopElevationIn:0,shape:'rounded-rectangle'}),...poolRoundedRectangle(30*12,14*12,78),rotationDeg:ROT,depthProfile:[{stationIn:0,depthIn:42},{stationIn:168,depthIn:60}]};
 const spa={...createPlanningPool({id:'spa',name:'Spa',type:'concrete',xIn:SC.x*12,zIn:SC.z*12,copingTopElevationIn:0,shape:'rounded-rectangle'}),...poolRoundedRectangle(8*12,8*12,30),rotationDeg:ROT,depthProfile:[{stationIn:0,depthIn:36},{stationIn:96,depthIn:36}]};
 const COPING={status:'planning' as const,widthIn:14,thicknessIn:2,overhangIn:1,jointIn:.125,transitionJointIn:.375,stockLengthIn:24,manufacturer:'Techo-Bloc',productId:'techo-piazzetta-coping',verifiedForPool:false,color:'#a9aaa8'};
 (pool as any).coping=COPING;(spa as any).coping=COPING;(pool as any).waterOffsetIn=.25;(spa as any).waterOffsetIn=.25; // 1in = the coping overhang: no exposed wall strip (it read as an orange line at night).
 data.pools=[pool,spa];
 // Cabana: its own patio east of the terrace, LOUSOL roof over kitchen and bar; dining on the open half.
 const cab=pave('cabana','Pool cabana',x1/12-0.3+12.5,tz-4,25,18);
 // Fire circle in the west, linked by a plank walk from the terrace.
 pave('fire-walk','Fire walk',tx-22,tz-3,22,6,0,0);
 const fc=pave('fire-circle','Fire circle',tx-40,tz+6,22,22);
 push({...createYardFeature(data,{kind:'fire-feature',id:'fire-bowl',name:'Fire bowl',xFt:fc.xFt,zFt:fc.zFt,widthFt:3.5,depthFt:3.5,productId:'fire-gas-sculptural',supportFeatureId:fc.id}),color:'#a69c8f'});
 // Two curved seat walls on a 7 ft radius round the bowl, facing it.
 const R=7*12;for(const [k,a0,a1] of [[0,200,320],[1,20,140]] as const){
  const pa={x:fc.xFt*12+R*Math.cos(a0*Math.PI/180),y:fc.zFt*12+R*Math.sin(a0*Math.PI/180)},pb={x:fc.xFt*12+R*Math.cos(a1*Math.PI/180),y:fc.zFt*12+R*Math.sin(a1*Math.PI/180)};
  const mid=(a0+a1)/2*Math.PI/180,chord=Math.hypot(pb.x-pa.x,pb.y-pa.y),sag=R-R*Math.cos((a1-a0)/2*Math.PI/180);
  const mx=(pa.x+pb.x)/2,mz=(pa.y+pb.y)/2,rot=Math.atan2(pb.y-pa.y,pb.x-pa.x)*180/Math.PI;
  // bulge toward the outside (away from the bowl)
  const curves=[{edge:0,bulgeIn:-sag}];
  const local=[{x:-chord/2,y:0},{x:chord/2,y:0}];
  const len=arcGeometry(local[0],local[1],sag).lengthIn/12;
  const w:YardFeature={id:`seat-wall-${k}`,kind:'retaining-wall',name:'Curved seat wall',enabled:true,xFt:mx/12,zFt:mz/12,widthFt:len,depthFt:1,heightIn:18,rotationDeg:Math.round(((rot%360)+360)%360*100)/100,productId:'segmental-concrete',color:'#b8ab98',wallPath:local,curves,wallConstruction:{freestanding:true}} as YardFeature;
  void mid;push(w);
 }
 const pg=newPergola('lousol-custom','custom');
 data.pergola={...pg,frameFinish:'black',roofFinish:'black',accessories:[],lighting:'perimeter-led',customSize:{widthFt:13,depthFt:14,heightFt:10},target:{kind:'patio',featureId:cab.id},xFt:cab.xFt-5.5,zFt:cab.zFt,rotationDeg:0,louverDeg:0} as any;
 // Objects.
 const objs:LandscapeObject[]=[];let n=0;
 const bed=(id:string,name:string,pts:[number,number][],extra:Partial<LandscapeObject>={})=>{const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);const o=newLandscapeObject('black-mulch-bed',id,(Math.min(...xs)+Math.max(...xs))*6,(Math.min(...zs)+Math.max(...zs))*6);objs.push({...o,name,widthIn:(Math.max(...xs)-Math.min(...xs))*12,depthIn:(Math.max(...zs)-Math.min(...zs))*12,polygon:pts.map(([x,z])=>({x:x*12,z:z*12})),...extra} as LandscapeObject);};
 const grow=(sp:string,x:number,z:number)=>{const o=newLandscapePlant(sp,`p${n++}`,x*12,z*12);objs.push({...o,rotationDeg:(n*53)%360,speciesRecord:structuredClone(o.speciesRecord!)});};
 const furn=(a:LandscapeAssetId,id:string,x:number,z:number,rot:number,sup?:string)=>objs.push({...newLandscapeObject(a,id,x*12,z*12),rotationDeg:rot,...(sup?{supportFeatureId:sup}:{})});
 // Meadow beds either side of the winding path, planted as dense native drifts (one object each).
 const MEADOW=['matteuccia-struthiopteris','echinacea-purpurea','hydrangea-arborescens-annabelle','rudbeckia-hirta','panicum-virgatum','monarda-fistulosa','matteuccia-struthiopteris','schizachyrium-scoparium'];
 const drift=(species:string[],spacingIn:number,seed:number)=>({drift:{species,spacingIn,seed}}) as Partial<LandscapeObject>;
 bed('meadow-west','Native meadow',[[tx-27,tz+3.2],[tx-3.3,tz+3.2],[tx-3.3,tz+12],[tx+1.4,tz+21.4],[tx+6.4,tz+28],[tx-27,tz+28]],drift(MEADOW,13,11));
 bed('meadow-east','Native meadow',[[tx+3.4,tz+0.3],[x1/12-0.6,tz+0.3],[x1/12-0.6,tz+6],[tx+20,tz+6],[tx+20,tz+17],[tx+13,tz+19],[tx+13,tz+20],[tx+8.3,tz+12]],drift(MEADOW,13,12));
 for(const [sp,x,z] of [['cercis-canadensis',tx-14,tz+16],['acer-rubrum',tx-24,tz+25],['amelanchier-canadensis',tx+16,tz+14]] as const)grow(sp,x,z);
 // Cutting garden: three raised cedar beds west of the fire circle, rows of coneflower and black-eyed Susan.
 for(let k=0;k<3;k++){const bx=fc.xFt-17,bz=fc.zFt-7+k*7;bed(`cut-${k}`,'Cutting garden bed',[[bx-2,bz-2.5],[bx+2,bz-2.5],[bx+2,bz+2.5],[bx-2,bz+2.5]],{raisedIn:18,edge:{kind:'timber'}} as any);for(const dz of [-1.5,0,1.5])grow(k%2?'rudbeckia-hirta':'echinacea-purpurea',bx,bz+dz);}
 // Screening: cedar hedge along the rear and both sides; pines and maples behind.
 const hl=Math.min(...houseOutline(data).flat().map(p=>p.x))/12,LX0=hl-30+1.5,LX1=hl-30+128-1.5,RZ=data.permitSite.rearYardFt-1.5;
 // Rear terrace: an armour-stone wall across the yard holds the back 3 ft up. Two runs leave a gap for natural
 // stone slab steps; a Borealis overlook landing sits on the upper level at the top of the steps.
 const WZ=104,SX=-10,GAP=2.6,UP=36;
 const armour=(id:string,xa:number,xb:number)=>{const run=xb-xa,pts=[{x:-run*6,y:0},{x:-run*2,y:9},{x:run*2,y:-6},{x:run*6,y:0}];
  let len=0;for(let k=1;k<pts.length;k++)len+=Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y);
  return push({id,kind:'retaining-wall',name:'Armour stone wall',enabled:true,xFt:(xa+xb)/2,zFt:WZ,widthFt:len/12,depthFt:2.5,heightIn:UP,rotationDeg:0,productId:'armour-stone',color:'#9a8f80',wallPath:pts} as YardFeature);};
 const wW=armour('armour-west',LX0-1,SX-GAP),wE=armour('armour-east',SX+GAP,LX1+1);
 const RISERS=6,RUN=17;
 push({id:'stone-steps',name:'Stone slab steps',kind:'patio',enabled:true,xFt:SX,zFt:WZ-((RISERS-1)*RUN+RUN+2)/24+1.2,widthFt:5,depthFt:((RISERS-1)*RUN+RUN+2)/12,heightIn:0,rotationDeg:180,productId:SLAB,hardscape:FIELD,color:'#a39887',finishedElevationIn:UP,
  stoneSteps:{lowerElevationIn:0,riserCount:RISERS,treadRunIn:RUN,stockWidthIn:60,stockDepthIn:RUN+2,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:0,productName:'Natural armour stone slab steps'}} as YardFeature);
 const top=push({...createYardFeature(data,{kind:'patio',id:'overlook',name:'Overlook',xFt:SX,zFt:WZ+5.5,widthFt:10,depthFt:7,heightIn:0,productId:PLANK,hardscape:plank(0)}),finishedElevationIn:UP,color:'#928d8c'});
 // The walk from the fire circle to the step foot, through the rear meadow.
 pave('rear-walk','Meadow walk',SX,(fc.zFt+11+WZ-RISERS*RUN/12+1.2)/2,5.5,(WZ-RISERS*RUN/12+1.2)-(fc.zFt+11)+0.6,0,90);
 const upper=(x:number,z:number)=>!(Math.abs(x-SX)<6.5&&z<WZ+10);
 bed('upper-garden','Upper garden',[[LX0-1.4,WZ+1.3],[SX-5.2,WZ+1.3],[SX-5.2,WZ+9.2],[SX+5.2,WZ+9.2],[SX+5.2,WZ+1.3],[LX1+1.4,WZ+1.3],[LX1+1.4,RZ+1.4],[LX0-1.4,RZ+1.4]],{raisedIn:UP,edge:{kind:'wall',wallFeatureId:wW.id},...drift(['monarda-fistulosa','echinacea-purpurea','hydrangea-arborescens-annabelle','rudbeckia-hirta','cornus-sericea','schizachyrium-scoparium','physocarpus-opulifolius','echinacea-purpurea'],18,21)} as any);
 // Layered: hedge at the back line, pines and maples, flowering trees, shrubs, perennials at the wall lip, boulders.
 for(let x=LX0;x<=LX1;x+=6)grow('thuja-occidentalis-smaragd',x,RZ);
 for(const [k,x] of [LX0+8,LX0+30,LX0+52,LX0+74,LX0+96,LX0+118].entries())grow(k%2?'acer-rubrum':'pinus-strobus',x,RZ-6);
 for(const [k,x] of [LX0+18,LX0+40,LX0+62,LX0+84,LX0+106].entries())grow(['cercis-canadensis','amelanchier-canadensis'][k%2],x,WZ+11);
 for(const [k,x] of [LX0+12,LX0+36,SX+9,LX0+92,LX0+120].entries())objs.push({...newLandscapeObject('natural-boulder',`boulder-${k}`,x*12,(WZ+6+(k%2)*5)*12),rotationDeg:k*41});
 // A bench-sofa on the overlook, turned to the pool.
 furn('outdoor-sofa','overlook-bench',top.xFt,top.zFt+1.6,180,top.id);
 furn('outdoor-coffee-table','overlook-table',top.xFt,top.zFt-2.3,0,top.id);
 // Lower meadow along the wall foot, either side of the meadow walk; deep mixed borders down both sides; a lawn
 // panel (the open green west of the fire circle) is left clean between them.
 bed('meadow-rear','Rear meadow',[[LX0+9.6,WZ-13],[SX-3.1,WZ-13],[SX-3.1,WZ-1.6],[LX0+9.6,WZ-1.6]],drift(MEADOW,13,31));
 const pE=L(23,-16.5),pW=L(0,-16.5);
 bed('wall-foot-east','Wall-foot planting',[[SX+3.1,WZ-6.6],[LX1-5.4,WZ-6.6],[LX1-5.4,WZ-1.6],[SX+3.1,WZ-1.6]],drift(['rudbeckia-hirta','monarda-fistulosa','schizachyrium-scoparium','echinacea-purpurea'],16,32));
 bed('west-border','West border',[[LX0-1.4,14],[LX0+9.2,14],[LX0+9.2,WZ-1.6],[LX0-1.4,WZ-1.6]],drift(['hydrangea-arborescens-annabelle','cornus-sericea','echinacea-purpurea','physocarpus-opulifolius','monarda-fistulosa','schizachyrium-scoparium'],24,41));
 // The night camera stands at (82,66) ft inside this border: the border is notched 8 ft either side of it so no shrub sits at the lens.
 const EB=['hydrangea-paniculata','cornus-sericea','echinacea-purpurea','rudbeckia-hirta','physocarpus-opulifolius'];
 bed('east-border','East border',[[LX1-5,tz+6.4],[LX1+1.4,tz+6.4],[LX1+1.4,58],[LX1-5,58]],drift(EB,24,42));
 bed('east-border-n','East border',[[LX1-5,74],[LX1+1.4,74],[LX1+1.4,WZ-1.6],[LX1-5,WZ-1.6]],drift(EB,24,44));
 bed('cabana-garden','Cabana garden',[[tx+20.6,tz+6.4],[LX1-5.4,tz+6.4],[LX1-5.4,pE.z-1.2],[pW.x+1,pW.z-1.2],[tx+20.6,pW.z-1.2]],drift(MEADOW,13,43));
 bed('house-west','Foundation planting',[[hl+0.5,1.5],[-0.8,1.5],[-0.8,tz-6.4-0.5-6],[hl+0.5,tz-6.4-0.5-6]],drift(['hydrangea-arborescens-annabelle','echinacea-purpurea','hosta','monarda-fistulosa'],20,51));
 // Fire-to-pool garden: closes the lawn between the fire circle, the west meadow and the pool court.
 const g1=L(-23.6,-6),g2=L(-23.6,16.6),g3=L(5,16.6);
 bed('fire-pool-garden','Fire-to-pool garden',[[-6.9,fc.zFt+11.6],[tx-27.6,fc.zFt+11.6],[tx-27.6,tz+28.6],[g1.x,g1.z],[g2.x,g2.z],[g3.x,g3.z],[g3.x,WZ-7.2],[-6.9,WZ-7.2]],drift(MEADOW,13,61));
 grow('acer-rubrum',4,72);grow('cercis-canadensis',14,86);grow('amelanchier-canadensis',-1,60);
 for(let z=22;z<=WZ-4;z+=8){grow('thuja-occidentalis-smaragd',LX0+0.6,z);if(Math.abs(z-66)>14)grow('thuja-occidentalis-smaragd',LX1-0.6,z);}
 // Cabana: kitchen island along its back under the roof, stools facing it; dining on the open east half.
 const kx=data.pergola!.xFt!,kz=cab.zFt-3;
 furn('kitchen-island','kitchen-island',kx,kz,180,cab.id);
 for(const dx of [-3.25,-1.1,1.1,3.25])furn('bar-stool',`stool-${dx}`,kx+dx,kz+3.2,180,cab.id);
 const dX=cab.xFt+6.6,dZ=cab.zFt;
 furn('teak-dining-table','dining-table',dX,dZ,0,cab.id);
 for(const s of [-1,1])for(const dx of [-2.75,0,2.75])furn('woven-dining-chair',`dine-${s}-${dx}`,dX+dx,dZ+s*3.1,rotationDegFacing(0,-s),cab.id);
 // Pool loungers on the house-side deck of the court, feet to the water.
 for(const k of [-1,1]){const c=L(-7+k*3.2,-12.5);furn('lounge-chair',`chaise-${k}`,c.x,c.z,ROT);}
 const st=L(-7,-12.5);furn('side-table','chaise-table',st.x,st.z,ROT);
 const um=L(-11.6,-14.2);furn('cantilever-umbrella','umbrella',um.x,um.z,ROT);
 // Two black steel planters flank the lounge frame: native grasses and coneflower, 18 in raised.
 for(const [k,u] of [[0,-21.4],[1,7.4]] as const){const q=(du:number,dv:number)=>{const p=L(u+du,-12.5+dv);return [p.x,p.z] as [number,number];};
  bed(`planter-${k}`,'Steel planter',[q(-1.5,-3),q(1.5,-3),q(1.5,3),q(-1.5,3)],{raisedIn:18,edge:{kind:'steel'},...drift(['schizachyrium-scoparium','echinacea-purpurea','panicum-virgatum'],12,70+k)} as any);}
 data.landscapeObjects=objs;
 // Lighting: pool + spa niche lights, 2 step lights per tread, path lights in the meadow beds 8–10 ft staggered, tree uplights.
 const hr=houseOutline(data);
 const pl=[...poolLightPlaces(pool,hr),...poolLightPlaces(spa,hr).slice(0,1)];
 const pin=(x:number,z:number,angle=0)=>({x:x*12,z:z*12,angle});
 const _path=[pin(tx-3.8,tz+5),pin(tx+3.9,tz+10),pin(tx-1.5,tz+16.5),pin(tx+13.5,tz+15.5)];
 const trees=[pin(tx-14,tz+14.2,Math.PI),pin(tx-24,tz+23,Math.PI),pin(tx+16,tz+12.2,Math.PI)];
 data.lightingSystem={wireDistance:80,selectedItems:syncAutoLighting({...data,lightingSystem:{wireDistance:80,selectedItems:[
  {productId:POOL_LIGHT_ID,qty:pl.length,zone:'pool',places:pl},
  {productId:'big_scope_narrow',qty:trees.length,zone:'accent-trees',places:trees},
  {productId:'hub100',qty:1},
 ]}} as DeckData,{posts:tk.quantities.railingPosts,stairs:tk.treads.length,privacy:0})} as any;
 void allDeck;void _path;
 const shot=(id:string,name:string,p:number[],tg:number[],fov:number)=>({id,name,fov,positionIn:p.map(v=>v*12) as [number,number,number],targetIn:tg.map(v=>v*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',poolEdgeWarmth:0,activeCameraId:'overhead',cameras:[
  shot('overhead','Overhead',[12,190,72],[12,0,71.9],55),
  shot('eye','Path to the pool',[tx-6,5.5,tz+1],[courtX,2,courtZ],60),
  shot('wall','Armour stone wall and steps',[-10,6,70],[-10,4,106],58),
 ]} as any;
 return data;
}
