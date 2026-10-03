import type {DeckData} from '../types';
import type {EstimateResult} from '../calculations';
import type {AgentCommand} from './deckAgentController';
import {assertUnlockedChanges,loadEditorOrganizationRuntime} from '../editorOrganization';
import {emptyBoardLayout,editSelectedBoard,selectableBoards} from './boardLayoutActions';
import {calculateDeckReleaseEstimate} from '../deckRelease';
import {DEFAULT_DECK} from '../defaults';
import {boundaryKey,resizeBoundaryPatch} from '../lib/freeOutline';
import {boundaryPatch,editableBoundaries,moveBoundary,insertBoundaryPoint,removeBoundaryPoint,boundaryProblem} from './boundaryEditMath';
import {setBoundaryDimension} from './boundaryDimensions';
import {applyComponentEdit,applyComponentBatch} from './componentEditActions';
import {editBoardBatch} from './boardBatchActions';
import {applyEdgeSectionEdit} from './edgeSectionActions';
import {yardShapePull,yardShapeInsert,yardShapeRemove,yardShapeEdit,yardShapeDimension} from '../yardShapeEditing';
import {createInlayPreset} from '../lib/inlayPresets';
import {contrastColour} from '../boardFinishes';
import {yardElevationEdit} from '../yardElevations';
import {normalizePavingAngle} from '../patioInlays';
import {ensureLiveDesignExtensions} from '../designExtensions';
export interface AgentPlannedDesign {data:DeckData;estimate:EstimateResult;interpretation?:{warnings:string[];summary:string[]}}
export interface AgentEditServices {
 fail:(message:string,code?:string)=>never;
 clone:<T>(value:T)=>T;
 canonical:(value:unknown)=>string;
 parseStrict:(candidate:DeckData,explicit:Record<string,unknown>)=>DeckData;
 stabilize:(data:DeckData)=>{data:DeckData;estimate:EstimateResult};
 designSchema:Readonly<Record<string,unknown>>;
 privateFields:readonly (keyof DeckData)[];
}
/** Loaded only by preview/execute. Shared controller guards are injected so
 * this mutation runtime has no eager runtime import back to its host. */
export async function planDesign(initial:DeckData,commands:AgentCommand[],services:AgentEditServices):Promise<AgentPlannedDesign> {
  const {fail,clone,canonical,stabilize,designSchema,privateFields}=services;
  const parseStrict=async(candidate:DeckData,explicit:Record<string,unknown>)=>{await ensureLiveDesignExtensions(candidate);return services.parseStrict(candidate,explicit);};
  await ensureLiveDesignExtensions(initial);
  if(commands.length!==1&&commands.some(c=>c.type==='layout.deleteBoard'))fail('Delete one board per request, then read the new revision before another edit. Inventory indices cannot be reused after a deletion.');
  let data=clone(initial);
  let interpretation:{warnings:string[];summary:string[]}|undefined;
  const requireLayoutLevel=(level:number)=>{if(!calculateDeckReleaseEstimate(data).model.levels.some(l=>l.kind==='deck'&&(l.index??0)+1===level))fail('That deck level is not present. Restore or add it before editing its board layout.');};
  for(const c of commands){
    await ensureLiveDesignExtensions(data);
    if(c.type==='landscape.edit'){const {applyLandscapeEdit}=await import('../landscapeEdits');data=await parseStrict({...data,...applyLandscapeEdit(data,c.id,c.edit)},{});
    }else if(c.type.startsWith('pool.')){const {applyPoolCommand}=await import('../poolEdits');data=await parseStrict({...data,...applyPoolCommand(data,c as Extract<AgentCommand,{type:`pool.${string}`}>)},{});
    }else if(c.type.startsWith('site.')){const {applySiteOperation}=await import('../siteOperationRuntime');data=await parseStrict({...data,...applySiteOperation(data,c as Extract<AgentCommand,{type:`site.${string}`}>)},{});
    }else if(c.type==='yard.stepAssembly'||c.type==='yard.stepConvert'||c.type==='yard.stepRow'){
      const f=data.yardFeatures?.find(f=>f.id===c.id);if(!f)fail('Choose a current step feature.');const runtime=await import('../stepAssemblyRegistry');await runtime.loadStepAssemblyRuntime();let next=f!;
      if(c.type==='yard.stepConvert')next=runtime.convertStoneSteps(f!);
      else if(c.type==='yard.stepAssembly')next=runtime.stepAssemblyPatch(f!,clone(c.assembly));
      else{if(!f!.stepAssembly)fail('Convert the legacy flight before editing an advanced row.');const a=clone(f!.stepAssembly!);const flight=a.flights.find(p=>p.id===c.flightId);if(!flight||!Number.isInteger(c.row)||c.row<0||c.row>=flight.rows)fail('Choose a present flight row.');const old=flight!.rowOverrides.find(o=>o.row===c.row);flight!.rowOverrides=flight!.rowOverrides.filter(o=>o.row!==c.row);flight!.rowOverrides.push({...old,...clone(c.edit),row:c.row});next=runtime.stepAssemblyPatch(f!,a);}
      data=await parseStrict({...data,yardFeatures:data.yardFeatures!.map(feature=>feature.id===c.id?next:feature)},{});
    }else if(c.type==='yard.stoneSupport'){
      const f=data.yardFeatures?.find(f=>f.id===c.id);if(!f?.stoneSteps)fail('Choose a current stone-stair flight.');
      const stoneSteps={...f!.stoneSteps!};if(c.support===null)delete stoneSteps.support;else stoneSteps.support=clone(c.support);
      data=await parseStrict({...data,yardFeatures:data.yardFeatures!.map(feature=>feature.id===c.id?{...feature,stoneSteps}:feature)},{});
    }else if(c.type==='yard.finished'){const f=data.yardFeatures?.find(f=>f.id===c.id);if(!f)fail('Choose a current patio or wall.');const {editYardFinished}=await import('../yardFinishedEdits');const next=editYardFinished(data,f!,c.edit);data=await parseStrict({...data,yardFeatures:data.yardFeatures!.map(f=>f.id===c.id?next:f)},{});
    }else if(c.type==='stair.refit'){const {previewStairRefit}=await import('../stairRefit');const preview=previewStairRefit(data,c);if(preview.status!=='ready')fail(preview.warnings.join(' ')||'Stair fit is pending measured landing coverage.');data=await parseStrict({...data,...preview.patch},{});interpretation={summary:preview.summary,warnings:preview.warnings};
    }else if(c.type==='objects.edit'){if(['lock','layer','group'].includes(c.edit.action))await loadEditorOrganizationRuntime();const {editObjects}=await import('../professionalEdits');data=await parseStrict({...data,...editObjects(data,c.ids,c.edit)},{});
    }else if(c.type==='yard.radius'||c.type==='yard.offset'){const {setYardRadius,offsetYardFeature}=await import('../professionalEdits'),f=data.yardFeatures?.find(f=>f.id===c.id);if(!f)fail('Choose a current patio or wall.');const next=c.type==='yard.radius'?setYardRadius(f!,c.index,c.radiusIn,c.side):offsetYardFeature(f!,c.distanceIn);data=await parseStrict({...data,yardFeatures:data.yardFeatures!.map(f=>f.id===c.id?next:f)},{});
    }else if(c.type.startsWith('inlay.')){
      const edit=c as Extract<AgentCommand,{type:'inlay.preset'|'inlay.place'|'inlay.move'|'inlay.rotate'|'inlay.remove'}>;
      const actions=await import('./inlayActions');
      const model=calculateDeckReleaseEstimate(data).model;
      let patch:Partial<DeckData>;
      if(edit.type==='inlay.preset'||edit.type==='inlay.place'){
        if(![1,2,3].includes(edit.level))fail('Choose a current deck level for this inlay.');
        const inlay=edit.type==='inlay.preset'?createInlayPreset(edit.presetId,edit.id,contrastColour(data)):edit.inlay;
        patch=actions.placeInlayPatch(data,model,inlay,edit.level,edit.point);
      }else if(edit.type==='inlay.move')patch=actions.moveInlayPatch(data,model,edit.id,edit.dxIn,edit.dyIn);
      else if(edit.type==='inlay.rotate')patch=actions.rotateInlayPatch(data,model,edit.id,edit.rotationDeg);
      else patch=actions.removeInlayPatch(data,edit.id);
      data=await parseStrict({...data,...patch},JSON.parse(JSON.stringify(patch)));
    }else if(c.type.startsWith('yard.inlay.')){
      const edit=c as Extract<AgentCommand,{type:'yard.inlay.place'|'yard.inlay.move'|'yard.inlay.rotate'|'yard.inlay.remove'}>,features=data.yardFeatures??[],feature=features.find(f=>f.id===edit.id);if(!feature||feature.kind!=='patio')fail('Choose a current patio.');
      let inlays=feature!.inlays??[];
      if(edit.type==='yard.inlay.place'){if(inlays.some(i=>i.id===edit.inlay.id))fail('That patio inlay id already exists.');inlays=[...inlays,{...edit.inlay}];}
      else {if(!inlays.some(i=>i.id===edit.inlayId))fail('That patio inlay is not present.');
        if(edit.type==='yard.inlay.remove')inlays=inlays.filter(i=>i.id!==edit.inlayId);
        else if(edit.type==='yard.inlay.move'){if(![edit.dxIn,edit.dyIn].every(Number.isFinite))fail('Enter finite local inch offsets.');inlays=inlays.map(i=>i.id===edit.inlayId?{...i,xIn:i.xIn+edit.dxIn,yIn:i.yIn+edit.dyIn}:i);}
        else {if(!Number.isFinite(edit.rotationDeg)||edit.rotationDeg<0||edit.rotationDeg>360)fail('Enter a rotation between 0 and 360 degrees.');inlays=inlays.map(i=>i.id===edit.inlayId?{...i,rotationDeg:normalizePavingAngle(edit.rotationDeg)}:i);}
      }
      data=await parseStrict({...data,yardFeatures:features.map(f=>f.id===edit.id?{...f,inlays}:f)},{});
    }else if(c.type.startsWith('yard.')){
      const edit=c as Extract<AgentCommand,{type:'yard.move'|'yard.add'|'yard.remove'|'yard.set'|'yard.dimension'|'yard.elevation'|'yard.delete'|'yard.preset'|'yard.curve'}>,features=data.yardFeatures??[],feature=features.find(f=>f.id===edit.id);if(!feature)fail('That yard feature is not present. Read the current design.');
      if(edit.type==='yard.delete'){data=await parseStrict({...data,yardFeatures:features.filter(f=>f.id!==edit.id)},{});continue;}
      if(feature!.kind==='water-feature')fail('Direct shape editing supports patios and retaining walls.');
      let next=feature!;
      if(edit.type==='yard.move'){if(!['point','edge','area'].includes(edit.target)||edit.target!=='area'&&!Number.isInteger(edit.index))fail('Choose a current yard point, edge or whole area.');next=yardShapePull(feature!,edit.target,edit.index??0,edit.dxIn,edit.dyIn);}
      else if(edit.type==='yard.add')next=yardShapeInsert(feature!,edit.index);
      else if(edit.type==='yard.remove')next=yardShapeRemove(feature!,edit.index);
      else if(edit.type==='yard.set')next=yardShapeEdit(feature!,edit.points);
      else if(edit.type==='yard.dimension')next=yardShapeDimension(feature!,edit.index,edit.lengthIn,edit.angleDeg);
      else if(edit.type==='yard.elevation')next=yardElevationEdit(feature!,edit.field,edit.valueIn);
      else if(edit.type==='yard.preset')next=(await import('../yardDesignTools')).applyYardStarter(feature!,edit.presetId);
      else if(edit.type==='yard.curve'){if(!Number.isFinite(edit.bulgeIn)||Math.abs(edit.bulgeIn)>960)fail('Enter a curve depth between -960 and 960 inches.');next=(await import('../yardDesignTools')).curveYardEdge(feature!,edit.index,edit.bulgeIn);}
      data=await parseStrict({...data,yardFeatures:features.map(f=>f.id===edit.id?next:f)},{});
    }else if(c.type==='edge.edit'){
      const result=applyEdgeSectionEdit(data,calculateDeckReleaseEstimate(data).model,c.edit);
      if('patch'in result)data=await parseStrict({...data,...result.patch},JSON.parse(JSON.stringify(result.patch)));
      else fail(result.error);
    }else if(c.type==='sketch.generate'){
      const {parseSketchDocument,generateSketchDesign}=await import('../sketch/sketchToDesign');
      const generated=generateSketchDesign(parseSketchDocument(c.document),data);
      if(!generated.ok||!generated.patch)fail(generated.errors.join(' ')||'The sketch could not be converted.','invalid_sketch');
      // The shared converter explicitly clears obsolete geometry-bound choices. Undefined clear values belong
      // to the generated candidate, but aren't user-supplied JSON fields to the strict release parser.
      data=await parseStrict({...data,...generated.patch},JSON.parse(JSON.stringify(generated.patch)));
      interpretation={warnings:[...(interpretation?.warnings??[]),...generated.warnings],summary:[...(interpretation?.summary??[]),...generated.summary]};
    }else if(c.type==='component.batch'){
      if(!Array.isArray(c.ids)||!c.ids.length||c.ids.length>64||c.ids.some(id=>typeof id!=='string'))fail('Select 1–64 current component IDs.');
      if(!c.edit||typeof c.edit!=='object'||!['update','duplicate','remove','move','distribute','screen-lights'].includes(c.edit.action))fail('Choose a supported batch part edit.');
      const allowed=c.edit.action==='update'?['action','fields']:c.edit.action==='move'?['action','offsetDeltaPct']:c.edit.action==='screen-lights'?['action','enabled']:['action'];
      if(Object.keys(c.edit).some(key=>!allowed.includes(key)))fail('Unexpected fields for this batch operation.');
      const result=applyComponentBatch(data,calculateDeckReleaseEstimate(data).model,c.ids,c.edit);
      if('error' in result)fail(result.error);
      if('patch' in result)data=await parseStrict({...data,...result.patch},Object.fromEntries(Object.entries(result.patch).filter(([,v])=>v!==undefined)));
    }else if(c.type==='component.edit'){
      if(typeof c.id!=='string'||!c.edit||typeof c.edit!=='object'||!['update','add-opening','duplicate','remove'].includes(c.edit.action))fail('Supply a current part id and supported component operation.');
      const allowed=c.edit.action==='update'?['action','fields']:c.edit.action==='add-opening'?['action','presetKey','wallId']:['action'];
      if(Object.keys(c.edit).some(key=>!allowed.includes(key)))fail('Unexpected fields for this component operation.');
      const result=applyComponentEdit(data,calculateDeckReleaseEstimate(data).model,c.id,c.edit);
      if('error' in result)fail(result.error);
      if('patch' in result)data=await parseStrict({...data,...result.patch},Object.fromEntries(Object.entries(result.patch).filter(([,v])=>v!==undefined)));
    }else if(c.type==='design.patch'){
      if(!c.patch||Array.isArray(c.patch))fail('patch must be an object.');
      const resized=resizeBoundaryPatch(data,c.patch),candidate={...data,...resized};
      const lockBase={...data,...(c.unset?.includes('boundaryLocks')||Object.hasOwn(c.patch,'boundaryLocks')?{boundaryLocks:undefined}: {})};
      // Generic dimension/outline patches keep the same neighboring origins and measured house as a point drag.
      // An explicit house or origin choice still wins; explicit dimensions are checked against the final boundary.
      if(resized.deckOutlines){
        const model=calculateDeckReleaseEstimate(data).model;
        for(const level of [1,2,3] as const){const key=boundaryKey(level),points=resized.deckOutlines[key];if(!points||canonical(points)===canonical(data.deckOutlines?.[key]))continue;
          const existing=editableBoundaries(data,model).find(b=>b.level===level);if(!existing)fail('That deck level is not present. Add the level before editing its boundary.');
          const preserved=boundaryPatch(lockBase,level,points.map(p=>({x:p.x*12,y:p.y*12})),existing.offset,model);if(!preserved)fail('Invalid deck boundary or measured edge lock. Unlock the edge before changing its length or direction.');
          for(const field of ['houseConfig','housePlacement','deckOutlineOffsets','boardLayout','boundaryLocks'] as const)if(!Object.hasOwn(c.patch,field)&&(preserved[field]!==undefined||field==='boundaryLocks'))(candidate as unknown as Record<string,unknown>)[field]=preserved[field];
          Object.assign(lockBase,{deckOutlines:preserved.deckOutlines,boundaryLocks:preserved.boundaryLocks});
          if(level===1){if(!Object.hasOwn(c.patch,'wrap'))delete candidate.wrap;if(!Object.hasOwn(c.patch,'cornerChamfers'))delete candidate.cornerChamfers;}
        }
      }
      for(const key of c.unset??[]){if(typeof key!=='string'||!Object.hasOwn(designSchema,key)||Object.hasOwn(DEFAULT_DECK,key)||Object.hasOwn(c.patch,key))fail('unset must name an optional editable field absent from patch.');delete (candidate as unknown as Record<string,unknown>)[key];}
      data=await parseStrict(candidate,c.patch as Record<string,unknown>);
    }else if(c.type==='design.replace'){
      const candidate={...c.design} as DeckData;for(const key of privateFields)if(Object.hasOwn(data,key))(candidate as unknown as Record<string,unknown>)[key]=data[key];
      data=await parseStrict(candidate,c.design as unknown as Record<string,unknown>);
    }else if(c.type.startsWith('layout.')){
      const layout=data.boardLayout??emptyBoardLayout();let patch:Partial<DeckData>;
      if(c.type==='layout.region'){const next=c.region;if(!next||typeof next!=='object')fail('Supply a layout region.');requireLayoutLevel(next.level);patch={boardLayout:{...layout,regions:layout.regions.some(r=>r.id===next.id)?layout.regions.map(r=>r.id===next.id?next:r):[...layout.regions,next]}};}
      else if(c.type==='layout.breaker'){const next=c.breaker;if(!next||typeof next!=='object')fail('Supply a layout breaker.');requireLayoutLevel(next.level);patch={boardLayout:{...layout,breakers:layout.breakers.some(b=>b.id===next.id)?layout.breakers.map(b=>b.id===next.id?next:b):[...layout.breakers,next]}};}
      else if(c.type==='layout.remove'){if(typeof c.id!=='string'||![...layout.regions,...layout.breakers,...layout.pieces].some(p=>p.id===c.id))fail('That layout id is not present.');patch={boardLayout:{regions:layout.regions.filter(r=>r.id!==c.id),breakers:layout.breakers.filter(b=>b.id!==c.id),pieces:layout.pieces.filter(p=>p.id!==c.id)}};}
      else if(c.type==='layout.deleteBoard'){
        if(!Number.isSafeInteger(c.modelLevel)||c.modelLevel<0||!Number.isSafeInteger(c.index)||c.index<0||typeof c.replacementId!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(c.replacementId))fail('Use a current board modelLevel/index and a stable replacementId.');
        const {deleteSelectedBoards}=await import('./boardRemovalActions');let sequence=0;
        patch=deleteSelectedBoards(data,calculateDeckReleaseEstimate(data).model,[{level:c.modelLevel,index:c.index}],()=>`${c.replacementId}-${++sequence}`).patch;
      }
      else if(c.type==='layout.board'){
        if(!Number.isInteger(c.modelLevel)||!Number.isInteger(c.index)||typeof c.pieceId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(c.pieceId))fail('Use current board modelLevel/index and a stable pieceId (letters, digits, _ or -).');
        const model=calculateDeckReleaseEstimate(data).model,board=selectableBoards(data,model).find(b=>b.modelLevel===c.modelLevel&&b.index===c.index);if(!board)fail('That board is not present. Read the current inventory again.');
        if(c.angleDeg===undefined&&c.colour===undefined)fail('Supply a board direction or colour.');
        if(c.angleDeg!==undefined&&(typeof c.angleDeg!=='number'||!Number.isFinite(c.angleDeg)||Math.abs(c.angleDeg)>360))fail('Board direction must be -360..360 degrees.');
        patch=editSelectedBoard(data,model,board!,c.angleDeg??board!.run.layoutSource?.angleDeg??board!.run.angleDeg,c.colour??board!.colour,c.pieceId);
      }else if(c.type==='layout.boards'){
        if(!Array.isArray(c.targets)||!c.targets.length||c.targets.length>64||c.targets.some(t=>!Number.isSafeInteger(t.modelLevel)||t.modelLevel<0||!Number.isSafeInteger(t.index)||t.index<0))fail('Select 1–64 current board inventory targets.');
        if(typeof c.idPrefix!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(c.idPrefix))fail('Use an idPrefix of 1–48 letters, digits, _ or -.');
        if(c.colour!==undefined&&typeof c.colour!=='string')fail('Use a catalogue colour reference.');
        let sequence=0;
        patch=editBoardBatch(data,calculateDeckReleaseEstimate(data).model,c.targets.map(t=>({level:t.modelLevel,index:t.index})),{angleDeg:c.angleDeg,colour:c.colour},()=>`${c.idPrefix}-${++sequence}`);
      }else fail('Unsupported layout command.');
      data=await parseStrict({...data,...patch!},Object.fromEntries(Object.entries(patch!).filter(([,value])=>value!==undefined)));
    }else if(c.type.startsWith('boundary.')){
      const b=c as Extract<AgentCommand,{type:'boundary.move'|'boundary.add'|'boundary.remove'|'boundary.set'|'boundary.dimension'|'boundary.lock'}>;if(![1,2,3].includes(b.level))fail('Boundary level must be 1, 2 or 3.');
      const model=calculateDeckReleaseEstimate(data).model,current=editableBoundaries(data,model).find(v=>v.level===b.level);if(!current)fail('That deck level is not present. Add the level before editing its boundary.');
      let points=current.points;
      if(b.type==='boundary.set')points=b.points;
      else {
        if(b.type!=='boundary.move'||b.target!=='area')if(!Number.isInteger(b.index)||b.index!<0||b.index!>=points.length)fail('Boundary index is outside this polygon.');
        if(b.type==='boundary.lock'){
          if(typeof b.locked!=='boolean')fail('locked must be a boolean.');
          const patch=boundaryPatch(data,b.level,points,current.offset,model);if(!patch)fail('Invalid boundary or measured edge lock.');
          const a=points[b.index],end=points[(b.index+1)%points.length],locks=(data.boundaryLocks??[]).filter(l=>l.level!==b.level||l.edge!==b.index);
          if(b.locked)locks.push({level:b.level,edge:b.index,dxIn:end.x-a.x,dyIn:end.y-a.y});
          data=await parseStrict({...data,...patch,boundaryLocks:locks},{});continue;
        }
        if(b.type==='boundary.dimension')points=setBoundaryDimension(points,b.index,b.lengthIn,b.angleDeg);
        else if(b.type==='boundary.move'){if(!['point','edge','area'].includes(b.target))fail('Unsupported boundary move target.');if(typeof b.dxIn!=='number'||typeof b.dyIn!=='number')fail('Boundary moves require dxIn and dyIn.');points=moveBoundary(points,b.target,b.index??0,b.dxIn,b.dyIn);}
        else if(b.type==='boundary.add')points=insertBoundaryPoint(points,b.index);
        else points=removeBoundaryPoint(points,b.index);
      }
      const problem=boundaryProblem(points);if(problem)fail(problem);
      const patch=boundaryPatch(data,b.level,points,current.offset,model);if(!patch)fail('Invalid boundary or measured edge lock. Unlock the edge before changing its length or direction.');
      data=await parseStrict({...data,...patch},{});
    }else fail('Preview supports design edits only.');
  }
  assertUnlockedChanges(initial,data);
  await ensureLiveDesignExtensions(data);
  if(data.landscapeObjects?.length){const {assertLandscapePlacements}=await import('../landscapeEdits');assertLandscapePlacements(initial,data);}
  const stable=stabilize(data),lastLighting=[...commands].reverse().find(c=>c.type==='design.replace'||c.type==='design.patch'&&Object.hasOwn(c.patch,'lightingSystem'));
  if(lastLighting){const supplied=lastLighting.type==='design.replace'?lastLighting.design.lightingSystem:lastLighting.type==='design.patch'?lastLighting.patch.lightingSystem:undefined;
    if(supplied&&canonical(supplied)!==canonical(stable.data.lightingSystem))fail('Managed lighting quantities must match the modeled mounts. Change autoLighting intent or omit managed items instead of supplying contradictory counts.');}
  return {...stable,...(interpretation?{interpretation}: {})};
}
