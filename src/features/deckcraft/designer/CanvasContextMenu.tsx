import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanTool} from './constants';
import {emptySelection,type SelectionState} from './selectionState';
import {listPlanComponents,applyComponentEdit} from './componentEditActions';
import {isObjectLocked} from '../editorOrganization';
import {sceneEditTarget} from './sceneEditCommands';
import {revealControl} from './architectKeys';
import './canvasContextMenu.css';
type Pick={partId?:string;board?:{level:number;index:number};hardscape?:SelectionState['hardscape']};
const drawing=(root:Element)=>!!root.querySelector('.dd-shape-draw-surface,.dd-yard-shape-editor[data-drawing=true],.dd-landscape-plan[data-drawing=true],.dd-yard-shape-draw-surface');
function inside(p:{x:number;y:number},poly:{x:number;y:number}[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export default function CanvasContextMenu({data,model,selection,onSelect,onTool,onSection,onBoundary,onApply}:{data:DeckData;model:DeckTakeoff;selection:SelectionState;onSelect:(s:SelectionState)=>void;onTool:(t:PlanTool)=>void;onSection:(s:'deck'|'house'|'stairs'|'boards')=>void;onBoundary:(level:1|2|3)=>void;onApply:(p:Partial<DeckData>)=>void}){
 const anchor=useRef<HTMLSpanElement>(null),menu=useRef<HTMLDivElement>(null),returnTo=useRef<HTMLElement|null>(null);
 const [popup,setPopup]=useState<{x:number;y:number;target:SelectionState}|null>(null),[error,setError]=useState('');
 const parts=useMemo(()=>listPlanComponents(data,model),[data,model]);
 const close=(restore=true)=>{setPopup(null);if(restore)returnTo.current?.focus({preventScroll:true});};
 useEffect(()=>{setPopup(null);},[data]);
 useEffect(()=>{const root=anchor.current?.closest('.dd-preview');if(!root)return;
  const open=(x:number,y:number,target:SelectionState)=>{returnTo.current=root.querySelector<HTMLElement>('.dd-plan-viewport,canvas');onSelect(target);setError('');setPopup({x,y,target});};
  const context=(e:Event)=>{const event=e as MouseEvent,t=event.target as Element;if(!t.closest('.dd-canvas')||t.closest('input,textarea,select,.dd-plan-navigation')||drawing(root)||t.tagName==='CANVAS')return;event.preventDefault();
   let pick:Pick|null=null;const hard=t.closest('[data-context-hardscape]'),part=t.closest('[data-component-id]');
   if(hard)pick={hardscape:JSON.parse(hard.getAttribute('data-context-hardscape')!)};else if(part)pick={partId:part.getAttribute('data-component-id')!};
   else{const svg=root.querySelector<SVGSVGElement>('.dd-plan-stage .dd-site-plan'),matrix=svg?.getScreenCTM();if(svg&&matrix){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());const hit=parts.filter(p=>['stairs','deck','house'].includes(p.kind)).sort((a,b)=>['stairs','deck','house'].indexOf(a.kind)-['stairs','deck','house'].indexOf(b.kind)).find(part=>part.polygon&&inside(p,part.polygon));if(hit)pick={partId:hit.id};}}
   open(event.clientX,event.clientY,pick?{partIds:pick.partId?[pick.partId]:[],boards:pick.board?[pick.board]:[],hardscape:pick.hardscape}:emptySelection());
  };
  const scene=(e:Event)=>{const {x,y,pick}=(e as CustomEvent<{x:number;y:number;pick:Pick|null}>).detail;open(x,y,pick?{partIds:pick.partId?[pick.partId]:[],boards:pick.board?[pick.board]:[],hardscape:pick.hardscape}:emptySelection());};
  const key=(e:Event)=>{const k=e as KeyboardEvent,t=k.target as Element;if(!(k.key==='ContextMenu'||k.key==='F10'&&k.shiftKey)||!t.closest('.dd-canvas')||drawing(root)||t.closest('input,textarea,select'))return;k.preventDefault();const b=t.getBoundingClientRect();open(b.x+b.width/2,b.y+b.height/2,selection);};
  root.addEventListener('contextmenu',context);root.addEventListener('deckcraft-object-context',scene);root.addEventListener('keydown',key);
  return()=>{root.removeEventListener('contextmenu',context);root.removeEventListener('deckcraft-object-context',scene);root.removeEventListener('keydown',key);};
 },[parts,selection,onSelect]);
 useLayoutEffect(()=>{const el=menu.current;if(!popup||!el)return;const b=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(popup.x,innerWidth-b.width-8))+'px';el.style.top=Math.max(8,Math.min(popup.y,innerHeight-b.height-8))+'px';el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});},[popup]);
 useEffect(()=>{if(!popup)return;const outside=(e:Event)=>{if(!menu.current?.contains(e.target as Node))close(false);};const dismiss=()=>close(false);document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',dismiss);window.addEventListener('wheel',dismiss,true);return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',dismiss);window.removeEventListener('wheel',dismiss,true);};},[popup]);
 if(!popup)return <span ref={anchor} hidden/>;
 const s=popup.target,part=parts.find(p=>p.id===s.partIds[0]),hard=s.hardscape,feature=data.yardFeatures?.find(f=>f.id===hard?.id),object=data.landscapeObjects?.find(o=>o.id===hard?.id)??feature??data.pools?.find(p=>p.id===hard?.id),has=!!(part||hard||s.boards.length),locked=isObjectLocked(data.editorOrganization,hard?.id??part?.id??'');
 const properties=()=>{close(false);if(part?.kind==='deck')onSection('deck');else if(part?.kind==='house'||part?.kind==='wall')onSection('house');else if(part?.kind==='stairs')onSection('stairs');else{if(part)onTool('components');requestAnimationFrame(()=>{const dock=anchor.current?.closest('.dd-preview')?.querySelector<HTMLDetailsElement>('.dd-selection-inspector');if(dock){dock.open=true;const expand=[...dock.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Show settings');expand?.click();revealControl(dock.querySelector('summary'));}});}};
 const act=(action:'duplicate'|'remove')=>{if(!part||locked)return;const result=applyComponentEdit(data,model,part.id,{action});if("error" in result){setError(result.error);return;}onApply(result.patch);onSelect({partIds:result.selectedId?[result.selectedId]:[],boards:[]});close();};
 const pointTool:PlanTool|undefined=part?.kind==='deck'?'outline':hard?.kind==='landscape'&&data.landscapeObjects?.find(o=>o.id===hard.id)?.kind==='bed'?'landscape':hard?.kind==='yard'&&!feature?.stoneSteps&&!feature?.stepAssembly?'yard':undefined;
 const root=anchor.current?.closest('.dd-preview'),in3d=!!root?.querySelector('.dd-canvas canvas'),sceneModes=in3d?sceneEditTarget(data,model,s).modes:[];
 return <><span ref={anchor} hidden/>{createPortal(<div ref={menu} className="dd-object-menu" role="menu" aria-label="Object edit menu" style={{left:popup.x,top:popup.y}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{e.stopPropagation();const items=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=items.indexOf(document.activeElement as HTMLButtonElement);if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){close(false);}else{const to=({ArrowDown:(i+1)%items.length,ArrowUp:(i+items.length-1)%items.length,Home:0,End:items.length-1} as Record<string,number>)[e.key];if(to!==undefined){e.preventDefault();items[to]?.focus();}}}}>
  <strong>{part?.label??object?.name??(s.boards.length?'Selected board':'Drawing')}</strong>
  {has&&<button role="menuitem" type="button" onClick={properties}>Properties… <kbd>J</kbd></button>}
  {pointTool&&<button role="menuitem" type="button" disabled={locked} onClick={()=>{if(part?.level)onBoundary(part.level);onTool(pointTool);close();}}>Edit points / shape</button>}
  {part?.kind==='deck'&&<button role="menuitem" type="button" onClick={()=>{close(false);onSection('boards');}}>Materials…</button>}
  {sceneModes.map(mode=>{const label=mode[0].toUpperCase()+mode.slice(1);return <button role="menuitem" type="button" key={mode} disabled={locked} onClick={()=>{[...root?.querySelectorAll<HTMLButtonElement>('.dd-scene-edit-toolbar .dd-area-actions>button')??[]].find(b=>b.textContent===label)?.click();close();}}>{label}</button>;})}
  {part&&['opening','screen'].includes(part.kind)&&<><button role="menuitem" type="button" disabled={locked} onClick={()=>act('duplicate')}>Duplicate</button><button role="menuitem" type="button" disabled={locked} onClick={()=>act('remove')}>Delete</button></>}
  {has&&<button role="menuitem" type="button" onClick={()=>{onSelect(emptySelection());close();}}>Deselect <kbd>N</kbd></button>}
  {!has&&<button role="menuitem" type="button" onClick={()=>{anchor.current?.closest('.dd-preview')?.querySelector<HTMLButtonElement>('[aria-label="Fit drawing"]')?.click();close();}}>{in3d?'Close menu':<>Fit drawing <kbd>Z</kbd></>}</button>}
  {locked&&<small>Locked — unlock in Layers to edit.</small>}{error&&<p role="alert">{error}</p>}
 </div>,document.body)}</>;
}
