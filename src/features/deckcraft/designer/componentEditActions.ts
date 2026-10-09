import {usesPhysicalElevations} from '../elevationDatum';
import type {DeckData,HouseOpening,PrivacyScreen} from '../types';
import {buildDeckTakeoff,type DeckTakeoff} from '../deckTakeoff';
import type {PlanPoint} from '../lib/deckGeometry';
import {validateDesign} from '../designPersistence';
import {getHouseConfig} from '../houseSettings';
import {getHousePlacement} from '../housePlacement';
import {getHouseBlocks,getHouseWalls,openingHidden,openingWallId,SIDE_FACADE,wallLabel} from '../houseFootprint';
import {newHouseOpening,openingLabel,openableWalls,presetFor,MAX_HOUSE_OPENINGS} from '../houseOpenings';
import {extrasLayout} from '../extrasLayout';
import {privacySides,screenProduct,screenLengthIn,MAX_PRIVACY_SCREENS} from '../privacyScreens';
import {activeWrap} from '../lib/wrapGeometry';
import {syncAutoLighting} from '../lightingSystem';

export type PlanComponentKind='house'|'wall'|'opening'|'deck'|'stairs'|'screen'|'beam'|'post'|'footing';
export interface PlanComponent {id:string;kind:PlanComponentKind;label:string;anchor?:PlanPoint;polygon?:PlanPoint[];line?:[PlanPoint,PlanPoint];level?:1|2|3;refId?:string;dimensions:string[];scope?:string;editable:boolean}
export type ComponentEdit={action:'update';fields:Record<string,unknown>}|{action:'add-opening';presetKey:string;wallId:string}|{action:'duplicate'}|{action:'remove'};
export type ComponentEditResult={ok:true;patch:Partial<DeckData>;selectedId:string;message:string}|{ok:false;error:string};
export type ComponentBatchEdit=ComponentEdit|{action:'move';offsetDeltaPct:number}|{action:'distribute'}|{action:'screen-lights';enabled:boolean};
export type ComponentBatchResult={ok:true;patch:Partial<DeckData>;selectedIds:string[];message:string}|{ok:false;error:string};
const inch=(n:number)=>`${Math.round(n*100)/100} in`,feet=(n:number)=>`${Math.round(n/12*100)/100} ft`;
const middle=(a:PlanPoint,b:PlanPoint)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const unique=(prefix:string,ids:readonly string[])=>{let n=1;while(ids.includes(`${prefix}-${n}`))n++;return `${prefix}-${n}`;};

/** Actual generated/model geometry only. Covered or hidden parts remain in the list without a canvas marker. */
export function listPlanComponents(data:DeckData,model:DeckTakeoff):PlanComponent[]{
 const parts:PlanComponent[]=[],house=getHouseConfig(data),blocks=getHouseBlocks(data),walls=getHouseWalls(data,blocks),visible=data.houseVisible!==false;
 for(const block of blocks){const r=block.rect;parts.push({id:`house:${block.id}`,kind:'house',refId:block.id,label:block.id==='main'?'Main house':`${block.kind==='garage'?'Garage':'House block'} ${block.id}`,editable:block.id==='main',...(visible?{polygon:[{x:r.x0,y:r.y0},{x:r.x1,y:r.y0},{x:r.x1,y:r.y1},{x:r.x0,y:r.y1}],anchor:{x:(r.x0+r.x1)/2,y:(r.y0+r.y1)/2}}:{}),dimensions:[`${feet(r.x1-r.x0)} wide`,`${feet(r.y1-r.y0)} deep`,`${inch(block.wallHeightIn)} wall height`],scope:block.id==='main'?'Main house size and position. Attached blocks follow the existing house constraints.':'Inspect this block; use House settings for its attached-block dimensions.'});}
 for(const wall of walls){const widest=[...wall.exposed].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0],u={x:(wall.b.x-wall.a.x)/wall.lengthIn,y:(wall.b.y-wall.a.y)/wall.lengthIn};const a=widest?{x:wall.a.x+u.x*widest[0],y:wall.a.y+u.y*widest[0]}:wall.a,b=widest?{x:wall.a.x+u.x*widest[1],y:wall.a.y+u.y*widest[1]}:wall.b;parts.push({id:`wall:${wall.id}`,kind:'wall',refId:wall.id,label:wallLabel(wall.id,house),editable:wall.blockId==='main',...(visible&&widest?{anchor:middle(a,b),line:[a,b] as [PlanPoint,PlanPoint]}:{}),dimensions:[`${feet(wall.lengthIn)} long`,`${inch(blocks.find(b=>b.id===wall.blockId)!.wallHeightIn)} high`],scope:'Wall geometry follows its house block. Main-house size edits affect all four main walls; an individual wall cannot be moved independently.'});}
 for(const opening of house.openings){const wall=walls.find(w=>w.id===openingWallId(opening,house)),at=wall?{x:wall.a.x+(wall.b.x-wall.a.x)*opening.offsetPct/100,y:wall.a.y+(wall.b.y-wall.a.y)*opening.offsetPct/100}:undefined;const unit=wall?{x:(wall.b.x-wall.a.x)/wall.lengthIn,y:(wall.b.y-wall.a.y)/wall.lengthIn}:undefined;parts.push({id:`opening:${opening.id}`,kind:'opening',refId:opening.id,label:`${openingLabel(opening)} · ${wallLabel(openingWallId(opening,house),house)}`,editable:true,...(visible&&at&&unit&&!openingHidden(opening,walls,house)?{anchor:at,line:[{x:at.x-unit.x*opening.widthIn/2,y:at.y-unit.y*opening.widthIn/2},{x:at.x+unit.x*opening.widthIn/2,y:at.y+unit.y*opening.widthIn/2}] as [PlanPoint,PlanPoint]}:{}),dimensions:[`${inch(opening.widthIn)} × ${inch(opening.heightIn)}`,`Bottom ${inch(opening.bottomIn)} ${usesPhysicalElevations(data)?'relative to datum':'above grade'}`],scope:'Door/window appearance and measured openings; these do not add a deck supply price.'});}
 model.levels.forEach((l,modelIndex)=>{const level=l.kind==='deck'&&l.index!==undefined?(l.index+1) as 1|2|3:undefined,levelLabel=level?`Level ${level}`:`${l.kind==='winder'?'Winder':'Landing'} ${modelIndex+1}`;
  if(level){const polygon=l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}));parts.push({id:`deck:${level}`,kind:'deck',level,label:`Deck level ${level}`,editable:false,polygon,anchor:polygon[0],dimensions:[`${feet(l.footprint.bounds.w)} × ${feet(l.footprint.bounds.h)}`,`${inch(l.top)} ${usesPhysicalElevations(data)?'relative to datum':'above grade'}`],scope:'Edit this level with Shape & points or Board layout.'});}
  // Beams and supports are already world inches: framing adds the level offset when it places them.
  // The footprint outline is level-local, so only that polygon adds the offset. Adding it again
  // shifts a lower level (a spa deck at x 360–552 was reported at 720–912). Physical foundation
  // datums already store the same world point, which is why those footings stayed on the span.
  l.beams.forEach((beam,index)=>{const a={x:beam.a.x,y:beam.a.z},b={x:beam.b.x,y:beam.b.z};parts.push({id:`beam:${modelIndex}:${index}`,kind:'beam',level,label:`${levelLabel} beam ${index+1}`,editable:false,line:[a,b],anchor:middle(a,b),dimensions:[`${feet(Math.hypot(b.x-a.x,b.y-a.y))} long`,`${inch(beam.width)} × ${inch(beam.depth)}`],scope:'Generated framing: framing-size settings apply to all generated framing, not this beam alone.'});});
  l.supports.forEach((support,index)=>{const datum=model.foundationSupports.find(f=>f.levelIndex===modelIndex&&f.supportIndex===index),anchor=usesPhysicalElevations(data)&&datum?{x:datum.x,y:datum.z}:{x:support.x,y:support.z};parts.push({id:`footing:${modelIndex}:${index}`,kind:'footing',level,label:`${levelLabel} footing ${index+1}`,editable:false,anchor,dimensions:[`Position X ${inch(anchor.x)}, Y ${inch(anchor.y)}`,data.foundation,`Support elevation ${inch(support.y)}`,...usesPhysicalElevations(data)&&datum?[`Ground ${datum.gradeElevationIn===null?'pending':inch(datum.gradeElevationIn)} datum`,`Bottom ${datum.bottomElevationIn===null?'pending':inch(datum.bottomElevationIn)} datum`,datum.status]:[]],scope:'Generated footing location. Foundation selection/depth apply to all footings; no individual footing relocation is supported.'});if(usesPhysicalElevations(data)?datum?.postHeightIn!==null&&(datum?.postHeightIn??0)>0:support.y>(data.foundation==='Deck Blocks'?6.5:4.5))parts.push({id:`post:${modelIndex}:${index}`,kind:'post',level,label:`${levelLabel} support post ${index+1}`,editable:false,anchor,dimensions:[usesPhysicalElevations(data)?`Post cut ${inch(datum!.postHeightIn!)}; top ${inch(support.y)} datum`:`Support top ${inch(support.y)} above grade`,`Position X ${inch(anchor.x)}, Y ${inch(anchor.y)}`],scope:'Generated support post. Shared framing/foundation settings control the support system; individual post size or relocation is not supported.'});});
 });
 const first=model.flights.find(f=>f.kind==='grade');if(first){const a={x:first.start.x,y:first.start.z},b={x:first.end.x,y:first.end.z},along=first.along??{x:1,y:0},half=first.width/2;parts.push({id:'stairs:primary',kind:'stairs',refId:first.id,label:'Primary grade stairs',editable:true,anchor:middle(a,b),polygon:[{x:a.x-along.x*half,y:a.y-along.y*half},{x:a.x+along.x*half,y:a.y+along.y*half},{x:b.x+along.x*half,y:b.y+along.y*half},{x:b.x-along.x*half,y:b.y-along.y*half}],dimensions:[`${inch(first.width)} wide`,`${first.risers} risers × ${inch(first.rise)}`,`${inch(first.run)} tread run`],scope:'Width and stair type apply to all grade stair flights. Edge and offset place the primary flight. Existing connection stairs remain generated from deck levels.'});}
 const handles=extrasLayout(data,model).screenHandles;
 for(const [index,screen] of (data.privacyScreens??[]).entries()){const handle=handles.find(h=>h.id===screen.id),product=screenProduct(screen);parts.push({id:`screen:${screen.id}`,kind:'screen',refId:screen.id,label:`Privacy screen ${index+1} · ${screen.side}${screen.level?` · Level ${screen.level}`:''}`,editable:true,...(handle?{anchor:{x:handle.x,y:handle.z},line:[{x:handle.x-Math.cos(handle.angle)*handle.w/2,y:handle.z+Math.sin(handle.angle)*handle.w/2},{x:handle.x+Math.cos(handle.angle)*handle.w/2,y:handle.z-Math.sin(handle.angle)*handle.w/2}] as [PlanPoint,PlanPoint]}:{}),dimensions:[product.name,...(handle?[`${feet(handle.w)} drawn length`,`${inch(handle.h)} drawn height`]:['Not currently drawn: off, outside the exposed edge, or unable to fit'])],scope:product.panel?'Stock product dimensions stay fixed; edit panel quantity and placement.':'Slatted screen dimensions and placement update actual screen geometry and the priced face area.'});}
 return parts;
}

/** Draft field values for the selected real part. Does not modify the design. */
export function componentEditValues(data:DeckData,part:PlanComponent):Record<string,string|boolean>{
 if(part.kind==='house'||part.kind==='wall'){const h=getHouseConfig(data),p=getHousePlacement(data);return {widthFt:String(h.widthFt),depthFt:String(h.depthFt),offsetIn:String(p.x0),visible:data.houseVisible!==false};}
 if(part.kind==='opening'){const o=getHouseConfig(data).openings.find(o=>o.id===part.refId)!;return {type:o.type,widthIn:String(o.widthIn),heightIn:String(o.heightIn),bottomIn:String(o.bottomIn),offsetPct:String(o.offsetPct),wallId:openingWallId(o,getHouseConfig(data))};}
 if(part.kind==='stairs')return {stairWidth:String(data.stairWidth),stairType:data.stairType,stairPosition:data.stairPosition,stairOffset:String(data.stairOffset??50),stairEdgeId:data.stairEdgeId??''};
 if(part.kind==='screen'){const s=data.privacyScreens!.find(s=>s.id===part.refId)!;return {side:s.side,lengthFt:String(s.lengthFt),heightFt:String(s.heightFt),offsetPct:String(s.offsetPct),panels:String(s.panels??1),enabled:s.enabled!==false};}
 return {};
}
function safeFields(input:Record<string,unknown>,allowed:string[]){if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Object.getOwnPropertySymbols(input).length)throw new Error('Provide plain component fields.');for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(input)))if(!allowed.includes(key)||!('value'in d)||!d.enumerable)throw new Error(`Unsupported component field: ${key}.`);return input;}
function number(input:unknown,label:string,min=-Infinity,max=Infinity){if(typeof input!=='number'||!Number.isFinite(input))throw new Error(`Enter a finite number for ${label}.`);if(input<min||input>max)throw new Error(`${label} must be between ${min} and ${max}.`);return input;}
function validatePatch(data:DeckData,patch:Partial<DeckData>):Partial<DeckData>{const clean=validateDesign({...data,...patch}),result:Partial<DeckData>={};for(const key of Object.keys(patch) as (keyof DeckData)[])(result as Record<string,unknown>)[key]=clean[key];return result;}

/** Pure shared operation. Only changed public keys are returned; host rates/customer/private data are never replaced. */
export function applyComponentEdit(data:DeckData,model:DeckTakeoff,id:string,edit:ComponentEdit):ComponentEditResult{
 try{
  safeFields(edit as unknown as Record<string,unknown>,['action','fields','presetKey','wallId']);if(!['update','add-opening','duplicate','remove'].includes(edit.action))throw new Error('Choose a supported component operation.');
  const part=listPlanComponents(data,model).find(p=>p.id===id);if(!part)throw new Error('That part is no longer in the current model. Select another part.');
  let patch:Partial<DeckData>={},selectedId=id;
  if(edit.action==='add-opening'){
   if(part.kind!=='house'&&part.kind!=='wall')throw new Error('Select a house or wall before adding an opening.');
   if(!openableWalls(data).some(w=>w.id===edit.wallId))throw new Error('Choose an exposed house wall.');
   const h=getHouseConfig(data),newId=unique('part-opening',h.openings.map(o=>o.id)),opening=newHouseOpening(data,edit.presetKey,edit.wallId,newId);if(!opening)throw new Error(`An opening cannot be added here. Keep an exposed wall and fewer than ${MAX_HOUSE_OPENINGS} openings.`);patch={houseConfig:{...h,openings:[...h.openings,opening]}};selectedId=`opening:${newId}`;
  }else if(part.kind==='opening'){
   const house=getHouseConfig(data),source=house.openings.find(o=>o.id===part.refId)!;
   if(edit.action==='remove'){patch={houseConfig:{...house,openings:house.openings.filter(o=>o.id!==source.id)}};selectedId='house:main';}
   else if(edit.action==='duplicate'){if(house.openings.length>=MAX_HOUSE_OPENINGS)throw new Error(`A house supports up to ${MAX_HOUSE_OPENINGS} openings.`);const newId=unique('part-opening',house.openings.map(o=>o.id)),placed=newHouseOpening(data,presetFor(source).key,openingWallId(source,house),newId);if(!placed)throw new Error('This wall has no exposed space for another opening.');patch={houseConfig:{...house,openings:[...house.openings,{...source,id:newId,offsetPct:placed.offsetPct}]}};selectedId=`opening:${newId}`;}
   else if(edit.action==='update'){const f=safeFields(edit.fields,['type','widthIn','heightIn','bottomIn','offsetPct','wallId']);const next={...source};if(f.type!==undefined){if(!['Door','Window','Garage'].includes(f.type as string))throw new Error('Choose a supported opening type.');if(f.type!==source.type)delete next.style;next.type=f.type as HouseOpening['type'];}for(const key of ['widthIn','heightIn','bottomIn','offsetPct'] as const)if(f[key]!==undefined)next[key]=number(f[key],key,key==='bottomIn'||key==='offsetPct'?0:12,key==='widthIn'?180:key==='heightIn'?144:key==='bottomIn'?900:100);if(f.wallId!==undefined){const wall=openableWalls(data).find(w=>w.id===f.wallId);if(!wall)throw new Error('Choose an exposed house wall.');next.wallId=wall.id;next.facade=SIDE_FACADE[wall.side];}patch={houseConfig:{...house,openings:house.openings.map(o=>o.id===source.id?next:o)}};}
   else throw new Error('Unsupported opening operation.');
  }else if(part.kind==='house'||part.kind==='wall'){
   if(edit.action!=='update'||!part.editable)throw new Error('Use House settings for attached-block changes.');const f=safeFields(edit.fields,['widthFt','depthFt','offsetIn','visible']),house={...getHouseConfig(data)};if(activeWrap(data)&&(f.widthFt!==undefined||f.depthFt!==undefined||f.offsetIn!==undefined))throw new Error('The wrap layout controls house size and position. Change those in Deck shape settings.');for(const key of ['widthFt','depthFt'] as const)if(f[key]!==undefined)house[key]=number(f[key],key,12,100);if(f.widthFt!==undefined||f.depthFt!==undefined)patch.houseConfig=house;if(f.offsetIn!==undefined)patch.housePlacement={anchor:'left',offsetIn:number(f.offsetIn,'house position',-2400,2400)};if(f.visible!==undefined){if(typeof f.visible!=='boolean')throw new Error('Choose whether the house is visible.');patch.houseVisible=f.visible;}
  }else if(part.kind==='stairs'){
   if(edit.action!=='update')throw new Error('Use Stairs settings to add or remove grade flights.');const f=safeFields(edit.fields,['stairWidth','stairType','stairPosition','stairOffset','stairEdgeId']);for(const key of ['stairWidth','stairOffset'] as const)if(f[key]!==undefined)patch[key]=number(f[key],key,key==='stairWidth'?36:0,key==='stairWidth'?120:100);if(f.stairType!==undefined){if(!['Straight','Winder','Landing'].includes(f.stairType as string))throw new Error('Choose a supported stair type.');patch.stairType=f.stairType as DeckData['stairType'];}if(f.stairPosition!==undefined){if(!['Front','Left','Right','Back'].includes(f.stairPosition as string))throw new Error('Choose a supported stair side.');patch.stairPosition=f.stairPosition as DeckData['stairPosition'];}if(f.stairEdgeId!==undefined){if(typeof f.stairEdgeId!=='string')throw new Error('Choose a valid stair edge.');patch.stairEdgeId=f.stairEdgeId||undefined;}
  }else if(part.kind==='screen'){
   const screens=data.privacyScreens!,source=screens.find(s=>s.id===part.refId)!;
   if(edit.action==='remove'){patch={privacyScreens:screens.filter(s=>s.id!==source.id)};selectedId='deck:1';}
   else if(edit.action==='duplicate'){if(screens.length>=MAX_PRIVACY_SCREENS)throw new Error(`A design supports up to ${MAX_PRIVACY_SCREENS} screens.`);const newId=unique('part-screen',screens.map(s=>s.id)),side=source.edgeId?source.side:privacySides(data).find(side=>!screens.some(s=>s.enabled!==false&&s.side===side))??source.side;patch={privacyScreens:[...screens,{...source,id:newId,side,offsetPct:side===source.side?(source.offsetPct<50?100:0):50}]};selectedId=`screen:${newId}`;}
   else if(edit.action==='update'){const f=safeFields(edit.fields,['side','lengthFt','heightFt','offsetPct','panels','enabled']),next={...source};if(f.side!==undefined){if(!privacySides(data).includes(f.side as PrivacyScreen['side']))throw new Error('Choose an exposed edge for this screen.');if(f.side!==source.side){delete next.edgeId;delete next.level;}next.side=f.side as PrivacyScreen['side'];}for(const key of ['lengthFt','heightFt','offsetPct','panels'] as const)if(f[key]!==undefined)(next as unknown as Record<string,unknown>)[key]=number(f[key],key);if(f.enabled!==undefined){if(typeof f.enabled!=='boolean')throw new Error('Choose whether this screen is enabled.');next.enabled=f.enabled;}if(screenProduct(source).panel&&(f.lengthFt!==undefined||f.heightFt!==undefined))throw new Error('Stock panel dimensions are fixed. Edit the number of panels instead.');if(!screenProduct(source).panel&&f.panels!==undefined)throw new Error('This slatted screen uses measured dimensions, not stock panel quantity.');patch={privacyScreens:screens.map(s=>s.id===source.id?next:s)};}
   else throw new Error('Unsupported screen operation.');
   patch.privacySqft=0;// validateDesign derives the exact enabled priced face area from the retained screens.
  }else throw new Error('This is a generated part. Use its shared framing or foundation settings; individual overrides are not supported.');
  const normalized=validatePatch(data,patch);
  if(part.kind==='stairs'){for(const key of ['stairType','stairPosition','stairEdgeId'] as const)if(patch[key]!==normalized[key])throw new Error('Those stair settings do not use a supported exposed edge. Choose a clear edge and a compatible stair type.');if(!buildDeckTakeoff({...data,...normalized}).flights.some(f=>f.kind==='grade'))throw new Error('Those stair settings do not produce a supported grade flight. Choose a clear exposed edge and valid width.');}
  if(part.kind==='screen'&&edit.action!=='remove'){const next=normalized.privacyScreens?.find(s=>`screen:${s.id}`===selectedId);if(next&&next.enabled!==false){const candidate={...data,...normalized},layout=extrasLayout(candidate,buildDeckTakeoff(candidate)),handle=layout.screenHandles.find(h=>h.id===next.id);if(!handle||Math.abs(handle.w-screenLengthIn(next))>.01)throw new Error('This screen does not fit a clear exposed edge at that position. Choose a shorter run, fewer stock panels, or another exposed side.');}}
  const opening=normalized.houseConfig?.openings.find(o=>`opening:${o.id}`===selectedId),actual=opening?` Actual opening: ${inch(opening.widthIn)} × ${inch(opening.heightIn)}, bottom ${inch(opening.bottomIn)}, wall offset ${Math.round(opening.offsetPct*100)/100}%. Wall clearances may constrain these values.`:'';
  return {ok:true,patch:normalized,selectedId,message:`${edit.action==='remove'?'Removed':edit.action==='duplicate'?'Duplicated':edit.action==='add-opening'?'Added opening to':'Updated'} ${part.label}.${actual}`};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'The component edit could not be applied.'};}
}

/** All-or-nothing batch: validate every real target before returning one host patch. */
export function applyComponentBatch(data:DeckData,model:DeckTakeoff,ids:string[],edit:ComponentBatchEdit):ComponentBatchResult{
 try{
  safeFields(edit as unknown as Record<string,unknown>,['action','fields','presetKey','wallId','offsetDeltaPct','enabled']);
  if(!Array.isArray(ids)||!ids.length||ids.length>64||ids.some(id=>typeof id!=='string'))throw new Error('Select between one and 64 actual parts.');
  const uniqueIds=[...new Set(ids)];if(!uniqueIds.length)throw new Error('Select parts before applying a batch.');
  const inventory=listPlanComponents(data,model),parts=uniqueIds.map(id=>{const p=inventory.find(p=>p.id===id);if(!p)throw new Error('A selected part is no longer present. Select it again.');return p;});
  if(parts.some(p=>p.kind!==parts[0].kind))throw new Error('Choose parts of the same type for a batch edit.');
  if(!['opening','screen'].includes(parts[0].kind))throw new Error('Batch edits support doors/windows or privacy screens. Generated structure uses shared settings.');
  let candidate=data;const patch:Partial<DeckData>={},selectedIds:string[]=[];
  if(edit.action==='distribute'||edit.action==='screen-lights'){
   if(parts[0].kind!=='screen')throw new Error('This operation applies to privacy screens only.');
   const screens=data.privacyScreens??[],chosen=parts.map(p=>screens.find(s=>s.id===p.refId)!);
   if(edit.action==='screen-lights'){
    if(typeof edit.enabled!=='boolean')throw new Error('Choose whether screen lights are enabled.');
    if(chosen.some(s=>s.enabled===false||!inventory.find(p=>p.id===`screen:${s.id}`)?.anchor))throw new Error('Screen lights need an enabled, supported screen in the drawing.');
    patch.privacyScreens=screens.map(s=>chosen.some(c=>c.id===s.id)?{...s,lights:edit.enabled}:s);
   }else{
    if(chosen.length<2||chosen.some(s=>s.side!==chosen[0].side||(s.level??1)!==(chosen[0].level??1)||s.edgeId!==chosen[0].edgeId||s.enabled===false))throw new Error('Choose two or more enabled screens on the same exposed side.');
    const handles=extrasLayout(data,model).screenHandles,handle=handles.find(h=>h.id===chosen[0].id);if(!handle)throw new Error('These screens need a supported exposed edge.');
    // Measure available centres from the real placement engine, including contact/stair exclusions.
    const ends=chosen.map(s=>[0,100].map(offsetPct=>{const trial={...data,privacyScreens:screens.map(c=>c.id===s.id?{...c,offsetPct}:c)};return extrasLayout(trial,model).screenHandles.find(h=>h.id===s.id);}));
    if(ends.some(pair=>pair.some(h=>!h)))throw new Error('The screen edge cannot support this distribution.');
    const widths=chosen.map(screenLengthIn),space=Math.hypot(ends[0][1]!.x-ends[0][0]!.x,ends[0][1]!.z-ends[0][0]!.z)+widths[0];
    const used=widths.reduce((a,b)=>a+b,0);if(used>space+.01)throw new Error('The selected screens do not fit along this exposed edge.');
    const gap=(space-used)/(chosen.length-1);let cursor=0;const offsets=new Map<string,number>();
    chosen.forEach((s,i)=>{const centre=cursor+widths[i]/2,travel=space-widths[i];offsets.set(s.id,travel>0?(centre-widths[i]/2)/travel*100:50);cursor+=widths[i]+gap;});
    patch.privacyScreens=screens.map(s=>offsets.has(s.id)?{...s,offsetPct:offsets.get(s.id)!}:s);
   }
   patch.privacySqft=0;candidate={...data,...validatePatch(data,patch)};
   const actual=extrasLayout(candidate,buildDeckTakeoff(candidate)).screenHandles;
   for(const s of candidate.privacyScreens!.filter(s=>chosen.some(c=>c.id===s.id)))if(!actual.some(h=>h.id===s.id&&Math.abs(h.w-screenLengthIn(s))<.01))throw new Error('A selected screen does not fit its actual exposed edge.');
   if(edit.action==='distribute'){const selectedHandles=actual.filter(h=>chosen.some(c=>c.id===h.id));for(let i=0;i<selectedHandles.length;i++)for(let j=i+1;j<selectedHandles.length;j++)if(Math.hypot(selectedHandles[i].x-selectedHandles[j].x,selectedHandles[i].z-selectedHandles[j].z)+.01<(selectedHandles[i].w+selectedHandles[j].w)/2)throw new Error('These screens cannot be distributed without overlapping.');}
   assertScreenBatchClearance(candidate,chosen.map(s=>s.id));const final=syncScreenBatchLighting(candidate,validatePatch(data,patch));return {ok:true,patch:final,selectedIds:uniqueIds,message:edit.action==='screen-lights'?`${edit.enabled?'Enabled':'Removed'} actual screen light mounts on ${chosen.length} screens. Supply quantities follow the mounted lights.`:`Distributed ${chosen.length} screens along their exposed edge.`};
  }
  for(const part of parts){let operation:ComponentEdit;if(edit.action==='move'){
    const delta=number(edit.offsetDeltaPct,'relative movement',-100,100),values=componentEditValues(candidate,part);operation={action:'update',fields:{offsetPct:number(Number(values.offsetPct)+delta,'resulting edge offset',0,100)}};
   }else operation=edit;
   const result=applyComponentEdit(candidate,buildDeckTakeoff(candidate),part.id,operation);if('error'in result)throw new Error(`${part.label}: ${result.error}`);Object.assign(patch,result.patch);candidate={...candidate,...result.patch};if(result.selectedId.startsWith(`${part.kind}:`))selectedIds.push(result.selectedId);
  }
  if(parts[0].kind==='screen')assertScreenBatchClearance(candidate,[...parts.map(p=>p.refId!),...selectedIds.map(id=>id.slice(7))]);
  return {ok:true,patch:syncScreenBatchLighting(candidate,patch),selectedIds,message:`${edit.action==='remove'?'Removed':edit.action==='duplicate'?'Duplicated':'Updated'} ${parts.length} ${parts[0].kind==='screen'?'privacy screens':'house openings'} in one change. ${edit.action==='update'?'Actual wall/edge constraints apply to the resulting values.':''}`};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'The batch could not be applied.'};}
}
function syncScreenBatchLighting(candidate:DeckData,patch:Partial<DeckData>):Partial<DeckData>{if(!patch.privacyScreens)return patch;const model=buildDeckTakeoff(candidate),layout=extrasLayout(candidate,model);return {...patch,lightingSystem:{...candidate.lightingSystem,selectedItems:syncAutoLighting(candidate,{posts:model.railing.posts.length,stairs:model.treads.length,privacy:layout.privacyMounts.length,border:layout.borderMounts.length})}};}
/** Reject overlap with unselected actual screens too; returning no patch preserves atomicity. */
function assertScreenBatchClearance(candidate:DeckData,changedIds:string[]){
 const handles=extrasLayout(candidate,buildDeckTakeoff(candidate)).screenHandles;
 for(let i=0;i<handles.length;i++)for(let j=i+1;j<handles.length;j++){
  const a=handles[i],b=handles[j];if(!changedIds.includes(a.id)&&!changedIds.includes(b.id))continue;
  if(Math.abs(Math.cos(a.angle-b.angle))<.9999)continue;
  const dx=b.x-a.x,dz=b.z-a.z,normal=dx*Math.sin(a.angle)+dz*Math.cos(a.angle),along=dx*Math.cos(a.angle)-dz*Math.sin(a.angle);
  if(Math.abs(normal)<.1&&Math.abs(along)+.01<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2)throw new Error('Selected screens overlap another actual screen. Shorten or move them into clear space before applying this batch.');
 }
}
