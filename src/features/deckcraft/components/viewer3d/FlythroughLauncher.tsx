import {Suspense,lazy,useState} from 'react';
import type {DeckData} from '../../types';
import {armFlythrough} from './flythroughState';

const FlythroughTools=lazy(()=>import('./FlythroughTools'));

/** The Fly-through panel. Its tools, and the recorder with its video encoder, load the first time it is opened;
 * after that they stay mounted so keyframes survive closing and reopening the panel. */
export default function FlythroughLauncher({data}:{data:DeckData}){
 const [opened,setOpened]=useState(false);
 return <details className="py-2 text-xs" onToggle={event=>{if(event.currentTarget.open&&!opened){setOpened(true);armFlythrough();}}}>
  <summary>Fly-through</summary>
  {opened&&<Suspense fallback={<p role="status">Loading fly-through tools…</p>}><FlythroughTools data={data}/></Suspense>}
 </details>;
}
