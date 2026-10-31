import type {DeckData} from '../../types';
import {landscapePlacement} from '../../landscapeModel';

/** Night stills: a warm 2700 K pergola-style downlight over each outdoor kitchen island, angled so the second also washes the cook face, so the
 * veneer and counter read at night instead of relying on the under-counter LED strip alone. Loaded only at night with an island in the design,
 * so the viewer chunk stays within its budget. */
export default function KitchenDownlights({data}:{data:DeckData}){
 const islands=(data.landscapeObjects??[]).filter(o=>o.enabled&&o.assetId==='kitchen-island');
 return <group name="kitchen-downlights">{islands.map(o=>{let y=0;try{y=landscapePlacement(data,o).y;}catch{/* runtime not loaded yet */}
  return <group key={o.id}><pointLight position={[o.xIn/12,y+7.5,o.zIn/12-1.2]} color="#ffcf98" intensity={14} distance={16} decay={2}/><pointLight position={[o.xIn/12,y+7.5,o.zIn/12+4]} color="#ffcf98" intensity={12} distance={14} decay={2}/><pointLight position={[o.xIn/12,y+1.6,o.zIn/12+4.5]} color="#ffd6a8" intensity={4} distance={8} decay={2}/><pointLight position={[o.xIn/12,y+1.6,o.zIn/12-4.5]} color="#ffd6a8" intensity={4} distance={8} decay={2}/></group>;})}</group>;
}
