import {useState} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData} from '../types';
import type {PlanFrame} from '../ConstructionPlan';
import type {LandscapeObject} from '../landscapeTypes';
import {newLandscapeObject} from '../landscapeCatalogue';
import {applyLandscapeEdit} from '../landscapeEdits';
import {convertLandscapeOutline,landscapeOutlinePaths} from '../landscapeOutline';
import {parseContractorLength} from './boundaryDimensions';
import {landscapeRingFromPath,landscapeRingPath,offsetPath,pathArea,samplePath,shapeBoolean,type ShapeRegion} from '../shapeTools';
import ShapeDrawTool,{feetInches,type DrawMode,type DrawResult} from './ShapeDrawTool';

interface Props {data:DeckData;object?:LandscapeObject;material:LandscapeObject['assetId'];frame:PlanFrame;planHost:HTMLElement|null;
 onPreview:(next:DeckData)=>void;onSelect:(id:string)=>void;onNotice:(message:string)=>void;onDrawing:(active:boolean)=>void}

const DRAWS:{mode:DrawMode;label:string}[]=[{mode:'polygon',label:'Area outline'},{mode:'rectangle',label:'Rectangle area'},{mode:'circle',label:'Circle area'}];
/** World region of a landscape area: its outer ring and holes, as exact lines and arcs. */
function areaRegion(o:LandscapeObject):ShapeRegion{const c=convertLandscapeOutline(o),outline=c.outline!;return {outer:landscapeRingPath(c,outline.outer),holes:outline.holes.map(h=>landscapeRingPath(c,h))};}
const areaOf=(r:ShapeRegion)=>(pathArea(r.outer)+r.holes.reduce((n,h)=>n-Math.abs(pathArea(h)),0))/144;

/** Designer tools for planting beds, turf and greens: draw with lines and true arcs, grow or shrink, ring a bed with a
 * band, and add, subtract or intersect areas. Results go through the editor's preview so quantities show before Apply. */
export default function DesignerAreaPanel({data,object,material,frame,planHost,onPreview,onSelect,onNotice,onDrawing}:Props){
 const [draw,setDraw]=useState<{mode:DrawMode;label:string}|null>(null),[offset,setOffset]=useState('1\''),[other,setOther]=useState(''),[panelHost,setPanelHost]=useState<HTMLDivElement|null>(null);
 const beds=(data.landscapeObjects??[]).filter(o=>o.kind==='bed'&&o.id!==object?.id);
 const attempt=(fn:()=>void)=>{try{fn();}catch(e){onNotice(e instanceof Error?e.message:'That area tool could not be applied.');}};
 const create=(shape:ShapeRegion,name?:string)=>{
  const id='landscape-'+crypto.randomUUID(),s=samplePath(shape.outer,.25),xs=s.map(p=>p.x),zs=s.map(p=>p.y),base:LandscapeObject={...newLandscapeObject(material,id,(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2),groundCoverOnly:true,...(name?{name}:{})};
  const next={...data,...applyLandscapeEdit(data,id,{action:'create',object:{...base,outline:{outer:landscapeRingFromPath(base,shape.outer),holes:shape.holes.map(h=>landscapeRingFromPath(base,h))}}})};
  onSelect(id);setTimeout(()=>onPreview(next),0);onNotice(`${base.name}: ${areaOf(shape).toFixed(1)} sq ft. Review the quantities, then Apply.`);
 };
 const reshape=(o:LandscapeObject,shape:ShapeRegion,source:DeckData=data)=>({...source,...applyLandscapeEdit(source,o.id,{action:'patch',patch:{outline:{outer:landscapeRingFromPath(o,shape.outer),holes:shape.holes.map(h=>landscapeRingFromPath(o,h))},polygon:undefined}})});
 const finished=(r:DrawResult)=>attempt(()=>{create({outer:r.path,holes:[]});setDraw(null);onDrawing(false);});
 const snapPoints=(data.landscapeObjects??[]).filter(o=>o.kind==='bed').flatMap(o=>landscapeOutlinePaths(o)[0]?.filter((_,i)=>i%8===0).map(p=>({x:p.x,y:p.z}))??[]);
 return <section className="dd-designer-panel" aria-label="Designer area tools">
  <h4>Draw areas with designer tools</h4>
  <div className="dd-designer-row">{DRAWS.map(d=><button key={d.mode} type="button" aria-pressed={draw?.mode===d.mode} disabled={!!draw&&draw.mode!==d.mode} onClick={()=>{if(draw){setDraw(null);onDrawing(false);}else{setDraw(d);onDrawing(true);}}}>{d.label}</button>)}</div>
  <div ref={setPanelHost}/>
  {object&&!draw&&<>
   <h4>Area tools · {object.name}</h4>
   <div className="dd-designer-row">
    <label>Offset<input aria-label="Designer area offset" value={offset} onChange={e=>setOffset(e.target.value)}/></label>
    <button type="button" onClick={()=>attempt(()=>{const r=areaRegion(object),d=parseContractorLength(offset);onPreview(reshape(object,{outer:offsetPath(r.outer,d),holes:r.holes.map(h=>offsetPath(h,-d))}));onNotice(`${object.name} grown by ${feetInches(d)}. Review, then Apply.`);})}>Grow</button>
    <button type="button" onClick={()=>attempt(()=>{const r=areaRegion(object),d=parseContractorLength(offset);onPreview(reshape(object,{outer:offsetPath(r.outer,-d),holes:r.holes.map(h=>offsetPath(h,d))}));onNotice(`${object.name} shrunk by ${feetInches(d)}. Review, then Apply.`);})}>Shrink</button>
    <button type="button" onClick={()=>attempt(()=>{const r=areaRegion(object),d=parseContractorLength(offset);create({outer:offsetPath(r.outer,d),holes:[r.outer]},`Band around ${object.name}`);})}>Band around</button>
   </div>
   {beds.length>0&&<div className="dd-designer-row">
    <label>Combine with<select aria-label="Designer area combine with" value={other} onChange={e=>setOther(e.target.value)}><option value="">Choose an area</option>{beds.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    {(['union','difference','intersection'] as const).map(op=><button key={op} type="button" disabled={!other} onClick={()=>attempt(()=>{
     const o=beds.find(b=>b.id===other)!,parts=shapeBoolean(areaRegion(object),areaRegion(o),op);
     if(!parts.length)throw Error(op==='intersection'?'Those areas do not overlap.':'Nothing would be left of this area.');
     if(parts.length>1)throw Error('That would split the area into separate pieces. Draw each piece as its own area.');
     let next=reshape(object,parts[0]);if(op==='union')next={...next,...applyLandscapeEdit(next,o.id,{action:'delete'})};
     onPreview(next);onNotice(`${object.name}: ${areaOf(parts[0]).toFixed(1)} sq ft after ${op==='union'?`adding ${o.name}`:op==='difference'?`cutting out ${o.name}`:`keeping only the overlap with ${o.name}`}. Review, then Apply.`);
    })}>{op==='union'?'Add':op==='difference'?'Subtract':'Intersect'}</button>)}
   </div>}
  </>}
  {draw&&planHost&&createPortal(<ShapeDrawTool frame={frame} mode={draw.mode} closed label={draw.label} snapPoints={snapPoints} panelHost={panelHost} onFinish={finished} onCancel={()=>{setDraw(null);onDrawing(false);onNotice('Drawing cancelled. The design is unchanged.');}}/>,planHost)}
 </section>;
}
