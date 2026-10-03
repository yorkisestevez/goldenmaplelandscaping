/** Board level is a zero-based model.levels index, matching the board-edit API. */
export interface HardscapeSelection {kind:'yard'|'pool'|'landscape';id:string;part?:string;flightId?:string;row?:number}
export interface SelectionState {partIds:string[];boards:{level:number;index:number}[];hardscape?:HardscapeSelection;objectIds?:string[]}
export const emptySelection=():SelectionState=>({partIds:[],boards:[]});
export const boardSelectionKey=(b:{level:number;index:number})=>`${b.level}:${b.index}`;
