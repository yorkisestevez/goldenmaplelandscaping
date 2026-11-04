import './layerList.css';
import '../editorOrganizationRuntime';
import {useRef,useState} from 'react';
import {emptyOrganization,validateEditorOrganization,type EditorOrganization} from '../editorOrganization';
import type {DeckData} from '../types';

interface Props{data:DeckData;apply:(patch:Partial<DeckData>)=>void;
  /** Opens Pools & backyard, where the full layers editor lives. */
  openBackyard:()=>void;
  /** Runs before the full editor opens (the caller puts its menu or pop-over away). */
  onManage?:()=>void;
  /** Says when Show and Lock would change nothing (the homeowner menu; Pro's pop-over stays as it was). */
  explain?:boolean}

// Pools & backyard and its editors load in a few chunks; a phone on mobile data can take seconds.
const MANAGER_WAIT_MS=10_000;

/** Opens the full layers, groups and precise-edits editor (in Pools & backyard) once that area has loaded. */
function openManager(openBackyard:()=>void){
  openBackyard();
  const look=()=>{
    const details=[...document.querySelectorAll<HTMLDetailsElement>('details.dd-advanced')].find(d=>d.querySelector('summary')?.textContent?.startsWith('Layers, groups'));
    if(!details)return false;
    details.open=true;details.scrollIntoView({block:'nearest'});details.querySelector('summary')?.focus();return true;
  };
  setTimeout(()=>{
    if(look())return;
    const watch=new MutationObserver(()=>{if(look())stop();}),timer=setTimeout(()=>stop(),MANAGER_WAIT_MS),stop=()=>{watch.disconnect();clearTimeout(timer);};
    watch.observe(document.body,{childList:true,subtree:true});
  });
}

/** How many layers are hidden and locked, for the control that folds the list away. */
export function layerSummary(org:EditorOrganization){
  const hidden=org.layers.filter(l=>!l.visible).length,locked=org.layers.filter(l=>l.locked).length;
  return [hidden&&`${hidden} hidden`,locked&&`${locked} locked`].filter(Boolean).join(', ');
}

/**
 * Each layer with Show and Lock: the same validated design organization the plan, 3D view and editors already honour,
 * every change one undo step, and a way to the full editor. Pro's Layers control and the homeowner file menu share it.
 */
export function LayerList({data,apply,openBackyard,onManage,explain}:Props){
  const org=data.editorOrganization??emptyOrganization(),[message,setMessage]=useState('');
  const change=(edit:(copy:EditorOrganization)=>void)=>{try{const copy=structuredClone(org);edit(copy);apply({editorOrganization:validateEditorOrganization(copy)});setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'This layer change could not be made.');}};
  return <>
    <ul>{org.layers.map(l=><li key={l.id}><strong>{l.name}</strong>
      <label><input type="checkbox" checked={l.visible} onChange={e=>change(copy=>{copy.layers.find(x=>x.id===l.id)!.visible=e.target.checked;})}/>Show</label>
      <label><input type="checkbox" checked={l.locked} onChange={e=>change(copy=>{copy.layers.find(x=>x.id===l.id)!.locked=e.target.checked;})}/>Lock</label></li>)}</ul>
    {explain&&!org.objects.length&&<p className="dd-layers-empty">Nothing is on a layer yet, so Show and Lock change nothing. Put objects on layers in Manage layers &amp; groups.</p>}
    {message&&<p role="alert" className="dd-layers-error">{message}</p>}
    <button type="button" className="dd-layers-manage" onClick={()=>{onManage?.();openManager(openBackyard);}}>Manage layers &amp; groups…</button>
  </>;
}

/** The homeowner file menu's Layers fold. The full editor puts the menu away, leaving the focus on its opener until the editor takes it. */
export default function LayerMenu(props:Props){
  const org=props.data.editorOrganization??emptyOrganization(),summary=layerSummary(org),self=useRef<HTMLDetailsElement>(null);
  return <details ref={self} className="dd-layer-menu"><summary>Layers ({org.layers.length}){summary&&<small> · {summary}</small>}</summary>
    <div className="dd-layer-list" role="group" aria-label="Layers"><LayerList {...props} explain onManage={()=>{const menu=self.current?.closest('details.dd-workspace-files');menu?.removeAttribute('open');menu?.querySelector('summary')?.focus();}}/></div>
  </details>;
}
