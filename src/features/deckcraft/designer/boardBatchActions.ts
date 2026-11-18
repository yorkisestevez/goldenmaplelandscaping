import type {DeckData,ColourRef} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {validateDesign} from '../designPersistence';
import {editSelectedBoard,selectableBoards} from './boardLayoutActions';
/** Freeze targets against the original model: a preceding edit must never shift a later board index. */
export function editBoardBatch(data:DeckData,model:DeckTakeoff,targets:{level:number;index:number}[],edit:{angleDeg?:number;colour?:ColourRef},id:()=>string):Partial<DeckData>{
 if(!targets.length)throw new Error('Select at least one board.');
 if(edit.angleDeg===undefined&&edit.colour===undefined)throw new Error('Choose a direction or colour.');
 if(edit.angleDeg!==undefined&&(!Number.isFinite(edit.angleDeg)||edit.angleDeg<-360||edit.angleDeg>360))throw new Error('Board direction must be between -360 and 360 degrees.');
 const all=selectableBoards(data,model),seen=new Set<string>(),selected=targets.map(t=>{const b=all.find(b=>b.modelLevel===t.level&&b.index===t.index);if(!b)throw new Error('A selected board is no longer present. Select it again.');return b;});
 let candidate=data;const patch:Partial<DeckData>={};
 for(const b of selected){const key=b.run.layoutKind==='piece'&&b.run.layoutId?`piece:${b.run.layoutId}`:`${b.modelLevel}:${b.index}`;if(seen.has(key))continue;seen.add(key);
  const nextId=id();if(candidate.boardLayout?.pieces.some(p=>p.id===nextId)&&b.run.layoutId!==nextId)throw new Error('A new board ID is already used by another saved piece. Choose a new batch ID.');
  const change=editSelectedBoard(candidate,model,{modelLevel:b.modelLevel,index:b.index},edit.angleDeg??b.run.layoutSource?.angleDeg??b.run.angleDeg,edit.colour??b.colour,nextId);Object.assign(patch,change);candidate={...candidate,...change};
 }
 const normalized=validateDesign(candidate);for(const key of Object.keys(patch) as (keyof DeckData)[])(patch as Record<string,unknown>)[key]=normalized[key];
 return patch;
}
export function editSelectedBoards(data:DeckData,model:DeckTakeoff,targets:{modelLevel:number;index:number}[],edit:{angleDeg?:number;colour?:ColourRef},idPrefix:string):Partial<DeckData>{let n=0;return editBoardBatch(data,model,targets.map(t=>({level:t.modelLevel,index:t.index})),edit,()=>`${idPrefix}-${++n}`);}
