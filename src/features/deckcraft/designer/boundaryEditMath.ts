import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanPoint} from '../lib/deckGeometry';
import {boundaryBounds,boundaryKey,boundaryProblem,savedBoundary,type BoundaryLevel} from '../lib/freeOutline';
import {getHouseConfig} from '../houseSettings';
import {getHousePlacement} from '../housePlacement';
import {reconcileBoundaryLocks} from './boundaryDimensions';
export {boundaryProblem};
export interface Boundary {level:BoundaryLevel;name:string;points:PlanPoint[];offset:{x:number;y:number}}
export function editableBoundaries(data:DeckData,model:DeckTakeoff):Boundary[]{
  return model.levels.flatMap(l=>{
    if(l.kind!=='deck'||l.index===undefined||l.index>2)return [];
    const level=(l.index+1) as BoundaryLevel,saved=data.deckOutlines?.[boundaryKey(level)];
    return [{level,name:level===1?'Main deck':`Level ${level}`,points:saved?saved.map(p=>({x:p.x*12,y:p.y*12})):l.footprint.outline.map(p=>({...p})),offset:{x:l.offset.x,y:l.offset.z}}];
  });
}
export function moveBoundary(points:PlanPoint[],kind:'point'|'edge'|'area',index:number,dxIn:number,dyIn:number):PlanPoint[]{
  return points.map((p,i)=>kind==='area'||i===index||kind==='edge'&&i===(index+1)%points.length?{x:p.x+dxIn,y:p.y+dyIn}:{...p});
}
export function insertBoundaryPoint(points:PlanPoint[],index:number):PlanPoint[]{
  const a=points[index],b=points[(index+1)%points.length];return [...points.slice(0,index+1),{x:(a.x+b.x)/2,y:(a.y+b.y)/2},...points.slice(index+1)].map(p=>({...p}));
}
/** Project a tap onto a finite edge; inserting a collinear vertex does not change the footprint. */
export function insertBoundaryPointAt(points:PlanPoint[],index:number,cursor:PlanPoint):PlanPoint[]{
  if(!Number.isInteger(index)||index<0||index>=points.length)throw Error('Choose an existing deck edge.');
  if(points.length>=64)throw Error('This deck level already has 64 points. Remove a point before adding another.');
  if(!Number.isFinite(cursor.x)||!Number.isFinite(cursor.y))throw Error('Choose a finite position on the edge.');
  const original=boundaryProblem(points);if(original)throw Error(original);
  const a=points[index],b=points[(index+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/(length*length))),point={x:a.x+dx*t,y:a.y+dy*t};
  if(t*length<1||(1-t)*length<1)throw Error('Tap at least 1 inch from either existing corner.');
  const next=points.map(p=>({...p}));next.splice(index+1,0,point);const problem=boundaryProblem(next);if(problem)throw Error(problem);return next;
}
export const removeBoundaryPoint=(points:PlanPoint[],index:number)=>points.filter((_,i)=>i!==index).map(p=>({...p}));
export function boundaryPatch(data:DeckData,level:BoundaryLevel,points:PlanPoint[],offset?:{x:number;y:number},model?:DeckTakeoff):Partial<DeckData>|null{
  if(boundaryProblem(points))return null;
  const before=model?editableBoundaries(data,model).find(b=>b.level===level)?.points:data.deckOutlines?.[boundaryKey(level)]?.map(p=>({x:p.x*12,y:p.y*12}));
  const locks=before?reconcileBoundaryLocks(data,level,before,points):data.boundaryLocks??[];
  if(locks===null||!before&&locks.some(l=>l.level===level))return null;
  const bounds=boundaryBounds(points),patch:Partial<DeckData>={deckOutlines:{...data.deckOutlines,[boundaryKey(level)]:savedBoundary(points)},boundaryLocks:locks.length?locks:undefined};
  if(model){
    const before=editableBoundaries(data,model).find(b=>b.level===level)?.points;
    if(data.boardLayout&&before?.length===points.length){
      const dx=points[0].x-before[0].x,dy=points[0].y-before[0].y;
      // Moving a whole level carries its locally anchored layouts; reshaping an edge never stretches stock.
      if((Math.abs(dx)>1e-7||Math.abs(dy)>1e-7)&&points.every((p,i)=>Math.abs(p.x-before[i].x-dx)<1e-6&&Math.abs(p.y-before[i].y-dy)<1e-6)){
        const shift=(p:PlanPoint)=>({x:p.x+dx,y:p.y+dy});
        patch.boardLayout={regions:data.boardLayout.regions.map(r=>r.level===level?{...r,polygon:r.polygon.map(shift)}:r),breakers:data.boardLayout.breakers.map(b=>b.level===level?{...b,start:shift(b.start),end:shift(b.end)}:b),pieces:data.boardLayout.pieces.map(p=>p.level===level?{...p,cx:p.cx+dx,cy:p.cy+dy,...(p.polygon?{polygon:p.polygon.map(shift)}:{})}:p)};
      }
    }
    const positions={...data.deckOutlineOffsets};
    for(const l of model.levels)if(l.kind==='deck'&&(l.index===1||l.index===2))positions[l.index===1?'second':'third']={x:l.offset.x/12,y:l.offset.z/12};
    if(Object.keys(positions).length)patch.deckOutlineOffsets=positions;
  }
  // Freeze the measured house at its existing world position; deck width changes must not move windows/walls.
  if(level===1){const house=getHousePlacement(data);Object.assign(patch,{width:bounds.w/12,length:bounds.h/12,wrap:undefined,cornerChamfers:undefined,houseConfig:getHouseConfig(data),housePlacement:{anchor:'left',offsetIn:house.x0}});}
  else{
    if(offset)patch.deckOutlineOffsets={...(patch.deckOutlineOffsets??data.deckOutlineOffsets),[boundaryKey(level)]:{x:offset.x/12,y:offset.y/12}};
    if(level===2)Object.assign(patch,{width2:bounds.w/12,length2:bounds.h/12});
    else if(data.level3)patch.level3={...data.level3,widthFt:bounds.w/12,lengthFt:bounds.h/12};
  }
  return patch;
}
