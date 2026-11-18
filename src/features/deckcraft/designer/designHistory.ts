/**
 * Undo and redo for the working design. Pure: the hook keeps one of these and swaps it on each change.
 * Every edit pushes the design as it was; quick edits to the same fields (typing in a number box,
 * dragging a slider) join one step, so one undo takes back the whole change.
 */
export const HISTORY_LIMIT=50;
/** Edits to the same fields closer together than this are one step. */
export const GROUP_MS=500;

export interface DesignHistory<T>{past:T[];future:T[];lastKey:string;lastAt:number}

export const emptyHistory=<T>():DesignHistory<T>=>({past:[],future:[],lastKey:'',lastAt:-Infinity});

/**
 * Records `before`, the design an edit just replaced. `key` names what changed ("edit:width"); a
 * replacement of the whole design (import, start over, an opened link) uses a key that never groups.
 */
export function recordChange<T>(h:DesignHistory<T>,before:T,key:string,now:number):DesignHistory<T>{
  const grouped=key.startsWith('edit:')&&key===h.lastKey&&now-h.lastAt<GROUP_MS&&h.past.length>0;
  if(grouped)return {...h,future:[],lastAt:now};
  const past=[...h.past,before];
  return {past:past.length>HISTORY_LIMIT?past.slice(past.length-HISTORY_LIMIT):past,future:[],lastKey:key,lastAt:now};
}

/** The design to go back to and the history after it, or null when there is nothing to undo. */
export function undoChange<T>(h:DesignHistory<T>,current:T):{design:T;history:DesignHistory<T>}|null{
  if(!h.past.length)return null;
  return {design:h.past[h.past.length-1],history:{past:h.past.slice(0,-1),future:[current,...h.future],lastKey:'',lastAt:-Infinity}};
}

/** The design to go forward to and the history after it, or null when there is nothing to redo. */
export function redoChange<T>(h:DesignHistory<T>,current:T):{design:T;history:DesignHistory<T>}|null{
  if(!h.future.length)return null;
  return {design:h.future[0],history:{past:[...h.past,current],future:h.future.slice(1),lastKey:'',lastAt:-Infinity}};
}

/** The history key for an edit: the fields it changed, so the same control's edits group together. */
export const editKey=(patch:object)=>`${Object.hasOwn(patch,'boardLayout')||Object.hasOwn(patch,'boardColours')||Object.hasOwn(patch,'boundaryLocks')?'apply':'edit'}:${Object.keys(patch).sort().join(',')}`;
