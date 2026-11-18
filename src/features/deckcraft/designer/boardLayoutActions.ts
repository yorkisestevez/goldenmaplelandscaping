import {accentAllowed,boardFinishPlan,deckColourRef} from '../boardFinishes';
import {paintBoard} from '../boardPaint';
import {boardLayoutPieceSource} from '../boardLayout';
import type {DeckTakeoff} from '../deckTakeoff';
import {deckLevelNumber} from '../lib/boardAddress';
import {boardOutline} from '../lib/polygonCuts';
import type {DeckData,BoardLayoutPiece,ColourRef} from '../types';

/** Model indices are used only against a revision-guarded snapshot, never saved as board identities. */
export function selectableBoards(data:DeckData,model:DeckTakeoff){
  const finishes=boardFinishPlan(data,model);
  return model.levels.flatMap((level,modelLevel)=>{
    const lv=deckLevelNumber(level);if(!lv)return [];
    return level.boards.map((run,index)=>({level:lv,modelLevel,index,run,polygon:boardOutline(run,data.boardWidth),
      colour:finishes.colours[modelLevel]?.[index]??deckColourRef(data),offset:{x:level.offset.x,y:level.offset.z},address:finishes.addresses[modelLevel]?.[index]??null}));
  });
}
export type SelectableBoard=ReturnType<typeof selectableBoards>[number];
export const emptyBoardLayout=()=>({regions:[],breakers:[],pieces:[]}) as NonNullable<DeckData['boardLayout']>;
export const layoutId=()=>`layout-${crypto.randomUUID()}`;
/** A single selected board is rotated as physical stock, with its original cut silhouette retained. */
export function editSelectedBoard(data:DeckData,model:DeckTakeoff,target:{modelLevel:number;index:number},angleDeg:number,colour:ColourRef,id:string):Partial<DeckData>{
  const selected=selectableBoards(data,model).find(b=>b.modelLevel===target.modelLevel&&b.index===target.index);
  if(!selected)throw new Error('That board is no longer present. Select it again.');
  const run=selected.run,layout=data.boardLayout??emptyBoardLayout(),existing=run.layoutKind==='piece'?layout.pieces.find(p=>p.id===run.layoutId):undefined;
  // Ordinary colour-only edits preserve their exact mitres and the established colour-address workflow.
  if(!run.layoutId&&Math.abs(angleDeg-run.angleDeg)<1e-7&&selected.address&&accentAllowed(data,colour)){
    const result=paintBoard(data,model,{level:target.modelLevel,index:target.index},colour,'piece');
    if(result.error)throw new Error(result.error);return {boardColours:result.boardColours};
  }
  const source=existing??boardLayoutPieceSource(run,data.boardWidth);
  const piece:BoardLayoutPiece={...source,id:existing?.id??id,level:selected.level,angleDeg,colour};
  return {boardLayout:{...layout,pieces:existing?layout.pieces.map(p=>p.id===existing.id?piece:p):[...layout.pieces,piece]}};
}
