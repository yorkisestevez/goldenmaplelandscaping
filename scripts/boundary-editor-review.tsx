import {useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import ConstructionPlan,{planFrame} from '../src/features/deckcraft/ConstructionPlan';
import PlanBoundaryEditor from '../src/features/deckcraft/designer/PlanBoundaryEditor';
import {editableBoundaries} from '../src/features/deckcraft/designer/boundaryEditMath';
import type {DeckData} from '../src/features/deckcraft/types';
declare global {interface Window{boundaryReview:{data:DeckData;boundaries:ReturnType<typeof editableBoundaries>;frame:ReturnType<typeof planFrame>;updates:number;history:Partial<DeckData>[]}}}
function App(){
  const [data,setData]=useState<DeckData>({...structuredClone(DEFAULT_DECK),height:108,levels:3,width2:8,length2:8,height2:84,level3:{widthFt:6,lengthFt:6,heightIn:60,parent:2,position:'Front',offsetPct:50}}),history=useRef<Partial<DeckData>[]>([]),toolbar=useRef<HTMLDivElement>(null);
  const model=useMemo(()=>buildDeckTakeoff(data),[data]);
  window.boundaryReview={data,boundaries:editableBoundaries(data,model),frame:planFrame(model,{data,variant:'site'}),updates:history.current.length,history:history.current};
  return <main><h1>Shape the deck</h1><p>Drag a point, edge or whole area in any direction.</p><div id="boundary-drawing"><ConstructionPlan data={data} model={model} variant="site"/><PlanBoundaryEditor data={data} model={model} toolbar={toolbar} update={patch=>{history.current.push(structuredClone(patch));setData(d=>({...d,...patch}));}}/></div><div id="boundary-toolbar" ref={toolbar}/><div id="boundary-count">{history.current.length} committed edits</div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
