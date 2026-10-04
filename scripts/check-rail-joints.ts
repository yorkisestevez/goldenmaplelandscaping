import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {foundationSolids} from '../src/features/deckcraft/foundationDatums';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
let checks=0;
for(const railingType of ['Wood Picket','Aluminum'] as const)for(const foundation of ['Concrete Piers','Helical Piles','Deck Blocks'] as const){
 const data={...structuredClone(DEFAULT_DECK),railingType,foundation,height:72,stairFlights:1};
 const model=buildDeckTakeoff(data);
 for(const spindle of model.railing.balusters)for(const p of [spindle.a,spindle.b]){
  assert(model.railing.rails.some(r=>{const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,t=((p.x-r.a.x)*dx+(p.z-r.a.z)*dz)/(dx*dx+dz*dz);return t>=0&&t<=1&&near(p.x,r.a.x+t*dx)&&near(p.z,r.a.z+t*dz)&&near(p.y,r.a.y+t*(r.b.y-r.a.y));}),'Spindle end is seated inside a rail');checks++;
 }
 for(const f of model.foundationSupports){const {boxes}=foundationSolids(f),post=boxes.find(b=>b.part==='post')!;assert(post);const shoe=boxes.filter(b=>b.part==='post-base');assert(shoe.some(b=>near(b.y+b.h/2,post.y-post.h/2)),'Seat meets timber');assert(shoe.some(b=>near(b.y-b.h/2,f.headTopElevationIn!)),'Steel reaches footing head');assert(shoe.filter(b=>b.h>0).length>=3,'Base has a seat and connected hardware');checks+=3;}
}
console.log('Rail and footing connections: '+checks+' checks passed');
