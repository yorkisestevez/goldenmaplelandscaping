import {lazy,Suspense,useEffect,type ComponentProps} from 'react';
import {setDesignerMode,useDesignerMode} from './designerMode';
const DesignerAreaPanel=lazy(()=>import('./DesignerAreaPanel'));

/** The landscape editor's designer switch. The tools themselves load only once designer mode is on. */
export default function DesignerAreaHost(props:ComponentProps<typeof DesignerAreaPanel>){
 const designer=useDesignerMode(),{onDrawing}=props;
 useEffect(()=>{if(!designer)onDrawing(false);},[designer,onDrawing]);
 return <>
  <label className="dd-designer-toggle"><input type="checkbox" checked={designer} onChange={e=>setDesignerMode(e.target.checked)}/> Designer tools</label>
  {designer&&<Suspense fallback={<p>Loading designer tools…</p>}><DesignerAreaPanel {...props}/></Suspense>}
 </>;
}
