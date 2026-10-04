import {useArchitectKeys,revealControl} from './architectKeys';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData,YardFeature} from '../types';
import type {PlanFrame} from '../ConstructionPlan';
import type {Update} from './fields';
import type {LandscapeObject} from '../landscapeTypes';
import type {YardPullKind} from '../yardShapeEditing';
import {newYardFeature} from '../yardSettings';
import {yardGradeIn} from '../yardElevations';
import {parseContractorLength} from './boundaryDimensions';
import {newLandscapeObject} from '../landscapeCatalogue';
import {LANDSCAPE_SURFACES} from '../landscapeSurfaces';
import {applyLandscapeEdit} from '../landscapeEdits';
import {landscapeOutlinePaths} from '../landscapeOutline';
import {
 applyPathToYardFeature,applyWalkway,chamferCorner,edgeCount,edgeTangent,landscapeRingFromPath,mirrorPath,offsetPath,pathArea,pathLength,roundCorner,samplePath,
 setEdge,shapeBoolean,tangentArcBulge,yardFeaturePath,yardSpinePath,type ShapePath,type ShapeRegion,
} from '../shapeTools';
import ShapeDrawTool,{feetInches,type DrawMode,type DrawResult} from './ShapeDrawTool';

type Target='patio'|'wall'|'walkway'|'bed';
interface Draw {target:Target;mode:DrawMode;label:string}
const DRAWS:{id:string;draw:Draw}[]=[
 {id:'outline',draw:{target:'patio',mode:'polygon',label:'Patio outline'}},{id:'rect',draw:{target:'patio',mode:'rectangle',label:'Rectangle patio'}},{id:'circle',draw:{target:'patio',mode:'circle',label:'Circle patio'}},
 {id:'walkway',draw:{target:'walkway',mode:'path',label:'Walkway'}},{id:'wall',draw:{target:'wall',mode:'polygon',label:'Wall path'}},{id:'bed',draw:{target:'bed',mode:'polygon',label:'Planting bed'}},
];
const region=(outer:ShapePath):ShapeRegion=>({outer,holes:[]});
const bounds=(p:ShapePath)=>{const s=samplePath(p,.25),xs=s.map(q=>q.x),ys=s.map(q=>q.y);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};};

export interface DesignerShapePanelProps {data:DeckData;update:Update;selected?:YardFeature;selection:{kind:YardPullKind;index:number};frame:PlanFrame;planHost:HTMLElement|null;
 commit:(before:YardFeature,next:YardFeature)=>boolean;announce:(message:string,bad?:boolean)=>void;onDrawing:(active:boolean)=>void;onSelect:(id:string)=>void}

/** Designer shape tools for patios, walls and walkways (Realtime Landscaping Architect class): draw any outline with
 * lines and true arcs, round or cut corners, bend or straighten edges, offset, combine, mirror, and walkways drawn as a
 * centreline with a width. Each action is one undo step and passes the same construction checks as manual edits. */
export default function DesignerShapePanel({data,update,selected,selection,frame,planHost,commit,announce,onDrawing,onSelect}:DesignerShapePanelProps){
 const [draw,setDraw]=useState<Draw|null>(null),[bedAsset,setBedAsset]=useState<LandscapeObject['assetId']>('mulch-bed');
 const [radius,setRadius]=useState('2\''),[cut,setCut]=useState('1\''),[offset,setOffset]=useState('1\''),[other,setOther]=useState(''),[walkWidth,setWalkWidth]=useState(''),[walkEnds,setWalkEnds]=useState<'square'|'round'>('square');
 const [panelHost,setPanelHost]=useState<HTMLDivElement|null>(null);
 const patios=(data.yardFeatures??[]).filter(f=>f.kind==='patio'&&!f.stepAssembly&&!f.stoneSteps&&f.id!==selected?.id);
 const room=(n=1)=>{if((data.yardFeatures?.length??0)+n>20)throw Error('This design supports up to 20 yard features.');};
 const placed=(f:YardFeature)=>{const grade=yardGradeIn(data,f);if(!Number.isFinite(grade))throw Error('Survey the new feature centre before setting its finished level.');return {...f,finishedElevationIn:grade+f.heightIn};};
 const attempt=(fn:()=>void)=>{try{fn();}catch(e){announce(e instanceof Error?e.message:'That shape tool could not be applied.',true);}};
 const apply=(next:YardFeature,what:string)=>{if(!selected)return;if(commit(selected,next))announce(`${what}. ${summary(next)} Undo restores the previous shape.`);};
 const summary=(f:YardFeature)=>{const p=yardFeaturePath(f);return f.kind==='patio'?`${(pathArea(p)/144).toFixed(1)} sq ft, ${feetInches(pathLength(p))} around.`:`${feetInches(pathLength(p))} of wall.`;};
 const bed=(shape:ShapeRegion,name?:string)=>{
  const id='landscape-'+crypto.randomUUID(),b=bounds(shape.outer),base:LandscapeObject={...newLandscapeObject(bedAsset,id,(b.x0+b.x1)/2,(b.y0+b.y1)/2),groundCoverOnly:true,...(name?{name}:{})};
  const object:LandscapeObject={...base,widthIn:Math.max(1,b.x1-b.x0),depthIn:Math.max(1,b.y1-b.y0),outline:{outer:landscapeRingFromPath(base,shape.outer),holes:shape.holes.map(h=>landscapeRingFromPath(base,h))}};
  update(applyLandscapeEdit(data,id,{action:'create',object}));return object;
 };
 const start=(d:Draw)=>{setDraw(d);onDrawing(true);announce(`${d.label}: ${d.mode==='rectangle'?'click two opposite corners.':d.mode==='circle'?'click the centre, then the edge.':'click to place points; choose Line, Tangent arc or 3-point arc for each edge.'}`);};
 const stop=()=>{setDraw(null);onDrawing(false);};
 const finished=(r:DrawResult)=>attempt(()=>{
  const d=draw!;
  if(d.target==='bed'){const o=bed(region(r.path));announce(`${o.name} drawn: ${(Math.abs(pathArea(r.path))/144).toFixed(1)} sq ft of ${LANDSCAPE_SURFACES.find(s=>s.id===bedAsset)?.name??'bed'}. Edit it in Landscape areas.`);stop();return;}
  room();const base=newYardFeature(d.target==='wall'?'retaining-wall':'patio',{...data,siteModel:undefined});
  let next=d.target==='walkway'?applyWalkway(base,r.path,r.widthIn!,r.ends!):applyPathToYardFeature(base,r.path);
  if(d.target==='walkway')next={...next,name:'Walkway'};next=placed(next);
  update({yardFeatures:[...(data.yardFeatures??[]),next]});onSelect(next.id);announce(`${next.name} drawn: ${summary(next)} Every point and edge stays editable.`);stop();
 });
 const world=selected?yardFeaturePath(selected):null,spine=selected?yardSpinePath(selected):null,isPatio=selected?.kind==='patio';
 const edgeIndex=selected&&world?Math.min(selection.index,edgeCount(world)-1):0;
 useArchitectKeys({o:()=>revealControl(document.querySelector('[aria-label="Designer corner radius"]')),h:()=>revealControl(document.querySelector('[aria-label="Designer corner cut"]')),'ctrl+e':()=>revealControl(document.querySelector('[aria-label="Designer offset distance"]'))},!draw);
 const snapPoints=(data.yardFeatures??[]).filter(f=>f.kind==='patio'||f.kind==='retaining-wall').flatMap(f=>{const p=yardFeaturePath(f);return [...p.points,...p.points.slice(0,edgeCount(p)).map((q,i)=>{const b=p.points[(i+1)%p.points.length];return {x:(q.x+b.x)/2,y:(q.y+b.y)/2};})];}).concat((data.landscapeObjects??[]).filter(o=>o.kind==='bed').flatMap(o=>landscapeOutlinePaths(o)[0]?.filter((_,i)=>i%8===0).map(p=>({x:p.x,y:p.z}))??[]));
 return <section className="dd-designer-panel" aria-label="Designer shape tools">
  <h4>Draw with designer tools</h4>
  <div className="dd-designer-row">{DRAWS.map(({id,draw:d})=><button key={id} type="button" aria-pressed={draw?.label===d.label} disabled={!!draw&&draw.label!==d.label} onClick={()=>draw?stop():start(d)}>{d.label}</button>)}<label>Bed surface<select aria-label="Designer bed surface" value={bedAsset} onChange={e=>setBedAsset(e.target.value as LandscapeObject['assetId'])}>{LANDSCAPE_SURFACES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
  <div ref={setPanelHost}/>
  {selected&&world&&!draw&&<>
   <h4>Shape tools · {selected.name}</h4>
   {selection.kind==='point'?<div className="dd-designer-row">
    <label>Corner radius<input aria-label="Designer corner radius" value={radius} onChange={e=>setRadius(e.target.value)}/></label><button type="button" onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,roundCorner(world,selection.index,parseContractorLength(radius))),`Point ${selection.index+1} rounded`))}>Round corner</button>
    <label>Cut back<input aria-label="Designer corner cut" value={cut} onChange={e=>setCut(e.target.value)}/></label><button type="button" onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,chamferCorner(world,selection.index,parseContractorLength(cut))),`Point ${selection.index+1} cut`))}>Cut corner</button>
   </div>:selection.kind==='edge'?<div className="dd-designer-row">
    <button type="button" onClick={()=>attempt(()=>{const a=world.points[edgeIndex],b=world.points[(edgeIndex+1)%world.points.length],chord=Math.hypot(b.x-a.x,b.y-a.y);apply(applyPathToYardFeature(selected,setEdge(world,edgeIndex,{kind:'arc',bulgeIn:(isPatio?-1:1)*chord/6})),`Edge ${edgeIndex+1} curved`);})}>Make arc</button>
    <button type="button" disabled={edgeIndex===0&&!world.closed} onClick={()=>attempt(()=>{const before=(edgeIndex+world.points.length-1)%world.points.length,a=world.points[edgeIndex],b=world.points[(edgeIndex+1)%world.points.length];apply(applyPathToYardFeature(selected,setEdge(world,edgeIndex,{kind:'arc',bulgeIn:tangentArcBulge(edgeTangent(world,before,true),a,b)})),`Edge ${edgeIndex+1} made tangent`);})}>Tangent to previous edge</button>
    <button type="button" disabled={world.edges[edgeIndex]?.kind!=='arc'} onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,setEdge(world,edgeIndex,{kind:'line'})),`Edge ${edgeIndex+1} straightened`))}>Straighten</button>
   </div>:<p className="dd-designer-note">Select a point to round or cut it, or an edge to bend it.</p>}
   <div className="dd-designer-row">
    <label>Offset<input aria-label="Designer offset distance" value={offset} onChange={e=>setOffset(e.target.value)}/></label>
    {isPatio?<>
     <button type="button" onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,offsetPath(world,parseContractorLength(offset))),'Outline offset'))}>Grow</button>
     <button type="button" onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,offsetPath(world,-parseContractorLength(offset))),'Outline offset'))}>Shrink</button>
     <button type="button" onClick={()=>attempt(()=>{room();const fresh=newYardFeature('patio',{...data,siteModel:undefined}),{inlays:_i,pathSpine:_s,...copy}=selected,next=placed(applyPathToYardFeature({...copy,id:fresh.id,name:`${selected.name} copy`},offsetPath(world,parseContractorLength(offset))));update({yardFeatures:[...(data.yardFeatures??[]),next]});onSelect(next.id);announce(`${next.name} added around ${selected.name}. ${summary(next)}`);})}>Copy as new patio</button>
     <button type="button" onClick={()=>attempt(()=>{const d=parseContractorLength(offset),o=bed({outer:offsetPath(world,d),holes:[world]},`Bed around ${selected.name}`);announce(`${o.name}: a ${feetInches(d)} band of ${LANDSCAPE_SURFACES.find(s=>s.id===bedAsset)?.name??'bed'} around the patio.`);})}>Planting bed around</button>
     {selection.kind==='edge'&&<button type="button" onClick={()=>attempt(()=>{room();const chain:ShapePath={points:[world.points[edgeIndex],world.points[(edgeIndex+1)%world.points.length]],edges:[world.edges[edgeIndex]],closed:false},next=placed(applyPathToYardFeature(newYardFeature('retaining-wall',{...data,siteModel:undefined}),offsetPath(chain,parseContractorLength(offset))));update({yardFeatures:[...(data.yardFeatures??[]),next]});onSelect(next.id);announce(`${next.name} follows edge ${edgeIndex+1}: ${summary(next)}`);})}>Wall along edge</button>}
    </>:<button type="button" onClick={()=>attempt(()=>{room();const fresh=newYardFeature('retaining-wall',{...data,siteModel:undefined}),next=placed(applyPathToYardFeature({...selected,id:fresh.id,name:`${selected.name} parallel`},offsetPath(world,parseContractorLength(offset))));update({yardFeatures:[...(data.yardFeatures??[]),next]});onSelect(next.id);announce(`${next.name} added: ${summary(next)}`);})}>Parallel wall</button>}
   </div>
   {isPatio&&patios.length>0&&<div className="dd-designer-row">
    <label>Combine with<select aria-label="Designer combine with" value={other} onChange={e=>setOther(e.target.value)}><option value="">Choose a patio</option>{patios.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {(['union','difference','intersection'] as const).map(op=><button key={op} type="button" disabled={!other} onClick={()=>attempt(()=>{
     const o=patios.find(p=>p.id===other)!,parts=shapeBoolean(region(world),region(yardFeaturePath(o)),op);
     if(!parts.length)throw Error(op==='intersection'?'Those patios do not overlap.':'Nothing would be left of this patio.');
     if(parts.length>1||parts[0].holes.length)throw Error(parts.length>1?'That would split the patio into separate pieces. Draw them as separate patios.':'That would leave a hole in the patio. Use a planting bed inside it instead.');
     const next=applyPathToYardFeature(selected,parts[0].outer);
     if(op==='union'){update({yardFeatures:(data.yardFeatures??[]).filter(f=>f.id!==o.id).map(f=>f.id===selected.id?next:f)});announce(`${o.name} merged into ${selected.name}. ${summary(next)} Undo restores both.`);}
     else apply(next,op==='difference'?`${o.name} cut out of ${selected.name}`:`${selected.name} trimmed to its overlap with ${o.name}`);
    })}>{op==='union'?'Add':op==='difference'?'Subtract':'Intersect'}</button>)}
   </div>}
   <div className="dd-designer-row">{(['across','out'] as const).map(axis=><button key={axis} type="button" onClick={()=>attempt(()=>apply(applyPathToYardFeature(selected,mirrorPath(world,axis,{x:selected.xFt*12,y:selected.zFt*12})),`Mirrored ${axis==='across'?'left to right':'front to back'}`))}>Mirror {axis==='across'?'left–right':'front–back'}</button>)}</div>
   {spine&&selected.pathSpine&&<div className="dd-designer-row">
    <label>Walkway width<input aria-label="Designer walkway width" placeholder={feetInches(selected.pathSpine.widthIn)} value={walkWidth} onChange={e=>setWalkWidth(e.target.value)}/></label>
    <label>Ends<select aria-label="Designer walkway ends" value={walkEnds} onChange={e=>setWalkEnds(e.target.value as 'square'|'round')}><option value="square">Square</option><option value="round">Round</option></select></label>
    <button type="button" onClick={()=>attempt(()=>apply(applyWalkway(selected,spine,walkWidth.trim()?parseContractorLength(walkWidth):selected.pathSpine!.widthIn,walkEnds),'Walkway updated'))}>Update walkway</button>
    <button type="button" onClick={()=>attempt(()=>{const {pathSpine:_s,...free}=selected;apply(free as YardFeature,'Walkway converted to a free patio shape');})}>Convert to free shape</button>
   </div>}
   <p className="dd-designer-note">Each tool is one undo step. Product, joint and construction checks still apply to the new shape.</p>
  </>}
  {draw&&planHost&&createPortal(<ShapeDrawTool frame={frame} mode={draw.mode} closed={draw.target==='patio'||draw.target==='bed'} label={draw.label} snapPoints={snapPoints} panelHost={panelHost} onFinish={finished} onCancel={()=>{stop();announce('Drawing cancelled. The design is unchanged.');}}/>,planHost)}
 </section>;
}
