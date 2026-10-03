import type {DeckData} from './types';
/** Explicit undefined clears optional settings, including restoring a legacy undo snapshot. */
export function mergeDesignPatch(data:DeckData,patch:Partial<DeckData>):DeckData{
  const next={...data,...patch};
  for(const [key,value] of Object.entries(patch))if(value===undefined)delete (next as unknown as Record<string,unknown>)[key];
  return next;
}
