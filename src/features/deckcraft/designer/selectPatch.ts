import type {DeckData} from '../types';

/**
 * What picking `value` in the select for `key` does to the design: a railing style drops a manufacturer railing, and no
 * border rows is a matching border. Every select in the sections applies this (fields.tsx), and the option deltas
 * (optionDeltas.ts) price exactly this patch.
 */
export const selectPatch=(key:keyof DeckData,value:string|number):Partial<DeckData>=>({[key]:value,...(key==='railingType'?{catalogueRailingId:undefined}:{}),...(key==='pictureFrameRows'&&Number(value)===0?{borderFinish:'Matching' as const}:{})});
