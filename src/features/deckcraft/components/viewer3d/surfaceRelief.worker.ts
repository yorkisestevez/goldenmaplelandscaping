import {buildSurfaceDetail,type DetailKind} from './detailMaps';

/**
 * The surface relief worker: builds the 2K paver, slab, cap, stone, deck and siding relief off the main thread, so
 * opening the 3D view does not stall for seconds while it is generated. The maps come back transferred, not copied.
 */
export interface ReliefRequest{kind:DetailKind;size:number}
export interface ReliefResult{kind:DetailKind;size:number;normal:Uint8Array|null;roughness:Uint8Array|null}
const scope=self as unknown as {postMessage:(result:ReliefResult,transfer:Transferable[])=>void;addEventListener:(type:'message',listener:(event:MessageEvent<ReliefRequest>)=>void)=>void};
scope.addEventListener('message',({data:{kind,size}})=>{
  try{const detail=buildSurfaceDetail(kind,size);scope.postMessage({kind,size,normal:detail.normal,roughness:detail.roughness},[detail.normal.buffer,detail.roughness.buffer]);}
  catch{scope.postMessage({kind,size,normal:null,roughness:null},[]);}
});
