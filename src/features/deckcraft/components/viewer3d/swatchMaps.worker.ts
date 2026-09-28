import {buildSwatchMaps,type SwatchImage,type SwatchMaps} from './swatchMaps';

/**
 * The board atlases' worker (Real Life G2): turns a swatch photo into its atlas off the main thread, so opening the 3D
 * view or picking a colour never holds up the page. The atlas's pixels come back transferred, not copied.
 */
export interface SwatchRequest{id:number;image:SwatchImage;kind:'composite'|'wood'}
export interface SwatchResult{id:number;maps:SwatchMaps|null}
const scope=self as unknown as {postMessage:(result:SwatchResult,transfer:Transferable[])=>void;addEventListener:(type:'message',listener:(event:MessageEvent<SwatchRequest>)=>void)=>void};
scope.addEventListener('message',async({data:{id,image,kind}})=>{
  try{const maps=await buildSwatchMaps(image,kind);scope.postMessage({id,maps},[maps.albedo.buffer,maps.normal.buffer,maps.roughness.buffer]);}
  catch{scope.postMessage({id,maps:null},[]);}
});
