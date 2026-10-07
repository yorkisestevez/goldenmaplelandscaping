import type {BoundaryEdgeLock,DeckData} from '../types';

/** Saved boundary edge locks, validated whenever a design is loaded or updated. The editing helpers (dimensions,
 * reconciliation, contractor lengths) are in boundaryDimensions.ts, which loads only with the plan editors. */
const TOL=1e-6;
const key=(level:1|2|3)=>level===1?'main':level===2?'second':'third';
function strict(value:unknown,keys:string[],array=false):void {
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)&&!( !array&&Object.getPrototypeOf(value)===null)||Array.isArray(value)!==array||Object.getOwnPropertySymbols(value).length)throw new Error('Boundary locks must contain plain data only.');
  for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(value)))if(!keys.includes(k)||!('value' in d)||k!=='length'&&!d.enumerable)throw new Error(`Unknown or unsafe boundary lock field: ${k}.`);
}
/** A lock is an exact directed edge vector on a saved editable outline, never an inferred constraint. */
export function validateBoundaryLocks(input:unknown,data:DeckData):BoundaryEdgeLock[]{
  if(!Array.isArray(input)||input.length>192)throw new Error('Keep no more than 192 saved edge locks.');
  strict(input,['length',...Array.from({length:input.length},(_,i)=>String(i))],true);
  const used=new Set<string>();
  return Array.from({length:input.length},(_,i)=>{
    if(!Object.hasOwn(input,i))throw new Error('Boundary locks cannot have missing items.');
    const value=input[i];strict(value,['level','edge','dxIn','dyIn']);const lock=value as BoundaryEdgeLock;
    if(![1,2,3].includes(lock.level)||!Number.isInteger(lock.edge)||!Number.isFinite(lock.dxIn)||!Number.isFinite(lock.dyIn))throw new Error('A boundary lock needs a valid level, edge and finite inch vector.');
    if(lock.level>data.levels||lock.level===3&&!data.level3)throw new Error(`Level ${lock.level} is not active. Unlock its edges before removing the level.`);
    const points=data.deckOutlines?.[key(lock.level)],id=`${lock.level}:${lock.edge}`;
    if(!points||points.length<3)throw new Error(`Save level ${lock.level}'s editable outline before locking an edge.`);
    if(lock.edge<0||lock.edge>=points.length||used.has(id))throw new Error('Choose an existing edge once per level.');used.add(id);
    const a=points[lock.edge],b=points[(lock.edge+1)%points.length],dx=(b.x-a.x)*12,dy=(b.y-a.y)*12;
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<=TOL||Math.hypot(lock.dxIn,lock.dyIn)<=TOL||Math.abs(lock.dxIn-dx)>TOL||Math.abs(lock.dyIn-dy)>TOL)throw new Error(`Level ${lock.level}, edge ${lock.edge+1}: the saved lock must match this edge's length and direction.`);
    return {level:lock.level,edge:lock.edge,dxIn:lock.dxIn,dyIn:lock.dyIn};
  });
}
