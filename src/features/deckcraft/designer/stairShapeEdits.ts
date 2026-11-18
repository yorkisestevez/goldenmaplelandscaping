import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {getHouseContact} from '../houseContact';
import {resolveStairPath,stairPathOffset} from '../lib/stairPath';
import type {PlanPoint} from '../lib/deckGeometry';
import {primaryStair} from './planEditMath';
export function stairShapeContext(data:DeckData,model:DeckTakeoff){
 const decks=model.levels.map((l,i)=>({l,i})).filter(({l,i})=>i===0||l.kind==='deck');
 const {l:level,i:index}=decks.reduce((a,b)=>b.l.top<=a.l.top?b:a);
 const primary=primaryStair(data,model),shift={x:level.offset.x,y:level.offset.z};
 const points=data.stairPath?.points.map(p=>({...p}))??(primary?[{x:primary.centre.x-primary.dir.x*primary.width/2-shift.x,y:primary.centre.y-primary.dir.y*primary.width/2-shift.y},{x:primary.centre.x+primary.dir.x*primary.width/2-shift.x,y:primary.centre.y+primary.dir.y*primary.width/2-shift.y}]:[]);
 const contact=index===0?getHouseContact(data,level.footprint):undefined;
 const occupied=model.connections.filter(c=>c.from===index).map(c=>c.opening);
 const flight=model.flights.find(f=>f.kind==='grade'),risers=flight?.risers??Math.ceil(level.top/7.75),tread=flight?.run??11;
 const resolve=(p:PlanPoint[])=>resolveStairPath({stairPath:{points:p}},level.footprint,contact,occupied);
 return {level,index,primary,shift,points,resolve,risers,tread};
}
export type StairShapeContext=ReturnType<typeof stairShapeContext>;
export function resizeStairPoint(data:DeckData,c:StairShapeContext,index:number,cursor:PlanPoint):Partial<DeckData>{
 const result=c.resolve(c.points);if(!result.segments.length)throw Error(result.issues[0]);
 if(index!==0&&index!==c.points.length-1)throw Error('Corner points stay on deck corners. Pull an end point to change the width.');
 const first=index===0,s=first?result.segments[0]:result.segments.at(-1)!,anchor=first?c.points[1]:c.points.at(-2)!,u={x:s.along.x*(first?-1:1),y:s.along.y*(first?-1:1)},outline=c.level.footprint.outline,a=outline[s.edgeIndex!],b=outline[(s.edgeIndex!+1)%outline.length];
 const max=Math.min(data.stairPath?720:120,Math.max((a.x-anchor.x)*u.x+(a.y-anchor.y)*u.y,(b.x-anchor.x)*u.x+(b.y-anchor.y)*u.y));
 if(max<36)throw Error('Keep at least 36 inches of stair width.');
 const width=Math.max(36,Math.min(max,Math.round((cursor.x-anchor.x)*u.x+(cursor.y-anchor.y)*u.y))),points=c.points.map(p=>({...p}));points[index]={x:anchor.x+u.x*width,y:anchor.y+u.y*width};
 const valid=c.resolve(points);if(valid.issues.length)throw Error(valid.issues[0]);
 if(data.stairPath)return {stairPath:{points}};
 const primary=c.primary!,centre={x:(points[0].x+points[1].x)/2+c.shift.x,y:(points[0].y+points[1].y)/2+c.shift.y},along=(centre.x-primary.a.x)*primary.dir.x+(centre.y-primary.a.y)*primary.dir.y,free=primary.len-width;
 return {stairWidth:width,stairOffset:free?Math.max(0,Math.min(100,(along-width/2)/free*100)):50};
}
export function extendStairPoints(c:StairShapeContext,atStart:boolean):Partial<DeckData>{
 const points=atStart?[...c.points].reverse():[...c.points],resolved=c.resolve(points);if(resolved.issues.length)throw Error(resolved.issues[0]);if(points.length>=9)throw Error('This stair path already has 9 points.');
 const last=resolved.segments.at(-1)!,o=c.level.footprint.outline,edge=last.edgeIndex!,a=o[edge],b=o[(edge+1)%o.length],forward=(b.x-a.x)*last.along.x+(b.y-a.y)*last.along.y>0,corner=forward?b:a,next=o[(edge+(forward?2:-1)+o.length)%o.length],length=Math.hypot(next.x-corner.x,next.y-corner.y);
 if(length<36)throw Error('The next deck edge is too short for stairs.');
 const distance=Math.min(48,length),end={x:corner.x+(next.x-corner.x)*distance/length,y:corner.y+(next.y-corner.y)*distance/length};points[points.length-1]={...corner};points.push(end);
 const candidate=atStart?points.reverse():points,valid=c.resolve(candidate);if(valid.issues.length)throw Error(valid.issues[0]);return {stairPath:{points:candidate},stairFlights:1};
}
export function stairShapePolygon(c:StairShapeContext,points:PlanPoint[],tread=c.tread){const r=c.resolve(points);if(!r.segments.length)return [];return [...points,...stairPathOffset(r.segments,Math.max(1,c.risers-1)*tread).reverse()].map(p=>({x:p.x+c.shift.x,y:p.y+c.shift.y}));}
