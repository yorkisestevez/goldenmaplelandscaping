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
 * "Paradise Resort" on a 140×200 ft lot (Barrie, Ontario):
 * - modern-farmhouse house; a two-level Coconut Husk composite deck: upper 36×14 at door height under a full-width black
 *   louvered pergola with 8-seat dining, lower 28×12 lounge level three risers down, a 10 ft stair on the house axis;
 * - an Industria arrival terrace at the stair foot and a banded walk on the axis to the pool court;
 * - one 40×18 ft rectangular pool centred on the axis, two framed lounge bays on its house side;
 * - an open-air kitchen on the cabana patio; a gas fire circle with curved seat walls in the west;
 * - a continuous terrace wall holding a deep mulched cedar-screen terrace (double staggered Smaragd row, Annabelles at the lip); restrained Ontario planting: Annabelle hydrangea, boxwood,
 *   yew, little bluestem, red maple, serviceberry, white pine, a clipped cedar hedge.
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
  width:40,length:16,height:40,deckType:'Freestanding',foundationDepthIn:48,houseCantileverIn:16,
  levels:2,level2Position:'Front',level2Offset:50,width2:32,length2:12,height2:18,level2FullStep:true,
  deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',deckFinishes:{border:'tt_prime_plus:Dark Cocoa',fascia:'tt_prime_plus:Dark Cocoa',risers:'tt_prime_plus:Dark Cocoa',railingColor:'Matte Black'},skirting:{style:'Horizontal boards',colour:'tt_prime_plus:Dark Cocoa',clearanceIn:1,accessPanels:1},boardWidth:5.5,pictureFrameRows:1,railingType:'Glass Panels',
  stairFlights:1,stairWidth:120,stairType:'Straight',stairPosition:'Front',stairOffset:50,stairRiserCount:3,stairTreadDepthIn:11,
  houseVisible:true,houseConfig:house,housePlacement:{anchor:'center',offsetIn:-60},
  terrainConfig:{widthFt:200,depthFt:250,elevationIn:0,slopePct:0},
  lightingPreviewOn:true,autoLighting:{posts:true,stairs:true,stairsPerTread:2},lightingSystem:{selectedItems:[],wireDistance:80},
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
 // Stair-axis connector: a 24 ft run of the same Industria field, terrace to pool court, so the stair landing paves straight through to the pool.
 pave('path-1','Axis connector',tx,tz+2.6,52,7.2,0);
 
 // Resort pool court, turned 22°.
 // Pool court square to the house, centred on the stair/house axis.
 const courtX=tx,courtZ=tz+25,ROT=0;
 const court=pave('court','Pool court',courtX,courtZ,50,38,ROT);
 // Two lounge bays either side of the walk landing, each framed by a 24 in Greyed Nickel band (20×9 ft bay), loungers 43 in off the coping.
 {const BAND={...FIELD!,colorId:'greyed-nickel'};
  const band=(id:string,x:number,y:number,w:number,d:number)=>({id,name:'Lounge frame band',shape:'band' as const,xIn:x,yIn:y,widthIn:w,depthIn:d,rotationDeg:0,productId:SLAB,color:'#b0aea6',hardscape:BAND});
  court.inlays=[-1,1].flatMap(k=>{const cu=k*12*12,cv=-12*12;return [band(`fr-n${k}`,cu,cv+48,240,24),band(`fr-s${k}`,cu,cv-48,240,24),band(`fr-w${k}`,cu-108,cv,24,72),band(`fr-e${k}`,cu+108,cv,24,72)];});
  // Axis runner: a framed Greyed Nickel band from the stair landing to the coping, tying the deck stair to the pool.
  court.inlays.push(band('axis-runner',0,-150,36,156));}
 const t=ROT*Math.PI/180;
 const L=(u:number,v:number)=>({x:courtX+u*Math.cos(t)-v*Math.sin(t),z:courtZ+u*Math.sin(t)+v*Math.cos(t)});
 // One 40×18 ft rectangular pool on the axis, crisp straight coping.
 const PC=L(0,5);
 const pool={...createPlanningPool({id:'lagoon',name:'Pool',type:'concrete',xIn:PC.x*12,zIn:PC.z*12,copingTopElevationIn:0,shape:'rectangle'}),outline:[{x:-240,y:-108},{x:240,y:-108},{x:240,y:108},{x:-240,y:108}],curves:[],rotationDeg:ROT,depthProfile:[{stationIn:0,depthIn:42},{stationIn:216,depthIn:60}]};
 const COPING={status:'planning' as const,widthIn:14,thicknessIn:2,overhangIn:1,jointIn:.125,transitionJointIn:.375,stockLengthIn:24,manufacturer:'Techo-Bloc',productId:'techo-piazzetta-coping',verifiedForPool:false,color:'#a9aaa8'};
 (pool as any).coping=COPING;(pool as any).waterOffsetIn=.25; // 1in = the coping overhang: no exposed wall strip.
 data.pools=[pool];
 // Cabana: its own patio east of the terrace, LOUSOL roof over kitchen and bar; dining on the open half.
 const cab=pave('cabana','Pool cabana',tx+37.5,tz-3,26,20); // runs on to meet the pool court's corner
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
 // Full-width black louvered pergola over the upper deck, warm dimmable LED in the louvers.
 data.pergola={...pg,frameFinish:'black',roofFinish:'black',accessories:[],lighting:'perimeter-led',customSize:{widthFt:30,depthFt:14,heightFt:9},target:{kind:'deck',level:0},xFt:20,zFt:8,rotationDeg:0,louverDeg:30} as any;
 // Objects.
 const objs:LandscapeObject[]=[];let n=0;
 const bed=(id:string,name:string,pts:[number,number][],extra:Partial<LandscapeObject>={})=>{const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);const o=newLandscapeObject('black-mulch-bed',id,(Math.min(...xs)+Math.max(...xs))*6,(Math.min(...zs)+Math.max(...zs))*6);objs.push({...o,name,widthIn:(Math.max(...xs)-Math.min(...xs))*12,depthIn:(Math.max(...zs)-Math.min(...zs))*12,polygon:pts.map(([x,z])=>({x:x*12,z:z*12})),...extra} as LandscapeObject);};
 const cedar=(x:number,z:number)=>{const o=newLandscapePlant('thuja-occidentalis-smaragd',`p${n++}`,x*12,z*12);objs.push({...o,assetId:'evergreen-shrub',heightIn:108,widthIn:44,depthIn:40,rotationDeg:(n*53)%360,speciesRecord:structuredClone(o.speciesRecord!)});};
 const grow=(sp:string,x:number,z:number)=>{const o=newLandscapePlant(sp,`p${n++}`,x*12,z*12);objs.push({...o,rotationDeg:(n*53)%360,speciesRecord:structuredClone(o.speciesRecord!)});};
 const furn=(a:LandscapeAssetId,id:string,x:number,z:number,rot:number,sup?:string)=>objs.push({...newLandscapeObject(a,id,x*12,z*12),rotationDeg:rot,...(sup?{supportFeatureId:sup}:{})});
 // Meadow beds either side of the winding path, planted as dense native drifts (one object each).
 // Restrained Ontario palette: Annabelle hydrangea massed as the hero shrub, boxwood for structure, a little bluestem.
 const MEADOW=['hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','buxus-microphylla','schizachyrium-scoparium'];
 const drift=(species:string[],spacingIn:number,seed:number)=>({drift:{species,spacingIn,seed}}) as Partial<LandscapeObject>;
 // (removed: clean lawn beside the axis paving)
 // (removed: clean lawn beside the axis paving)
 // (removed: clean lawn beside the axis paving)
 // Cutting garden: three raised cedar beds west of the fire circle, rows of coneflower and black-eyed Susan.
 // (Cutting garden removed: open lawn west of the fire circle.)
 // Screening: cedar hedge along the rear and both sides; pines and maples behind.
 const hl=Math.min(...houseOutline(data).flat().map(p=>p.x))/12,LX0=hl-30+1.5,LX1=hl-30+128-1.5,RZ=data.permitSite.rearYardFt-1.5;
 // Rear terrace: an armour-stone wall across the yard holds the back 3 ft up. Two runs leave a gap for natural
 // (steps and overlook removed: the wall runs continuous.)
 const WZ=96,SX=-10,UP=36;
 const armour=(id:string,xa:number,xb:number)=>{const run=xb-xa,pts=[{x:-run*6,y:0},{x:-run*2,y:9},{x:run*2,y:-6},{x:run*6,y:0}];
  let len=0;for(let k=1;k<pts.length;k++)len+=Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y);
  return push({id,kind:'retaining-wall',name:'Terrace retaining wall',enabled:true,xFt:(xa+xb)/2,zFt:WZ,widthFt:len/12,depthFt:249/304.8,heightIn:UP,rotationDeg:0,productId:'techo-raffinato-wall',color:'#ddd4c3',hardscape:{finishId:'smooth',colorId:'beige-cream',unitId:'double-sided-397-249-180',patternId:'running-bond',angleDeg:0,jointMm:0,capUnitId:'cap:techo-raffinato-cap:smooth:shale-grey:raffinato-711-356-60'},wallPath:pts} as YardFeature);};
 const wW=armour('terrace-wall',LX0-1,LX1+1);
 bed('upper-garden','Annabelle drift at the wall lip',[[LX0-1.4,WZ+1.3],[LX1+1.4,WZ+1.3],[LX1+1.4,WZ+6.5],[LX0-1.4,WZ+6.5]],{assetId:'mulch-bed',raisedIn:UP,edge:{kind:'wall',wallFeatureId:wW.id},...drift(['hydrangea-arborescens-annabelle'],30,71)} as any);
 bed('cedar-screen','Cedar screen terrace',[[LX0-1.4,WZ+6.5],[LX1+1.4,WZ+6.5],[LX1+1.4,RZ+1.4],[LX0-1.4,RZ+1.4]],{assetId:'mulch-bed',raisedIn:UP} as any);
 for(let x=LX0+0.5;x<=LX1-0.5;x+=2.5)grow('buxus-microphylla',x,WZ+2); // low boxwood edge at the wall lip
 // Layered: hedge at the back line, pines and maples, flowering trees, shrubs, perennials at the wall lip, boulders.
 // Privacy screen: tight staggered double row of Smaragd cedars, 9 ft, across the full terrace.
 for(let x=LX0;x<=LX1;x+=2.2){cedar(x,RZ-0.6);if(x+1.1<=LX1)cedar(x+1.1,RZ-2.4);} // tight staggered hedge wall
 // (Boulders removed from the upper level.)
 // Lower meadow along the wall foot, either side of the meadow walk; deep mixed borders down both sides; a lawn
 // panel (the open green west of the fire circle) is left clean between them.
 // (meadow-rear removed: clean lawn.)
 const pE=L(23,-16.5),pW=L(0,-16.5);
 // (wall-foot-east removed: clean lawn.)
 bed('west-border','West border',[[LX0-1.4,14],[LX0+9.2,14],[LX0+9.2,WZ-1.6],[LX0-1.4,WZ-1.6]],drift(['taxus-media','hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','buxus-microphylla'],40,41));
 // The night camera stands at (82,66) ft inside this border: the border is notched 8 ft either side of it so no shrub sits at the lens.
 const EB=['taxus-media','hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','buxus-microphylla'];
 bed('east-border','East border',[[LX1-5,tz+6.4],[LX1+1.4,tz+6.4],[LX1+1.4,58],[LX1-5,58]],drift(EB,40,42));
 bed('east-border-n','East border',[[LX1-5,74],[LX1+1.4,74],[LX1+1.4,WZ-1.6],[LX1-5,WZ-1.6]],drift(EB,40,44));
 // (cabana-garden removed: clean lawn.)
 bed('house-west','Foundation planting',[[hl+0.5,1.5],[-0.8,1.5],[-0.8,tz-6.4-0.5-6],[hl+0.5,tz-6.4-0.5-6]],drift(['hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','buxus-microphylla'],26,51));
 // Fire-to-pool garden: closes the lawn between the fire circle, the west meadow and the pool court.
 const g1=L(-23.6,-6),g2=L(-23.6,16.6),g3=L(5,16.6);
 // (fire-pool-garden removed: clean lawn.)
 
 for(let z=22;z<=WZ-4;z+=3.5){cedar(LX0+0.6,z);if(Math.abs(z-66)>14)cedar(LX1-0.6,z);}
 // Cabana: kitchen island along its back under the roof, stools facing it; dining on the open east half.
 const kx=cab.xFt-5.5,kz=cab.zFt-3;
 furn('kitchen-island','kitchen-island',kx,kz,180,cab.id);
 for(const dx of [-3.25,-1.1,1.1,3.25])furn('bar-stool',`stool-${dx}`,kx+dx,kz+3.2,180,cab.id);
 // 8-seat dining centred under the pergola on the upper deck.
 furn('teak-dining-table','dining-table',20,8.1,0);
 for(const sd of [-1,1])for(const dx of [-2.75,0,2.75])furn('woven-dining-chair',`dine-${sd}-${dx}`,20+dx,8.1+sd*3.1,rotationDegFacing(0,-sd));
 for(const sd of [-1,1])furn('woven-dining-chair',`dine-end-${sd}`,20+sd*5.1,8.1,rotationDegFacing(-sd,0));
 // Pool loungers on the house-side deck of the court, feet to the water.
 for(const b of [-1,1]){const cu=b*12;for(const k of [-1,1]){const c=L(cu+k*3.2,-12);furn('lounge-chair',`chaise-${b}-${k}`,c.x,c.z,ROT);}
  const st=L(cu,-12);furn('side-table',`chaise-table-${b}`,st.x,st.z,ROT);if(b<0){const um=L(cu-4.6,-13.7);furn('cantilever-umbrella','umbrella',um.x,um.z,ROT);}}
 // Annabelle bank along the open east side of the court, boxwood dots for winter structure.
 {const q=(u:number,v:number)=>{const p=L(u,v);return [p.x,p.z] as [number,number];};bed('hydrangea-bank','Annabelle hydrangea bank',[q(25.6,-17),q(31,-17),q(31,17),q(25.6,17)],drift(['hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','hydrangea-arborescens-annabelle','buxus-microphylla'],28,81));}
 // Planter pair flanking the stair landing on the axis: low framed Annabelle/boxwood planters on the paving.
 for(const k of [-1,1])bed(`landing-planter-${k}`,'Landing planter',[[tx+k*10-2.5,tz-14.5],[tx+k*10+2.5,tz-14.5],[tx+k*10+2.5,tz-8.5],[tx+k*10-2.5,tz-8.5]],{raisedIn:18,...drift(['hydrangea-arborescens-annabelle','buxus-microphylla'],30,60+k)} as any);
 data.landscapeObjects=objs;
 // Lighting: pool + spa niche lights, 2 step lights per tread, path lights in the meadow beds 8–10 ft staggered, tree uplights.
 const hr=houseOutline(data);
 const pl=poolLightPlaces(pool,hr);
 const pin=(x:number,z:number,angle=0)=>({x:x*12,z:z*12,angle});
 const _path=[pin(tx-3.8,tz+5),pin(tx+3.9,tz+10),pin(tx-1.5,tz+16.5),pin(tx+13.5,tz+15.5)];
 const trees=[pin(tx-14,tz+10.2,Math.PI),pin(tx-23,tz+13,Math.PI),pin(tx+16,tz+10.2,Math.PI)];
 data.lightingSystem={wireDistance:80,selectedItems:syncAutoLighting({...data,lightingSystem:{wireDistance:80,selectedItems:[
  {productId:POOL_LIGHT_ID,qty:pl.length,zone:'pool',places:pl},
    {productId:'hub100',qty:1},
 ]}} as DeckData,{posts:tk.quantities.railingPosts,stairs:tk.treads.length,privacy:0})} as any;
 void allDeck;void _path;void trees;
 const shot=(id:string,name:string,p:number[],tg:number[],fov:number)=>({id,name,fov,positionIn:p.map(v=>v*12) as [number,number,number],targetIn:tg.map(v=>v*12) as [number,number,number]});
 data.scenePresentation={viewMode:'finished',poolEdgeWarmth:0,activeCameraId:'overhead',cameras:[
  shot('overhead','Overhead',[12,190,72],[12,0,71.9],55),
  shot('eye','Path to the pool',[tx-6,5.5,tz+1],[courtX,2,courtZ],60),
  shot('wall','Armour stone wall and steps',[-10,6,70],[-10,4,106],58),
 ]} as any;
 return data;
}
