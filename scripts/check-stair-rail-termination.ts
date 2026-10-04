import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import type {DeckData} from '../src/features/deckcraft/types';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
let cases=0;
for(const stairType of ['Straight','Landing','Winder'] as const)for(const stairPosition of ['Front','Left','Right'] as const)for(const height of [30,72,120]){
 const data:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',levels:1,height,stairFlights:1,stairType,stairPosition,railingType:'Wood Picket'};
 const model=buildDeckTakeoff(data);
 for(const f of model.flights.filter(f=>f.kind==='grade'&&f.type==='Straight'&&!f.id.endsWith('-upper')&&f.risers>1)){
  const runBack=f.run/2,inset=2.5*(Math.abs(f.along!.x)+Math.abs(f.along!.y))+.5;
  for(const side of [-1,1]){const x=f.end.x-f.outward!.x*runBack+f.along!.x*side*(f.width/2-inset),z=f.end.z-f.outward!.y*runBack+f.along!.y*side*(f.width/2-inset);
   assert(model.railing.posts.some(p=>near(p.x,x)&&near(p.z,z)&&near(p.y,f.end.y+f.rise)),'Terminal post reaches the last tread surface');
   for(const dx of [-2.5,2.5])for(const dz of [-2.5,2.5]){const px=x+dx-f.end.x,pz=z+dz-f.end.z;assert(Math.abs(px*f.along!.x+pz*f.along!.y)<f.width/2,'Entire terminal base plate stays inside stair sides');const depth=px*f.outward!.x+pz*f.outward!.y;assert(depth>-f.run&&depth<model.stairSupport.treadNosingIn,'Entire terminal plate rests on last tread');}
   assert(!model.railing.posts.some(p=>near(p.x,f.end.x+f.along!.x*side*f.width/2)&&near(p.z,f.end.z+f.along!.y*side*f.width/2)&&near(p.y,f.end.y)),'No terminal guard post remains at ground endpoint');
  }
 }
 for(const f of model.flights.filter(f=>f.kind==='grade'&&f.risers===1&&!f.id.endsWith('-upper')))assert(!model.railing.posts.some(p=>near(p.y,f.end.y)),'Single final riser does not add a vertical guard down to grade');
 for(const f of model.flights.filter(f=>f.id.endsWith('-upper')))assert(model.railing.posts.some(p=>near(p.y,f.end.y)),'Intermediate landing/winder joins remain');
 assert(near(model.quantities.stairRailingLf,model.railing.rails.filter(r=>!near(r.a.y,r.b.y)).reduce((n,r)=>n+Math.hypot(r.a.x-r.b.x,r.a.y-r.b.y,r.a.z-r.b.z)/24,0)),'Railing quantity follows both modeled rail runs');cases++;
}
for(const reverse of [false,true]){const points=[{x:0,y:144},{x:192,y:144},{x:192,y:0}];const data:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',width:16,length:12,height:30,levels:1,pictureFrameRows:0,pattern:'Straight',stairFlights:1,railingType:'Wood Picket',stairPath:{points:reverse?points.reverse():points},stairRiserCount:5,stairTreadDepthIn:12};const model=buildDeckTakeoff(data);assert(model.railing.posts.filter(p=>near(p.y,6)).length===2,'Both exposed wrap ends terminate on the final tread');assert(!model.railing.posts.some(p=>near(p.y,0)),'Wrap guard does not drop to grade');for(const post of model.railing.posts.filter(p=>near(p.y,6)))for(const dx of [-2.5,2.5])for(const dz of [-2.5,2.5])assert(model.treads.filter(t=>near(t.y+t.h/2,post.y)&&t.polygon).some(t=>{const p={x:post.x+dx,y:post.z+dz},poly=t.polygon!,cross=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});return cross.every(v=>v>=0)||cross.every(v=>v<=0);}), 'All wrap post plate corners are supported by the last tread');cases++;}
console.log('Stair railing termination: '+cases+' scenarios passed');
