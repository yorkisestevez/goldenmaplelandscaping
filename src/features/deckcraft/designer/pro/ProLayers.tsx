import './proWorkspace.css';
import '../../editorOrganizationRuntime';
import {useEffect,useRef,useState} from 'react';
import {Layers} from 'lucide-react';
import {emptyOrganization,validateEditorOrganization,type EditorOrganization} from '../../editorOrganization';
import type {ProPage} from './proTypes';

/** Opens the full layers, groups and precise-edits editor (in Pools & backyard) once that area has loaded. */
function openManager(page:ProPage){
  page.openSection('backyard');
  let tries=0;const look=()=>{
    const details=[...document.querySelectorAll<HTMLDetailsElement>('#dd-pro-properties details.dd-advanced')].find(d=>d.querySelector('summary')?.textContent?.startsWith('Layers'));
    if(details){details.open=true;details.scrollIntoView({block:'nearest'});details.querySelector('summary')?.focus();}else if(++tries<60)requestAnimationFrame(look);
  };requestAnimationFrame(look);
}

/**
 * The Pro workspace's layer control beside the sheet tabs: each layer with Show and Lock (the same validated design
 * organization the plan, 3D view and editors already honour; every change is one undo step), and a way to the full editor.
 */
export default function ProLayers({page}:{page:ProPage}){
  const org=page.data.editorOrganization??emptyOrganization();
  const [open,setOpen]=useState(false),[message,setMessage]=useState(''),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);},[open]);
  const change=(edit:(copy:EditorOrganization)=>void)=>{try{const copy=structuredClone(org);edit(copy);page.apply({editorOrganization:validateEditorOrganization(copy)});setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'This layer change could not be made.');}};
  const hidden=org.layers.filter(l=>!l.visible).length,locked=org.layers.filter(l=>l.locked).length;
  return <div ref={root} className="dd-pro-layers" onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}>
    <button type="button" className="dd-pro-layers-toggle" aria-expanded={open} aria-controls="dd-pro-layers-list" onClick={()=>setOpen(o=>!o)}>
      <Layers size={16}/><span>Layers ({org.layers.length})</span>{(hidden>0||locked>0)&&<small>{[hidden&&`${hidden} hidden`,locked&&`${locked} locked`].filter(Boolean).join(', ')}</small>}
    </button>
    {open&&<div id="dd-pro-layers-list" className="dd-pro-layers-list" role="group" aria-label="Layers">
      <ul>{org.layers.map(l=><li key={l.id}><strong>{l.name}</strong>
        <label><input type="checkbox" checked={l.visible} onChange={e=>change(copy=>{copy.layers.find(x=>x.id===l.id)!.visible=e.target.checked;})}/>Show</label>
        <label><input type="checkbox" checked={l.locked} onChange={e=>change(copy=>{copy.layers.find(x=>x.id===l.id)!.locked=e.target.checked;})}/>Lock</label></li>)}</ul>
      {message&&<p role="alert" className="dd-pro-wizard-error">{message}</p>}
      <button type="button" className="dd-pro-layers-manage" onClick={()=>{setOpen(false);openManager(page);}}>Manage layers &amp; groups…</button>
    </div>}
  </div>;
}
