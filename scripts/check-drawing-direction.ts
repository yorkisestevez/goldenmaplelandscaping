import assert from 'node:assert/strict';
import {createDrawingDirection} from '../src/features/deckcraft/designer/drawingDirection';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const angle of [0,27,45,90,135,210]){
 const lock=createDrawingDirection(),r=angle*Math.PI/180,from={x:31,y:72},v={x:Math.cos(r),y:Math.sin(r)};
 lock.point(from,{x:from.x+v.x*40,y:from.y+v.y*40},false);
 const p=lock.point(from,{x:from.x+v.x*80-v.y*23,y:from.y+v.y*80+v.x*23},true);
 near(p.x,from.x+v.x*80);near(p.y,from.y+v.y*80);
 lock.release();lock.point(from,{x:from.x+20,y:from.y},false);near(lock.point(from,{x:from.x+50,y:from.y+30},true).y,from.y);
 lock.reset();assert.deepEqual(lock.point(undefined,{x:1,y:2},true),{x:1,y:2});
}
console.log('Direction lock: 24 assertions passed, including unrounded diagonals, release, and reset.');

// Shift-held drawing still closes and snaps: closing on the first point wins, another endpoint sets the length along
// the held bearing, and with nothing in reach the held point is kept.
const {lockedSnap}=await import('../src/features/deckcraft/designer/drawingDirection');
const {drawingSnap}=await import('../src/features/deckcraft/designer/drawingSnap');
{
 const pts=[{x:0,y:0},{x:120,y:0},{x:120,y:96}],from=pts[2],lock=createDrawingDirection();
 lock.point(from,{x:60,y:96},false);
 const held=(to:{x:number;y:number})=>lock.point(from,to,true),snap=(p:{x:number;y:number})=>drawingSnap(p,pts,[...pts,{x:40,y:90}],true,22);
 const back=lockedSnap(held({x:-3,y:110}),snap,held);assert.ok(back.closing===false,'a point away from the first corner does not close');
 const far=lockedSnap(held({x:300,y:400}),snap,held);assert.equal(far.closing,false);near(far.point.y,96);
 const toCorner=lockedSnap(held({x:44,y:120}),snap,held);assert.equal(toCorner.closing,false);near(toCorner.point.x,40);near(toCorner.point.y,96);
 const lock2=createDrawingDirection(),from2=pts[2];lock2.point(from2,{x:120,y:40},false);
 const up=(to:{x:number;y:number})=>lock2.point(from2,to,true),closing=lockedSnap(up({x:110,y:8}),p=>drawingSnap(p,pts,pts,true,22),up);
 assert.equal(closing.closing,false,'the held line never reaches the first corner from straight above the third');
 const lock3=createDrawingDirection(),from3={x:96,y:4};lock3.point(from3,{x:50,y:2},false);
 const left=(to:{x:number;y:number})=>lock3.point(from3,to,true),closes=lockedSnap(left({x:6,y:-30}),p=>drawingSnap(p,pts,pts,true,22),left);
 assert.equal(closes.closing,true,'Shift-held drawing closes on the first point');assert.deepEqual(closes.point,pts[0]);
}
console.log('Shift-held snapping: closing wins, endpoints set the length, the bearing holds.');
