import assert from 'node:assert/strict';
import {drawingSnap} from '../src/features/deckcraft/designer/drawingSnap';
const points=[{x:0,y:0},{x:100,y:0},{x:100,y:100}];
for(const zoom of [.5,1,2,4]){
 const hit=drawingSnap({x:12/zoom,y:4/zoom},points,[{x:12/zoom,y:4/zoom}],true,22/zoom);
 assert.equal(hit.closing,true);assert.deepEqual(hit.point,points[0]);
 assert.equal(drawingSnap({x:23/zoom,y:0},points,[],true,22/zoom).closing,false);
 assert.equal(drawingSnap({x:0,y:0},points.slice(0,2),[],true,22/zoom).closing,false);
 assert.equal(drawingSnap({x:0,y:0},points,[],false,22/zoom).closing,false);
 const corner={x:200,y:200};assert.deepEqual(drawingSnap({x:200+10/zoom,y:200},points,[corner],true,22/zoom).point,corner);
}
console.log('Drawing snap: 24 assertions passed across four zoom scales.');

// Patios and walls snap to the deck's corners (each level at its offset) and to the house corners.
const {siteSnapPoints}=await import('../src/features/deckcraft/designer/drawingSnap');
{
 const levels=[{footprint:{outline:[{x:0,y:0},{x:144,y:0},{x:144,y:120}]},offset:{x:0,z:0}},{footprint:{outline:[{x:0,y:0},{x:48,y:0}]},offset:{x:144,z:24}}];
 const targets=siteSnapPoints(levels,[[{x:-50,y:-200},{x:300,y:-200}]]);
 assert.deepEqual(targets,[{x:0,y:0},{x:144,y:0},{x:144,y:120},{x:144,y:24},{x:192,y:24},{x:-50,y:-200},{x:300,y:-200}]);
 assert.deepEqual(drawingSnap({x:150,y:126},[],targets,true,22).point,{x:144,y:120});
 assert.deepEqual(siteSnapPoints([]),[]);
}
console.log('Site snap targets: deck corners at level offsets and house corners.');
