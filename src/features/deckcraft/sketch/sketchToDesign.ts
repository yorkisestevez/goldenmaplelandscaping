import type {DeckData,HouseBlock,HouseConfig} from '../types';
import {boundaryBounds,boundaryProblem,savedBoundary,freeFootprint} from '../lib/freeOutline';
import {edgeFacing,getFootprint,getStairPlacement,type EdgeName,type PlanPoint} from '../lib/deckGeometry';
import {polygonCut,signedArea} from '../lib/polygonCuts';
import {getHouseConfig} from '../houseSettings';
import {getHousePlacement} from '../housePlacement';
import {getHouseContact} from '../houseContact';
import {getHouseBlocks} from '../houseFootprint';
import {getStairSupport} from '../stairConstruction';
import {finishedFasciaOffset} from '../lib/finishedFootprint';
import {parseSketchDocument,type SketchDocument,type SketchResult,type SketchShape} from './sketchTypes';
import {rectangularSketch,sketchBounds,sketchRectangle} from './sketchGeometry';
import {snapStairPath} from './sketchStairPath';
import {resolveStairPath,stairPathOffset} from '../lib/stairPath';
export {parseSketchDocument} from './sketchTypes';

type Surface={shape:SketchShape;points:PlanPoint[];height:number;bounds:ReturnType<typeof boundaryBounds>};
type Join={parent:number;side:'Front'|'Left'|'Right';offsetPct:number;span:number;points:PlanPoint[]};
const EPS=.01,CONTACT=.5;
const area=(p:PlanPoint[])=>Math.abs(signedArea(p));
const overlap=(a:PlanPoint[],b:PlanPoint[])=>polygonCut([a],[b]).reduce((n,p)=>n+area(p),0);
const inRange=(v:number,min:number,max:number,name:string)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(`${name} must be between ${min} and ${max}.`);return v;};
const near=(a:number,b:number,tolerance=CONTACT)=>Math.abs(a-b)<=tolerance;
// Matches takeoff gaps for the studio's two wood collections; no pricing/catalogue table is imported.
const boardGap=(data:DeckData)=>['pressure_treated','cedar'].includes(data.deckingMaterial)?.25:.1875;
const edges=(points:PlanPoint[])=>points.map((a,index)=>{const b=points[(index+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);return {a,b,index,length,outward:{x:(b.y-a.y)/length,y:-(b.x-a.x)/length}};});
const opposite=(side:EdgeName):EdgeName=>side==='Front'?'Back':side==='Back'?'Front':side==='Left'?'Right':'Left';
function sameLine(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint){const len=Math.hypot(b.x-a.x,b.y-a.y),off=(p:PlanPoint)=>Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/len;return len>EPS&&off(c)<=CONTACT&&off(d)<=CONTACT;}
function sharedSpans(parent:PlanPoint[],child:PlanPoint[]){
  return edges(parent).flatMap(e=>edges(child).flatMap(f=>{
    if(!sameLine(e.a,e.b,f.a,f.b)||e.outward.x*f.outward.x+e.outward.y*f.outward.y>-.99)return [];
    const ux=(e.b.x-e.a.x)/e.length,uy=(e.b.y-e.a.y)/e.length,t=(p:PlanPoint)=>(p.x-e.a.x)*ux+(p.y-e.a.y)*uy,lo=Math.max(0,Math.min(t(f.a),t(f.b))),hi=Math.min(e.length,Math.max(t(f.a),t(f.b)));
    return hi-lo>CONTACT?[{edge:e,childEdge:f,length:hi-lo,a:{x:e.a.x+ux*lo,y:e.a.y+uy*lo},b:{x:e.a.x+ux*hi,y:e.a.y+uy*hi}}]:[];
  }));
}
function canonicalShape(s:SketchShape,sx:number,sy:number,warnings:string[]):PlanPoint[]{
  const rectangle=rectangularSketch(s.points);
  if(!rectangle)return s.points.map(p=>({...p}));
  const deviation=rectangle.deviation*Math.max(sx,sy)*12;
  if(deviation>6)return s.points.map(p=>({...p}));
  if(deviation>.01||s.points.length!==4)warnings.push(`${s.label}: hand-drawn walls/edges straightened to a rectangle (up to ${deviation.toFixed(1)} inches of drawing correction).`);
  return rectangle.points;
}
function measuredShape(s:SketchShape,sx:number,sy:number,x0:number,y0:number,warnings:string[]):PlanPoint[]{
  const p=canonicalShape(s,sx,sy,warnings),b=sketchBounds(p),w=s.widthFt??b.w*sx,h=s.depthFt??b.h*sy;
  if(s.widthFt!==undefined&&Math.abs(w-b.w*sx)*12>.5||s.depthFt!==undefined&&Math.abs(h-b.h*sy)*12>.5)warnings.push(`${s.label}: typed width/depth override the drawing proportions; its across/out position remains anchored to the drawing's top-left corner.`);
  return p.map(v=>({x:((b.x-x0)*sx+(v.x-b.x)*w/b.w)*12,y:((b.y-y0)*sy+(v.y-b.y)*h/b.h)*12}));
}
function surface(s:SketchShape,sx:number,sy:number,x0:number,y0:number,defaultHeight:number,warnings:string[],main=false):Surface{
  const points=measuredShape(s,sx,sy,x0,y0,warnings),bounds=boundaryBounds(points),height=s.heightIn??defaultHeight;
  inRange(bounds.w/12,4,main?60:40,`${s.label} width in feet`);inRange(bounds.h/12,4,main?60:40,`${s.label} depth in feet`);inRange(height,8,144,`${s.label} elevation in inches`);
  const problem=boundaryProblem(points);if(problem)throw new Error(`${s.label}: ${problem}`);
  if(s.heightIn===undefined)warnings.push(`${s.label}: elevation defaults to ${height} inches above grade. Enter the measured elevation before construction.`);
  return {shape:s,points,height,bounds};
}
function joinSurface(child:Surface,parents:Surface[],data:DeckData):Join{
  const candidates=parents.flatMap((parent,index)=>sharedSpans(parent.points,child.points).map(span=>({parent,index,span})));
  if(!candidates.length)throw new Error(`${child.shape.label}: connect its edge directly to a deck edge. Gapped or floating landings need a separately drawn, supported stair connection.`);
  if(new Set(candidates.map(c=>c.index)).size>1||candidates.length>1)throw new Error(`${child.shape.label}: the attachment is ambiguous. Draw one shared straight joining edge with one parent deck.`);
  const {parent,index,span}=candidates[0],side=edgeFacing(span.edge.outward);
  if(side==='Back'||Math.abs(span.edge.outward.x)>EPS&&Math.abs(span.edge.outward.y)>EPS)throw new Error(`${child.shape.label}: this studio joins extra levels on straight front, left or right edges. Move the connection to one of those edges.`);
  const horizontal=side==='Front',requested=horizontal?child.bounds.w:child.bounds.h;
  if(!near(span.length,requested))throw new Error(`${child.shape.label}: its whole ${opposite(side).toLowerCase()} edge must meet the parent deck. Align the measured edge or resize it.`);
  const fp={outline:parent.points,bounds:{w:parent.bounds.w,h:parent.bounds.h},isCurved:false},contact=index===0?getHouseContact(data,fp):undefined,first=getStairPlacement({...data,stairFlights:1,stairPosition:side,stairWidth:requested,stairOffset:50,stairEdgeId:undefined},fp,contact);
  if(!first||first.edgeIndex!==span.edge.index||first.width<requested-CONTACT)throw new Error(`${child.shape.label}: the selected joining edge cannot be represented by the current level controls. Use the longest exposed ${side.toLowerCase()} edge.`);
  const chosen=span.edge,reverse=chosen.b.x-chosen.a.x<-.5||chosen.b.y-chosen.a.y<-.5,base=reverse?chosen.b:chosen.a,along=first.along,lo=Math.min((span.a.x-base.x)*along.x+(span.a.y-base.y)*along.y,(span.b.x-base.x)*along.x+(span.b.y-base.y)*along.y),available=chosen.length-requested,offsetPct=available>EPS?lo/available*100:50;
  const delta=Math.abs(parent.height-child.height),n=delta>.01?Math.ceil(delta/7.75):0;
  if(n>14)throw new Error(`${child.shape.label}: this height difference needs an intermediate stair landing. Draw a smaller split-level rise.`);
  if(n){const support=getStairSupport(data,boardGap(data)),lower=parent.height>=child.height?child.points:parent.points,dir=parent.height>=child.height?span.edge.outward:{x:-span.edge.outward.x,y:-span.edge.outward.y},reach=(n-1)*support.runIn+support.treadNosingIn+36+((data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0),ux=(span.b.x-span.a.x)/span.length,uy=(span.b.y-span.a.y)/span.length,at=(t:number,d:number)=>({x:span.a.x+ux*t+dir.x*d,y:span.a.y+uy*t+dir.y*d}),room=[at(.5,.01),at(span.length-.5,.01),at(span.length-.5,reach),at(.5,reach)];
    if(overlap(room,lower)<area(room)-1)throw new Error(`${child.shape.label}: the connecting steps need ${Math.ceil(reach)} inches of clear depth on the lower surface. Increase that depth or reduce the elevation difference.`);}
  return {parent:index,side,offsetPct:Math.max(0,Math.min(100,offsetPct)),span:span.length,points:child.points};
}
function replacementHouse(shapes:SketchShape[],sx:number,sy:number,x0:number,y0:number,current:DeckData,warnings:string[],summary:string[]){
  const original=getHouseConfig(current),main=shapes[0],rect=rectangularSketch(main.points);
  if(!rect||rect.deviation*Math.max(sx,sy)*12>6)throw new Error(`${main.label}: the main house must be an axis-aligned rectangular footprint. Split an L-shaped house into a main rectangle and attached rectangular blocks.`);
  const b=sketchBounds(main.points),width=main.widthFt??b.w*sx,depth=main.depthFt??b.h*sy,rectWorld=sketchRectangle((b.x-x0)*sx*12,-depth*12,width*12,depth*12);
  inRange(width,12,100,`${main.label} width in feet`);inRange(depth,12,100,`${main.label} depth in feet`);
  if(main.heightIn!==undefined)inRange(main.heightIn,96,900,`${main.label} total wall height in inches`);
  const house:HouseConfig={...original,widthFt:width,depthFt:depth,...(main.heightIn!==undefined?{storeyHeightIn:inRange(main.heightIn/original.storeys,96,300,'House storey height')}:{})};
  const blocks:HouseBlock[]=[],blockOutlines:PlanPoint[][]=[];
  const mainBox=boundaryBounds(rectWorld);
  for(const [i,s] of shapes.slice(1).entries()){
    const r=rectangularSketch(s.points);if(!r||r.deviation*Math.max(sx,sy)*12>6)throw new Error(`${s.label}: draw an axis-aligned rectangular house block attached to the main house.`);
    const points=measuredShape(s,sx,sy,x0,y0,warnings),bb=boundaryBounds(points),spans=sharedSpans(rectWorld,points);
    if(overlap(rectWorld,points)>1||blockOutlines.some(p=>overlap(p,points)>1))throw new Error(`${s.label}: house blocks overlap. Draw separate rectangles sharing only their joining wall.`);
    if(spans.length!==1||spans[0].length<24)throw new Error(`${s.label}: attach at least 2 feet of one block wall to the main house. Detached buildings and chained blocks are not supported.`);
    const side=edgeFacing(spans[0].edge.outward),horizontal=side==='Front'||side==='Back';
    const block:HouseBlock={id:`sketch${i+1}`,kind:'house',wall:side,offsetFt:horizontal?(bb.x-mainBox.x)/12:-(bb.y+bb.h)/12,widthFt:(horizontal?bb.w:bb.h)/12,depthFt:(horizontal?bb.h:bb.w)/12};
    inRange(block.widthFt,2,100,`${s.label} wall width`);inRange(block.depthFt,1,60,`${s.label} projection`);inRange(block.offsetFt,-100,100,`${s.label} wall offset`);
    if(s.heightIn!==undefined){const storeys=s.heightIn/house.storeyHeightIn;if(![1,2,3].some(n=>Math.abs(n-storeys)<.0001))throw new Error(`${s.label}: block wall height must be one, two or three of the main house's ${house.storeyHeightIn}-inch storeys.`);block.storeys=Math.round(storeys) as 1|2|3;}
    blocks.push(block);blockOutlines.push(points);summary.push(`${s.label}: rectangular house block attached to the ${side.toLowerCase()} wall.`);
  }
  house.footprint=blocks.length?{rects:blocks}:undefined;
  if(original.openings.length)warnings.push('The new house replaces existing door/window wall positions. Those openings are cleared; add measured openings to the new house before construction.');
  house.openings=[];house.wallFinishes=undefined;
  warnings.push(`${main.label}: interpreted as measured rectangular house walls; typed measurements override its drawing proportions.`);
  summary.push(`${main.label}: house ${width.toFixed(2)} × ${depth.toFixed(2)} ft; width anchored to its drawn left edge, depth extends back from its deck-facing wall. Appearance/products retained, measured openings reset.`);
  inRange(mainBox.x,-2400,2400,`${main.label} position in inches`);
  return {house,placement:{anchor:'left' as const,offsetIn:mainBox.x},outlines:[rectWorld,...blockOutlines]};
}
/** Deterministic local interpretation only. A preview never mutates the current design or persists a draft. */
export function generateSketchDesign(document:SketchDocument,current:DeckData):SketchResult {
  const errors:string[]=[],warnings:string[]=[],summary:string[]=[];
  try{
    const parsed=parseSketchDocument(document);if(parsed.shapes.some(s=>s.kind==='patio'||s.kind==='retaining-wall'))throw Error('Use Current plan to add or edit patios and retaining walls. A new deck sketch does not replace existing yard features.');const decks=parsed.shapes.filter(s=>s.kind==='deck'),houses=parsed.shapes.filter(s=>s.kind==='house'),stairs=parsed.shapes.filter(s=>s.kind==='stairs');
    if(!decks.length)throw new Error('Draw and label a main deck. A landing alone does not identify the main deck.');
    const surfaces=[decks[0],...parsed.shapes.filter(s=>(s.kind==='deck'||s.kind==='landing')&&s!==decks[0])];
    if(surfaces.length>3)throw new Error('This studio supports three editable deck/landing surfaces. Combine areas or remove an extra surface.');
    if(houses.length>7)throw new Error('Use one main house and no more than six attached house blocks.');
    if(stairs.length>1)throw new Error('Draw one connected stair path or rectangle. Use an L to wrap adjacent edges.');
    const main=surfaces[0],mb=sketchBounds(main.points),hb=houses[0]&&sketchBounds(houses[0].points),sx=main.widthFt!==undefined?main.widthFt/mb.w:houses[0]?.widthFt!==undefined?houses[0].widthFt/hb!.w:0,sy=main.depthFt!==undefined?main.depthFt/mb.h:houses[0]?.depthFt!==undefined?houses[0].depthFt/hb!.h:0;
    if(!(sx>0&&sy>0))throw new Error('Enter typed width and depth measurements on the main deck or main house to calibrate the whole drawing. Labels and handwriting are not read as measurements.');
    const x0=mb.x,y0=hb?hb.y+hb.h:mb.y,mainHeight=main.heightIn??current.height;
    summary.push(`Drawing calibrated in one shared coordinate system (${(sx*12).toFixed(3)} inches per across unit; ${(sy*12).toFixed(3)} inches per out unit). Typed shape dimensions override proportions.`);
    let nonHouseY0=y0;
    const mainSurface=surface(main,sx,sy,x0,nonHouseY0,mainHeight,warnings,true);
    if(houses.length===1&&(current.deckType==='Attached'||current.deckType==='Add-on')&&rectangularSketch(houses[0].points)){
      const h=houses[0],hb=sketchBounds(h.points),left=(hb.x-x0)*sx*12,right=left+(h.widthFt??hb.w*sx)*12,gap=mainSurface.bounds.y;
      const back=edges(mainSurface.points).find(e=>near(e.a.y,gap)&&near(e.b.y,gap)&&e.outward.y<-.99&&Math.min(Math.max(e.a.x,e.b.x),right)-Math.max(Math.min(e.a.x,e.b.x),left)>=24);
      if(back&&Math.abs(gap)>.001&&Math.abs(gap)<=6){
        nonHouseY0+=gap/(12*sy);mainSurface.points=mainSurface.points.map(p=>({x:p.x,y:p.y-gap}));mainSurface.bounds=boundaryBounds(mainSurface.points);
        const note=`The whole deck/landing/stair sketch moved ${Math.abs(gap).toFixed(2)} inches ${gap>0?'toward':'away from'} the house to close the small hand-drawn wall gap. Relative positions are preserved.`;warnings.push(note);summary.push(note);
      }
    }
    const patch:Partial<DeckData>={projectKind:'deck',shape:'Rectangle',levels:surfaces.length,width:mainSurface.bounds.w/12,length:mainSurface.bounds.h/12,height:mainSurface.height,cutoutWidth:0,cutoutLength:0,cutoutWidth2:0,cutoutLength2:0,
      deckOutlines:{main:savedBoundary(mainSurface.points)},deckOutlineOffsets:undefined,boundaryLocks:undefined,wrap:undefined,customFront:undefined,cornerChamfers:undefined,boardColours:undefined,boardLayout:undefined,railSections:undefined,railDefault:undefined,inlays:undefined,hasInlay:false,inlayLf:0,
      stairFlights:0,stairType:'Straight',stairPosition:'Front',stairOffset:50,stairEdgeId:undefined,stairPath:undefined,stairRiserCount:undefined,stairTreadDepthIn:undefined,stairTurn:'Right',level2EdgeId:undefined,level2FullStep:false,level2Position:'Front',level2Offset:50,level3:undefined,privacyScreens:undefined,privacySqft:0};
    if(current.skirting?.openEdges?.length)patch.skirting={...current.skirting,openEdges:undefined};
    summary.push('Geometry-bound board colours, custom board layouts, railing section placements, decorative inlays, wrap/chamfer selections, old stair locations and privacy-screen locations are reset for the new footprint. Product selections, finishes, pricing settings and customer details are retained.');
    if(current.boundaryLocks?.length)warnings.push('Existing measured edge locks are cleared because this sketch replaces the deck geometry. Review and lock the new measurements after applying.');
    if(current.yardFeatures?.length)warnings.push('Existing yard feature positions are retained. Review their clearance from the new house/deck.');
    let houseOutlines:PlanPoint[][]=[];
    if(houses.length){const result=replacementHouse(houses,sx,sy,x0,y0,current,warnings,summary);patch.houseConfig=result.house;patch.housePlacement=result.placement;patch.houseVisible=true;houseOutlines=result.outlines;}
    else {patch.houseConfig=structuredClone(getHouseConfig(current));patch.housePlacement={anchor:'left',offsetIn:getHousePlacement(current).x0};summary.push('No house was drawn: existing measured house and openings are retained at their current world position.');}
    let candidate={...current,...patch};
    if(houses.length){const actual=getHouseBlocks(candidate);if(actual.length!==houseOutlines.length||actual.some((block,i)=>{const b=boundaryBounds(houseOutlines[i]);return !near(block.rect.x0,b.x)||!near(block.rect.x1,b.x+b.w)||!near(block.rect.y0,b.y)||!near(block.rect.y1,b.y+b.h);} ))throw new Error('The drawn house blocks would be repositioned by the studio support rules. Reduce their projection or use a simpler attached-block arrangement.');}
    const actualHouses=getHouseBlocks(candidate).map(b=>sketchRectangle(b.rect.x0,b.rect.y0,b.rect.x1-b.rect.x0,b.rect.y1-b.rect.y0));
    if(actualHouses.some(p=>overlap(p,mainSurface.points)>1))throw new Error(`${main.label}: the deck overlaps the house footprint. Draw it outside the wall or notch its outline around the house.`);
    if(candidate.deckType==='Attached'||candidate.deckType==='Add-on'){const contact=getHouseContact(candidate);if(contact.ledgerLf+contact.flushLf<2)throw new Error(`${main.label}: the attached deck must meet at least 2 feet of a house wall. Close the drawing gap or select a freestanding deck before applying.`);}
    const converted:Surface[]=[mainSurface],joins:Join[]=[];
    for(const [index,s] of surfaces.slice(1).entries()){
      const child=surface(s,sx,sy,x0,nonHouseY0,mainSurface.height,warnings);
      if(converted.some(parent=>overlap(parent.points,child.points)>1))throw new Error(`${s.label}: deck surfaces overlap. Draw their outlines beside one another, sharing an edge.`);
      if(actualHouses.some(p=>overlap(p,child.points)>1))throw new Error(`${s.label}: this surface overlaps the house. Move its outline outside the house walls.`);
      const join=joinSurface(child,converted,candidate);joins.push(join);
      const key=index===0?'second':'third',points=child.points.map(p=>({x:p.x-child.bounds.x,y:p.y-child.bounds.y}));
      patch.deckOutlines={...patch.deckOutlines,[key]:savedBoundary(points)};patch.deckOutlineOffsets={...patch.deckOutlineOffsets,[key]:{x:child.bounds.x/12,y:child.bounds.y/12}};
      if(index===0)Object.assign(patch,{width2:child.bounds.w/12,length2:child.bounds.h/12,height2:child.height,level2Position:join.side,level2Offset:join.offsetPct,level2FullStep:true});
      else patch.level3={widthFt:child.bounds.w/12,lengthFt:child.bounds.h/12,heightIn:child.height,parent:(join.parent+1) as 1|2,position:join.side,offsetPct:join.offsetPct,fullStep:true};
      converted.push(child);candidate={...current,...patch};summary.push(`${s.label}: editable level ${index+2}, ${child.bounds.w/12} × ${child.bounds.h/12} ft at ${child.height} inches, joined to level ${join.parent+1}. ${s.kind==='landing'?'Landing interpreted as a supported deck section, not an automatic stair landing.':''}`);
    }
    summary.push(`${main.label}: editable main outline with ${mainSurface.points.length} corners, ${Math.round(area(mainSurface.points)/144*100)/100} sq ft, ${mainSurface.height} inches above grade.`);
    if(stairs.length){
      const s=stairs[0];
      if(s.drawing==='edge-path'){
        const exit=converted.reduce((best,s,i)=>s.height<=converted[best].height?i:best,0),deck=converted[exit];
        if(s.heightIn!==undefined&&!near(s.heightIn,deck.height))throw Error(`${s.label}: stair rise must match the lowest deck elevation (${deck.height} in).`);
        const points=snapStairPath(s.points.map(p=>({x:(p.x-x0)*sx*12,y:(p.y-nonHouseY0)*sy*12})),deck.points);
        if(s.widthFt!==undefined||s.depthFt!==undefined)warnings.push(`${s.label}: opening lengths follow the measured deck perimeter. Stair path width/depth fields are not used; edit its spans after applying.`);
        Object.assign(patch,{stairPath:{points:points.map(p=>({x:p.x-deck.bounds.x,y:p.y-deck.bounds.y}))},stairFlights:points.length-1,stairType:'Straight',stairRiserCount:s.riserCount,stairTreadDepthIn:s.treadDepthIn});
        const pathData={...current,...patch},fp=exit===2?freeFootprint(pathData,3)!:getFootprint(pathData,(exit+1) as 1|2),contact=exit===0?getHouseContact(pathData,fp):undefined;
        const result=resolveStairPath(pathData,fp,contact);if(result.issues.length)throw Error(`${s.label}: ${result.issues.join(' ')}`);
        for(let i=0;i<points.length-1;i++)for(const [j,join] of joins.entries()){
          if(join.parent!==exit&&j+1!==exit)continue;
          for(const span of sharedSpans(converted[join.parent].points,converted[j+1].points)){
            if(!sameLine(points[i],points[i+1],span.a,span.b))continue;
            const a=points[i],b=points[i+1],len=Math.hypot(b.x-a.x,b.y-a.y),t=(p:PlanPoint)=>((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/len;
            if(Math.min(len,Math.max(t(span.a),t(span.b)))-Math.max(0,Math.min(t(span.a),t(span.b)))>.01)throw Error(`${s.label}: that perimeter already connects deck levels. Draw stairs on an unoccupied edge.`);
          }
        }
        const n=s.riserCount??Math.ceil(deck.height/7.75);if(n>14)throw Error(`${s.label}: a continuous perimeter stair can have up to 14 risers; a taller run needs an intermediate landing.`);
        const support=getStairSupport(pathData,boardGap(pathData)),startOffset=(pathData.pictureFrameRows||pathData.pattern==='Picture Frame')?finishedFasciaOffset(pathData):0;
        const inner=stairPathOffset(result.segments,startOffset),far=stairPathOffset(result.segments,startOffset+(n-1)*(s.treadDepthIn??support.runIn)+support.treadNosingIn),world=(p:PlanPoint)=>({x:p.x+deck.bounds.x,y:p.y+deck.bounds.y});
        const footprints=result.segments.map((_,i)=>[world(inner[i]),world(inner[i+1]),world(far[i+1]),world(far[i])]);
        if(footprints.some(p=>actualHouses.some(h=>overlap(p,h)>1)||converted.some(d=>overlap(p,d.points)>1)))throw Error(`${s.label}: the generated stairs run into a house or deck. Shorten or relocate the path.`);
        if(footprints.some((p,i)=>footprints.slice(i+1).some(q=>overlap(p,q)>1)))throw Error(`${s.label}: the stair path folds back into itself. Use a shorter perimeter run.`);
        Object.assign(patch,{stairWidth:Math.min(120,result.segments[0].width),stairPosition:result.segments[0].edge});
        summary.push(`${s.label}: ${points.length===2?'straight':'continuous wrapped'} stairs from level ${exit+1}, ${points.length-1} perimeter edge${points.length===2?'':'s'}, ${n} risers. Opening spans, riser count and tread depth stay editable.`);
      }else{
      const r=rectangularSketch(s.points);if(!r||r.deviation*Math.max(sx,sy)*12>6)throw new Error(`${s.label}: draw a rectangular flight or an open line / L along the deck perimeter.`);
      const points=measuredShape(s,sx,sy,x0,nonHouseY0,warnings),bb=boundaryBounds(points),exit=converted.reduce((best,s,i)=>s.height<=converted[best].height?i:best,0),deck=converted[exit],matches=sharedSpans(deck.points,points);
      if(matches.length!==1)throw new Error(`${s.label}: join one end directly to one exposed edge of the lowest deck level.`);
      const match=matches[0],side=edgeFacing(match.edge.outward);if(Math.abs(match.edge.outward.x)>EPS&&Math.abs(match.edge.outward.y)>EPS)throw new Error(`${s.label}: stairs on a diagonal custom edge cannot be identified by the current stair controls. Use a straight side edge.`);
      if(converted.some(d=>overlap(d.points,points)>1)||actualHouses.some(p=>overlap(p,points)>1))throw new Error(`${s.label}: the flight crosses a deck or house. Draw it outside the walking surfaces.`);
      if(s.heightIn!==undefined&&!near(s.heightIn,deck.height))throw new Error(`${s.label}: entered rise ${s.heightIn} inches does not match the lowest deck elevation ${deck.height} inches.`);
      const width=Math.abs(match.edge.outward.y)>.5?bb.w:bb.h,depth=Math.abs(match.edge.outward.y)>.5?bb.h:bb.w;
      inRange(width,36,120,`${s.label} stair width in inches`);if(!near(match.length,width))throw new Error(`${s.label}: the entire stair width must meet the deck edge.`);
      const n=s.riserCount??Math.ceil(deck.height/7.75);if(n>14)throw new Error(`${s.label}: this rise needs an intermediate stair landing, which this straight-flight sketch cannot represent.`);
      Object.assign(patch,{stairRiserCount:s.riserCount,stairTreadDepthIn:s.treadDepthIn});candidate={...current,...patch};
      const support=getStairSupport(candidate,boardGap(candidate)),expected=(n-1)*(s.treadDepthIn??support.runIn)+support.treadNosingIn+((candidate.pictureFrameRows||candidate.pattern==='Picture Frame')?finishedFasciaOffset(candidate):0);
      if(Math.abs(depth-expected)>2)throw new Error(`${s.label}: ${deck.height} inches of rise needs a modeled straight footprint about ${(expected/12).toFixed(2)} ft deep (${n} risers). Change the typed/drawn stair depth; the sketch is ${(depth/12).toFixed(2)} ft.`);
      if(Math.abs(depth-expected)>.01)warnings.push(`${s.label}: drawn depth ${(depth/12).toFixed(2)} ft reconciles to ${(expected/12).toFixed(2)} ft for ${n} modeled risers; rise/run require construction review.`);
      const fp=exit===2?freeFootprint(candidate,3)!:getFootprint(candidate,(exit+1) as 1|2),contact=exit===0?getHouseContact(candidate,fp):undefined,tryData={...candidate,stairFlights:1,stairWidth:width,stairPosition:side,stairOffset:50,stairEdgeId:undefined},placement=getStairPlacement(tryData,fp,contact);
      if(!placement)throw new Error(`${s.label}: this stair would pass through a house wall.`);
      const offset=exit?{x:deck.bounds.x,y:deck.bounds.y}:{x:0,y:0},edge=fp.outline[placement.edgeIndex!],end=fp.outline[(placement.edgeIndex!+1)%fp.outline.length];
      if(!sameLine({x:edge.x+offset.x,y:edge.y+offset.y},{x:end.x+offset.x,y:end.y+offset.y},match.a,match.b))throw new Error(`${s.label}: use the longest exposed ${side.toLowerCase()} edge; this shorter edge cannot be selected by the current controls.`);
      const start=placement.along.x<0||placement.along.y<0?end:((end.x-edge.x<-.5||end.y-edge.y<-.5)?end:edge),len=Math.hypot(end.x-edge.x,end.y-edge.y),lo=Math.min((match.a.x-offset.x-start.x)*placement.along.x+(match.a.y-offset.y-start.y)*placement.along.y,(match.b.x-offset.x-start.x)*placement.along.x+(match.b.y-offset.y-start.y)*placement.along.y),available=len-width;
      Object.assign(patch,{stairFlights:1,stairWidth:width,stairPosition:side,stairOffset:available>EPS?inRange(lo/available*100,0,100,'Stair position'):50});
      if(joins.some((j,i)=>i+1===exit&&opposite(j.side)===side||j.parent===exit&&j.side===side))throw new Error(`${s.label}: that edge already connects deck levels. Move the grade stair to an unoccupied edge.`);
      summary.push(`${s.label}: one straight grade stair from level ${exit+1}, ${(width/12).toFixed(2)} ft wide, ${n} risers at ${(deck.height/n).toFixed(2)} inches; matched to the ${side.toLowerCase()} edge.`);
      }
    }else summary.push('No stair was drawn: existing grade stairs are removed. Add and review a grade access stair if needed.');
    warnings.push('Sketch conversion is a measured draft, not structural approval. Review support, house ledgers, elevations and stair connections before construction.');
    return {ok:true,patch,errors,warnings,summary};
  }catch(error){errors.push(error instanceof Error?error.message:'The sketch could not be interpreted.');return {ok:false,errors,warnings,summary};}
}
