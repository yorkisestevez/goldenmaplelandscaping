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
