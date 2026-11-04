import './proWorkspace.css';
import {useEffect,useRef,useState} from 'react';
import {Layers} from 'lucide-react';
import {emptyOrganization} from '../../editorOrganization';
import {LayerList,layerSummary} from '../LayerList';
import type {ProPage} from './proTypes';

/** The Pro workspace's layer control beside the sheet tabs: the shared layer list (LayerList.tsx) in a pop-over. */
export default function ProLayers({page}:{page:ProPage}){
  const org=page.data.editorOrganization??emptyOrganization(),summary=layerSummary(org);
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return ()=>document.removeEventListener('pointerdown',close);},[open]);
  return <div ref={root} className="dd-pro-layers" onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}>
    <button type="button" className="dd-pro-layers-toggle" aria-expanded={open} aria-controls="dd-pro-layers-list" onClick={()=>setOpen(o=>!o)}>
      <Layers size={16}/><span>Layers ({org.layers.length})</span>{summary&&<small>{summary}</small>}
    </button>
    {open&&<div id="dd-pro-layers-list" className="dd-pro-layers-list" role="group" aria-label="Layers">
      <LayerList data={page.data} apply={page.apply} openBackyard={()=>page.openSection('backyard')} onManage={()=>setOpen(false)}/>
    </div>}
  </div>;
}
