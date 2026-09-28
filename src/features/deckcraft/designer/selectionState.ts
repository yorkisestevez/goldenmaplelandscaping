/** Board level is a zero-based model.levels index, matching the board-edit API. */
export interface SelectionState {partIds:string[];boards:{level:number;index:number}[]}
export const emptySelection=():SelectionState=>({partIds:[],boards:[]});
export const boardSelectionKey=(b:{level:number;index:number})=>`${b.level}:${b.index}`;
