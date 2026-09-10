import type {DeckTakeoff} from '../../deckTakeoff';

/** Camera and plan share the full extents, including rotated stairs and landings. */
export function sceneBounds(model:DeckTakeoff){
  const points=model.levels.flatMap(l=>(l.deckingFootprint??l.footprint).outline.map(p=>({x:p.x+l.offset.x,z:p.y+l.offset.z})));
  for(const t of model.treads){
    const a=t.angle||0;
    for(const x of [-t.w/2,t.w/2])for(const z of [-t.d/2,t.d/2])points.push({x:t.x+x*Math.cos(a)+z*Math.sin(a),z:t.z-x*Math.sin(a)+z*Math.cos(a)});
  }
  return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),top:Math.max(...model.levels.map(l=>l.top))};
}
