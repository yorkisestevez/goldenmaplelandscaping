import {edgeKind,normalizeFront,outlineProblems,rectangleFront,snapFt as snap,type OutlineEdgeKind,type OutlinePoint} from './customOutline';

/**
 * Editing a custom outline's front (lib/customOutline.ts): starting shapes, and moves that keep every corner
 * square or 45° on the 6 in grid. Loaded with the outline editor only, never with the page.
 */
/** Starting shapes, sized to the deck. Each is null when the deck is too small for it. */
export const OUTLINE_PRESETS=[
  {id:'rectangle',name:'Rectangle'},{id:'l-right',name:'L, front right cut out'},{id:'l-left',name:'L, front left cut out'},
  {id:'t',name:'T, centre bump-out'},{id:'u',name:'U, centre cut-in'},{id:'bay',name:'Bay front'},{id:'angled',name:'Angled front corners'},
] as const;
export type OutlinePresetId=typeof OUTLINE_PRESETS[number]['id'];
export function outlinePreset(id:OutlinePresetId,widthFt:number,lengthFt:number):OutlinePoint[]|null{
  const W=snap(Math.min(60,Math.max(4,widthFt))),L=snap(Math.min(40,Math.max(3,lengthFt))),third=Math.max(2,snap(W/3)),notch=Math.max(1,snap(L/3)),side=Math.max(3,snap(L*.6));
  const mid=(w:number)=>({xr:snap((W+w)/2),xl:snap((W-w)/2)});
  let front:OutlinePoint[];
  if(id==='rectangle')front=rectangleFront(W,L);
  else if(id==='l-right')front=[{x:W,y:L-notch},{x:W-third,y:L-notch},{x:W-third,y:L},{x:0,y:L}];
  else if(id==='l-left')front=[{x:W,y:L},{x:third,y:L},{x:third,y:L-notch},{x:0,y:L-notch}];
  else if(id==='t'){const {xr,xl}=mid(snap(W/2));front=[{x:W,y:side},{x:xr,y:side},{x:xr,y:L},{x:xl,y:L},{x:xl,y:side},{x:0,y:side}];}
  else if(id==='u'){const {xr,xl}=mid(snap(W/3));front=[{x:W,y:L},{x:xr,y:L},{x:xr,y:side},{x:xl,y:side},{x:xl,y:L},{x:0,y:L}];}
  else if(id==='bay'){const d=snap(L-side),{xr,xl}=mid(snap(Math.max(W/2,2*d+2)));front=[{x:W,y:side},{x:xr,y:side},{x:xr-d,y:L},{x:xl+d,y:L},{x:xl,y:side},{x:0,y:side}];}
  else{const c=Math.max(2,Math.min(4,snap(Math.min(W/4,L/3))));front=[{x:W,y:L-c},{x:W-c,y:L},{x:c,y:L},{x:0,y:L-c}];}
  front=normalizeFront(front);
  return outlineProblems(front).length?null:front;
}

// --- Editing: move an edge along its normal, add a step, angle or square a corner. Each returns a new front
// that follows the rules, or null (the edit is refused and the front is left as it was). ---
type Line={k:'h'|'v'|'d1'|'d2';c:number};// h: y = c; v: x = c; d1: x + y = c; d2: y − x = c
function lineOf(a:OutlinePoint,b:OutlinePoint):Line{
  const kind=edgeKind(a,b);
  if(kind==='across')return {k:'h',c:a.y};
  if(kind==='step')return {k:'v',c:a.x};
  return (b.x-a.x)*(b.y-a.y)<0?{k:'d1',c:a.x+a.y}:{k:'d2',c:a.y-a.x};
}
function meet(p:Line,q:Line):OutlinePoint|null{
  if(p.k===q.k)return null;
  const of=(k:Line['k'])=>p.k===k?p:q.k===k?q:null,h=of('h'),v=of('v'),d1=of('d1'),d2=of('d2');
  if(h&&v)return {x:v.c,y:h.c};
  if(h&&d1)return {x:d1.c-h.c,y:h.c};
  if(h&&d2)return {x:h.c-d2.c,y:h.c};
  if(v&&d1)return {x:v.c,y:d1.c-v.c};
  if(v&&d2)return {x:v.c,y:d2.c+v.c};
  return {x:(d1!.c-d2!.c)/2,y:(d1!.c+d2!.c)/2};
}
const RIGHT=(W:number):Line=>({k:'v',c:W}),LEFT:Line={k:'v',c:0};
/** The lines of the front's edges, with the right and left sides at either end. */
function frontLines(front:OutlinePoint[]):Line[]{return [RIGHT(front[0].x),...front.slice(1).map((p,i)=>lineOf(front[i],p)),LEFT];}
function fromLines(lines:Line[]):OutlinePoint[]|null{
  const pts:OutlinePoint[]=[];
  for(let i=0;i+1<lines.length;i++){const p=meet(lines[i],lines[i+1]);if(!p)return null;pts.push(p);}
  return pts;
}
const accept=(front:OutlinePoint[]|null)=>{if(!front)return null;const n=normalizeFront(front);return outlineProblems(n).length?null:n;};

/** Moves an edge along its normal: a positive `deltaFt` moves an across or 45° edge out toward the yard and a
 * step or the right side to the right. Edge 0 is the right side, 1…n−1 the front edges; the left side stays at 0. */
export function moveEdge(front:OutlinePoint[],edge:number,deltaFt:number):OutlinePoint[]|null{
  const lines=frontLines(front);if(edge<0||edge>=lines.length-1||!deltaFt)return null;
  lines[edge]={k:lines[edge].k,c:lines[edge].c+deltaFt};
  return accept(fromLines(lines));
}
/** Splits front edge `edge` (an across edge) at its middle with a step of `stepFt` toward the yard (or back
 * toward the house when that is the only way that fits). */
export function addStep(front:OutlinePoint[],edge:number,stepFt=1):OutlinePoint[]|null{
  const a=front[edge-1],b=front[edge];if(!a||!b||edgeKind(a,b)!=='across')return null;
  const m=snap((a.x+b.x)/2);
  for(const d of [stepFt,-stepFt]){
    const lines=frontLines(front);
    lines.splice(edge,1,{k:'h',c:a.y},{k:'v',c:m},{k:'h',c:a.y+d});
    const out=accept(fromLines(lines));if(out)return out;
  }
  return null;
}
/** Cuts the corner at front point `point` (between a square edge and a step or side) at 45°, legs `legFt`. */
export function angleCorner(front:OutlinePoint[],point:number,legFt=2):OutlinePoint[]|null{
  const lines=frontLines(front),before=lines[point],after=lines[point+1];
  if(!before||!after||before.k.startsWith('d')||after.k.startsWith('d'))return null;
  const p=front[point],prev=point===0?{x:p.x,y:0}:front[point-1],next=point===front.length-1?{x:0,y:0}:front[point+1];
  const dirIn={x:Math.sign(prev.x-p.x),y:Math.sign(prev.y-p.y)},dirOut={x:Math.sign(next.x-p.x),y:Math.sign(next.y-p.y)};
  const a={x:p.x+dirIn.x*legFt,y:p.y+dirIn.y*legFt},b={x:p.x+dirOut.x*legFt,y:p.y+dirOut.y*legFt};
  return accept([...front.slice(0,point),a,b,...front.slice(point+1)]);
}
/** Squares a 45° front edge back into the corner its neighbours make. */
export function squareCorner(front:OutlinePoint[],edge:number):OutlinePoint[]|null{
  const lines=frontLines(front);if(!lines[edge]||!lines[edge].k.startsWith('d'))return null;
  lines.splice(edge,1);
  return accept(fromLines(lines));
}
/** Removes a step by bringing the edge after it in line with the edge before it. */
export function removeStep(front:OutlinePoint[],edge:number):OutlinePoint[]|null{
  const lines=frontLines(front),s=lines[edge],before=lines[edge-1],after=lines[edge+1];
  if(!s||s.k!=='v'||edge===0||!before||!after||before.k!=='h'||after.k!=='h')return null;
  lines.splice(edge,2);
  return accept(fromLines(lines));
}
/** Every edge of the front with its kind, for the editor: 0 is the right side, then the front edges, then the left side. */
export function frontEdges(front:OutlinePoint[]){
  const W=front[0].x,pts=[{x:W,y:0},...front,{x:0,y:0}];
  return pts.slice(0,-1).map((a,i)=>{const b=pts[i+1];return {index:i,a,b,kind:(i===0||i===pts.length-2?'side':edgeKind(a,b)??'across') as OutlineEdgeKind|'side',lengthFt:Math.round(Math.hypot(b.x-a.x,b.y-a.y)*10)/10};});
}
