import {yardGradeIn,yardElevationEdit} from '../yardElevations';
import type {DeckData,HouseBlock,YardFeature} from '../types';
import {buildDeckTakeoff} from '../deckTakeoff';
import {boundaryPatch,editableBoundaries} from '../designer/boundaryEditMath';
import {boundaryBounds,boundaryKey,boundaryProblem} from '../lib/freeOutline';
import {getHouseConfig} from '../houseSettings';
import {getHousePlacement} from '../housePlacement';
import {getHouseBlocks,rectPolygon} from '../houseFootprint';
import {getHouseContact} from '../houseContact';
import {finishedFasciaOffset} from '../lib/finishedFootprint';
import {resolveStairPath} from '../lib/stairPath';
import {polygonCut,signedArea} from '../lib/polygonCuts';
import {generateSketchDesign} from './sketchToDesign';
import {parseSketchDocument,type SketchDocument,type SketchShape,type SketchResult,type SketchPoint} from './sketchTypes';
import {rectangularSketch} from './sketchGeometry';
import {snapStairPath} from './sketchStairPath';
import {fitNewPatio,newYardFeature} from '../yardSettings';
import {yardShapeEdit,yardShapeResize,yardShapeWorldPoints,yardShapeLocalPoint,yardShapeWorldPoint,yardShapeRunIn} from '../yardShapeEditing';

const EPS=1e-6;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const fields=(s:SketchShape)=>[s.id,s.kind,s.points,s.widthFt,s.depthFt,s.heightIn,s.drawing,s.riserCount,s.treadDepthIn];
const sameShape=(a:SketchShape,b:SketchShape)=>same(fields(a),fields(b));
const inches=(p:SketchPoint,o:SketchPoint)=>({x:p.x-o.x,y:p.y-o.y});
const plus=(p:SketchPoint,o:SketchPoint)=>({x:p.x+o.x,y:p.y+o.y});
const overlap=(a:SketchPoint[],b:SketchPoint[])=>polygonCut([a],[b]).some(p=>Math.abs(signedArea(p))>1);
const deckId=(level:number)=>`plan-deck-${level}`;
const houseId=(id:string)=>id==='main'?'plan-house-main':`plan-house-block-${id}`;
const yardId=(f:YardFeature,index:number)=>f.id.length<=54?`plan-yard-${f.id}`:`plan-yard-long-${index}`;
const isYard=(s:SketchShape)=>s.kind==='patio'||s.kind==='retaining-wall';
export function planYardFeature(shape:SketchShape,data:DeckData){return data.yardFeatures?.find((f,i)=>yardId(f,i)===shape.id);}
export function planYardMeasurements(shape:SketchShape,data:DeckData){const f=planYardFeature(shape,data),points=f?shape.points.map(p=>yardShapeLocalPoint(f,p)):shape.points,b=boundaryBounds(points);return {widthFt:shape.kind==='retaining-wall'?yardShapeRunIn(points)/12:b.w/12,depthFt:shape.kind==='retaining-wall'?shape.depthFt??f?.depthFt??1:b.h/12};}
/** Scale in the retained feature's own axes; a display translation never changes these measured spans. */
export function resizePlanYardSketch(shape:SketchShape,patch:Partial<SketchShape>,data:DeckData):Partial<SketchShape>{
 const f=planYardFeature(shape,data),points=f?shape.points.map(p=>yardShapeLocalPoint(f,p)):shape.points,b=boundaryBounds(points),old=planYardMeasurements(shape,data),sx=patch.widthFt===undefined?1:patch.widthFt/old.widthFt,sy=shape.kind==='retaining-wall'?sx:patch.depthFt===undefined?1:patch.depthFt/old.depthFt;
 const scaled=points.map(p=>({x:b.x+(p.x-b.x)*sx,y:b.y+(p.y-b.y)*sy}));return {...patch,points:f?scaled.map(p=>yardShapeWorldPoint(f,p)):scaled};
}
const ranged=(n:number,min:number,max:number,label:string)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error(`${label} must be between ${min} and ${max}.`);return n;};

function seed(data:DeckData){
  const model=buildDeckTakeoff(data),boundaries=editableBoundaries(data,model),blocks=getHouseBlocks(data),warnings:string[]=[],shapes:SketchShape[]=[];
  for(const b of boundaries){const l=model.levels.find(l=>l.kind==='deck'&&l.index===b.level-1)!,points=b.points.map(p=>plus(p,b.offset)),bb=boundaryBounds(points);shapes.push({id:deckId(b.level),kind:'deck',label:b.level===1?'Main deck':`Deck level ${b.level}`,points,widthFt:bb.w/12,depthFt:bb.h/12,heightIn:l.top});}
  for(const b of blocks)shapes.push({id:houseId(b.id),kind:'house',label:b.id==='main'?'House':`${b.kind==='garage'?'Garage':'House block'} ${b.id}`,points:rectPolygon(b.rect),widthFt:(b.rect.x1-b.rect.x0)/12,depthFt:(b.rect.y1-b.rect.y0)/12,heightIn:b.wallHeightIn});
  const decks=model.levels.filter(l=>l.kind==='deck'),exit=decks.reduce((a,b)=>b.top<=a.top?b:a),flights=model.flights.filter(f=>f.kind==='grade');
  let path=data.stairPath?.points.map(p=>plus(p,{x:exit.offset.x,y:exit.offset.z}));
  if(!path&&data.stairFlights===1&&data.stairType==='Straight'&&flights.length===1&&flights[0].risers<=14){const f=flights[0],u=f.along!,out=f.outward!,d=(data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0,a={x:f.start.x-out.x*d-u.x*f.width/2,y:f.start.z-out.y*d-u.y*f.width/2};path=[a,{x:a.x+u.x*f.width,y:a.y+u.y*f.width}];}
  if(path)shapes.push({id:'plan-stairs',kind:'stairs',drawing:'edge-path',label:'Stair edge path',points:path,heightIn:exit.top,...(data.stairRiserCount===undefined?{}:{riserCount:data.stairRiserCount}),...(data.stairTreadDepthIn===undefined?{}:{treadDepthIn:data.stairTreadDepthIn})});
  else if(data.stairFlights)warnings.push('Existing landing, winder or multiple stair exits remain in the plan. This sketch does not replace those complex stair layouts; use Stairs settings to edit them.');
  if(data.stairPath&&data.stairFlights===0)warnings.push('The saved stair path is switched off. It remains off unless you edit its sketch.');
  if(data.houseVisible===false)warnings.push('The house is hidden in the regular plan. Its footprint is shown here for measured positioning; visibility stays unchanged.');
  for(const [i,f] of (data.yardFeatures??[]).entries())if(f.kind==='patio'||f.kind==='retaining-wall'){shapes.push({id:yardId(f,i),kind:f.kind,label:f.name,points:yardShapeWorldPoints(f),widthFt:f.widthFt,depthFt:f.depthFt,heightIn:f.heightIn,...(f.kind==='retaining-wall'?{drawing:'edge-path' as const}:{})});if(!f.enabled)warnings.push(`${f.name} is excluded from the estimate. Sketch edits keep it excluded.`);}
  const all=shapes.flatMap(s=>s.points),origin={x:64-Math.min(...all.map(p=>p.x)),y:64-Math.min(...all.map(p=>p.y))};
  return {document:{version:1 as const,shapes:shapes.map(s=>({...s,points:s.points.map(p=>plus(p,origin))}))},warnings,origin,model,boundaries,blocks};
}

/** One sketch coordinate is one world inch. Only a shared display translation separates the two views. */
export function planSketchOf(data:DeckData):{document:SketchDocument;warnings:string[]}{try{const {document,warnings}=seed(data);return {document,warnings};}catch{return {document:{version:1,shapes:[]},warnings:['The current plan could not be measured safely. Return to the regular plan to review its geometry before sketching.']};}}

function measured(s:SketchShape,old:SketchShape|undefined,origin:SketchPoint):SketchPoint[]{
  const points=s.points.map(p=>inches(p,origin)),bb=boundaryBounds(points);
  const ratio=(n:number)=>Math.abs(n-1)<EPS?1:n;
  const sx=old&&s.widthFt!==old.widthFt&&s.widthFt!==undefined?ratio(s.widthFt*12/bb.w):1,sy=old&&s.depthFt!==old.depthFt&&s.depthFt!==undefined?ratio(s.depthFt*12/bb.h):1;
  return points.map(p=>({x:bb.x+(p.x-bb.x)*sx,y:bb.y+(p.y-bb.y)*sy}));
}
function rectangle(points:SketchPoint[],label:string){const r=rectangularSketch(points,.00001);if(!r||r.deviation>.01)throw Error(`${label}: keep an axis-aligned rectangular house footprint; a custom polygon cannot replace its walls.`);return boundaryBounds(r.points);}

/** Scoped edits of an existing measured design. Labels are view text; untouched configuration never gets regenerated. */
export function generatePlanSketchDesign(document:SketchDocument,current:DeckData,baseline:SketchDocument):SketchResult{
  const warnings:string[]=[],summary:string[]=[],errors:string[]=[];
  try{
    // The parser validates all descriptors and values. Existing plan points deliberately bypass its hand-stroke smoothing.
    parseSketchDocument(baseline);const parsed=parseSketchDocument(document),fresh=seed(current);if(!baseline.shapes.length)throw Error('No measured current plan is available. Return to the regular plan before applying this sketch.');
    const stamp=(d:SketchDocument)=>d.shapes.map(fields).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    if(!same(stamp(baseline),stamp(fresh.document)))throw Error('The regular plan changed while this sketch was open. Return to Current plan before applying this draft.');
    if(same(stamp(document),stamp(baseline)))return {ok:true,patch:{},errors,warnings,summary:['Sketch and regular plan already match. All design details and pricing are unchanged.']};
    const oldById=new Map(baseline.shapes.map(s=>[s.id,s])),byId=new Map(document.shapes.map(s=>[s.id,s])),patch:Partial<DeckData>={};
    const changed=(s:SketchShape)=>!oldById.has(s.id)||!sameShape(s,oldById.get(s.id)!);
    for(const s of document.shapes)if(oldById.has(s.id)&&s.kind!==oldById.get(s.id)!.kind)throw Error(`${s.label}: an existing plan part cannot change kind. Draw a new labelled part instead.`);
    if(!byId.has(deckId(1)))throw Error('Keep the current main deck. Use New sketch to replace the complete project intentionally.');
    if(!byId.has(houseId('main')))throw Error('Keep the current house footprint. Hide it in House settings if you do not want it displayed.');
    const candidate=()=>({...current,...patch});
    const merge=(p:Partial<DeckData>)=>{Object.assign(patch,p);};
    const deckDocument={...document,shapes:document.shapes.filter(s=>!isYard(s))};

    // Trailing levels can be removed explicitly. A missing parent cannot silently reparent a surviving level.
    const removed=fresh.boundaries.filter(b=>!byId.has(deckId(b.level))).map(b=>b.level);
    if(removed.length){const remain=fresh.boundaries.filter(b=>!removed.includes(b.level));if(remain.some(b=>b.level>Math.min(...removed)))throw Error('Remove the highest deck level first; this sketch cannot silently reparent another level.');const outlines={...current.deckOutlines},positions={...current.deckOutlineOffsets};for(const level of removed){delete outlines[boundaryKey(level)];if(level>1)delete positions[boundaryKey(level) as 'second'|'third'];}merge({levels:remain.length,deckOutlines:outlines,deckOutlineOffsets:positions,level3:undefined});warnings.push('Removed levels no longer render. Saved board, railing and screen selections are retained; review any selection tied to those levels.');}
    for(const b of fresh.boundaries){const s=byId.get(deckId(b.level));if(!s||!changed(s))continue;const old=oldById.get(s.id)!,oldWorld=b.points.map(p=>plus(p,b.offset)),points=measured(s,old,fresh.origin).map((p,i)=>({x:oldWorld[i]&&Math.abs(p.x-oldWorld[i].x)<EPS?oldWorld[i].x:p.x,y:oldWorld[i]&&Math.abs(p.y-oldWorld[i].y)<EPS?oldWorld[i].y:p.y})),bb=boundaryBounds(points),height=s.heightIn??old.heightIn!;
      ranged(height,8,144,`${s.label} elevation`);const geometryChanged=!same(points,oldWorld);
      if(geometryChanged){const translation=points.length===oldWorld.length&&points.every((p,i)=>Math.abs(p.x-oldWorld[i].x-points[0].x+oldWorld[0].x)<EPS&&Math.abs(p.y-oldWorld[i].y-points[0].y+oldWorld[0].y)<EPS),move={x:points[0].x-oldWorld[0].x,y:points[0].y-oldWorld[0].y};
        const offset=b.level>1&&translation?plus(b.offset,move):b.offset,local=b.level===1?points:points.map(p=>inches(p,offset));
        const p=boundaryPatch(candidate(),b.level,local,b.level>1?offset:undefined,fresh.model);if(!p)throw Error(`${s.label}: this outline crosses, exceeds its limits or moves a locked edge. Keep the measured constraints or unlock that edge first.`);merge(p);
        summary.push(`${s.label}: ${points.length} editable points, ${bb.w/12} × ${bb.h/12} ft; existing finishes and object selections retained.`);
      }
      if(height!==old.heightIn){if(b.level===1){merge({height});if(!current.houseConfig&&!patch.houseConfig)merge({houseConfig:structuredClone(getHouseConfig(current))});}else if(b.level===2)merge({height2:height});else merge({level3:{...candidate().level3!,heightIn:height}});summary.push(`${s.label}: elevation ${height} in.`);}
    }

    // House edits retain measured openings, appearance and block identifiers instead of replacing the house.
    const mainHouse=byId.get(houseId('main'))!,oldHouse=oldById.get(mainHouse.id)!,houseChanged=changed(mainHouse);
    let house=structuredClone(getHouseConfig(candidate()));
    if(houseChanged){let p=measured(mainHouse,oldHouse,fresh.origin),bb=rectangle(p,mainHouse.label);if(mainHouse.depthFt!==oldHouse.depthFt&&mainHouse.depthFt!==undefined&&same(mainHouse.points,oldHouse.points)){bb={...bb,y:-mainHouse.depthFt*12,h:mainHouse.depthFt*12};}
      if(Math.abs(bb.y+bb.h)>.01)throw Error('The main house front stays on the deck-facing wall at world zero. Change its depth or move it along that wall.');
      house={...house,widthFt:ranged(bb.w/12,12,100,'House width'),depthFt:ranged(bb.h/12,12,100,'House depth'),...(mainHouse.heightIn!==undefined&&mainHouse.heightIn!==oldHouse.heightIn?{storeyHeightIn:ranged(mainHouse.heightIn/house.storeys,96,300,'House storey height')}:{})};
      merge({houseConfig:house,housePlacement:{anchor:'left',offsetIn:ranged(bb.x,-2400,2400,'House position')}});summary.push('House dimensions updated; measured doors, windows, finishes and block identities retained.');
    }
    const blocks=house.footprint?.rects??[],kept:HouseBlock[]=[];
    for(const block of blocks){const s=byId.get(houseId(block.id));if(!s){if(house.openings.some(o=>o.wallId?.startsWith(`${block.id}-`)))throw Error(`Move or remove the openings on house block ${block.id} before removing that block.`);warnings.push(`House block ${block.id} removed; its wall-specific finishes no longer render.`);continue;}
      if(!changed(s)){kept.push(block);continue;}const bb=rectangle(measured(s,oldById.get(s.id),fresh.origin),s.label),hp=getHousePlacement(candidate()),side=block.wall,horizontal=side==='Front'||side==='Back';
      const matches=side==='Front'?Math.abs(bb.y)<.01:side==='Back'?Math.abs(bb.y+bb.h+hp.depthIn)<.01:side==='Left'?Math.abs(bb.x+bb.w-hp.x0)<.01:Math.abs(bb.x-hp.x1)<.01;
      if(!matches)throw Error(`${s.label}: keep this block joined to its existing house wall.`);
      const height=s.heightIn??oldById.get(s.id)!.heightIn!,storeys=height/house.storeyHeightIn;if(![1,2,3].some(n=>Math.abs(n-storeys)<EPS))throw Error(`${s.label}: use one, two or three complete storeys.`);
      kept.push({...block,widthFt:ranged((horizontal?bb.w:bb.h)/12,2,100,'House block wall width'),depthFt:ranged((horizontal?bb.h:bb.w)/12,1,60,'House block projection'),offsetFt:ranged(horizontal?(bb.x-hp.x0)/12:-(bb.y+bb.h)/12,-100,100,'House block offset'),storeys:Math.round(storeys) as 1|2|3});
    }
    if(!same(kept,blocks)){house={...house,footprint:kept.length?{rects:kept}:undefined};merge({houseConfig:house});}

    const additions=parsed.shapes.filter(s=>!oldById.has(s.id));
    if(additions.some(s=>s.kind==='house'))throw Error('Add attached house blocks in House settings, then reopen Current plan. Existing blocks stay editable here.');
    const newSurfaces=additions.filter(s=>s.kind==='deck'||s.kind==='landing');
    if(newSurfaces.length){if(candidate().levels+newSurfaces.length>3)throw Error('This plan supports up to three editable deck levels.');const result=generateSketchDesign(deckDocument,candidate());if(!result.ok)throw Error(`New level: ${result.errors.join(' ')}`);const generated=result.patch!,start=candidate().levels+1,mainBounds=boundaryBounds(fresh.boundaries[0].points);
      for(let level=start;level<=generated.levels!;level++){const key=boundaryKey(level as 2|3),position=generated.deckOutlineOffsets?.[key as 'second'|'third'];merge({deckOutlines:{...candidate().deckOutlines,[key]:generated.deckOutlines![key]},deckOutlineOffsets:{...candidate().deckOutlineOffsets,[key]:position?{x:position.x+mainBounds.x/12,y:position.y}:position}});if(level===2)merge({width2:generated.width2,length2:generated.length2,height2:generated.height2,level2Position:generated.level2Position,level2Offset:generated.level2Offset,level2FullStep:generated.level2FullStep,level2EdgeId:generated.level2EdgeId});else merge({level3:generated.level3});}
      merge({levels:generated.levels});summary.push('New supported deck level added; existing object selections and level connections retained.');
    }

    const oldStairs=baseline.shapes.find(s=>s.kind==='stairs'),stairs=document.shapes.filter(s=>s.kind==='stairs');if(stairs.length>1)throw Error('Use one connected stair edge path for the current plan.');
    if(oldStairs&&!stairs.length){merge({stairFlights:0,stairPath:undefined});summary.push('Grade stairs removed; connecting steps between deck levels retained.');}
    if(stairs[0]&&(!oldStairs||changed(stairs[0]))){const s=stairs[0];if(s.drawing!=='edge-path'){const result=generateSketchDesign(deckDocument,candidate());if(!result.ok)throw Error(`Stairs: ${result.errors.join(' ')}`);const p=result.patch!;for(const key of ['stairFlights','stairWidth','stairType','stairPosition','stairOffset','stairEdgeId','stairPath','stairRiserCount','stairTreadDepthIn'] as const)(patch as Record<string,unknown>)[key]=p[key];}
      else{const model=buildDeckTakeoff(candidate()),decks=model.levels.filter(l=>l.kind==='deck'),exit=decks.reduce((a,b)=>b.top<=a.top?b:a),offset={x:exit.offset.x,y:exit.offset.z},world=s.points.map(p=>inches(p,fresh.origin)),local=snapStairPath(world.map(p=>inches(p,offset)),exit.footprint.outline),next={...candidate(),stairPath:{points:local},stairFlights:local.length-1,stairType:'Straight' as const,stairRiserCount:s.riserCount,stairTreadDepthIn:s.treadDepthIn};
        if(s.heightIn!==undefined&&Math.abs(s.heightIn-exit.top)>.01)throw Error(`Stair rise must match the lowest deck elevation (${exit.top} in).`);const resolved=resolveStairPath(next,exit.footprint,exit.index===0?getHouseContact(next,exit.footprint):undefined);if(resolved.issues.length)throw Error(resolved.issues.join(' '));const built=buildDeckTakeoff(next);if(!built.flights.some(f=>f.kind==='grade'))throw Error(built.issues.filter(s=>/stair/i.test(s)).join(' ')||'This stair path needs a buildable exposed edge and reviewed rise.');
        merge({stairPath:next.stairPath,stairFlights:next.stairFlights,stairType:'Straight',stairRiserCount:s.riserCount,stairTreadDepthIn:s.treadDepthIn,stairWidth:Math.min(120,resolved.segments[0].width),stairPosition:resolved.segments[0].edge,stairEdgeId:undefined});if(!same(local,world.map(p=>inches(p,offset))))warnings.push('Stair path points snapped to the measured deck perimeter.');
      }
      summary.push('Only the selected stair layout changed; riser count, tread depth and edge spans remain editable.');
    }

    // Yard shapes share world inches but retain their own product, physical thickness and rotation.
    const yard:YardFeature[]=[];
    const changeYard=(s:SketchShape,f:YardFeature,old?:SketchShape)=>{
      const world=s.points.map(p=>inches(p,fresh.origin));let next=yardShapeEdit(f,world);
      const width=s.widthFt===undefined||old&&s.widthFt===old.widthFt?next.widthFt:s.widthFt,depth=s.depthFt===undefined||old&&s.depthFt===old.depthFt?next.depthFt:s.depthFt;
      if(Math.abs(width-next.widthFt)>EPS||Math.abs(depth-next.depthFt)>EPS)next=yardShapeResize(next,width,depth);
      if(s.heightIn!==undefined&&s.heightIn!==old?.heightIn)next=yardElevationEdit(next,'heightIn',ranged(s.heightIn,s.kind==='patio'?-24:6,s.kind==='patio'?48:72,`${s.label} height`));
      return next;
    };
    for(const [i,f] of (current.yardFeatures??[]).entries()){
      if(f.kind!=='patio'&&f.kind!=='retaining-wall'){yard.push(f);continue;}
      const id=yardId(f,i),s=byId.get(id);if(!s){summary.push(`${f.name} removed from the yard.`);continue;}const old=oldById.get(id)!;yard.push(changed(s)?changeYard(s,f,old):f);
    }
    for(const s of document.shapes.filter(s=>isYard(s)&&!oldById.has(s.id))){const id=`yard-${s.id}`;if(yard.some(f=>f.id===id))throw Error('Give the new yard shape a unique sketch ID.');const f={...newYardFeature(s.kind as 'patio'|'retaining-wall',{...candidate(),siteModel:undefined}),id,name:s.label};const added=changeYard(s,f),grade=yardGradeIn(candidate(),added);if(!Number.isFinite(grade))throw Error('Survey the new feature centre before setting its finished level.');yard.push(fitNewPatio(candidate(),{...added,finishedElevationIn:grade+added.heightIn}));summary.push(`${s.label}: new editable ${s.kind==='patio'?'patio outline':'open wall path'}; selected product remains available in Backyard settings.`);}
    if(yard.length>20)throw Error('This design supports up to 20 yard features.');if(!same(yard,current.yardFeatures??[]))merge({yardFeatures:yard});

    const next=candidate(),model=buildDeckTakeoff(next),houses=getHouseBlocks(next);
    for(const b of fresh.boundaries){const s=byId.get(deckId(b.level));if(!s||!changed(s))continue;const actual=editableBoundaries(next,model).find(q=>q.level===b.level);if(!actual)throw Error(`${s.label}: the edited level could not be represented.`);const points=actual.points.map(p=>plus(p,actual.offset));if(boundaryProblem(actual.points))throw Error(`${s.label}: invalid measured perimeter.`);if(houses.some(h=>overlap(points,rectPolygon(h.rect)))){const original=fresh.boundaries.find(q=>q.level===b.level)!;if(!fresh.blocks.some(h=>overlap(original.points.map(p=>plus(p,original.offset)),rectPolygon(h.rect))))throw Error(`${s.label}: the edited outline overlaps the house footprint.`);}}
    // Required normalization must not move an explicitly edited house block to a different position.
    for(const block of houses.slice(1)){const s=byId.get(houseId(block.id));if(s&&changed(s)){const wanted=rectangle(measured(s,oldById.get(s.id),fresh.origin),s.label),actual=boundaryBounds(rectPolygon(block.rect));if((['x','y','w','h'] as const).some(k=>Math.abs(wanted[k]-actual[k])>EPS))throw Error(`${s.label}: support rules would reposition this block. Reduce its projection or adjust the joining wall.`);}}
    warnings.push(...model.issues.filter(s=>!fresh.model.issues.includes(s)));if(model.flights.length===0&&next.stairFlights)warnings.push('The existing stair layout is retained but no longer fits this geometry. Its supply and installation remain an outstanding quote until reconnected.');
    for(const key of Object.keys(patch) as (keyof DeckData)[])if(same(patch[key],current[key]))delete patch[key];
    if(!Object.keys(patch).length)summary.push('Only sketch labels changed. The regular plan remains unchanged.');
    return {ok:true,patch,errors,warnings:[...new Set(warnings)],summary};
  }catch(error){errors.push(error instanceof Error?error.message:'This sketch edit could not be represented without losing current plan details.');return {ok:false,errors,warnings,summary};}
}
