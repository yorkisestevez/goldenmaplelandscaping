import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff,guardRuns,type DeckTakeoff,type RailRun} from '../src/features/deckcraft/deckTakeoff';
import {finishedFasciaOffset} from '../src/features/deckcraft/lib/finishedFootprint';
import type {DeckData} from '../src/features/deckcraft/types';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
let cases=0;
const len=(r:RailRun)=>Math.hypot(r.a.x-r.b.x,r.a.y-r.b.y,r.a.z-r.b.z);
/**
 * The priced stair guard is the modelled guard, and the drawing only departs from it where a stair's top end joins the
 * deck guard's post, mounted on the boards: the lower end never moves, and the top end moves onto an actual post, at most
 * the 3.6 in mounting inset plus the finished fascia offset (times root 2 where that post is a mitred corner post, as
 * where a wrap-round stair meets the deck corner). Beside a deck corner, a guard stub shorter than one 5 in post plate
 * folds onto the corner post (an empty drawn run), and a stair top on that stub moves onto the corner post: at most the
 * plate width along the edge and the inset across it. Returns the priced sloped lines.
 */
function pricedAndDrawn(data:DeckData,model:DeckTakeoff){
 const lines=guardRuns(model),sloped=lines.filter(r=>!near(r.a.y,r.b.y)),drawn=model.railing.rails.filter((_,i)=>i%2===0),reach=(3.6+finishedFasciaOffset(data))*Math.SQRT2+1e-6,fold=Math.hypot(5,3.6+finishedFasciaOffset(data))+1e-6;
 const folded=(q:{x:number;z:number})=>lines.some((g,j)=>near(g.a.y,g.b.y)&&Math.hypot(drawn[j].b.x-drawn[j].a.x,drawn[j].b.z-drawn[j].a.z)<.01&&near(drawn[j].a.x,q.x)&&near(drawn[j].a.z,q.z));
 assert(near(model.quantities.stairRailingLf,sloped.reduce((n,r)=>n+len(r)/12,0)),'Stair railing quantity is the priced sloped guard lines');
 assert.equal(drawn.length,lines.length,'One drawn run for each priced guard line');
 for(const [i,p] of lines.entries()){
  const d={a:{...drawn[i].a,y:drawn[i].a.y-3},b:{...drawn[i].b,y:drawn[i].b.y-3}},moved=Math.hypot(d.a.x-p.a.x,d.a.z-p.a.z);
  if(near(p.a.y,p.b.y))continue;
  assert(near(d.b.x,p.b.x)&&near(d.b.y,p.b.y)&&near(d.b.z,p.b.z),'A drawn stair rail ends where its priced line ends');
  const limit=moved>reach&&folded(d.a)?fold:reach;
  assert(near(d.a.y,p.a.y)&&moved<=limit,"A drawn stair rail top moves no further than the post mounting inset (or onto a folded stub's corner post)");
  if(moved>1e-6)assert(model.railing.posts.some(q=>near(q.x,d.a.x)&&near(q.z,d.a.z)&&near(q.y,d.a.y)),'A moved stair rail top stands on the deck guard post');
  assert(len(d)-len(p)<=limit,'The drawn stair rail exceeds its priced line only by the joined top end');
 }
 return sloped;
}
for(const stairType of ['Straight','Landing','Winder'] as const)for(const stairPosition of ['Front','Left','Right'] as const)for(const height of [30,72,120]){
 const data:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',levels:1,height,stairFlights:1,stairType,stairPosition,railingType:'Wood Picket'};
 const model=buildDeckTakeoff(data);
 for(const f of model.flights.filter(f=>f.kind==='grade'&&f.type==='Straight'&&!f.id.endsWith('-upper')&&f.risers>1)){
  const runBack=f.run/2,inset=2.5*(Math.abs(f.along!.x)+Math.abs(f.along!.y))+.5;
  for(const side of [-1,1]){const x=f.end.x-f.outward!.x*runBack+f.along!.x*side*(f.width/2-inset),z=f.end.z-f.outward!.y*runBack+f.along!.y*side*(f.width/2-inset);
   assert(model.railing.posts.some(p=>near(p.x,x)&&near(p.z,z)&&near(p.y,f.end.y+f.rise)),'Terminal post reaches the last tread surface');
   const top={x:f.start.x+f.along!.x*side*f.width/2,z:f.start.z+f.along!.y*side*f.width/2};
   assert(guardRuns(model).some(r=>near(r.a.x,top.x)&&near(r.a.z,top.z)&&near(r.a.y,f.start.y)&&near(r.b.x,x)&&near(r.b.z,z)&&near(r.b.y,f.end.y+f.rise)),'The priced stair guard runs from the stair top to the last-tread post');
   for(const dx of [-2.5,2.5])for(const dz of [-2.5,2.5]){const px=x+dx-f.end.x,pz=z+dz-f.end.z;assert(Math.abs(px*f.along!.x+pz*f.along!.y)<f.width/2,'Entire terminal base plate stays inside stair sides');const depth=px*f.outward!.x+pz*f.outward!.y;assert(depth>-f.run&&depth<model.stairSupport.treadNosingIn,'Entire terminal plate rests on last tread');}
   assert(!model.railing.posts.some(p=>near(p.x,f.end.x+f.along!.x*side*f.width/2)&&near(p.z,f.end.z+f.along!.y*side*f.width/2)&&near(p.y,f.end.y)),'No terminal guard post remains at ground endpoint');
  }
 }
 for(const f of model.flights.filter(f=>f.kind==='grade'&&f.risers===1&&!f.id.endsWith('-upper')))assert(!model.railing.posts.some(p=>near(p.y,f.end.y)),'Single final riser does not add a vertical guard down to grade');
 for(const f of model.flights.filter(f=>f.id.endsWith('-upper')))assert(model.railing.posts.some(p=>near(p.y,f.end.y)),'Intermediate landing/winder joins remain');
 pricedAndDrawn(data,model);
 // A framed stair starts at the fascia, 0.75 in out: its top posts join the deck guard posts, so no post stands within
 // an inch of another at the deck top.
 const deckTop=model.railing.posts.filter(p=>near(p.y,model.levels[0].top));
 assert(!deckTop.some((p,i)=>deckTop.some((q,j)=>j>i&&Math.hypot(p.x-q.x,p.z-q.z)<1)),'No duplicate stair-top posts');cases++;
}
// A stair beside a deck corner (or the house): a new design's short guard stub folds onto the corner post, the stair top
// joins it, and no two stair-top or deck posts stand within an inch of each other.
for(const deckType of ['Attached','Freestanding'] as const)for(const stairPosition of ['Front','Left','Right'] as const)for(const rows of [0,1] as const)for(const stairOffset of [0,1,2,3,4,6,8,92,94,96,97,98,99,100]){
 const data:DeckData={...structuredClone(DEFAULT_DECK),deckType,stairPosition,stairOffset,pictureFrameRows:rows,railingType:'Wood Picket'},model=buildDeckTakeoff(data);
 pricedAndDrawn(data,model);
 const deckTop=model.railing.posts.filter(p=>near(p.y,model.levels[0].top));
 assert(!deckTop.some((p,i)=>deckTop.some((q,j)=>j>i&&Math.hypot(p.x-q.x,p.z-q.z)<1)),`${deckType} ${stairPosition} ${stairOffset}% rows ${rows}: no duplicate stair-top posts`);cases++;
}
for(const reverse of [false,true]){const points=[{x:0,y:144},{x:192,y:144},{x:192,y:0}];const data:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',width:16,length:12,height:30,levels:1,pictureFrameRows:0,pattern:'Straight',stairFlights:1,railingType:'Wood Picket',stairPath:{points:reverse?points.reverse():points},stairRiserCount:5,stairTreadDepthIn:12};const model=buildDeckTakeoff(data);pricedAndDrawn(data,model);assert(model.railing.posts.filter(p=>near(p.y,6)).length===2,'Both exposed wrap ends terminate on the final tread');assert(!model.railing.posts.some(p=>near(p.y,0)),'Wrap guard does not drop to grade');for(const post of model.railing.posts.filter(p=>near(p.y,6)))for(const dx of [-2.5,2.5])for(const dz of [-2.5,2.5])assert(model.treads.filter(t=>near(t.y+t.h/2,post.y)&&t.polygon).some(t=>{const p={x:post.x+dx,y:post.z+dz},poly=t.polygon!,cross=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});return cross.every(v=>v>=0)||cross.every(v=>v<=0);}), 'All wrap post plate corners are supported by the last tread');cases++;}
// A design saved before the 2026-10 rules keeps the railing it was quoted with: the stair guards run to grade beyond the
// final riser (no last-tread post), every guard is drawn on its priced line, and each stair top has its own post: shared
// with the deck guard post on an unframed deck, and at the fascia beside the deck guard post on a framed one.
for(const rows of [0,1] as const)for(const stairType of ['Straight','Landing'] as const){
 const data:DeckData={...structuredClone(DEFAULT_DECK),buildRules:'legacy',pictureFrameRows:rows,pictureFrameOverhangIn:1.5,stairType,railingType:'Wood Picket'};
 const model=buildDeckTakeoff(data),sloped=pricedAndDrawn(data,model);
 for(const f of model.flights.filter(f=>f.kind==='grade'&&f.type==='Straight'&&!f.id.endsWith('-upper')&&f.risers>1))for(const side of [-1,1]){
  const foot={x:f.end.x+f.along!.x*side*f.width/2,z:f.end.z+f.along!.y*side*f.width/2};
  assert(sloped.some(r=>near(r.b.x,foot.x)&&near(r.b.z,foot.z)&&near(r.b.y,f.end.y)),'Legacy: the priced stair guard still runs to grade');
  assert(model.railing.posts.some(p=>near(p.x,foot.x)&&near(p.z,foot.z)&&near(p.y,f.end.y)),'Legacy: the stair guard post still stands at grade');
 }
 const tops=model.flights.filter(f=>f.kind==='grade'&&!f.id.startsWith('grade-path')&&near(f.start.y,model.levels[0].top)).flatMap(f=>[-1,1].map(side=>({x:f.start.x+f.along!.x*side*f.width/2,z:f.start.z+f.along!.y*side*f.width/2})));
 // railingLf is summed from the priced guard lines; drawn on them, the bottom rails add up to it exactly.
 assert(model.railing.guardLines===undefined&&near(model.railing.rails.filter((_,i)=>i%2===0).reduce((n,r)=>n+len(r)/12,0),model.quantities.railingLf),'Legacy: every guard is drawn on its priced line');
 const deckEnds=guardRuns(model).filter(r=>near(r.a.y,r.b.y)).flatMap(r=>[r.a,r.b]),fascia=finishedFasciaOffset(data);
 assert(tops.length&&tops.every(t=>model.railing.posts.some(p=>near(p.x,t.x)&&near(p.z,t.z))),'Legacy: each stair top has its own post where its priced guard starts');
 assert(tops.every(t=>deckEnds.some(e=>Math.abs(Math.hypot(e.x-t.x,e.z-t.z)-(rows?fascia:0))<1e-6)),'Legacy: the stair top post is the deck guard post (unframed) or stands at the fascia beside it (framed), as quoted');
 if(rows===0&&stairType==='Straight')assert(Math.abs(model.quantities.stairRailingLf-9.315)<.001,'Legacy: the default stair guard prices 9.315 lf, as at 9b2ee11');
 cases++;
}
console.log('Stair railing termination: '+cases+' scenarios passed');
