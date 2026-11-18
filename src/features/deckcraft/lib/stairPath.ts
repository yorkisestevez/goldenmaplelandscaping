import type {DeckData} from '../types';
import {edgeFacing,type EdgeContact,type FootprintPlan,type PlanPoint,type StairPlacement} from './deckGeometry';

/** Saved points are local inches on the lowest deck's perimeter, never percentages on a replacement edge. */
export function validateStairPath(value:unknown):NonNullable<DeckData['stairPath']>{
  const plain=(v:unknown,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&!Object.getOwnPropertySymbols(v).length&&Object.entries(Object.getOwnPropertyDescriptors(v)).every(([k,d])=>keys.includes(k)&&'value'in d&&d.enumerable);
  if(!plain(value,['points']))throw new Error('Invalid stair edge path.');
  const p=(value as {points?:unknown}).points;
  if(!Array.isArray(p)||p.length<2||p.length>9)throw new Error('A stair edge path needs 2–9 points.');
  if(Object.getPrototypeOf(p)!==Array.prototype||Object.getOwnPropertySymbols(p).length||Object.entries(Object.getOwnPropertyDescriptors(p)).some(([k,d])=>k!=='length'&&(!/^\d+$/.test(k)||Number(k)>=p.length||!('value'in d)||!d.enumerable))||Array.from({length:p.length},(_,i)=>!Object.hasOwn(p,i)).some(Boolean))throw new Error('Use a plain list of stair path points.');
  return {points:p.map(v=>{if(!plain(v,['x','y']))throw new Error('Invalid stair path point.');const {x,y}=v as PlanPoint;if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1440||Math.abs(y)>1440)throw new Error('Stair path points must be local inches within the deck drawing.');return {x,y};})};
}
export function resolveStairPath(data:Pick<DeckData,'stairPath'>,fp:FootprintPlan,contact?:EdgeContact,occupied:StairPlacement[]=[]):{segments:StairPlacement[];issues:string[]}{
  const fail=(s:string)=>({segments:[],issues:[s]});
  let points:PlanPoint[];try{points=validateStairPath(data.stairPath).points;}catch(e){return fail((e as Error).message);}
  const edges=fp.outline.map((a,i)=>{const b=fp.outline[(i+1)%fp.outline.length],w=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/w,y:(b.y-a.y)/w};return {a,b,w,u,i};});
  const on=(p:PlanPoint,e:typeof edges[number])=>{const x=p.x-e.a.x,y=p.y-e.a.y,t=x*e.u.x+y*e.u.y;return Math.abs(x*e.u.y-y*e.u.x)<.05&&t>=-.05&&t<=e.w+.05;};
  const segments:StairPlacement[]=[];
  for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],width=Math.hypot(b.x-a.x,b.y-a.y),edge=edges.find(e=>on(a,e)&&on(b,e));
    if(!edge)return fail('Stair path no longer follows the deck perimeter. Saved position preserved; redraw it.');
    if(width<36||width>720)return fail('Each stair path section must be 36–720 inches wide.');
    if(contact?.isContactEdge(edge.i))return fail('Stairs cannot start through a house wall.');
    const along={x:(b.x-a.x)/width,y:(b.y-a.y)/width},outward={x:edge.u.y,y:-edge.u.x};
    if(occupied.some(o=>{if(o.edgeIndex!==edge.i)return false;const t=(o.origin.x-a.x)*along.x+(o.origin.y-a.y)*along.y,end=t+(o.along.x*along.x+o.along.y*along.y)*o.width;return Math.min(t,end)<width-.05&&Math.max(t,end)>.05;}))return fail('Stair path crosses a level connection. Choose a clear edge.');
    if(segments.some(s=>s.edgeIndex===edge.i))return fail('The stair path doubles back on an edge.');
    if(i){const prev=segments[i-1],cross=prev.along.x*along.y-prev.along.y*along.x,turn=(prev.along.x*prev.outward.y-prev.along.y*prev.outward.x)*cross;
      if(Math.abs(cross)<.05||turn>=-.05)return fail('Stair wraps must follow outside corners. Recessed corners need a reviewed detail.');

    }
    segments.push({origin:{...a},along,outward,width,edge:edgeFacing(outward),edgeIndex:edge.i});
  }
  return {segments,issues:[]};
}
/** Adjacent offset lines share one mitre vertex, so corner boards have neither a hole nor overlapping rectangles. */
export function stairPathOffset(segments:StairPlacement[],distance:number):PlanPoint[]{
  const at=(s:StairPlacement,t:number)=>({x:s.origin.x+s.along.x*t+s.outward.x*distance,y:s.origin.y+s.along.y*t+s.outward.y*distance});
  if(!segments.length)return [];
  const points=[at(segments[0],0)];
  for(let i=1;i<segments.length;i++){const a=segments[i-1],b=segments[i],p=at(a,a.width),q=at(b,0),cross=a.along.x*b.along.y-a.along.y*b.along.x,t=((q.x-p.x)*b.along.y-(q.y-p.y)*b.along.x)/cross;points.push({x:p.x+a.along.x*t,y:p.y+a.along.y*t});}
  points.push(at(segments[segments.length-1],segments[segments.length-1].width));return points;
}
