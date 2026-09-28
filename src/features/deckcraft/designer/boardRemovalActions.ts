import type {DeckData,BoardLayoutRegion} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {BOARD_LAYOUT_LIMITS,validateBoardLayout} from '../boardLayout';
import {emptyBoardLayout,selectableBoards} from './boardLayoutActions';

/** Targets belong to one current model revision. A saved breaker is one addition even if rendered
 * as several stock pieces. Generated picture-frame stock is replaced only in its exact cut silhouette. */
export function deleteSelectedBoards(data:DeckData,model:DeckTakeoff,targets:{level:number;index:number}[],nextId:()=>string){
  if(!targets.length||targets.length>64)throw new Error('Select 1–64 added boards or picture-frame boards.');
  const all=selectableBoards(data,model),layout=data.boardLayout??emptyBoardLayout();
  const removeIds=new Set<string>(),stock=new Set<string>(),replacements:BoardLayoutRegion[]=[];
  let frameBoards=0;
  for(const target of targets){
    const selected=all.find(b=>b.modelLevel===target.level&&b.index===target.index);
    if(!selected)throw new Error('That board has changed. Select it again.');
    const run=selected.run;
    if(run.layoutId&&run.layoutKind){
      if(![...layout.regions,...layout.breakers,...layout.pieces].some(p=>p.id===run.layoutId))throw new Error('That saved addition is no longer present.');
      removeIds.add(run.layoutId);continue;
    }
    if(run.role!=='border')throw new Error('Only added layouts and picture-frame boards can be deleted. Field boards and required stock joints stay in the deck.');
    const key=`${selected.modelLevel}:${run.layoutStockId??selected.index}`;if(stock.has(key))continue;stock.add(key);frameBoards++;
    const pieces=run.layoutStockId?all.filter(b=>b.modelLevel===selected.modelLevel&&b.run.layoutStockId===run.layoutStockId&&!b.run.layoutId):[selected];
    const field=all.filter(b=>b.modelLevel===selected.modelLevel&&(b.run.role??'field')==='field'&&!b.run.layoutId).sort((a,b)=>Math.hypot(a.run.cx-run.cx,a.run.cy-run.cy)-Math.hypot(b.run.cx-run.cx,b.run.cy-run.cy))[0];
    const angleDeg=field?.run.angleDeg??(data.pattern==='Diagonal'||data.pattern==='Herringbone'?45:0);
    for(const piece of pieces)replacements.push({id:nextId(),level:selected.level,polygon:piece.polygon.map(p=>({...p})),angleDeg,replaceBorder:true});
  }
  const remaining=layout.regions.filter(r=>!removeIds.has(r.id));
  if(remaining.length+replacements.length>BOARD_LAYOUT_LIMITS.regions)throw new Error('Too many custom areas. Remove an unused saved layout before deleting another frame board.');
  const candidate={regions:[...remaining,...replacements],breakers:layout.breakers.filter(b=>!removeIds.has(b.id)),pieces:layout.pieces.filter(p=>!removeIds.has(p.id))};
  const boardLayout=validateBoardLayout(candidate,data.boardWidth);
  const message=[removeIds.size?`${removeIds.size} saved addition${removeIds.size===1?'':'s'} removed; underlying decking restored.`:'',frameBoards?`${frameBoards} picture-frame board${frameBoards===1?'':'s'} replaced with field decking in the selected cut area. Other frame boards are kept.`:''].filter(Boolean).join(' ');
  return {patch:{boardLayout} as Partial<DeckData>,message,removedIds:[...removeIds],frameBoards};
}
