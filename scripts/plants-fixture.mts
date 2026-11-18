/**
 * The plants-realism demo fixture: every library species in one 34 x 9 ft brown mulch bed out from the deck, a red maple
 * and a serviceberry in its front third (so a trunk base in mulch is in view), four lawn trees behind it, and three small
 * beds side by side (brown, black, cedar with steel edging) for the mulch-colour comparison. Generic plants only: no client
 * data. Writes scripts/fixtures/plants-realism-demo.json (landscapeObjects for a design.patch).
 */
import {writeFileSync} from 'node:fs';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';
import type {LandscapeAssetId,LandscapeObject} from '../src/features/deckcraft/landscapeTypes';

const out:LandscapeObject[]=[];
let n=0;
const plant=(id:string,x:number,z:number)=>{out.push(newLandscapePlant(id,`demo-${n++}`,x,z));};
// Main bed: 408 x 108 in, centred 96 in across and 276 in out from the house.
out.push({...newLandscapeObject('mulch-bed','demo-bed',96,276),widthIn:408,depthIn:108});
// Lawn trees behind the bed.
['acer-saccharum','cercis-canadensis','pinus-strobus','picea-pungens'].forEach((id,i)=>plant(id,-74+i*102,420));
// Back row: hedges and tall shrubs.
['thuja-occidentalis-smaragd','thuja-occidentalis-smaragd','taxus-media','syringa-vulgaris','hydrangea-paniculata','physocarpus-opulifolius','cornus-sericea'].forEach((id,i,a)=>plant(id,-108+408/a.length*(i+.5),312));
// Middle row.
['buxus-microphylla','buxus-microphylla','hydrangea-arborescens-annabelle','spiraea-japonica','calamagrostis-karl-foerster','calamagrostis-karl-foerster','panicum-virgatum','schizachyrium-scoparium'].forEach((id,i,a)=>plant(id,-108+408/a.length*(i+.5),276));
// Front row: perennials, with a red maple and a serviceberry at the two ends so their bases are in view.
plant('acer-rubrum',-84,236);plant('amelanchier-canadensis',276,236);
['hosta','hosta','matteuccia-struthiopteris','echinacea-purpurea','echinacea-purpurea','rudbeckia-hirta','monarda-fistulosa','hemerocallis','nepeta-faassenii','salvia-nemorosa'].forEach((id,i,a)=>plant(id,-40+280/a.length*(i+.5),244));
// Three small beds side by side for the mulch colours; the cedar one has steel edging.
(['mulch-bed','black-mulch-bed','cedar-mulch-bed'] as LandscapeAssetId[]).forEach((asset,i)=>{
 const x=420+i*108;
 out.push({...newLandscapeObject(asset,`swatch-bed-${i}`,x,276),widthIn:96,depthIn:72,...(i===2?{edging:true}:{})});
 plant('hosta',x-24,276);plant('buxus-microphylla',x+24,276);
});
writeFileSync('scripts/fixtures/plants-realism-demo.json',JSON.stringify(out,null,1)+'\n');
console.log(`plants-realism-demo: ${out.length} objects`);
