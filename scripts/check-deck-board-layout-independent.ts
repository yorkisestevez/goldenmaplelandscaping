import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import Clipper from 'clipper-lib';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {boardFinishPlan,colourRef} from '../src/features/deckcraft/boardFinishes';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {boardLayoutAllowance,layoutBoardStock,BOARD_LAYOUT_SUPPORT_QUOTE} from '../src/features/deckcraft/boardLayoutPricing';
import {validateBoardLayout,physicalBoardPieceCount} from '../src/features/deckcraft/boardLayout';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {emptyHistory,recordChange,undoChange,redoChange} from '../src/features/deckcraft/designer/designHistory';
import type {BoardRun,PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import type {DeckData} from '../src/features/deckcraft/types';

// Independent QA: these fixtures do not call the layout engine's clipping, board-rectangle,
// direction, or area helpers. Raw Clipper retains hole contours, unlike a positive-path filter.
type Layout=NonNullable<DeckData['boardLayout']>;
type EditedBoard=BoardRun&{layoutId?:string;layoutKind?:string;layoutColour?:string};
const COCOA=colourRef('tt_prime_plus','Dark Cocoa'),SALT=colourRef('tt_prime_plus','Sea Salt Gray');
let checks=0;const failures:string[]=[],results:{name:string;boards:number;areaIn2:number}[]=[];
const ok=(condition:unknown,message:string)=>{if(!condition)failures.push(message);checks++;};
const near=(actual:number,expected:number,message:string,tolerance=.025)=>ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`);
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),width:16,length:12,deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',pattern:'Straight',pictureFrameRows:0,pictureFrameOverhangIn:0,...patch});
const layout=(patch:Partial<Layout>={}):Layout=>({regions:[],breakers:[],pieces:[],...patch});
const rect=(x0:number,y0:number,x1:number,y1:number):PlanPoint[]=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
const area=(p:PlanPoint[])=>Math.abs(p.reduce((sum,v,i)=>{const next=p[(i+1)%p.length];return sum+v.x*next.y-next.x*v.y;},0)/2);
const outline=(b:BoardRun,width:number):PlanPoint[]=>{
 if(b.polygon)return b.polygon.map(p=>({...p}));
 const a=b.angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),w=b.width??width;
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:b.cx+c*u*b.length/2-s*v*w/2,y:b.cy+s*u*b.length/2+c*v*w/2}));
};
const physicalCuts=(boards:BoardRun[])=>boards.map(({cx,cy,length,width,angleDeg,polygon,role,inlay})=>({cx,cy,length,width,angleDeg,polygon,role,inlay}));
const intersectionArea=(a:PlanPoint[],b:PlanPoint[])=>{
 const scale=10000,path=(p:PlanPoint[])=>p.map(v=>({X:Math.round(v.x*scale),Y:Math.round(v.y*scale)}));
 const clip=new Clipper.Clipper(),paths:{X:number;Y:number}[][]=[];
 clip.AddPath(path(a),Clipper.PolyType.ptSubject,true);clip.AddPath(path(b),Clipper.PolyType.ptClip,true);
 clip.Execute(Clipper.ClipType.ctIntersection,paths,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 return Math.abs(paths.reduce((sum,p)=>sum+p.reduce((n,v,i)=>{const next=p[(i+1)%p.length];return n+v.X*next.Y-next.X*v.Y;},0)/2,0))/(scale*scale);
};
const inside=(point:PlanPoint,polygon:PlanPoint[])=>{
 let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
 }return hit;
};
const extent=(p:PlanPoint[],degrees:number)=>{
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),u=p.map(v=>v.x*c+v.y*s),v=p.map(v=>-v.x*s+v.y*c);
 return {length:Math.max(...u)-Math.min(...u),width:Math.max(...v)-Math.min(...v)};
};
const directionEdge=(p:PlanPoint[],degrees:number)=>p.some((v,i)=>{
 const n=p[(i+1)%p.length],dx=n.x-v.x,dy=n.y-v.y,a=degrees*Math.PI/180;
 return Math.hypot(dx,dy)>.25&&Math.abs(dx*Math.sin(a)-dy*Math.cos(a))<.005;
});
function geometry(name:string,data:DeckData){
 const model=buildDeckTakeoff(data);
 for(const level of model.levels.filter(l=>l.kind==='deck')){
  const polys=level.boards.map(b=>outline(b,data.boardWidth));
  for(let i=0;i<polys.length;i++){
   const b=level.boards[i],poly=polys[i],dimensions=extent(poly,b.angleDeg);
   ok(poly.length>=3&&poly.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&area(poly)>.001,`${name}: physical polygon ${i} is finite and nonempty`);
   near(intersectionArea(poly,level.deckingFootprint?.outline??level.footprint.outline),area(poly),`${name}: physical piece ${i} remains within finished level`,.05);
   near(dimensions.length,b.length,`${name}: cut length follows physical axis ${i}`);
   ok(dimensions.width<=(b.width??data.boardWidth)+.025,`${name}: cut width stays within its stock width ${i}`);
   ok(b.length<=model.stockLength+.025,`${name}: cut ${i} fits stock`);
   for(let j=0;j<i;j++)ok(intersectionArea(poly,polys[j])<.025,`${name}: boards ${j}/${i} do not double-cover material`);
  }
 }
 const stock=deckBoardStock(model,1),length=model.levels.flatMap(l=>l.boards).reduce((sum,b)=>sum+b.length,0)/12;
 near(stock.installedLf,length,`${name}: physical projected cuts reconcile with purchasing`);
 ok(stock.unresolved.length===0,`${name}: no free oversize stock cuts`);
 const plan=boardFinishPlan(data,model);
 for(const [li,level] of model.levels.entries())for(const [bi,board] of level.boards.entries()){
  const b=board as EditedBoard;if(b.layoutColour&&b.layoutColour!==colourRef(data.deckingMaterial,data.deckingColor))ok(plan.colours[li][bi]===b.layoutColour,`${name}: actual cut ${b.layoutId} takes its exact selected colour`);
 }
 const estimate=calculateDeckReleaseEstimate(data,DECK_SETTINGS),pricedSections=estimate.sections.filter(s=>!/^HST/.test(s.title));
 for(const section of pricedSections)near(section.total,section.items.reduce((sum,item)=>sum+(item.cost??0),0),`${name}: ${section.title} line costs reconcile`,1);
 near(estimate.subtotal,pricedSections.reduce((sum,section)=>sum+section.total,0),`${name}: priced sections reconcile with subtotal`,1);
 near(estimate.hst,Math.round(estimate.subtotal*.13),`${name}: Ontario HST reconciles`,1);
 near(estimate.total,estimate.subtotal+estimate.hst,`${name}: priced total reconciles`,1);
 results.push({name,boards:model.levels.reduce((n,l)=>n+l.boards.length,0),areaIn2:model.levels.flatMap(l=>l.boards).reduce((n,b)=>n+area(outline(b,data.boardWidth)),0)});
 return model;
}
const plain=base(),before=buildDeckTakeoff(plain),unchanged=base({boardLayout:layout()});
ok(JSON.stringify(before)===JSON.stringify(buildDeckTakeoff(unchanged)),'An empty layout preserves exact legacy model');
ok(serializeDesign(plain)===serializeDesign(unchanged),'An empty layout preserves serialized design bytes');
ok(JSON.stringify(calculateDeckReleaseEstimate(plain,DECK_SETTINGS))===JSON.stringify(calculateDeckReleaseEstimate(unchanged,DECK_SETTINGS)),'An empty layout preserves exact legacy prices and quoted gaps');

const original=before.levels[0].boards.find(b=>(b.role??'field')==='field'&&b.cy>35&&b.cy<65&&b.length>100)!;
assert(original);
// A small mask fully inside a board is the critical negative-hole regression fixture.
for(const [name,config] of [
 ['contained rectangular region',layout({regions:[{id:'tiny-region',level:1,polygon:rect(original.cx-7,original.cy-1,original.cx+7,original.cy+1),angleDeg:33,colour:COCOA}]})],
 ['contained physical piece',layout({pieces:[{id:'tiny-piece',level:1,cx:original.cx,cy:original.cy,lengthIn:12,widthIn:2,angleDeg:0,colour:COCOA}]})],
 ['contained concave region',layout({regions:[{id:'tiny-concave',level:1,polygon:[{x:original.cx-7,y:original.cy-1},{x:original.cx+7,y:original.cy-1},{x:original.cx+7,y:original.cy},{x:original.cx,y:original.cy},{x:original.cx,y:original.cy+1},{x:original.cx-7,y:original.cy+1}],angleDeg:90,colour:COCOA}]})],
] as const){
 const d=base({boardLayout:config}),model=geometry(name,d),edited=model.levels[0].boards.filter(b=>(b as EditedBoard).layoutId);
 ok(edited.length>0,`${name}: the contained selection creates actual cuts`);
 const unaffected=[{x:original.cx-30,y:original.cy},{x:original.cx+30,y:original.cy}];
 for(const p of unaffected)ok(model.levels[0].boards.filter(b=>inside(p,outline(b,d.boardWidth))).length===1,`${name}: material outside the mask remains covered exactly once`);
  const oldArea=before.levels[0].boards.reduce((n,b)=>n+area(outline(b,d.boardWidth)),0),newArea=model.levels[0].boards.reduce((n,b)=>n+area(outline(b,d.boardWidth)),0);
  ok(newArea<=oldArea+.05&&newArea>=oldArea-20,`${name}: coverage changes only by the small selection and real joint gaps`);
  const fragments=model.levels[0].boards.filter(raw=>{const b=raw as BoardRun&{layoutStockSource?:{cx:number;cy:number;lengthIn:number}};return b.layoutStockSource?.cx===original.cx&&b.layoutStockSource?.cy===original.cy&&b.layoutStockSource?.lengthIn===original.length;});
  ok(fragments.length>1,`${name}: the original board really is decomposed around the hole`);
  const fragmentModel={...model,levels:model.levels.map((level,index)=>({...level,boards:index===0?fragments:[]}))},fragmentPurchase=layoutBoardStock(d,fragmentModel,1);
  near(fragmentPurchase.orderedBoards,1,`${name}: hole fragments purchase the same original stock blank once`);
  near(physicalBoardPieceCount(fragments,d.boardWidth),1,`${name}: drawable hole fragments remain one connected physical board`);
}

const throughData=base({boardLayout:layout({pieces:[{id:'through-cut',level:1,cx:original.cx,cy:original.cy,lengthIn:5.5,widthIn:2,angleDeg:90,colour:SALT}]})}),throughModel=geometry('through cut separates physical board',throughData),throughFragments=throughModel.levels[0].boards.filter(raw=>{const b=raw as BoardRun&{layoutStockSource?:{cx:number;cy:number;lengthIn:number}};return b.layoutStockSource?.cx===original.cx&&b.layoutStockSource?.cy===original.cy&&b.layoutStockSource?.lengthIn===original.length;});
near(physicalBoardPieceCount(throughFragments,throughData.boardWidth),2,'A crossing cut leaves two actual disconnected physical board components');
near(throughModel.quantities.installedBoardPieces,before.quantities.installedBoardPieces+2,'Physical quantity counts the two surviving sides plus inserted piece, not drawing fragments');

for(const angle of [33,90]){
 const d=base({boardLayout:layout({regions:[{id:`rectangle-${angle}`,level:1,polygon:rect(38,32,122,92),angleDeg:angle,colour:COCOA}]})}),m=geometry(`rectangle ${angle} degrees`,d);
 const runs=m.levels[0].boards.filter(b=>(b as EditedBoard).layoutId===`rectangle-${angle}`);
 ok(runs.length>3,`${angle}: the region is made of real multiple board cuts`);
 for(const b of runs.filter(b=>b.length>d.boardWidth*2))ok(directionEdge(outline(b,d.boardWidth),angle),`${angle}: physical long board edges follow requested direction`);
 for(const b of m.levels[0].boards.filter(b=>!(b as EditedBoard).layoutId))ok(b.angleDeg===0,`${angle}: untouched field retains its original direction`);
}

const overlapping=base({boardLayout:layout({regions:[
 {id:'first',level:1,polygon:rect(30,30,130,90),angleDeg:33,colour:COCOA},
 {id:'last',level:1,polygon:rect(80,50,160,110),angleDeg:90,colour:SALT},
]})}),overlapModel=geometry('last region owns overlap',overlapping);
for(const b of overlapModel.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='first'))ok(intersectionArea(outline(b,overlapping.boardWidth),rect(80,50,130,90))<.025,'Earlier region cannot retain physical material inside later region');
ok(overlapModel.levels[0].boards.some(b=>(b as EditedBoard).layoutId==='last'&&inside({x:b.cx,y:b.cy},rect(80,50,130,90))),'Last region physically owns the overlap');

for(const breaker of [
 {id:'off-centre',level:1 as const,start:{x:73,y:12},end:{x:73,y:130},colour:COCOA},
 {id:'angled',level:1 as const,start:{x:20,y:34},end:{x:164,y:106},colour:SALT},
]){
 const d=base({boardLayout:layout({breakers:[breaker]})}),m=geometry(`manual breaker ${breaker.id}`,d),runs=m.levels[0].boards.filter(b=>(b as EditedBoard).layoutId===breaker.id),angle=Math.atan2(breaker.end.y-breaker.start.y,breaker.end.x-breaker.start.x)*180/Math.PI;
 ok(runs.length>0,'Manual breaker creates physical boards');
 ok(runs.some(b=>directionEdge(outline(b,d.boardWidth),angle)),'Manual breaker physical edges follow chosen endpoints');
 const expectedLf=Math.hypot(breaker.end.x-breaker.start.x,breaker.end.y-breaker.start.y)/12;
 near(boardLayoutAllowance(d,m,320).breakerLf,expectedLf,'Measured breaker purchasing/fitting length follows independently chosen endpoints');
}

const physical=base({boardLayout:layout({pieces:[{id:'rotated-piece',level:1,cx:96,cy:72,lengthIn:72,widthIn:5.5,angleDeg:90,colour:SALT}]})}),physicalModel=geometry('one physical piece rotated 90 degrees',physical),replacement=physicalModel.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='rotated-piece');
ok(replacement.length===1,'The selected fitting piece remains one physical stock cut');
const replacementBounds=outline(replacement[0],physical.boardWidth);
near(Math.max(...replacementBounds.map(p=>p.x))-Math.min(...replacementBounds.map(p=>p.x)),5.5,'Rotated piece has actual width along X');
near(Math.max(...replacementBounds.map(p=>p.y))-Math.min(...replacementBounds.map(p=>p.y)),72,'Rotated piece has actual long cut along Y');
near(area(replacementBounds),72*5.5,'Rotation preserves independently calculated rectangular board area');

const sourceCut=[{x:60,y:69.25},{x:132,y:69.25},{x:128,y:74.75},{x:60,y:74.75}],rotatedCut=sourceCut.map(p=>({x:96-(p.y-72),y:72+(p.x-96)}));
const cutData=base({boardLayout:layout({pieces:[{id:'real-mitred-cut',level:1,cx:96,cy:72,lengthIn:72,widthIn:5.5,angleDeg:90,sourceAngleDeg:0,polygon:sourceCut,colour:COCOA}]})}),cutModel=geometry('real cut silhouette rotates physically',cutData),cutRuns=cutModel.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='real-mitred-cut');
ok(cutRuns.length===1,'A fitting mitred piece remains one physical cut');
const actualCut=outline(cutRuns[0],cutData.boardWidth);
near(area(actualCut),(72+68)/2*5.5,'Physical rotation preserves independently calculated trapezoid area');
near(intersectionArea(actualCut,rotatedCut),area(rotatedCut),'Every physical point remains in independently rotated cut silhouette');
ok(area(actualCut)<72*5.5-.1,'Rotation cannot substitute the requested stock rectangle for the actual mitred cut');

// The same catalogue stock blank must be bought for a narrow rip: no invented rip-width discount.
const narrowPhysical=base({boardLayout:layout({pieces:[{id:'narrow-piece',level:1,cx:96,cy:72,lengthIn:72,widthIn:1,angleDeg:90,colour:SALT}]})}),narrowEstimate=calculateDeckReleaseEstimate(narrowPhysical,DECK_SETTINGS),fullEstimate=calculateDeckReleaseEstimate(physical,DECK_SETTINGS);
const ownStock=(e:typeof narrowEstimate)=>e.sections.find(s=>s.title==='Custom board-layout stock')!.items.find(i=>i.name.includes('Sea Salt Gray'))!;
const narrowStock=ownStock(narrowEstimate),fullStock=ownStock(fullEstimate);
ok(!!narrowStock&&!!fullStock,'Real colour stock is separate from the base decking order');
near(Number(narrowStock.qty),1,'A fitting 72-inch physical piece purchases one actual 16-foot stock board');
near(narrowStock.cost!,fullStock.cost!,'A narrow rip purchases the same full-width stock as a full-width piece');
const catalogueRate=DECK_SETTINGS.materials.find(m=>m.id==='tt_prime_plus')?.costPerSqft??DECKING_CATALOGUE.find(m=>m.id==='tt_prime_plus')!.costPerSqft!;
near(narrowStock.cost!,16*5.5/12*catalogueRate*1.35,'Known supply cost uses full-width stock and existing 35 percent material markup',.01);
ok(narrowEstimate.quoteRequired.includes(BOARD_LAYOUT_SUPPORT_QUOTE),'Support, fastening and construction review remain explicit quote scope');
ok(narrowEstimate.sections.find(s=>s.title==='Custom board-layout construction review')?.items.some(i=>i.cost===null),'Unknown supporting assemblies have a quote row rather than free completed work');
const twiceMarkup=calculateDeckReleaseEstimate({...narrowPhysical,materialMarkup:70},DECK_SETTINGS);
near(ownStock(twiceMarkup).cost!,narrowStock.cost!/1.35*1.70,'Changing material markup changes known stock supply exactly once',.01);

const bordered=base({pictureFrameRows:1}),borderModel=buildDeckTakeoff(bordered),borderEdited=geometry('regions preserve picture frame',base({pictureFrameRows:1,boardLayout:layout({regions:[{id:'border-domain',level:1,polygon:rect(-10,-10,202,154),angleDeg:33}]})}));
ok(isDeepStrictEqual(physicalCuts(borderModel.levels[0].boards.filter(b=>b.role==='border')),physicalCuts(borderEdited.levels[0].boards.filter(b=>b.role==='border'))),'Region crossing whole deck leaves exact picture-frame cuts unchanged');

const inlayBase=base({inlays:[{id:'protected-inlay',kind:'rug',widthFt:6,depthFt:4,frameRows:1,pattern:'Herringbone'}]}),inlayBefore=buildDeckTakeoff(inlayBase),inlayModel=geometry('region preserves built inlay domain',{...inlayBase,boardLayout:layout({regions:[{id:'around-inlay',level:1,polygon:rect(10,10,180,132),angleDeg:33,colour:SALT}]})});
ok(isDeepStrictEqual(physicalCuts(inlayBefore.levels[0].boards.filter(b=>b.inlay==='protected-inlay')),physicalCuts(inlayModel.levels[0].boards.filter(b=>b.inlay==='protected-inlay'))),'Directional region preserves exact physical inlay cuts');
geometry('concave deck clips lasso',base({shape:'L-Shape',cutoutWidth:6,cutoutLength:5,boardLayout:layout({regions:[{id:'lasso-concave',level:1,polygon:[{x:14,y:18},{x:176,y:36},{x:155,y:131},{x:28,y:115}],angleDeg:33,colour:COCOA}]})}));

const levels=base({levels:2,width2:10,length2:8,height2:20}),levelsBefore=buildDeckTakeoff(levels),levelEdit=geometry('level 2 local inches',base({levels:2,width2:10,length2:8,height2:20,boardLayout:layout({regions:[{id:'second-local',level:2,polygon:rect(20,20,100,70),angleDeg:90,colour:COCOA}]})}));
ok(JSON.stringify(levelsBefore.levels[0])===JSON.stringify(levelEdit.levels[0]),'Level 2 layout cannot change level 1 physical model');
const second=levelEdit.levels.find(l=>l.kind==='deck'&&l.index===1)!;
ok(second.boards.some(b=>(b as EditedBoard).layoutId==='second-local'),'Second-level local selection creates cuts on the second level');

const thirdBase=base({levels:3,width2:10,length2:8,height2:24,level3:{widthFt:10,lengthFt:8,heightIn:8,parent:2,position:'Front',offsetPct:50}}),thirdBefore=buildDeckTakeoff(thirdBase),thirdData={...thirdBase,boardLayout:layout({regions:[{id:'third-local',level:3,polygon:rect(20,20,100,70),angleDeg:33,colour:SALT}]})},thirdModel=geometry('level 3 local inches',thirdData);
for(const index of [0,1])ok(JSON.stringify(thirdBefore.levels.find(l=>l.kind==='deck'&&l.index===index))===JSON.stringify(thirdModel.levels.find(l=>l.kind==='deck'&&l.index===index)),`Third-level edit leaves deck level ${index+1} unchanged`);
ok(thirdModel.levels.find(l=>l.kind==='deck'&&l.index===2)?.boards.some(b=>(b as EditedBoard).layoutId==='third-local'),'Third-level local selection creates actual cuts');

const precedence=base({boardLayout:layout({regions:[{id:'region-low',level:1,polygon:rect(20,20,170,120),angleDeg:33}],breakers:[{id:'breaker-middle',level:1,start:{x:96,y:12},end:{x:96,y:132},colour:COCOA}],pieces:[{id:'piece-top',level:1,cx:96,cy:72,lengthIn:18,widthIn:3,angleDeg:0,colour:SALT}]})}),precedenceModel=geometry('piece carves breaker and region',precedence),pieceMask=rect(87,70.5,105,73.5);
for(const b of precedenceModel.levels[0].boards.filter(b=>(b as EditedBoard).layoutId!=='piece-top'))ok(intersectionArea(outline(b,precedence.boardWidth),pieceMask)<.025,'Explicit physical piece wins without duplicate material underneath');

for(const [name,lengthIn,widthIn] of [['contained breaker notch',2,1],['crossing breaker cut',12,2]] as const){
 const data=base({boardLayout:layout({breakers:[{id:'notched-breaker',level:1,start:{x:73,y:12},end:{x:73,y:130},colour:COCOA}],pieces:[{id:'notch-cut',level:1,cx:73,cy:72,lengthIn,widthIn,angleDeg:0,colour:SALT}]})}),model=geometry(name,data),runs=model.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='notched-breaker');
 const intervals=runs.map(b=>{const p=outline(b,data.boardWidth);return [Math.min(...p.map(v=>v.y)),Math.max(...p.map(v=>v.y))];}).sort((a,b)=>a[0]-b[0]);
 let union=0,end=-Infinity;for(const [lo,hi] of intervals){union+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}
 const measured=boardLayoutAllowance(data,model,320).breakerLf;
 near(measured,union/12,`${name}: fitting uses independently merged surviving longitudinal spans`);
 ok(measured<=118/12+.025,`${name}: notch fragments cannot double the requested breaker fitting length`);
}

const longPiece=geometry('oversize manual piece split into stock cuts',base({width:24,boardLayout:layout({pieces:[{id:'long-piece',level:1,cx:144,cy:72,lengthIn:240,widthIn:5.5,angleDeg:0,colour:COCOA}]})}));
ok(longPiece.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='long-piece').length>=2,'A 240-inch physical piece is split and purchased as actual stock cuts');
near(physicalBoardPieceCount(longPiece.levels[0].boards.filter(b=>(b as EditedBoard).layoutId==='long-piece'),5.5),2,'Real stock joints remain two distinct physical board pieces');

// Storage and links must preserve the actual layout, not only the visual editor state.
const serialized=serializeDesign(overlapping),parsed=parseDesign(serialized);
ok(isDeepStrictEqual(parsed.boardLayout,overlapping.boardLayout),'JSON round trip preserves exact polygons, angles, and colours');
ok(JSON.stringify(buildDeckTakeoff(parsed))===JSON.stringify(overlapModel),'JSON round trip preserves actual physical cuts');
const linked=await decodeDesignLink(designLinkFromHash(new URL(await encodeDesignLink(overlapping)).hash)!);
ok(isDeepStrictEqual(linked.boardLayout,overlapping.boardLayout),'Shared design preserves layout geometry and colours');
let history=recordChange(emptyHistory<DeckData>(),plain,'board-layout-apply',1000),current=overlapping;
const undo=undoChange(history,current)!;ok(JSON.stringify(undo.design.boardLayout)===JSON.stringify(plain.boardLayout),'One history Undo restores the complete prior layout');
const redo=redoChange(undo.history,undo.design)!;ok(JSON.stringify(redo.design.boardLayout)===JSON.stringify(current.boardLayout),'Redo restores the complete applied layout');

for(const invalid of [
 layout({regions:[{id:'bad-level',level:4 as 1,polygon:rect(20,20,60,60),angleDeg:33}]}),
 layout({regions:[{id:'bad-shape',level:1,polygon:[{x:20,y:20},{x:30,y:30}],angleDeg:33}]}),
 layout({regions:[{id:'bad-colour',level:1,polygon:rect(20,20,60,60),angleDeg:33,colour:'invented:nonexistent'}]}),
 layout({breakers:[{id:'zero-line',level:1,start:{x:30,y:30},end:{x:30,y:30}}]}),
 layout({pieces:[{id:'bad-width',level:1,cx:40,cy:40,lengthIn:20,widthIn:99,angleDeg:0}]}),
 layout({pieces:[{id:'bad-point',level:1,cx:NaN,cy:40,lengthIn:20,widthIn:5.5,angleDeg:0}]}),
]){
 const file=JSON.parse(serializeDesign(plain));file.configuration.boardLayout=invalid;
 assert.throws(()=>parseDesign(JSON.stringify(file)),undefined,'Malformed layout cannot silently enter saved design');checks++;
}

const safeRegion={id:'safe-region',level:1,polygon:rect(20,20,60,60),angleDeg:33},sparse=new Array(1),hidden=[safeRegion],symbol=[safeRegion],prototype=[safeRegion],accessor=[safeRegion];
Object.defineProperty(hidden,'hidden',{value:true});Object.defineProperty(symbol,Symbol('hidden'),{value:true});Object.setPrototypeOf(prototype,Object.create(Array.prototype));
let getterCalls=0;Object.defineProperty(accessor,'0',{get(){getterCalls++;throw new Error('Accessors must not be invoked');},enumerable:true});
for(const regions of [sparse,hidden,symbol,prototype,accessor]){assert.throws(()=>validateBoardLayout({regions,breakers:[],pieces:[]},plain.boardWidth),undefined,'Unsafe arrays cannot enter imported layouts');checks++;}
ok(getterCalls===0,'Layout validation rejects accessor arrays without invoking their getters');

const cedar=DECKING_CATALOGUE.find(m=>m.id==='cedar'||/cedar/i.test(m.name)&&!m.isComposite)!;assert(cedar,'Fixture needs an actual cedar catalogue product');
for(const [main,colour] of [
 ['tt_prime_plus',colourRef(cedar.id,cedar.colors[0].name)],
 [cedar.id,SALT],
] as const){
 const file=JSON.parse(serializeDesign(plain));file.configuration.deckingMaterial=main;file.configuration.deckingColor=DECKING_CATALOGUE.find(m=>m.id===main)!.colors[0].name;file.configuration.boardLayout=layout({regions:[{id:'incompatible',level:1,polygon:rect(20,20,60,60),angleDeg:33,colour}]});
 assert.throws(()=>parseDesign(JSON.stringify(file)),undefined,'Known but incompatible wood/composite overrides cannot be silently suppressed');checks++;
}
const reserve=DECKING_CATALOGUE.find(m=>m.id==='tt_reserve')!,compatibleRef=colourRef(reserve.id,reserve.colors[0].name),compatible=base({boardLayout:layout({regions:[{id:'compatible-composite',level:1,polygon:rect(20,20,60,60),angleDeg:33,colour:compatibleRef}]})});
ok(parseDesign(serializeDesign(compatible)).boardLayout?.regions[0].colour===compatibleRef,'Compatible real composite collection colour survives strict import');

// The proof goes to the outer research workspace's outputs/ only when this checkout sits in it; a site checkout or CI
// runner never gets folders created outside the repository.
if(existsSync(new URL('../../../outputs/',import.meta.url))){
  const out=new URL('../../../outputs/deckcraft-workspace-review/board-editing/',import.meta.url);mkdirSync(out,{recursive:true});
  writeFileSync(new URL('independent-geometry-proof.json',out),JSON.stringify({status:failures.length?'FAIL':'PASS',checks,failures,fixtures:results},null,2));
}
console.log(`Independent board-layout geometry: ${checks} checks across ${results.length} fixtures; ${failures.length} failures`);
if(failures.length){console.error(failures.slice(0,25).join('\n'));process.exitCode=1;}
