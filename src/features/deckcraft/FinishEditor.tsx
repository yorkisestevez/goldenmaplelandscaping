import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import SkirtingEditor from './SkirtingEditor';
import DrySpaceEditor from './DrySpaceEditor';
import BoardFinishEditor from './BoardFinishEditor';
export type FinishTab='skirting'|'boards'|'dryspace';
export default function FinishEditor({data,model,onChange,tab,onTab,selectedBoardId,onSelectBoard}:{data:DeckData;model:DeckTakeoff;onChange:(p:Partial<DeckData>)=>void;tab:FinishTab;onTab:(t:FinishTab)=>void;selectedBoardId?:string;onSelectBoard:(id:string)=>void}){
 return <section aria-label="Skirting, board colours and dry space"><div className="dd-component-tabs" role="group" aria-label="Finish editing category">{([['skirting','Skirting & framing'],['boards','Individual board colours'],['dryspace','Under-deck dry space']] as const).map(([id,label])=><button className="dd-secondary" key={id} aria-pressed={tab===id} onClick={()=>onTab(id)}>{label}</button>)}</div>
 {tab==='skirting'?<SkirtingEditor data={data} model={model} onChange={onChange}/>:tab==='boards'?<BoardFinishEditor data={data} model={model} onChange={onChange} selectedBoardId={selectedBoardId} onSelectBoard={onSelectBoard}/>:<DrySpaceEditor data={data} model={model} onChange={onChange}/>}
 </section>;
}
