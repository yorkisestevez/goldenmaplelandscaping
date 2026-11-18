import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {stairPathOffset} from './lib/stairPath';
import {stairTargetId} from './stairTargets';
/** Full bottom landing band in world plan inches; wrapped edges share exact mitres. */
export function stairLandingPolygons(model:DeckTakeoff,id:string,depth=36):PlanPoint[][] {
 const flights=model.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===id),bottom=Math.min(...flights.map(f=>f.end.y)),terminal=flights.filter(f=>Math.abs(f.end.y-bottom)<1e-5);
 if(id==='grade-path'&&terminal.every(f=>f.terminationEdge&&f.along&&f.outward)){const segments=terminal.map(f=>({origin:f.terminationEdge!.a,along:f.along!,outward:f.outward!,width:f.endWidth!,edge:'Front' as const})),far=stairPathOffset(segments,depth);return terminal.map((f,i)=>[f.terminationEdge!.a,f.terminationEdge!.b,far[i+1],far[i]]);}
 return terminal.map(f=>{const outward=f.outward??{x:(f.end.x-f.start.x)/(Math.hypot(f.end.x-f.start.x,f.end.z-f.start.z)||1),y:(f.end.z-f.start.z)/(Math.hypot(f.end.x-f.start.x,f.end.z-f.start.z)||1)},along=f.along??{x:outward.y,y:-outward.x},width=f.endWidth??f.width,at=(u:number,v:number)=>({x:f.end.x+along.x*u+outward.x*v,y:f.end.z+along.y*u+outward.y*v});return [at(-width/2,0),at(width/2,0),at(width/2,depth),at(-width/2,depth)];});
}
