import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
let checks=0;
for(const stairType of ['Straight','Landing','Winder'] as const)for(const rows of [0,1,2] as const)for(const stairPosition of ['Front','Left','Right'] as const){
 const d={...structuredClone(DEFAULT_DECK),deckType:'Freestanding' as const,levels:1,height:72,stairFlights:1,stairPosition,stairType,pictureFrameRows:rows,pattern:'Straight' as const,railingType:'Aluminum' as const};const m=buildDeckTakeoff(d),level=m.levels[0],outline=(level.deckingFootprint??level.footprint).outline;
 for(const p of m.railing.posts.filter(p=>Math.abs(p.y-level.top)<.001)){const plate=[{x:p.x-2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z+2.5},{x:p.x-2.5,y:p.z+2.5}];assert(polygonCut([plate],[outline],true).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Whole deck post plate sits on finished decking');checks++;}
 const boards=getStairBoards(d,m);assert(boards.length);assert.equal(boards.some(b=>b.role==='border'),rows>0);checks++;
 for(const b of boards){assert(b.w<=m.stockLength+.001&&b.d<=d.boardWidth+.001,'Every trim and field piece respects stock dimensions');assert(b.polygon?.length);checks++;}
 for(let i=0;i<boards.length;i++)for(let j=i+1;j<boards.length;j++){const a=boards[i],b=boards[j];if(Math.abs(a.y-b.y)>.001)continue;assert(polygonCut([a.polygon!],[b.polygon!]).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Trim and field boards do not overlap');checks++;}
}
console.log('Picture frame and railing seating: '+checks+' checks passed');
