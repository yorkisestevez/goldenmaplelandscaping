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
